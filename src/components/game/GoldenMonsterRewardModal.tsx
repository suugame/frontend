import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';

interface GoldenMonsterRewardModalProps {
  id?: string;
  minGoldenMonsterReward: number; // in MIST (1e9 = 1 SUI)
  maxGoldenMonsterReward: number; // in MIST
}

export default function GoldenMonsterRewardModal({
  id = 'golden_monster_reward_modal',
  minGoldenMonsterReward,
  maxGoldenMonsterReward,
}: GoldenMonsterRewardModalProps) {
  const { t } = useI18n();
  const minRewardSui = (minGoldenMonsterReward / 1e9).toFixed(2);
  const maxRewardSui = (maxGoldenMonsterReward / 1e9).toFixed(2);
  return (
    <dialog id={id} className="modal">
      <div className="modal-box max-w-md bg-gray-900 border border-white/20">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
        </form>
        <h3 className="font-bold text-lg text-white mb-4">{t('game.goldenReward.title')}</h3>
        <div className="space-y-3 text-sm text-white">
          <div className="text-xs text-gray-300">
            {t('game.goldenReward.rangeLabel')}: <span className="text-yellow-400 font-medium">{minRewardSui} - {maxRewardSui} SUI</span>
          </div>
          <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
            <div className="font-bold text-white mb-2">{t('game.goldenReward.description')}：</div>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('game.goldenReward.rulesHigh')}</li>
              <li>{t('game.goldenReward.rulesLow')}</li>
              <li>{t('game.goldenReward.timeout')}</li>
            </ul>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>{t('game.goldenReward.close')}</button>
      </form>
    </dialog>
  );
}