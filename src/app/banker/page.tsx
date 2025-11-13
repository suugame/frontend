'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { RefreshCw, AlertTriangle, BarChart, Coins, Building2 } from 'lucide-react';
import {
  getContractInfo,
  getContractBalances,
  createDepositTransaction,
  createWithdrawTransaction,
} from '@/sui';
import type { ContractInfo } from '@/sui';
import { Message } from '@/components';
import type { MessageType } from '@/components/Message';
import { useI18n } from '@/i18n/useI18n';
// import { envConfig } from '@/config/environment';

// const CONTRACT_OBJECT_ID = envConfig.contractObjectId; // 可用于调试显示
// const CONTRACT_PACKAGE_ID = envConfig.contractPackageId; // 可用于调试显示

// 格式化为SUI显示（MIST转SUI）
function formatSUI(mist: string | number): string {
  const num = typeof mist === 'string' ? BigInt(mist) : BigInt(mist);
  const sui = Number(num) / 1e9;
  return sui.toFixed(4);
}

export default function BankerPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { t } = useI18n();

  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lockedBalance, setLockedBalance] = useState<string>('0');
  const [withdrawableBalance, setWithdrawableBalance] = useState<string>('0');
  
  // 存款相关状态
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  
  // 提现相关状态
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  // 已移除：NFT管理与配置管理相关状态

  // Message 通知状态
  const [messageConfig, setMessageConfig] = useState<{
    type: MessageType;
    title?: string;
    message: string;
    autoClose?: boolean;
  } | null>(null);

  // 显示 Message 的辅助函数
  const showMessage = (
    type: MessageType,
    message: string,
    title?: string,
    autoClose = true
  ) => {
    setMessageConfig({
      type,
      title,
      message,
      autoClose,
    });
  };

  // 获取合约信息
  const fetchContractInfo = async () => {
    setRefreshing(true);
    try {
      const info = await getContractInfo();
      setContractInfo(info);
    } catch (error) {
      console.error('获取合约信息失败:', error);
      showMessage('error', t('admin.fetchContractInfoFailPrefix') + ' ' + (error instanceof Error ? error.message : t('common.unknown')));
    } finally {
      setRefreshing(false);
    }
  };

  // 获取合约拆分余额（不可提款与可提款）
  const fetchContractBalances = async () => {
    try {
      const b = await getContractBalances();
      setLockedBalance(b.locked);
      setWithdrawableBalance(b.withdrawable);
    } catch (error) {
      console.error('获取合约拆分余额失败:', error);
    }
  };

  // 根据当前账户与合约信息动态计算是否管理员，避免首次渲染时的竞态
  const isBanker = useMemo(() => {
    const banker = contractInfo?.banker;
    const addr = account?.address;
    if (!banker || !addr) return false;
    try {
      return normalizeSuiAddress(banker) === normalizeSuiAddress(addr);
    } catch {
      // 如果归一化失败，退回到不区分大小写的比较
      return banker.toLowerCase() === addr.toLowerCase();
    }
  }, [contractInfo?.banker, account?.address]);

  // 已移除：获取游戏配置

  useEffect(() => {
    fetchContractInfo();
    fetchContractBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  // 存款
  const handleDeposit = () => {
    if (!account || !isBanker) {
      showMessage('warning', t('admin.actions.onlyAdmin'));
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      showMessage('warning', t('admin.deposit.enterValidAmount'));
      return;
    }

    const amountMist = Math.floor(amount * 1e9); // 转换为MIST
    setDepositing(true);

    try {
      const tx = createDepositTransaction(amountMist);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('存款成功:', result);
            showMessage('success', t('admin.deposit.success'));
            setDepositAmount('');
            setTimeout(() => {
              fetchContractInfo();
            }, 2000);
            setDepositing(false);
          },
          onError: (error) => {
            console.error('存款失败:', error);
            showMessage('error', t('admin.deposit.failPrefix') + ' ' + (error.message || t('common.unknown')));
            setDepositing(false);
          },
        }
      );
    } catch (error) {
      console.error('创建交易失败:', error);
      setDepositing(false);
    }
  };

  // 提现
  const handleWithdraw = () => {
    if (!account || !isBanker) {
      showMessage('warning', t('admin.actions.onlyAdmin'));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showMessage('warning', t('admin.withdraw.enterValidAmount'));
      return;
    }

    if (BigInt(withdrawableBalance || '0') < BigInt(Math.floor(amount * 1e9))) {
      showMessage('warning', t('admin.withdraw.insufficientBalance'));
      return;
    }

    const amountMist = Math.floor(amount * 1e9); // 转换为MIST
    setWithdrawing(true);

    try {
      const tx = createWithdrawTransaction(amountMist);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('提现成功:', result);
            showMessage('success', t('admin.withdraw.success'));
            setWithdrawAmount('');
            setTimeout(() => {
              fetchContractInfo();
            }, 2000);
            setWithdrawing(false);
          },
          onError: (error) => {
            console.error('提现失败:', error);
            showMessage('error', t('admin.withdraw.failPrefix') + ' ' + (error.message || t('common.unknown')));
            setWithdrawing(false);
          },
        }
      );
    } catch (error) {
      console.error('创建交易失败:', error);
      setWithdrawing(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 font-sans">
      {/* Message 通知 */}
      {messageConfig && (
        <Message
          type={messageConfig.type}
          title={messageConfig.title}
          message={messageConfig.message}
          autoClose={messageConfig.autoClose}
          onClose={() => setMessageConfig(null)}
        />
      )}

      {/* 顶部导航栏 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Building2 className="w-7 h-7" /> {t('admin.title')}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                fetchContractInfo();
                fetchContractBalances();
              }}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {refreshing ? (
                t('admin.refreshing')
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> {t('admin.refresh')}
                </>
              )}
            </button>
            <ConnectButton />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 权限检查（仅在已获取合约信息后再判断） */}
        {account && contractInfo && !isBanker && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {t('admin.warningNotAdmin')}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-2">
              {t('admin.bankerAddress')} {contractInfo?.banker || t('common.loading')}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">
              {t('admin.currentAddress')} {account.address}
            </p>
          </div>
        )}

        {/* 合约信息卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <BarChart className="w-6 h-6" /> {t('admin.contractInfo')}
          </h2>
          {contractInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.bankerAddress')}</p>
                <p className="text-lg font-mono text-blue-600 dark:text-blue-400 break-all">
                  {contractInfo.banker}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.contractBalance')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatSUI(contractInfo.contractBalance)} SUI
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.totalMinted')}</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {contractInfo.totalMinted}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          )}

          {/* 拆分余额展示：可提款与不可提款 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.withdraw.availablePrefix')}</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatSUI(withdrawableBalance)} SUI
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.lockedBalance')}</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {formatSUI(lockedBalance)} SUI
              </p>
            </div>
          </div>
        </div>

        {/* 资金管理 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 存款卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Coins className="w-6 h-6" /> {t('admin.deposit.title')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.deposit.amountLabel')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={!isBanker || depositing}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="0.0000"
                />
              </div>
              <button
                onClick={handleDeposit}
                disabled={!isBanker || depositing || !depositAmount}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {depositing ? t('admin.deposit.processing') : t('admin.deposit.confirm')}
              </button>
            </div>
          </div>

          {/* 提现卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              💸 {t('admin.withdraw.title')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.withdraw.amountLabel')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  disabled={!isBanker || withdrawing}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="0.0000"
                />
                {contractInfo && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('admin.withdraw.availablePrefix')} {formatSUI(withdrawableBalance)} SUI
                  </p>
                )}
              </div>
              <button
                onClick={handleWithdraw}
                disabled={!isBanker || withdrawing || !withdrawAmount}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {withdrawing ? t('admin.withdraw.processing') : t('admin.withdraw.confirm')}
              </button>
            </div>
          </div>
        </div>

        {/* 已移除：NFT 管理与游戏配置管理模块 */}
      </div>
    </div>
  );
}
