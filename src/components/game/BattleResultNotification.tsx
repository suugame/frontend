import { PartyPopper, Frown, Coins, Sparkles, ArrowUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface BattleResultNotificationProps {
  result: {
    isWin: boolean;
    experienceGained: number;
    levelIncreased: boolean;
    isGoldenMonster: boolean;
    rewardAmount: number;
  };
}

export default function BattleResultNotification({ result }: BattleResultNotificationProps) {
  const { t } = useI18n();
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-5 duration-500">
      <div
        className={`rounded-lg shadow-2xl p-6 min-w-[320px] ${
          result.isWin
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 border-2 border-green-400'
            : 'bg-gradient-to-r from-red-600 to-rose-600 border-2 border-red-400'
        }`}
      >
        <div className="text-center text-white">
          <div className="text-3xl font-bold mb-3 flex items-center justify-center gap-2">
            {result.isWin ? (
              <>
                <PartyPopper className="w-8 h-8" /> {t('game.battleResult.win')}
              </>
            ) : (
              <>
                <Frown className="w-8 h-8" /> {t('game.battleResult.lose')}
              </>
            )}
          </div>

          {result.isGoldenMonster && (
            <div className="text-lg mb-2 flex items-center justify-center gap-2">
              <Coins className="w-6 h-6" />
              <span className="font-bold">{t('game.enemyCard.goldMonster')}</span>
            </div>
          )}

          {result.isWin && (
            <>
              {result.isGoldenMonster && result.rewardAmount > 0 ? (
                <div className="text-xl mb-2 font-bold text-yellow-300 flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5" /> {t('game.battleResult.reward')}: {(result.rewardAmount / 1000000000).toFixed(4)} SUI
                </div>
              ) : result.experienceGained > 0 ? (
                <div className="text-lg mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" /> {t('game.battleResult.exp')}: +{result.experienceGained}
                </div>
              ) : null}

              {result.levelIncreased && (
                <div className="text-xl font-bold text-yellow-300 animate-pulse flex items-center justify-center gap-2">
                  <ArrowUp className="w-5 h-5" /> {t('game.battleResult.levelUp')}
                </div>
              )}
            </>
          )}

          {!result.isWin && (
            <div className="text-sm text-gray-200 mt-2">
              {result.isGoldenMonster ? t('game.battleResult.tooStrong') : t('game.battleResult.encourage')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

