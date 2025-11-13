import { EnemyInfo } from '@/sui';
import { getElementKey, getMonsterTypeName, formatTime } from '@/utils/gameHelpers';
import { Coins, Clock, RefreshCw } from 'lucide-react';
import AvatarDisplay from './AvatarDisplay';
import { useI18n } from '@/i18n/I18nProvider';

interface EnemyCardProps {
  enemyInfo: EnemyInfo | null;
  hasPlayerNFT: boolean;
  hasBattleCommitment: boolean;
  enemyCooldownRemaining: number;
  enemyRerandomCooldownSeconds: number;
  randomizing: boolean;
  isConnected: boolean;
  onRandomEnemy: () => void;
}

export default function EnemyCard({
  enemyInfo,
  hasPlayerNFT,
  hasBattleCommitment,
  enemyCooldownRemaining,
  enemyRerandomCooldownSeconds,
  randomizing,
  isConnected,
  onRandomEnemy,
}: EnemyCardProps) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-3 md:p-6 border-2 md:border-4 border-red-600 w-full h-full flex flex-col">
      <div className="text-right mb-2 md:mb-4">
        <h3 className="text-base md:text-xl font-bold text-white">
          {enemyInfo ? (
            enemyInfo.isGoldenMonster ? (
              <span className="flex items-center gap-1">
                <Coins className="w-5 h-5" /> {t('game.enemyCard.goldMonster')}
              </span>
            ) : (
              t('game.enemyCard.enemyLevel', { level: enemyInfo.level })
            )
          ) : (
            t('game.enemyCard.enemy')
          )}
        </h3>
        {enemyInfo && (
          <>
            <p className="text-xs md:text-sm text-gray-300">
              {t('elements.' + getElementKey(enemyInfo.element))} {t('game.playerCard.attribute')}
            </p>
            {!enemyInfo.isGoldenMonster && (
              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">
                {t('common.type')}: {getMonsterTypeName(enemyInfo.monsterType)}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex justify-center items-center flex-1">
        {enemyInfo ? (
          <AvatarDisplay
            name={enemyInfo.isGoldenMonster ? t('game.enemyCard.goldMonster') : `${enemyInfo.name}`}
            element={enemyInfo.element}
            monsterType={enemyInfo.isGoldenMonster ? undefined : enemyInfo.monsterType}
            isGoldenMonster={enemyInfo.isGoldenMonster}
            size={120}
            flipHorizontal
          />
        ) : (
          <div className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-gray-400 text-sm">?</span>
          </div>
        )}
      </div>

      {hasPlayerNFT && !enemyInfo && !hasBattleCommitment && (
        <div className="mt-3 md:mt-4">
          {enemyCooldownRemaining > 0 ? (
            <div className="w-full bg-gray-700 rounded-lg p-3 md:p-4 text-center">
              <div className="text-white text-xs md:text-sm font-bold mb-2 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" /> {t('game.playerActions.cooldown')}
              </div>
              <div className="text-xl md:text-2xl font-mono text-purple-400 mb-2">
                {formatTime(enemyCooldownRemaining)}
              </div>
              <div className="text-gray-400 text-[10px] md:text-xs">
                {t('game.playerActions.totalDuration')}: {formatTime(enemyRerandomCooldownSeconds)}
              </div>
            </div>
          ) : (
            <button
              onClick={onRandomEnemy}
              disabled={randomizing || !isConnected}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm md:text-base"
            >
              {randomizing ? t('game.enemyCard.generating') : t('game.enemyCard.randomizeEnemy')}
            </button>
          )}
        </div>
      )}

      {hasPlayerNFT && enemyInfo && (
        <button
          onClick={onRandomEnemy}
          disabled={randomizing || enemyCooldownRemaining > 0 || !isConnected || hasBattleCommitment}
          className="mt-2 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs md:text-sm"
          title={hasBattleCommitment ? t('game.enemyCard.noRefreshDuringBattle') : ''}
        >
          {randomizing
            ? t('game.enemyCard.generating')
            : hasBattleCommitment
              ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {t('game.playerActions.battling')}
                </span>
              )
              : enemyCooldownRemaining > 0
                ? `${t('game.playerActions.cooldown')} (${formatTime(enemyCooldownRemaining)})`
                : (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" /> {t('game.enemyCard.randomizeEnemy')}
                  </span>
                )}
        </button>
      )}
    </div>
  );
}

