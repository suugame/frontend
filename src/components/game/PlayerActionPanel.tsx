'use client';

import { formatTime } from '@/utils/gameHelpers';
import { Clock, Target, Sword, CheckCircle } from 'lucide-react';
import BuyNftButton from './BuyNftButton';
import { useI18n } from '@/i18n/I18nProvider';

interface PlayerActionPanelProps {
  hasPlayerNFT: boolean;
  hasEnemy: boolean;
  isConnected: boolean;
  battling: boolean;
  battleCommitmentId: string | null;
  battleSecret: string | null;
  battleCountdown: number;
  battleRevealDelaySeconds: number;
  isGoldenMonster: boolean;
  capturing: boolean;
  captureCommitmentId: string | null;
  captureSecret: string | null;
  captureCountdown: number;
  captureRevealDelaySeconds: number;
  onBuyNFTSuccess: () => void;
  onBattleCommit: () => void;
  onBattleReveal: () => void;
  onCaptureCommit: () => void;
  onCaptureReveal: () => void;
}

export default function PlayerActionPanel({
  hasPlayerNFT,
  hasEnemy,
  isConnected,
  battling,
  battleCommitmentId,
  battleSecret,
  battleCountdown,
  battleRevealDelaySeconds,
  isGoldenMonster,
  capturing,
  captureCommitmentId,
  captureSecret,
  captureCountdown,
  captureRevealDelaySeconds,
  onBuyNFTSuccess,
  onBattleCommit,
  onBattleReveal,
  onCaptureCommit,
  onCaptureReveal,
}: PlayerActionPanelProps) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-3 md:p-6 border-2 md:border-4 border-green-600 w-full h-full flex flex-col">
      <h3 className="text-base md:text-xl font-bold text-white mb-3 md:mb-4 text-center">
        {t('game.playerActions.panelTitle')}
      </h3>

      {/* 未连接钱包 */}
      {!isConnected && (
        <div className="text-center text-gray-400 text-sm py-8">
          {t('game.playerActions.connectWallet')}
        </div>
      )}

      {/* 已连接但没有NFT */}
      {isConnected && !hasPlayerNFT && (
        <div className="space-y-3">
          <div className="text-center text-gray-400 text-sm mb-4">
            {t('game.playerActions.buyToStart')}
          </div>
          <BuyNftButton 
            onSuccess={onBuyNFTSuccess}
            className="w-full py-2 text-sm md:text-base"
            variant="primary"
          />
        </div>
      )}

      {/* 有NFT - 显示操作 */}
      {hasPlayerNFT && (() => {
        // 判断是否有任何可操作内容
        const hasAnyAction = 
          (battleCommitmentId && battleSecret) || // 有战斗承诺
          (captureCommitmentId && captureSecret) || // 有抓捕承诺
          (hasEnemy && !battleCommitmentId && !captureCommitmentId); // 有敌人且没有承诺

        return (
          <div className="space-y-3 h-full flex flex-col">
            {/* 战斗倒计时 */}
            {battleCommitmentId && battleSecret && battleCountdown > 0 && (
              <div className="bg-orange-900/30 rounded-lg p-3 md:p-4 border border-orange-500/30">
                <div className="text-orange-300 text-xs md:text-sm font-bold mb-2 text-center flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" /> {t('game.playerActions.battleCooldown')}
                </div>
                <div className="text-2xl md:text-3xl font-mono text-orange-400 mb-2 text-center">
                  {formatTime(battleCountdown)}
                </div>
                <div className="text-gray-400 text-[10px] md:text-xs text-center">
                  {t('game.playerActions.remaining')} {formatTime(battleCountdown)} {t('game.playerActions.waitingSettlement')}
                </div>
                <div className="text-gray-500 text-[10px] md:text-xs mt-1 text-center">
                  {t('game.playerActions.totalDuration')}: {formatTime(battleRevealDelaySeconds)}
                </div>
              </div>
            )}

            {/* 抓宠按钮（仅普通怪物显示，且没有战斗或抓捕承诺时） */}
            {hasEnemy && !battleCommitmentId && !captureCommitmentId && !isGoldenMonster && (
              <button
                onClick={onCaptureCommit}
                disabled={capturing || battling || !isConnected}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-bold py-2 md:py-3 px-4 rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
              >
                {capturing ? t('game.playerActions.capturing') : (
                  <>
                    <Target className="w-4 h-4" /> {t('game.playerActions.captureMonster')}
                  </>
                )}
              </button>
            )}

            {/* 抓捕结算按钮 */}
            {captureCommitmentId && captureSecret && (
              <div className="space-y-2">
                <button
                  onClick={onCaptureReveal}
                  disabled={captureCountdown > 0 || capturing || !isConnected}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-bold py-2 md:py-3 px-4 rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
                >
                  {capturing
                    ? t('game.playerActions.settlementPending')
                    : captureCountdown > 0
                    ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {t('game.playerActions.waitingSettlement')} ({formatTime(captureCountdown)})
                      </span>
                    )
                    : (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> {t('game.playerActions.captureSettlement')}
                      </span>
                    )}
                </button>
                {captureCountdown > 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    {t('game.playerActions.waitBeforeReveal', { time: formatTime(captureRevealDelaySeconds) })}
                  </p>
                )}
              </div>
            )}

            {/* 开始战斗按钮（没有抓捕承诺时才显示） */}
            {hasEnemy && !battleCommitmentId && !captureCommitmentId && (
              <button
                onClick={onBattleCommit}
                disabled={battling || capturing || !isConnected}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold py-2 md:py-3 px-4 rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
              >
                {battling ? t('game.playerActions.battling') : (
                  <>
                    <Sword className="w-4 h-4" /> {t('game.playerActions.startBattle')}
                  </>
                )}
              </button>
            )}

            {/* 结算战斗按钮 */}
            {battleCommitmentId && battleSecret && battleCountdown === 0 && (
              <button
                onClick={onBattleReveal}
                disabled={battling || !isConnected}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white font-bold py-2 md:py-3 px-4 rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
              >
                {battling ? t('game.playerActions.settlementPending') : (
                  <>
                    <Target className="w-4 h-4" /> {t('game.playerActions.settleBattle')}
                  </>
                )}
              </button>
            )}

            {/* 暂无可操作内容 */}
            {!hasAnyAction && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="alert alert-warning bg-yellow-500/10 border-yellow-500/30 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <div>
                      <div className="font-bold text-sm">{t('game.playerActions.noActions')}</div>
                      <div className="text-xs mt-1">{t('game.playerActions.randomizeFirst')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

