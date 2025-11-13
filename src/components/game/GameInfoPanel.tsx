'use client';

import { HelpCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { getElementKey } from '@/utils/gameHelpers';
import { calculateWinProbability, getElementAdvantage, calculateCaptureLevelPenaltyFactor } from '@/utils/battleHelpers';
import { calculateEnemyRerandomCooldown, calculateBattleRevealDelay } from '@/utils/gameHelpers';
import type { EnemyInfo, HealthNFT } from '@/sui';

interface GameInfoPanelProps {
  playerNFT: HealthNFT | null;
  enemyInfo: EnemyInfo | null;
  hasBattleCommitment: boolean;
  enemyRerandomCooldownSeconds: number;
  battleRevealDelaySeconds: number;
  minGoldenMonsterReward: number;
  maxGoldenMonsterReward: number;
  renderOnlyDialog?: boolean; // 新增：是否只渲染dialog
}

export default function GameInfoPanel({
  playerNFT,
  enemyInfo,
  hasBattleCommitment,
  enemyRerandomCooldownSeconds,
  battleRevealDelaySeconds,
  minGoldenMonsterReward,
  maxGoldenMonsterReward,
  renderOnlyDialog = false,
}: GameInfoPanelProps) {
  const { t } = useI18n();

  // 计算从3月20日开始的一年中的第几天（0-359）
  // 3月20日 = 第0天
  const getDayOfYearFromMarch20 = (month: number, day: number): number => {
    // 简化计算：假设每月30天
    if (month === 3) {
      if (day >= 20) {
        // 3月20日之后
        return day - 20;
      } else {
        // 3月1-19日，属于下一年周期的末尾
        return 342 + (day - 1);
      }
    } else if (month === 4) {
      return 12 + (day - 1);
    } else if (month === 5) {
      return 42 + (day - 1);
    } else if (month === 6) {
      return 72 + (day - 1);
    } else if (month === 7) {
      return 102 + (day - 1);
    } else if (month === 8) {
      return 132 + (day - 1);
    } else if (month === 9) {
      return 162 + (day - 1);
    } else if (month === 10) {
      return 192 + (day - 1);
    } else if (month === 11) {
      return 222 + (day - 1);
    } else if (month === 12) {
      return 252 + (day - 1);
    } else if (month === 1) {
      return 282 + (day - 1);
    } else if (month === 2) {
      return 312 + (day - 1);
    }
    return 0;
  };

  // 获取当前季节信息
  const getCurrentSeason = (): { name: string; element: string; elementNum: number; isEarthPeriod: boolean } => {
    const now = new Date();
    const month = now.getMonth() + 1; // 0-11 -> 1-12
    const day = now.getDate();
    
    const dayOfYear = getDayOfYearFromMarch20(month, day);
    const dayNormalized = dayOfYear % 360;
    
    // 季节分配（每个季节90天：72天主属性 + 18天土）
    // 春季木：第0-71天（72天），然后土：第72-89天（18天）
    // 夏季火：第90-161天（72天），然后土：第162-179天（18天）
    // 秋季金：第180-251天（72天），然后土：第252-269天（18天）
    // 冬季水：第270-341天（72天），然后土：第342-359天（18天）
    
    if (dayNormalized < 72) {
      return { name: t('game.season.spring'), element: t('elements.wood'), elementNum: 1, isEarthPeriod: false };
    } else if (dayNormalized < 90) {
      return { name: t('game.season.springTransition'), element: t('elements.earth'), elementNum: 4, isEarthPeriod: true };
    } else if (dayNormalized < 162) {
      return { name: t('game.season.summer'), element: t('elements.fire'), elementNum: 3, isEarthPeriod: false };
    } else if (dayNormalized < 180) {
      return { name: t('game.season.summerTransition'), element: t('elements.earth'), elementNum: 4, isEarthPeriod: true };
    } else if (dayNormalized < 252) {
      return { name: t('game.season.autumn'), element: t('elements.metal'), elementNum: 0, isEarthPeriod: false };
    } else if (dayNormalized < 270) {
      return { name: t('game.season.autumnTransition'), element: t('elements.earth'), elementNum: 4, isEarthPeriod: true };
    } else if (dayNormalized < 342) {
      return { name: t('game.season.winter'), element: t('elements.water'), elementNum: 2, isEarthPeriod: false };
    } else {
      return { name: t('game.season.winterTransition'), element: t('elements.earth'), elementNum: 4, isEarthPeriod: true };
    }
  };

  const season = getCurrentSeason();

  // 获取下一个季节信息
  const getNextSeason = (): { name: string; element: string; elementNum: number; daysUntil: number } => {
    const now = new Date();
    const month = now.getMonth() + 1; // 0-11 -> 1-12
    const day = now.getDate();
    const currentYear = now.getFullYear();
    
    // 季节切换时间点（月，日）及其对应的下一个季节
    const seasonTransitions = [
      { month: 3, day: 20, nextSeason: { name: t('game.season.spring'), element: t('elements.wood'), elementNum: 1 } },
      { month: 6, day: 21, nextSeason: { name: t('game.season.summer'), element: t('elements.fire'), elementNum: 3 } },
      { month: 9, day: 22, nextSeason: { name: t('game.season.autumn'), element: t('elements.metal'), elementNum: 0 } },
      { month: 12, day: 21, nextSeason: { name: t('game.season.winter'), element: t('elements.water'), elementNum: 2 } },
    ];
    
    // 找到下一个季节切换点
    let nextTransition = null;
    for (const transition of seasonTransitions) {
      let transitionDate = new Date(currentYear, transition.month - 1, transition.day);
      const nowDate = new Date(currentYear, month - 1, day);
      
      // 如果今年的切换时间已过，考虑明年的
      if (transitionDate < nowDate) {
        transitionDate = new Date(currentYear + 1, transition.month - 1, transition.day);
      }
      
      if (!nextTransition || transitionDate < nextTransition.date) {
        nextTransition = {
          ...transition.nextSeason,
          date: transitionDate,
        };
      }
    }
    
    if (!nextTransition) {
      const nextSpring = new Date(currentYear + 1, 2, 20);
      const nowDate = new Date(currentYear, month - 1, day);
      if (nextSpring < nowDate) {
        nextSpring.setFullYear(currentYear + 1);
      }
      const daysUntil = Math.ceil((nextSpring.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
      return { name: t('game.season.spring'), element: t('elements.wood'), elementNum: 1, daysUntil };
    }
    
    // 计算距离天数
    const nowDate = new Date(currentYear, month - 1, day);
    const daysUntil = Math.ceil((nextTransition.date.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      name: nextTransition.name,
      element: nextTransition.element,
      elementNum: nextTransition.elementNum,
      daysUntil,
    };
  };

  const nextSeason = getNextSeason();

  // 获取当前季节的属性层级
  // 返回 (主属性, 第二属性1, 第二属性2, 第三属性)
  const getSeasonHierarchy = (seasonElement: number): [number, number, number, number] => {
    if (seasonElement === 1) { // 春（木）
      return [1, 2, 3, 0]; // 木, 水, 火, 金
    } else if (seasonElement === 3) { // 夏（火）
      return [3, 1, 0, 2]; // 火, 木, 金, 水
    } else if (seasonElement === 0) { // 秋（金）
      return [0, 3, 2, 1]; // 金, 火, 水, 木
    } else { // 冬（水）
      return [2, 0, 1, 3]; // 水, 金, 木, 火
    }
  };

  // 计算属性出现概率（根据日期在季节中的位置线性变化）
  const getElementProbabilities = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dayOfYear = getDayOfYearFromMarch20(month, day);
    const dayNormalized = dayOfYear % 360;
    
    // 获取季节信息
    const seasonInfo = getSeasonInfoByDay(dayNormalized);
    
    const elements = [
      t('elements.metal'),
      t('elements.wood'),
      t('elements.water'),
      t('elements.fire'),
      t('elements.earth'),
    ];
    
    if (seasonInfo.isEarthPeriod) {
      // 土属性期间：土50%，其他四个属性各12.5%
      return elements.map((el, idx) => ({
        name: el,
        probability: idx === 4 ? '50%' : '12.5%',
      }));
    } else {
      // 主属性期间：根据距离季节中间的距离线性变化
      const position = seasonInfo.positionInSeason; // 0-71
      const seasonMiddle = 36;
      const distanceFromMiddle = Math.abs(position - seasonMiddle);
      
      // 根据距离计算主属性概率（70% -> 40%）
      const mainProb = 70 - (distanceFromMiddle * 30 / 36);
      // 第二属性概率（10% -> 22.5%）
      const secondProb = 10 + (distanceFromMiddle * 12.5 / 36);
      // 第三属性概率（5% -> 10%）
      const thirdProb = 5 + (distanceFromMiddle * 5 / 36);
      // 土属性固定5%
      const earthProb = 5;
      
      // 获取属性层级
      const [main, second1, second2, third] = getSeasonHierarchy(seasonInfo.seasonElement);
      
      // 构建概率映射
      const probMap: { [key: number]: string } = {};
      probMap[main] = `${mainProb.toFixed(1)}%`;
      probMap[second1] = `${secondProb.toFixed(1)}%`;
      probMap[second2] = `${secondProb.toFixed(1)}%`;
      probMap[third] = `${thirdProb.toFixed(1)}%`;
      probMap[4] = `${earthProb.toFixed(1)}%`; // 土属性
      
      return elements.map((el, idx) => ({
        name: el,
        probability: probMap[idx] || '0%',
      }));
    }
  };

  // 根据一年中的第几天获取季节信息
  const getSeasonInfoByDay = (dayNormalized: number) => {
    if (dayNormalized < 72) {
      // 春季木（0-71）
      return { seasonElement: 1, oppositeElement: 0, isEarthPeriod: false, positionInSeason: dayNormalized };
    } else if (dayNormalized < 90) {
      // 春季土（72-89）
      return { seasonElement: 1, oppositeElement: 0, isEarthPeriod: true, positionInSeason: 0 };
    } else if (dayNormalized < 162) {
      // 夏季火（90-161）
      return { seasonElement: 3, oppositeElement: 2, isEarthPeriod: false, positionInSeason: dayNormalized - 90 };
    } else if (dayNormalized < 180) {
      // 夏季土（162-179）
      return { seasonElement: 3, oppositeElement: 2, isEarthPeriod: true, positionInSeason: 0 };
    } else if (dayNormalized < 252) {
      // 秋季金（180-251）
      return { seasonElement: 0, oppositeElement: 1, isEarthPeriod: false, positionInSeason: dayNormalized - 180 };
    } else if (dayNormalized < 270) {
      // 秋季土（252-269）
      return { seasonElement: 0, oppositeElement: 1, isEarthPeriod: true, positionInSeason: 0 };
    } else if (dayNormalized < 342) {
      // 冬季水（270-341）
      return { seasonElement: 2, oppositeElement: 3, isEarthPeriod: false, positionInSeason: dayNormalized - 270 };
    } else {
      // 冬季土（342-359）
      return { seasonElement: 2, oppositeElement: 3, isEarthPeriod: true, positionInSeason: 0 };
    }
  };

  // 根据玩家等级计算怪物类型概率
  // 合约逻辑：1级时 beam-40%, bauhaus-25%, pixel-15%, sunset-10%, ring-6%, marble-4%
  //          10级时 beam-70%, bauhaus-20%, pixel-7%, sunset-2%, ring-0.8%, marble-0.2%
  // 使用1000作为基数进行线性插值
  const getMonsterTypeProbabilities = () => {
    // 如果没有玩家NFT，使用1级的概率
    const level = playerNFT ? playerNFT.level : 1;
    const levelNum = Math.min(Math.max(level, 1), 10); // 限制在1-10级之间
    const levelU64 = levelNum;
    
    // 计算各类型累积概率阈值（使用1000作为基数）
    // beam: 从400(40%) 增长到 700(70%)
    const beamProb = 400 + Math.floor((levelU64 - 1) * 300 / 9);
    
    // bauhaus: 从250(25%) 减少到 200(20%)
    const bauhausProb = beamProb + Math.floor(250 - (levelU64 - 1) * 50 / 9);
    
    // pixel: 从150(15%) 减少到 70(7%)
    const pixelProb = bauhausProb + Math.floor(150 - (levelU64 - 1) * 80 / 9);
    
    // sunset: 从100(10%) 减少到 20(2%)
    const sunsetProb = pixelProb + Math.floor(100 - (levelU64 - 1) * 80 / 9);
    
    // ring: 从60(6%) 减少到 8(0.8%)
    const ringProb = sunsetProb + Math.floor(60 - (levelU64 - 1) * 52 / 9);
    
    // marble: 剩余概率 (1000 - ringProb)
    
    // 计算每个类型的实际概率（区间大小），并转换为百分比字符串
    return [
      { name: 'beam', probability: `${(beamProb / 10).toFixed(1)}%` },
      { name: 'bauhaus', probability: `${((bauhausProb - beamProb) / 10).toFixed(1)}%` },
      { name: 'pixel', probability: `${((pixelProb - bauhausProb) / 10).toFixed(1)}%` },
      { name: 'sunset', probability: `${((sunsetProb - pixelProb) / 10).toFixed(1)}%` },
      { name: 'ring', probability: `${((ringProb - sunsetProb) / 10).toFixed(1)}%` },
      { name: 'marble', probability: `${((1000 - ringProb) / 10).toFixed(1)}%` },
    ];
  };

  const monsterTypeProbabilities = getMonsterTypeProbabilities();
  const elementProbabilities = getElementProbabilities();

  // 计算金币怪概率
  const getGoldenMonsterProb = (): string => {
    if (!playerNFT) return '0%';
    // 如果已经击败过金币怪，则后续概率为 0
    if (playerNFT.defeatedGoldenMonster) {
      return '0%';
    }
    
    const level = playerNFT.level;
    let baseProb: number;
    
    // 根据等级计算基础概率（1级0.5%，9级9%）
    if (level <= 1) {
      baseProb = 0.5;
    } else if (level >= 9) {
      baseProb = 9;
    } else {
      const baseProbRaw = 50; // 0.5% = 50/10000
      const maxProbRaw = 900; // 9% = 900/10000
      const probRaw = baseProbRaw + (level - 1) * (maxProbRaw - baseProbRaw) / 8;
      baseProb = probRaw / 100;
    }
    
    // 检查是否逆属性（NFT属性与季节属性相克），如果是则概率翻倍
    const isCounterSeason = getElementAdvantage(season.elementNum, playerNFT.element);
    const finalProb = baseProb * (isCounterSeason ? 2 : 1);
    
    return `${finalProb.toFixed(2)}%${isCounterSeason ? t('game.infoPanel.counterSeasonBonus') : ''}`;
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}${t('common.unit.secondShort')}`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}${t('common.unit.minuteShort')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}${t('common.unit.hourShort')}${minutes > 0 ? minutes + t('common.unit.minuteShort') : ''}`;
    }
  };

  // 计算战胜概率
  const getWinProbability = (): number | null => {
    if (!playerNFT || !enemyInfo) return null;
    
    // 金币怪固定50%概率
    if (enemyInfo.isGoldenMonster) {
      return 50;
    }
    
    const prob = calculateWinProbability(
      playerNFT.level,
      playerNFT.element,
      enemyInfo.level,
      enemyInfo.element
    );
    
    return prob;
  };

  // 获取克制关系
  const getAdvantageInfo = (): {
    elementAdvantage: boolean;
    elementDisadvantage: boolean;
    levelAdvantage: number;
  } | null => {
    if (!playerNFT || !enemyInfo) return null;
    
    return {
      elementAdvantage: getElementAdvantage(playerNFT.element, enemyInfo.element),
      elementDisadvantage: getElementAdvantage(enemyInfo.element, playerNFT.element),
      levelAdvantage: playerNFT.level - enemyInfo.level,
    };
  };

  // 计算战胜获取的经验或金币
  const getRewardInfo = (): string | null => {
    if (!playerNFT || !enemyInfo) return null;
    
    if (enemyInfo.isGoldenMonster) {
      const minSui = (minGoldenMonsterReward / 1e9).toFixed(2);
      const maxSui = (maxGoldenMonsterReward / 1e9).toFixed(2);
      return `${minSui} - ${maxSui} SUI`;
    }
    
    // 普通怪物获得经验
    const levelDiff = Math.abs(playerNFT.level - enemyInfo.level);
    let expGain: number;
    
    if (levelDiff === 0) {
      expGain = 10;
    } else if (levelDiff === 1) {
      expGain = playerNFT.level > enemyInfo.level ? 8 : 12;
    } else if (levelDiff === 2) {
      expGain = playerNFT.level > enemyInfo.level ? 5 : 15;
    } else {
      expGain = playerNFT.level > enemyInfo.level ? 2 : 20;
    }
    
    return `${expGain} ${t('game.infoPanel.expUnit')}`;
  };

  const winProb = getWinProbability();
  const advantageInfo = getAdvantageInfo();
  const rewardInfo = getRewardInfo();
  const minRewardSui = (minGoldenMonsterReward / 1e9).toFixed(2);
  const maxRewardSui = (maxGoldenMonsterReward / 1e9).toFixed(2);

  // 固定显示的内容
  const baseInfo = (
    <>
      <div className="space-y-2 text-xs md:text-sm">
        <div className="flex justify-between items-start">
          <span className="text-gray-400">{t('game.infoPanel.currentSeason')}</span>
          <span className="text-white font-medium">
            {season.name}（{season.element}）
          </span>
        </div>

        <div className="flex justify-between items-start">
          <span className="text-gray-400">{t('game.infoPanel.nextSeason')}</span>
          <span className="text-white font-medium">
            {nextSeason.name}（{nextSeason.element}）
            <span className="text-blue-400 ml-1">
              {nextSeason.daysUntil === 0 
                ? t('game.infoPanel.today') 
                : t('game.infoPanel.daysLeft', { days: nextSeason.daysUntil })}
            </span>
          </span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center gap-1 mb-2">
            <div className="text-gray-400">{t('game.infoPanel.elementProb')}</div>
            <button
              onClick={() => (document.getElementById('element_probability_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewElementProbDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          </div>
          {/* 移动端：横向滚动显示所有属性概率（从高到低排序） */}
          <div className="md:hidden overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 text-xs whitespace-nowrap pb-1">
              {(() => {
                const probs = getElementProbabilities();
                // 按概率从高到低排序
                const sortedProbs = [...probs].sort((a, b) => {
                  const probA = parseFloat(a.probability.replace('%', ''));
                  const probB = parseFloat(b.probability.replace('%', ''));
                  return probB - probA;
                });
                return sortedProbs.map((item) => (
                  <div key={item.name} className="bg-white/5 rounded px-2 py-1 shrink-0">
                    <span className="text-white">{item.name}</span>
                    <span className="text-gray-400 ml-1">{item.probability}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
          {/* 桌面端显示所有属性 */}
          <div className="hidden md:grid grid-cols-5 gap-1 text-xs">
            {getElementProbabilities().map((item) => (
              <div key={item.name} className="text-center">
                <div className="text-white">{item.name}</div>
                <div className="text-gray-400">{item.probability}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center gap-1 mb-2">
            <div className="text-gray-400">{t('game.infoPanel.typeProb')}</div>
            <button
              onClick={() => (document.getElementById('monster_type_probability_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewTypeProbDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          </div>
          {/* 移动端：横向滚动 */}
          <div className="md:hidden overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 text-xs whitespace-nowrap pb-1">
              {monsterTypeProbabilities.map((item) => (
                <div key={item.name} className="bg-white/5 rounded px-2 py-1 shrink-0">
                  <span className="text-white">{item.name}</span>
                  <span className="text-gray-400 ml-1">{item.probability}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 桌面端：网格布局 */}
          <div className="hidden md:grid grid-cols-3 gap-1 text-xs">
            {monsterTypeProbabilities.map((item) => (
              <div key={item.name} className="flex justify-between">
                <span className="text-white">{item.name}:</span>
                <span className="text-gray-400">{item.probability}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // 展开后显示的额外内容
  const expandedInfo = (
    <div className="space-y-2 text-xs md:text-sm pt-2 border-t border-white/10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">{t('game.infoPanel.goldenProb')}</span>
          {playerNFT && (
            <button
              onClick={() => (document.getElementById('golden_monster_prob_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewGoldenProbDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-yellow-400 font-medium">{getGoldenMonsterProb()}</span>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">{t('game.infoPanel.goldenRewardRange')}</span>
          {playerNFT && (
            <button
              onClick={() => (document.getElementById('golden_monster_reward_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewGoldenRewardDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-yellow-400 font-medium">{minRewardSui} - {maxRewardSui} SUI</span>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">{t('game.infoPanel.enemyCooldown')}</span>
          {playerNFT && (
            <button
              onClick={() => (document.getElementById('enemy_cooldown_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewEnemyCooldownDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-white">{formatTime(enemyRerandomCooldownSeconds)}</span>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">{t('game.infoPanel.battleDelay')}</span>
          {playerNFT && (
            <button
              onClick={() => (document.getElementById('battle_delay_modal') as HTMLDialogElement)?.showModal()}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={t('game.infoPanel.viewBattleDelayDetail')}
            >
              <HelpCircle className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-white">{formatTime(battleRevealDelaySeconds)}</span>
      </div>
    </div>
  );

  // 战斗相关信息（有敌人时显示）
  const battleInfo = (enemyInfo || hasBattleCommitment) && (
    <div className="space-y-2 text-xs md:text-sm mb-3 md:mb-4 pb-3 md:pb-4 border-b border-white/10">
      {winProb !== null && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">{t('game.infoPanel.winProb')}</span>
            <span className={`font-bold text-base md:text-lg ${
              winProb >= 70 ? 'text-green-400' : 
              winProb >= 50 ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              {winProb.toFixed(1)}%
            </span>
          </div>
          
          {/* 抓捕概率（战胜概率的一半，同类型+10%，应用等级惩罚，仅对普通怪物显示） */}
          {enemyInfo && !enemyInfo.isGoldenMonster && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">{t('game.infoPanel.captureProb')}</span>
              <div className="flex items-center gap-1">
                {(() => {
                  if (!playerNFT) return null;
                  
                  // 基础抓捕概率 = 战胜概率 / 2
                  let captureProb = winProb / 2;
                  // 检查是否同类型
                  const isSameType = playerNFT && enemyInfo.monsterType === playerNFT.monsterType;
                  if (isSameType) {
                    captureProb += 10; // 同类型额外+10%
                  }
                  // 应用等级惩罚：等级越低，捕捉成功率越低
                  const levelPenaltyFactor = calculateCaptureLevelPenaltyFactor(playerNFT.level);
                  captureProb = (captureProb * (100 - levelPenaltyFactor)) / 100;
                  
                  // 确保不超过100%
                  if (captureProb > 100) captureProb = 100;
                  
                  return (
                    <>
                      <span className={`font-bold text-sm md:text-base ${
                        captureProb >= 45 ? 'text-purple-400' : 
                        captureProb >= 35 ? 'text-blue-400' : 
                        'text-gray-400'
                      }`}>
                        {captureProb.toFixed(1)}%
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {advantageInfo && (
        <div>
          <div className="text-gray-400 mb-1">{t('game.infoPanel.advantageTitle')}</div>
          <div className="text-[10px] md:text-xs space-y-1 ml-2">
            <div className="flex items-center">
              <span className="text-gray-500">{t('game.infoPanel.elementAdvantageLabel')}</span>
              <span className={`ml-2 ${
                advantageInfo.elementAdvantage 
                  ? 'text-green-400' 
                  : advantageInfo.elementDisadvantage 
                  ? 'text-red-400' 
                  : 'text-gray-400'
              }`}>
                {advantageInfo.elementAdvantage 
                  ? t('game.infoPanel.elementAdvantageText', { player: t('elements.' + getElementKey(playerNFT!.element)), enemy: t('elements.' + getElementKey(enemyInfo!.element)) })
                  : advantageInfo.elementDisadvantage 
                  ? t('game.infoPanel.elementDisadvantageText', { enemy: t('elements.' + getElementKey(enemyInfo!.element)), player: t('elements.' + getElementKey(playerNFT!.element)) })
                  : t('game.infoPanel.noAdvantage')}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-500">{t('game.infoPanel.levelDifferenceLabel')}</span>
              <span className={`ml-2 ${
                advantageInfo.levelAdvantage > 0 
                  ? 'text-green-400' 
                  : advantageInfo.levelAdvantage < 0 
                  ? 'text-red-400' 
                  : 'text-gray-400'
              }`}>
                {advantageInfo.levelAdvantage > 0 
                  ? t('game.infoPanel.higherByLevel', { levels: advantageInfo.levelAdvantage })
                  : advantageInfo.levelAdvantage < 0 
                  ? t('game.infoPanel.lowerByLevel', { levels: Math.abs(advantageInfo.levelAdvantage) })
                  : t('game.infoPanel.sameLevel')}
              </span>
            </div>
          </div>
        </div>
      )}

      {rewardInfo && (
        <div className="flex justify-between">
          <span className="text-gray-400">{t('game.infoPanel.winReward')}</span>
          <span className={`font-medium ${
            enemyInfo?.isGoldenMonster ? 'text-yellow-400' : 'text-blue-400'
          }`}>
            {rewardInfo}
          </span>
        </div>
      )}
    </div>
  );

  const hasBattle = enemyInfo || hasBattleCommitment;

  // 如果只需要渲染dialog，直接返回dialog
  if (renderOnlyDialog) {
    return (
      <>
        <dialog id="game_info_modal" className="modal">
          <div className="modal-box max-w-2xl bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.detailsTitle')}</h3>
            <div className="space-y-3 text-sm text-white">
              {baseInfo}
              {expandedInfo}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>

        {/* 金币怪概率详情弹窗 */}
        {playerNFT && (
          <dialog id="golden_monster_prob_modal" className="modal">
            <div className="modal-box max-w-md bg-gray-900 border border-white/20">
              <form method="dialog">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
              </form>
              <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.goldenProbTitle')}</h3>
              {playerNFT.defeatedGoldenMonster && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs rounded-md p-2 mb-4">
                  {t('game.infoPanel.goldenDefeatedNotice')}
                </div>
              )}
              <div className="space-y-3 text-sm text-white">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="table  w-full text-[10px] compact">
                    <thead>
                      <tr>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.baseProbHeader')}</th>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.counterProbHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, i) => {
                        const level = i + 1;
                        let baseProb: number;
                        
                        if (level <= 1) {
                          baseProb = 0.5;
                        } else if (level >= 9) {
                          baseProb = 9;
                        } else {
                          const baseProbRaw = 50;
                          const maxProbRaw = 900;
                          const probRaw = baseProbRaw + (level - 1) * (maxProbRaw - baseProbRaw) / 8;
                          baseProb = probRaw / 100;
                        }
                        
                        const counterProb = baseProb * 2;
                        
                        return (
                          <tr key={level} className={level === playerNFT.level ? 'bg-yellow-500/20' : ''}>
                            <td className="font-bold text-gray-200 py-1 px-2">Lv.{level}</td>
                            <td className="text-gray-200 py-1 px-2">{baseProb.toFixed(2)}%</td>
                            <td className="text-yellow-400 py-1 px-2">{counterProb.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                  <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('game.infoPanel.goldenProbRuleLevelInc')}</li>
                    <li>{t('game.infoPanel.goldenProbRuleCounter')}</li>
                    <li>{t('game.infoPanel.currentSeason')} {season.name}（{season.element}）</li>
                    <li>{t('game.infoPanel.playerElementLabel')} {t('elements.' + getElementKey(playerNFT.element))}</li>
                    <li>{t('game.infoPanel.goldenProbRuleDefeated')}</li>
                    <li className="text-yellow-400">
                      {getElementAdvantage(season.elementNum, playerNFT.element) 
                        ? '✓ ' + t('game.infoPanel.goldenCounterActive')
                        : t('game.infoPanel.goldenCounterInactive')}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button>{t('common.close')}</button>
            </form>
          </dialog>
        )}

        {/* 金币怪奖励范围详情弹窗移除：改用通用组件 GoldenMonsterRewardModal */}

        {/* 刷新冷却时间详情弹窗 */}
        {playerNFT && (
          <dialog id="enemy_cooldown_modal" className="modal">
            <div className="modal-box max-w-md bg-gray-900 border border-white/20">
              <form method="dialog">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
              </form>
              <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.enemyCooldownTitle')}</h3>
              <div className="space-y-3 text-sm text-white">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="table  w-full text-[10px] compact">
                    <thead>
                      <tr>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.cooldownTimeHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, i) => {
                        const level = i + 1;
                        const cooldownMs = calculateEnemyRerandomCooldown(level);
                        const cooldownSeconds = Math.floor(cooldownMs / 1000);
                        const isCurrentLevel = level === playerNFT.level;
                        
                        return (
                          <tr key={level} className={isCurrentLevel ? 'bg-blue-500/20' : ''}>
                            <td className="font-bold text-gray-200 py-1 px-2">Lv.{level}</td>
                            <td className="text-gray-200 py-1 px-2">{formatTime(cooldownSeconds)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                  <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('game.infoPanel.cooldownRuleStart')}</li>
                    <li>{t('game.infoPanel.cooldownFormula')}</li>
                    <li className="text-blue-400">{t('game.infoPanel.cooldownCurrentLevel', { level: playerNFT.level, time: formatTime(enemyRerandomCooldownSeconds) })}</li>
                  </ul>
                </div>
              </div>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button>{t('common.close')}</button>
            </form>
          </dialog>
        )}

        {/* 战斗延迟时间详情弹窗 */}
        {playerNFT && (
          <dialog id="battle_delay_modal" className="modal">
            <div className="modal-box max-w-md bg-gray-900 border border-white/20">
              <form method="dialog">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
              </form>
              <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.battleDelayTitle')}</h3>
              <div className="space-y-3 text-sm text-white">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="table  w-full text-[10px] compact">
                    <thead>
                      <tr>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                        <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.delayTimeHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, i) => {
                        const level = i + 1;
                        const delayMs = calculateBattleRevealDelay(level);
                        const delaySeconds = Math.floor(delayMs / 1000);
                        const isCurrentLevel = level === playerNFT.level;
                        
                        return (
                          <tr key={level} className={isCurrentLevel ? 'bg-blue-500/20' : ''}>
                            <td className="font-bold text-gray-200 py-1 px-2">Lv.{level}</td>
                            <td className="text-gray-200 py-1 px-2">{formatTime(delaySeconds)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                  <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('game.infoPanel.battleDelayRuleStart')}</li>
                    <li>{t('game.infoPanel.battleDelayFormula')}</li>
                    <li className="text-blue-400">{t('game.infoPanel.battleDelayCurrentLevel', { level: playerNFT.level, time: formatTime(battleRevealDelaySeconds) })}</li>
                  </ul>
                </div>
              </div>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button>{t('common.close')}</button>
            </form>
          </dialog>
        )}

        {/* 属性出现概率和克制关系详情弹窗 */}
        <dialog id="element_probability_modal" className="modal">
          <div className="modal-box max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] my-4 mx-4 bg-gray-900 border border-white/20 flex flex-col">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white z-10">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4 shrink-0">{t('game.infoPanel.elementProbAndAdvantageTitle')}</h3>
            <div className="space-y-4 text-sm text-white overflow-y-auto flex-1 pr-2">
              {/* 属性出现概率说明 */}
              <div>
                <div className="font-bold text-white mb-2">{t('game.infoPanel.elementProbExplanationTitle')}</div>
                <div className="text-gray-300 text-xs space-y-2">
                  <p>{t('game.infoPanel.elementProbExplanationIntro')}</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('game.infoPanel.seasonMiddleDesc')}</li>
                  <li>{t('game.infoPanel.seasonBoundaryDesc')}</li>
                  <li>{t('game.infoPanel.earthPeriodDesc')}</li>
                  <li>{t('game.infoPanel.probLinearDesc')}</li>
                </ul>
                  <div className="mt-2 p-2 bg-white/5 rounded">
                    <div className="font-bold mb-1">{t('game.infoPanel.currentSeason')} {season.name}（{season.element}）</div>
                    <div className="text-xs text-gray-400">{t('game.infoPanel.seasonsBasisTitle')}</div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 ml-2">
                      <li>{t('game.infoPanel.springRange')}</li>
                      <li>{t('game.infoPanel.springEarthRange')}</li>
                      <li>{t('game.infoPanel.summerRange')}</li>
                      <li>{t('game.infoPanel.summerEarthRange')}</li>
                      <li>{t('game.infoPanel.autumnRange')}</li>
                      <li>{t('game.infoPanel.autumnEarthRange')}</li>
                      <li>{t('game.infoPanel.winterRange')}</li>
                      <li>{t('game.infoPanel.winterEarthRange')}</li>
                    </ul>
                    <div className="mt-2 text-xs text-gray-400">
                      <div className="font-bold text-white mb-1">{t('game.infoPanel.probExplanationTitle')}</div>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>{t('game.infoPanel.seasonMiddleDesc')}</li>
                        <li>{t('game.infoPanel.seasonBoundaryDesc')}</li>
                        <li>{t('game.infoPanel.earthPeriodDesc')}</li>
                        <li>{t('game.infoPanel.probLinearDesc')}</li>
                      </ul>
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <div className="font-bold text-white mb-2">{t('game.infoPanel.currentDateProbTitle')}</div>
                      <div className="overflow-x-auto">
                        <table className="table w-full text-xs">
                          <thead>
                            <tr>
                              <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.elementHeader')}</th>
                              <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.currentProbHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {elementProbabilities.map((item) => (
                              <tr key={item.name}>
                                <td className="text-center font-bold py-2 px-2">{item.name}</td>
                                <td className="text-center py-2 px-2">{item.probability}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">{t('game.infoPanel.probabilitiesComputedNote')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 属性克制关系表格 */}
              <div className="border-t border-white/10 pt-3">
                <div className="font-bold text-white mb-3">{t('game.infoPanel.elementAdvantageTableTitle')}</div>
                <div className="overflow-x-auto">
                  <table className="table w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.elementHeader')}</th>
                        <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.advantageHeader')}</th>
                        <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.disadvantageHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-center font-bold py-2 px-2">{t('elements.metal')}</td>
                        <td className="text-center text-green-400 py-2 px-2">{t('elements.wood')}</td>
                        <td className="text-center text-red-400 py-2 px-2">{t('elements.fire')}</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold py-2 px-2">{t('elements.wood')}</td>
                        <td className="text-center text-green-400 py-2 px-2">{t('elements.earth')}</td>
                        <td className="text-center text-red-400 py-2 px-2">{t('elements.metal')}</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold py-2 px-2">{t('elements.water')}</td>
                        <td className="text-center text-green-400 py-2 px-2">{t('elements.fire')}</td>
                        <td className="text-center text-red-400 py-2 px-2">{t('elements.earth')}</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold py-2 px-2">{t('elements.fire')}</td>
                        <td className="text-center text-green-400 py-2 px-2">{t('elements.metal')}</td>
                        <td className="text-center text-red-400 py-2 px-2">{t('elements.water')}</td>
                      </tr>
                      <tr>
                        <td className="text-center font-bold py-2 px-2">{t('elements.earth')}</td>
                        <td className="text-center text-green-400 py-2 px-2">{t('elements.water')}</td>
                        <td className="text-center text-red-400 py-2 px-2">{t('elements.wood')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-white/5 rounded text-xs text-gray-300">
                  <div className="font-bold text-white mb-1">{t('game.infoPanel.advantageExplanationTitle')}</div>
                  <p>{t('game.infoPanel.advantageExplanationText')}</p>
                </div>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>

        {/* 类型出现概率详情弹窗 */}
        <dialog id="monster_type_probability_modal" className="modal">
          <div className="modal-box max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] my-4 mx-4 bg-gray-900 border border-white/20 flex flex-col">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white z-10">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4 shrink-0">{t('game.infoPanel.typeProbModalTitle')}</h3>
            <div className="space-y-4 text-sm text-white overflow-y-auto flex-1 pr-2">
              <div>
                <div className="font-bold text-white mb-2">{t('game.infoPanel.rulesTitle')}</div>
                <div className="text-gray-300 text-xs space-y-2">
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{t('game.infoPanel.beamRule')}</li>
                    <li>{t('game.infoPanel.bauhausRule')}</li>
                    <li>{t('game.infoPanel.pixelRule')}</li>
                    <li>{t('game.infoPanel.sunsetRule')}</li>
                    <li>{t('game.infoPanel.ringRule')}</li>
                    <li>{t('game.infoPanel.marbleRule')}</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="font-bold text-white mb-2">{t('game.infoPanel.currentLevelTypeProbTitle')}</div>
                <div className="overflow-x-auto">
                  <table className="table w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.typeHeader')}</th>
                        <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.currentProbHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monsterTypeProbabilities.map((item) => (
                        <tr key={item.name}>
                          <td className="text-center font-bold py-2 px-2">{item.name}</td>
                          <td className="text-center py-2 px-2">{item.probability}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="font-bold text-white mb-2">{t('game.infoPanel.typeProbChangesTitle')}</div>
                <div className="overflow-x-auto">
                  <table className="table w-full text-[10px] compact">
                    <thead>
                      <tr>
                        <th className="text-gray-300 py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                        <th className="text-gray-300 py-1 px-2">beam</th>
                        <th className="text-gray-300 py-1 px-2">bauhaus</th>
                        <th className="text-gray-300 py-1 px-2">pixel</th>
                        <th className="text-gray-300 py-1 px-2">sunset</th>
                        <th className="text-gray-300 py-1 px-2">ring</th>
                        <th className="text-gray-300 py-1 px-2">marble</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, i) => {
                        const lvl = i + 1;
                        const beamProb = 400 + Math.floor((lvl - 1) * 300 / 9);
                        const bauhausProb = beamProb + Math.floor(250 - (lvl - 1) * 50 / 9);
                        const pixelProb = bauhausProb + Math.floor(150 - (lvl - 1) * 80 / 9);
                        const sunsetProb = pixelProb + Math.floor(100 - (lvl - 1) * 80 / 9);
                        const ringProb = sunsetProb + Math.floor(60 - (lvl - 1) * 52 / 9);
                        const beamPct = (beamProb / 10).toFixed(1) + '%';
                        const bauhausPct = ((bauhausProb - beamProb) / 10).toFixed(1) + '%';
                        const pixelPct = ((pixelProb - bauhausProb) / 10).toFixed(1) + '%';
                        const sunsetPct = ((sunsetProb - pixelProb) / 10).toFixed(1) + '%';
                        const ringPct = ((ringProb - sunsetProb) / 10).toFixed(1) + '%';
                        const marblePct = ((1000 - ringProb) / 10).toFixed(1) + '%';
                        return (
                          <tr key={lvl}>
                            <td className="py-1 px-2 text-center font-bold">{lvl}</td>
                            <td className="py-1 px-2 text-center">{beamPct}</td>
                            <td className="py-1 px-2 text-center">{bauhausPct}</td>
                            <td className="py-1 px-2 text-center">{pixelPct}</td>
                            <td className="py-1 px-2 text-center">{sunsetPct}</td>
                            <td className="py-1 px-2 text-center">{ringPct}</td>
                            <td className="py-1 px-2 text-center">{marblePct}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      </>
    );
  }

  return (
    <>
      <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-3 md:p-5 border-2 border-white/20 shadow-2xl w-full h-full flex flex-col">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-white font-bold text-base md:text-xl">{t('game.infoPanel.title')}</h3>
          {/* 有敌人时显示问号按钮，点击查看详细信息 */}
          {hasBattle && (
            <button
              onClick={() => (document.getElementById('game_info_modal') as HTMLDialogElement)?.showModal()}
              className="btn btn-circle btn-sm bg-white/10 hover:bg-white/20 border-white/20 text-white"
              title={t('game.infoPanel.viewDetailsTooltip')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {!hasBattle ? (
            // 没有敌人时：显示完整的游戏提示信息
            <div className="space-y-3 text-xs md:text-sm">
              <div className="alert alert-info bg-blue-500/20 border-blue-500/30 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-xs">{t('game.infoPanel.noEnemyPrompt')}</span>
              </div>

              {baseInfo}
              {expandedInfo}
            </div>
          ) : (
            // 有敌人时：只显示战斗相关信息
            <div className="space-y-2">
              {battleInfo}
            </div>
          )}
        </div>
      </div>

      {/* 详细信息弹窗 (daisyUI Modal) */}
      <dialog id="game_info_modal" className="modal">
        <div className="modal-box max-w-2xl bg-gray-900 border border-white/20">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
          </form>
          <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.detailsTitle')}</h3>
          <div className="space-y-3 text-sm text-white">
            {baseInfo}
            {expandedInfo}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('common.close')}</button>
        </form>
      </dialog>

      {/* 金币怪概率详情弹窗 */}
      {playerNFT && (
        <dialog id="golden_monster_prob_modal" className="modal">
          <div className="modal-box max-w-md bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.goldenProbTitle')}</h3>
            <div className="space-y-3 text-sm text-white">
              <div className="overflow-x-auto">
                <table className="table  w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-gray-300">{t('game.infoPanel.levelHeader')}</th>
                      <th className="text-gray-300">{t('game.infoPanel.baseProbHeader')}</th>
                      <th className="text-gray-300">{t('game.infoPanel.counterProbHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => {
                      const level = i + 1;
                      let baseProb: number;
                      
                      if (level <= 1) {
                        baseProb = 0.5;
                      } else if (level >= 9) {
                        baseProb = 9;
                      } else {
                        const baseProbRaw = 50; // 0.5% = 50/10000
                        const maxProbRaw = 900; // 9% = 900/10000
                        const probRaw = baseProbRaw + (level - 1) * (maxProbRaw - baseProbRaw) / 8;
                        baseProb = probRaw / 100;
                      }
                      
                      const counterProb = baseProb * 2;
                      
                      return (
                        <tr key={level} className={level === playerNFT.level ? 'bg-yellow-500/20' : ''}>
                          <td className="font-bold">Lv.{level}</td>
                          <td>{baseProb.toFixed(2)}%</td>
                          <td className="text-yellow-400">{counterProb.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('game.infoPanel.goldenProbRuleLevelInc')}</li>
                  <li>{t('game.infoPanel.goldenProbRuleCounter')}</li>
                  <li>{t('game.infoPanel.currentSeason')} {season.name}（{season.element}）</li>
                  <li>{t('game.infoPanel.playerElementLabel')} {t('elements.' + getElementKey(playerNFT.element))}</li>
                  <li className="text-yellow-400">
                    {getElementAdvantage(season.elementNum, playerNFT.element) 
                      ? t('game.infoPanel.goldenCounterActive') 
                      : t('game.infoPanel.goldenCounterInactive')}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      )}

      {/* 金币怪奖励范围详情弹窗移除：改用通用组件 GoldenMonsterRewardModal */}

      {/* 刷新冷却时间详情弹窗 */}
      {playerNFT && (
        <dialog id="enemy_cooldown_modal" className="modal">
          <div className="modal-box max-w-md bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.enemyCooldownTitle')}</h3>
            <div className="space-y-3 text-sm text-white">
              <div className="overflow-x-auto">
                <table className="table  w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-gray-300">{t('game.infoPanel.levelHeader')}</th>
                      <th className="text-gray-300">{t('game.infoPanel.cooldownTimeHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => {
                      const level = i + 1;
                      const cooldownMs = calculateEnemyRerandomCooldown(level);
                      const cooldownSeconds = Math.floor(cooldownMs / 1000);
                      const isCurrentLevel = level === playerNFT.level;
                      
                      return (
                        <tr key={level} className={isCurrentLevel ? 'bg-blue-500/20' : ''}>
                          <td className="font-bold">Lv.{level}</td>
                          <td>{formatTime(cooldownSeconds)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('game.infoPanel.cooldownRuleStart')}</li>
                  <li>{t('game.infoPanel.cooldownFormula')}</li>
                  <li className="text-blue-400">{t('game.infoPanel.cooldownCurrentLevel', { level: playerNFT.level, time: formatTime(enemyRerandomCooldownSeconds) })}</li>
                </ul>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      )}

      {/* 战斗延迟时间详情弹窗 */}
      {playerNFT && (
        <dialog id="battle_delay_modal" className="modal">
          <div className="modal-box max-w-md bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('game.infoPanel.battleDelayTitle')}</h3>
            <div className="space-y-3 text-sm text-white">
              <div className="overflow-x-auto">
                <table className="table  w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-gray-300">{t('game.infoPanel.levelHeader')}</th>
                      <th className="text-gray-300">{t('game.infoPanel.delayTimeHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => {
                      const level = i + 1;
                      const delayMs = calculateBattleRevealDelay(level);
                      const delaySeconds = Math.floor(delayMs / 1000);
                      const isCurrentLevel = level === playerNFT.level;
                      
                      return (
                        <tr key={level} className={isCurrentLevel ? 'bg-blue-500/20' : ''}>
                          <td className="font-bold">Lv.{level}</td>
                          <td>{formatTime(delaySeconds)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
                <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('game.infoPanel.battleDelayRuleStart')}</li>
                  <li>{t('game.infoPanel.battleDelayFormula')}</li>
                  <li className="text-blue-400">{t('game.infoPanel.battleDelayCurrentLevel', { level: playerNFT.level, time: formatTime(battleRevealDelaySeconds) })}</li>
                </ul>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      )}

      {/* 属性出现概率和克制关系详情弹窗 */}
      <dialog id="element_probability_modal" className="modal">
        <div className="modal-box max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] my-4 mx-4 bg-gray-900 border border-white/20 flex flex-col">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white z-10">✕</button>
          </form>
          <h3 className="font-bold text-lg text-white mb-4 shrink-0">{t('game.infoPanel.elementProbAndAdvantageTitle')}</h3>
          <div className="space-y-4 text-sm text-white overflow-y-auto flex-1 pr-2">
            {/* 属性出现概率说明 */}
            <div>
              <div className="font-bold text-white mb-2">{t('game.infoPanel.elementProbExplanationTitle')}</div>
              <div className="text-gray-300 text-xs space-y-2">
                <p>{t('game.infoPanel.elementProbExplanationIntro')}</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('game.infoPanel.seasonMiddleDesc')}</li>
                  <li>{t('game.infoPanel.seasonBoundaryDesc')}</li>
                  <li>{t('game.infoPanel.earthPeriodDesc')}</li>
                  <li>{t('game.infoPanel.probLinearDesc')}</li>
                </ul>
                <div className="mt-2 p-2 bg-white/5 rounded">
                  <div className="font-bold mb-1">{t('game.infoPanel.currentSeason')} {season.name}（{season.element}）</div>
                  <div className="text-xs text-gray-400">{t('game.infoPanel.seasonsBasisTitle')}</div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 ml-2">
                    <li>{t('game.infoPanel.springRange')}</li>
                    <li>{t('game.infoPanel.springEarthRange')}</li>
                    <li>{t('game.infoPanel.summerRange')}</li>
                    <li>{t('game.infoPanel.summerEarthRange')}</li>
                    <li>{t('game.infoPanel.autumnRange')}</li>
                    <li>{t('game.infoPanel.autumnEarthRange')}</li>
                    <li>{t('game.infoPanel.winterRange')}</li>
                    <li>{t('game.infoPanel.winterEarthRange')}</li>
                  </ul>
                  <div className="mt-2 text-xs text-gray-400">
                    <div className="font-bold text-white mb-1">{t('game.infoPanel.probExplanationTitle')}</div>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>{t('game.infoPanel.seasonMiddleDesc')}</li>
                      <li>{t('game.infoPanel.seasonBoundaryDesc')}</li>
                      <li>{t('game.infoPanel.earthPeriodDesc')}</li>
                      <li>{t('game.infoPanel.probLinearDesc')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 属性克制关系表格 */}
            <div className="border-t border-white/10 pt-3">
              <div className="font-bold text-white mb-3">{t('game.infoPanel.elementAdvantageTableTitle')}</div>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.elementHeader')}</th>
                      <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.advantageHeader')}</th>
                      <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.disadvantageHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center font-bold py-2 px-2">{t('elements.metal')}</td>
                      <td className="text-center text-green-400 py-2 px-2">{t('elements.wood')}</td>
                      <td className="text-center text-red-400 py-2 px-2">{t('elements.fire')}</td>
                    </tr>
                    <tr>
                      <td className="text-center font-bold py-2 px-2">{t('elements.wood')}</td>
                      <td className="text-center text-green-400 py-2 px-2">{t('elements.earth')}</td>
                      <td className="text-center text-red-400 py-2 px-2">{t('elements.metal')}</td>
                    </tr>
                    <tr>
                      <td className="text-center font-bold py-2 px-2">{t('elements.water')}</td>
                      <td className="text-center text-green-400 py-2 px-2">{t('elements.fire')}</td>
                      <td className="text-center text-red-400 py-2 px-2">{t('elements.earth')}</td>
                    </tr>
                    <tr>
                      <td className="text-center font-bold py-2 px-2">{t('elements.fire')}</td>
                      <td className="text-center text-green-400 py-2 px-2">{t('elements.metal')}</td>
                      <td className="text-center text-red-400 py-2 px-2">{t('elements.water')}</td>
                    </tr>
                    <tr>
                      <td className="text-center font-bold py-2 px-2">{t('elements.earth')}</td>
                      <td className="text-center text-green-400 py-2 px-2">{t('elements.water')}</td>
                      <td className="text-center text-red-400 py-2 px-2">{t('elements.wood')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-2 bg-white/5 rounded text-xs text-gray-300">
                <div className="font-bold text-white mb-1">{t('game.infoPanel.advantageExplanationTitle')}</div>
                <p>{t('game.infoPanel.advantageExplanationText')}</p>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('common.close')}</button>
        </form>
      </dialog>

      {/* 类型出现概率详情弹窗 */}
      <dialog id="monster_type_probability_modal" className="modal">
        <div className="modal-box max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] my-4 mx-4 bg-gray-900 border border-white/20 flex flex-col">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white z-10">✕</button>
          </form>
          <h3 className="font-bold text-lg text-white mb-4 shrink-0">{t('game.infoPanel.typeProbModalTitle')}</h3>
          <div className="space-y-4 text-sm text-white overflow-y-auto flex-1 pr-2">
            <div>
              <div className="font-bold text-white mb-2">{t('game.infoPanel.rulesTitle')}</div>
              <div className="text-gray-300 text-xs space-y-2">
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('game.infoPanel.beamRule')}</li>
                  <li>{t('game.infoPanel.bauhausRule')}</li>
                  <li>{t('game.infoPanel.pixelRule')}</li>
                  <li>{t('game.infoPanel.sunsetRule')}</li>
                  <li>{t('game.infoPanel.ringRule')}</li>
                  <li>{t('game.infoPanel.marbleRule')}</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="font-bold text-white mb-2">{t('game.infoPanel.currentLevelTypeProbTitle')}</div>
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.typeHeader')}</th>
                      <th className="text-gray-300 text-center py-2 px-2 bg-white/5">{t('game.infoPanel.currentProbHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monsterTypeProbabilities.map((item) => (
                      <tr key={item.name}>
                        <td className="text-center font-bold py-2 px-2">{item.name}</td>
                        <td className="text-center py-2 px-2">{item.probability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="font-bold text-white mb-2">{t('game.infoPanel.typeProbChangesTitle')}</div>
              <div className="overflow-x-auto">
                <table className="table w-full text-[10px] compact">
                  <thead>
                    <tr>
                      <th className="text-gray-300 py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                      <th className="text-gray-300 py-1 px-2">beam</th>
                      <th className="text-gray-300 py-1 px-2">bauhaus</th>
                      <th className="text-gray-300 py-1 px-2">pixel</th>
                      <th className="text-gray-300 py-1 px-2">sunset</th>
                      <th className="text-gray-300 py-1 px-2">ring</th>
                      <th className="text-gray-300 py-1 px-2">marble</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => {
                      const lvl = i + 1;
                      const beamProb = 400 + Math.floor((lvl - 1) * 300 / 9);
                      const bauhausProb = beamProb + Math.floor(250 - (lvl - 1) * 50 / 9);
                      const pixelProb = bauhausProb + Math.floor(150 - (lvl - 1) * 80 / 9);
                      const sunsetProb = pixelProb + Math.floor(100 - (lvl - 1) * 80 / 9);
                      const ringProb = sunsetProb + Math.floor(60 - (lvl - 1) * 52 / 9);
                      const beamPct = (beamProb / 10).toFixed(1) + '%';
                      const bauhausPct = ((bauhausProb - beamProb) / 10).toFixed(1) + '%';
                      const pixelPct = ((pixelProb - bauhausProb) / 10).toFixed(1) + '%';
                      const sunsetPct = ((sunsetProb - pixelProb) / 10).toFixed(1) + '%';
                      const ringPct = ((ringProb - sunsetProb) / 10).toFixed(1) + '%';
                      const marblePct = ((1000 - ringProb) / 10).toFixed(1) + '%';
                      return (
                        <tr key={lvl}>
                          <td className="py-1 px-2 text-center font-bold">{lvl}</td>
                          <td className="py-1 px-2 text-center">{beamPct}</td>
                          <td className="py-1 px-2 text-center">{bauhausPct}</td>
                          <td className="py-1 px-2 text-center">{pixelPct}</td>
                          <td className="py-1 px-2 text-center">{sunsetPct}</td>
                          <td className="py-1 px-2 text-center">{ringPct}</td>
                          <td className="py-1 px-2 text-center">{marblePct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
        </form>
      </dialog>
    </>
  );
}
