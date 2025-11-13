import { NFTMintedEvent, HealthNFT } from '@/sui';
import { getElementKey, getMonsterTypeName } from '@/utils/gameHelpers';
import AvatarDisplay from './AvatarDisplay';
import { useI18n } from '@/i18n/I18nProvider';

interface PlayerCardProps {
  playerNFT: NFTMintedEvent | null;
  fullNFTInfo: HealthNFT | null;
}

export default function PlayerCard({
  playerNFT,
  fullNFTInfo,
}: PlayerCardProps) {
  const { t } = useI18n();
  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-3 md:p-6 border-2 md:border-4 border-blue-600 w-full h-full flex flex-col">
      <div className="text-left mb-2 md:mb-4">
        {playerNFT ? (
          <>
            <h3 className="text-base md:text-xl font-bold text-white">
              NFT #{playerNFT.nftId} Lv.{fullNFTInfo?.level ?? playerNFT.level}
            </h3>
            <p className="text-xs md:text-sm text-gray-300">
              {t('elements.' + getElementKey(playerNFT.element))} {t('game.playerCard.attribute')}
            </p>
            {(fullNFTInfo?.monsterType !== undefined || playerNFT.monsterType !== undefined) && (
              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">
                {t('common.type')}: {getMonsterTypeName(fullNFTInfo?.monsterType ?? playerNFT.monsterType ?? 0)}
              </p>
            )}
            {fullNFTInfo && (
              <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                {t('game.playerCard.experience')}: {fullNFTInfo.experience}/100
                {fullNFTInfo.experience > 0 && (
                  <div className="mt-1 w-full bg-gray-700 rounded-full h-1.5 md:h-2">
                    <div
                      className="bg-blue-500 h-1.5 md:h-2 rounded-full transition-all"
                      style={{ width: `${(fullNFTInfo.experience / 100) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <h3 className="text-base md:text-xl font-bold text-white">{t('game.playerCard.waitingNFT')}</h3>
        )}
      </div>

      <div className="flex justify-center items-center flex-1">
        {playerNFT ? (
          <AvatarDisplay
            name={`${fullNFTInfo?.name}`}
            element={playerNFT.element}
            monsterType={fullNFTInfo?.monsterType ?? playerNFT.monsterType}
            size={120}
          />
        ) : (
          <div className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-gray-400 text-sm">?</span>
          </div>
        )}
      </div>
    </div>
  );
}

