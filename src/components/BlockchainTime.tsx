'use client';

import { useEffect, useState } from 'react';
import { getChainTimestamp, getContractDeployTime } from '@/sui';
import { Globe, Laptop, Clock, CheckCircle, AlertTriangle, Package, FileText, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface TimeInfo {
  chainTimestamp: number | null;
  chainTimeString: string;
  localTimestamp: number;
  localTimeString: string;
  timeDifference: number;
  deployTimestamp: number | null;
  deployTimeString: string;
  network: string;
}

export default function BlockchainTime() {
  const { t } = useI18n();
  const [timeInfo, setTimeInfo] = useState<TimeInfo>({
    chainTimestamp: null,
    chainTimeString: t('common.loading'),
    localTimestamp: Date.now(),
    localTimeString: new Date().toISOString(),
    timeDifference: 0,
    deployTimestamp: null,
    deployTimeString: '-',
    network: '-',
  });

  const [loading, setLoading] = useState(false);

  // 更新本地时间
  const updateLocalTime = () => {
    const now = Date.now();
    setTimeInfo((prev) => ({
      ...prev,
      localTimestamp: now,
      localTimeString: new Date(now).toISOString(),
    }));
  };

  // 获取链上时间
  const fetchChainTime = async () => {
    setLoading(true);
    try {
      // 从 Sui 链上获取真实时间（直接读取 Clock 对象）
      const chainTime = await getChainTimestamp();
      
      // 获取部署时间
      const deployTime = await getContractDeployTime();
      
      setTimeInfo((prev) => ({
        ...prev,
        chainTimestamp: chainTime,
        chainTimeString: new Date(chainTime).toISOString(),
        timeDifference: chainTime - prev.localTimestamp,
        deployTimestamp: deployTime,
        deployTimeString: deployTime ? new Date(deployTime).toISOString() : '-',
        network: 'SUI',
      }));
      
      // 不再使用外部时间合约，直接使用链上Clock与部署交易时间
    } catch (err: unknown) {
      console.error('获取链上时间失败:', err);
      const errorMessage = err instanceof Error ? err.message : '无法连接到 Sui 网络';
      setTimeInfo((prev) => ({
        ...prev,
        chainTimeString: `获取失败: ${errorMessage}`,
      }));
    } finally {
      setLoading(false);
    }
  };

  // 每秒更新本地时间
  useEffect(() => {
    updateLocalTime();
    const interval = setInterval(updateLocalTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 获取链上时间
  useEffect(() => {
    fetchChainTime();
    const interval = setInterval(fetchChainTime, 5000); // 每5秒更新一次链上时间
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          {t('game.blockchainTime.title')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 链上时间 */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <Globe className="w-5 h-5" /> {t('game.blockchainTime.chainTime')}
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.readable')}</span>
                <p className="text-xl font-mono text-blue-900 dark:text-blue-100">
                  {timeInfo.chainTimeString}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.timestamp')}</span>
                <p className="text-lg font-mono text-blue-700 dark:text-blue-300">
                  {timeInfo.chainTimestamp ? `${timeInfo.chainTimestamp}ms` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* 本地时间 */}
          <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-green-900 dark:text-green-100 flex items-center gap-2">
              <Laptop className="w-5 h-5" /> {t('game.blockchainTime.localTime')}
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.readable')}</span>
                <p className="text-xl font-mono text-green-900 dark:text-green-100">
                  {timeInfo.localTimeString}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.timestamp')}</span>
                <p className="text-lg font-mono text-green-700 dark:text-green-300">
                  {timeInfo.localTimestamp}ms
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 时间差 */}
        <div className="mt-6 bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-500 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-purple-900 dark:text-purple-100 flex items-center gap-2">
            <Clock className="w-5 h-5" /> {t('game.blockchainTime.timeDelta')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.deltaMs')}</span>
              <p className="text-2xl font-mono text-purple-900 dark:text-purple-100">
                {timeInfo.timeDifference !== 0 ? `${timeInfo.timeDifference}ms` : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.deltaSec')}</span>
              <p className="text-2xl font-mono text-purple-900 dark:text-purple-100">
                {timeInfo.timeDifference !== 0 ? `${(timeInfo.timeDifference / 1000).toFixed(2)}s` : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.status')}</span>
              <p className={`text-2xl font-mono flex items-center gap-2 ${Math.abs(timeInfo.timeDifference) < 1000 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(timeInfo.timeDifference) < 1000 ? (
                  <>
                    <CheckCircle className="w-6 h-6" /> {t('game.blockchainTime.synced')}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-6 h-6" /> {t('game.blockchainTime.unsynced')}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* 部署时间信息 */}
        {timeInfo.deployTimestamp && (
          <div className="mt-6 bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-500 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
              <Package className="w-5 h-5" /> {t('game.blockchainTime.deployTitle')}
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.network')}</span>
                <p className="text-lg font-mono text-indigo-900 dark:text-indigo-100">
                  {timeInfo.network}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.deployUtc')}</span>
                <p className="text-xl font-mono text-indigo-900 dark:text-indigo-100">
                  {timeInfo.deployTimeString}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('game.blockchainTime.ago')}</span>
                <p className="text-lg font-mono text-indigo-700 dark:text-indigo-300">
                  {timeInfo.deployTimestamp && timeInfo.localTimestamp
                    ? `${Math.floor((timeInfo.localTimestamp - timeInfo.deployTimestamp) / 1000 / 60)} ${t('common.unit.minuteShort')}`
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 说明 */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-500 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
            <FileText className="w-5 h-5" /> {t('game.blockchainTime.infoTitle')}
          </h3>
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1 list-disc list-inside">
            <li>{t('game.blockchainTime.noteUTC')}</li>
            <li>{t('game.blockchainTime.noteClock')}</li>
            <li>{t('game.blockchainTime.noteDeploy')}</li>
            <li>{t('game.blockchainTime.noteDelay')}</li>
            <li>{t('game.blockchainTime.noteIdeal')}</li>
          </ul>
        </div>

        {/* 按钮 */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={fetchChainTime}
            disabled={loading}
            className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <>
                <Clock className="w-5 h-5" /> {t('common.loading')}
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" /> {t('game.blockchainTime.refreshChain')}
              </>
            )}
          </button>
          <button
            onClick={updateLocalTime}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <Clock className="w-5 h-5" /> {t('game.blockchainTime.refreshLocal')}
          </button>
        </div>
      </div>
    </div>
  );
}

