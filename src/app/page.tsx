'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import {
  Zap,
  Coins,
  PartyPopper,
  Sword,
  Target,
  Gift,
  Clock,
  RefreshCw,
  Dice1,
  Info,
  HelpCircle,
} from 'lucide-react';
import {
  getUserNFTs,
  getNFTCurrentEnemy,
  getUserPendingBattleCommitments,
  getNextEnemyRandomTime,
  getFullNFTInfo,
  getGameConfig,
  getActiveNFT,
  type NFTMintedEvent,
  type EnemyInfo,
  type HealthNFT,
  suiClient,
  createRandomEnemyTransaction,
  createBattleCommitTransaction,
  createBattleRevealTransaction,
  createCancelBattleCommitmentTransaction,
  createCaptureCommitTransaction,
  createCaptureRevealTransaction,
  createCancelCaptureCommitmentTransaction,
} from '@/sui';
import { envConfig } from '@/config/environment';
import { generateBattleCommitmentHash, calculateWinProbability, calculateCaptureLevelPenaltyFactor, getElementAdvantage, getGoldenMonsterWinProb } from '@/utils/battleHelpers';
import {
  calculateEnemyRerandomCooldown,
  calculateBattleRevealDelay,
  getElementKey,
  getMonsterTypeName,
  formatTime,
} from '@/utils/gameHelpers';
import {
  BattleResultNotification,
  BottomActions,
  GameInfoPanel,
  AvatarDisplay,
  BuyNftButton,
  Message,
  GoldenMonsterRewardModal,
} from '@/components';
import type { MessageType } from '@/components/Message';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';

const CONTRACT_PACKAGE_ID = envConfig.contractPackageId;
const CONTRACT_OBJECT_ID = envConfig.contractObjectId;

// 验证配置
if (!CONTRACT_PACKAGE_ID || !CONTRACT_OBJECT_ID) {
  console.error('合约配置缺失:', {
    packageId: CONTRACT_PACKAGE_ID,
    objectId: CONTRACT_OBJECT_ID,
    network: envConfig.suiNetwork,
  });
}

// 根据季节获取背景颜色
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const getSeason = (): Season => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

const getSeasonalBackground = (): string => {
  const season = getSeason();
  switch (season) {
    case 'spring':
      // 春季：柔和的绿色、粉色、淡蓝色渐变（新绿、樱花）
      return 'bg-gradient-to-b from-emerald-900/90 via-pink-900/60 to-sky-900/90';
    case 'summer':
      // 夏季：清新的蓝色、青色渐变（海洋、天空）
      return 'bg-gradient-to-b from-blue-900/95 via-cyan-900/70 to-teal-900/95';
    case 'autumn':
      // 秋季：温暖的橙色、红色、琥珀色渐变（落叶、丰收）
      return 'bg-gradient-to-b from-amber-900/90 via-orange-900/70 to-red-900/90';
    case 'winter':
      // 冬季：冷色调的蓝色、紫色渐变（雪、冰）
      return 'bg-gradient-to-b from-slate-900/95 via-indigo-900/80 to-violet-900/95';
    default:
      return 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900';
  }
};

const getSeasonalDecorations = (): { top: string; bottom: string; center: string } => {
  const season = getSeason();
  switch (season) {
    case 'spring':
      return {
        top: 'bg-green-400',
        bottom: 'bg-pink-400',
        center: 'bg-blue-400',
      };
    case 'summer':
      return {
        top: 'bg-cyan-400',
        bottom: 'bg-teal-400',
        center: 'bg-blue-400',
      };
    case 'autumn':
      return {
        top: 'bg-orange-400',
        bottom: 'bg-red-400',
        center: 'bg-amber-400',
      };
    case 'winter':
      return {
        top: 'bg-indigo-400',
        bottom: 'bg-violet-400',
        center: 'bg-blue-400',
      };
    default:
      return {
        top: 'bg-blue-500',
        bottom: 'bg-purple-500',
        center: 'bg-indigo-500',
      };
  }
};

// 根据季节返回与背景呼应的主行动按钮渐变
const getSeasonalPrimaryButtonClasses = (): string => {
  const season = getSeason();
  switch (season) {
    case 'spring':
      // 春季：新绿与天空色
      return 'bg-gradient-to-r from-emerald-500 to-sky-600 hover:from-emerald-600 hover:to-sky-700';
    case 'summer':
      // 夏季：清爽的天蓝与青色
      return 'bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700';
    case 'autumn':
      // 秋季：琥珀与橙色的温暖渐变
      return 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700';
    case 'winter':
      // 冬季：靛蓝到紫罗兰的冷色渐变
      return 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700';
    default:
      return 'bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700';
  }
};

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { t } = useI18n();

  const [playerNFT, setPlayerNFT] = useState<NFTMintedEvent | null>(null);
  const [fullNFTInfo, setFullNFTInfo] = useState<HealthNFT | null>(null);
  const [enemyInfo, setEnemyInfo] = useState<EnemyInfo | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [battling, setBattling] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isLoadingGameConfig, setIsLoadingGameConfig] = useState(true);
  const [isLoadingUserNFT, setIsLoadingUserNFT] = useState(false);
  const [isRestoringBattleState, setIsRestoringBattleState] = useState(false);
  const [isRestoringCaptureState, setIsRestoringCaptureState] = useState(false);
  const [battleCommitmentId, setBattleCommitmentId] = useState<string | null>(null);
  const [battleSecret, setBattleSecret] = useState<string | null>(null);
  const [battleCountdown, setBattleCountdown] = useState<number>(0);
  const [battleStartTime, setBattleStartTime] = useState<number | null>(null);
  // 金币怪提交阶段限时（10分钟）倒计时（单位：秒）
  const [goldenCommitCountdown, setGoldenCommitCountdown] = useState<number>(0);
  const [battleCommitLevel, setBattleCommitLevel] = useState<number | null>(null); // 提交战斗承诺时的NFT等级
  const [captureCommitmentId, setCaptureCommitmentId] = useState<string | null>(null);
  const [captureSecret, setCaptureSecret] = useState<string | null>(null);
  const [captureCountdown, setCaptureCountdown] = useState<number>(0);
  const [captureStartTime, setCaptureStartTime] = useState<number | null>(null);
  const [captureCommitLevel, setCaptureCommitLevel] = useState<number | null>(null); // 提交抓捕承诺时的NFT等级

  // 游戏配置（金币怪奖励）
  const [minGoldenMonsterReward, setMinGoldenMonsterReward] = useState<number>(10000000); // 默认 0.01 SUI
  const [maxGoldenMonsterReward, setMaxGoldenMonsterReward] = useState<number>(100000000); // 默认 0.1 SUI

  // 根据玩家NFT等级动态计算的刷新时间和战斗延迟（秒）
  // 这些值会根据玩家NFT等级自动计算
  const getEnemyRerandomCooldownSeconds = (): number => {
    if (!fullNFTInfo) return 600; // 默认10分钟（1级）
    const ms = calculateEnemyRerandomCooldown(fullNFTInfo.level);
    return Math.floor(ms / 1000);
  };

  const getBattleRevealDelaySeconds = (): number => {
    if (!fullNFTInfo) return 180; // 默认3分钟（1级）
    const ms = calculateBattleRevealDelay(fullNFTInfo.level);
    return Math.floor(ms / 1000);
  };

  // 敌人刷新冷却时间
  const [enemyCooldownEndTime, setEnemyCooldownEndTime] = useState<number | null>(null);
  const [enemyCooldownRemaining, setEnemyCooldownRemaining] = useState<number>(0);

  // 金币怪限时战斗（提交阶段）倒计时逻辑：基于敌人生成时间 + 10分钟
  useEffect(() => {
    // 仅在当前有敌人且为金币怪、且还未提交战斗承诺时启用倒计时
    if (enemyInfo && enemyInfo.isGoldenMonster && !battleCommitmentId) {
      const timeoutMs = 10 * 60 * 1000; // 10分钟
      const deadline = (enemyInfo.generatedAt || 0) + timeoutMs;
      const update = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
        setGoldenCommitCountdown(remaining);
      };
      update();
      const id = setInterval(update, 1000);
      return () => clearInterval(id);
    } else {
      setGoldenCommitCountdown(0);
    }
  }, [enemyInfo?.generatedAt, enemyInfo?.isGoldenMonster, battleCommitmentId]);

  // 战斗结果显示
  const [battleResult, setBattleResult] = useState<{
    isWin: boolean;
    experienceGained: number;
    levelIncreased: boolean;
    isGoldenMonster: boolean;
    rewardAmount: number;
  } | null>(null);
  // 逃跑状态
  const [escaping, setEscaping] = useState(false);

  // 底部操作面板状态
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMarket, setShowMarket] = useState(false);

  // Message 通知状态
  const [messageConfig, setMessageConfig] = useState<{
    type: MessageType;
    title?: string;
    message: string;
    autoClose?: boolean;
  } | null>(null);

  // 显示 Message 的辅助函数
  const showAlert = (
    type: MessageType,
    message: string,
    title?: string,
    capturedMonster?: {
      level: number;
      element: number;
      monsterType?: number;
      probability: number;
    },
    autoClose = true
  ) => {
    // 如果有捕获的怪物信息，格式化到消息中
    let finalMessage = message;
    if (capturedMonster) {
      const monsterInfo = [
        `${t('common.level')}: Lv.${capturedMonster.level}`,
        `${t('common.element')}: ${t('elements.' + getElementKey(capturedMonster.element))}`,
        capturedMonster.monsterType !== undefined
          ? `${t('common.type')}: ${getMonsterTypeName(capturedMonster.monsterType)}`
          : '',
        `${t('common.successRate')}: ${capturedMonster.probability.toFixed(1)}%`,
      ].filter(Boolean).join('\n');
      finalMessage = `${message}\n\n${monsterInfo}`;
    }

    setMessageConfig({
      type,
      title,
      message: finalMessage,
      autoClose,
    });
  };

  // 加载游戏配置（只加载金币怪奖励配置）
  const fetchGameConfig = async () => {
    setIsLoadingGameConfig(true);
    try {
      const config = await getGameConfig();

      const minReward = Number(config.minGoldenMonsterReward);
      const maxReward = Number(config.maxGoldenMonsterReward);

      setMinGoldenMonsterReward(minReward);
      setMaxGoldenMonsterReward(maxReward);

      console.log('游戏配置已加载:', {
        minGoldenMonsterReward: minReward,
        maxGoldenMonsterReward: maxReward,
      });
    } catch (error) {
      console.error('加载游戏配置失败:', error);
    } finally {
      setIsLoadingGameConfig(false);
    }
  };

  // 获取用户的NFT（优先使用激活的NFT）
  const fetchUserNFT = async (skipEnemyUpdate = false): Promise<boolean> => {
    setIsLoadingUserNFT(true);
    if (!account?.address) {
      setIsLoadingUserNFT(false);
      return false;
    }

    try {
      // 优先获取当前激活的NFT
      const activeNFTId = await getActiveNFT(account.address);
      let targetNFT: NFTMintedEvent | null = null;

      if (activeNFTId > 0) {
        // 如果设置了激活的NFT，获取其完整信息
        try {
          const fullInfo = await getFullNFTInfo(activeNFTId);
          if (fullInfo && fullInfo.owner.toLowerCase() === account.address.toLowerCase()) {
            if (fullInfo.is_listed) {
              console.warn('激活的NFT正在上架，跳过:', activeNFTId);
            } else {
              targetNFT = {
                nftId: fullInfo.nftId,
                owner: fullInfo.owner,
                element: fullInfo.element,
                monsterType: fullInfo.monsterType ?? 0,
                level: fullInfo.level,
                timestamp: fullInfo.mintTime,
              };
              console.log('使用激活的NFT:', activeNFTId);
            }
          }
        } catch (error) {
          console.warn('获取激活NFT信息失败，回退到默认NFT:', error);
        }
      }

      // 如果没有激活的NFT或获取失败，使用默认逻辑（选择第一个未上架的NFT）
      if (!targetNFT) {
        const nfts = await getUserNFTs(account.address);
        for (const nft of nfts) {
          const fullInfo = await getFullNFTInfo(nft.nftId);
          if (fullInfo && !fullInfo.is_listed) {
            targetNFT = nft;
            console.log('使用默认NFT（第一个未上架的）:', targetNFT.nftId);
            break; // Found an unlisted NFT, break the loop
          }
        }
        if (!targetNFT && nfts.length > 0) {
          console.log('所有NFT都已上架，无法选择活跃NFT。');
        }
      }

      if (targetNFT) {
        const fullInfo = await getFullNFTInfo(targetNFT.nftId);

        if (fullInfo) {
          setPlayerNFT({
            ...targetNFT,
            level: fullInfo.level,
          });
          setFullNFTInfo(fullInfo);
        } else {
          setPlayerNFT(targetNFT);
        }

        // 只有在没有跳过敌人更新标志时才更新敌人信息
        // 这样可以避免在有战斗承诺时覆盖掉 commitment 中保存的敌人信息
        if (!skipEnemyUpdate) {
          const enemy = await getNFTCurrentEnemy(targetNFT.nftId);
          setEnemyInfo(enemy);
        }

        const nextRandomTime = await getNextEnemyRandomTime(targetNFT.nftId);
        if (nextRandomTime > 0) {
          const now = Date.now();
          const remainingMs = Math.max(0, nextRandomTime - now);
          const remainingSeconds = Math.floor(remainingMs / 1000);

          if (remainingSeconds > 0) {
            setEnemyCooldownEndTime(nextRandomTime);
            setEnemyCooldownRemaining(remainingSeconds);
          } else {
            setEnemyCooldownEndTime(null);
            setEnemyCooldownRemaining(0);
          }
        } else {
          setEnemyCooldownEndTime(null);
          setEnemyCooldownRemaining(0);
        }

        return !!fullInfo;
      } else {
        setPlayerNFT(null);
        setFullNFTInfo(null);
        setEnemyInfo(null);
        setEnemyCooldownEndTime(null);
        setEnemyCooldownRemaining(0);
        return false;
      }
    } catch (error) {
      console.error('获取NFT失败:', error);
      return false;
    } finally {
      setIsLoadingUserNFT(false);
    }
  };

  // 恢复战斗状态（只恢复与当前激活NFT相关的战斗状态）
  // 返回 true 表示成功恢复了战斗状态（有未揭示的战斗承诺）
  const restoreBattleState = async (): Promise<boolean> => {
    setIsRestoringBattleState(true);
    if (!account?.address) {
      setIsRestoringBattleState(false);
      return false;
    }

    try {
      // 获取当前激活的NFT ID
      const activeNFTId = await getActiveNFT(account.address);

      // 如果没有激活的NFT，不清除战斗状态但不恢复
      if (activeNFTId === 0) {
        console.log('没有激活的NFT，跳过战斗状态恢复');
        return false;
      }

      const commitments = await getUserPendingBattleCommitments(account.address);
      console.log('查询到的战斗承诺:', commitments);

      // 只查找与当前激活NFT相关的未揭示战斗承诺
      if (commitments.length > 0) {
        const activeCommitment = commitments.find(
          c => !c.isRevealed && c.nftId === activeNFTId
        );

        if (activeCommitment && !activeCommitment.isRevealed) {
          console.log('找到活跃的战斗承诺:', activeCommitment);

          const savedSecret =
            localStorage.getItem(`battle_secret_${activeCommitment.nftId}`) ||
            localStorage.getItem('battle_secret');

          if (savedSecret) {
            console.log('从 localStorage 恢复 secret');

            setBattleCommitmentId(activeCommitment.id);
            setBattleSecret(savedSecret);
            setEnemyInfo(activeCommitment.enemyInfo);
            console.log('从战斗承诺恢复敌人信息:', activeCommitment.enemyInfo);

            // 使用提交时的等级（从commitment中获取）
            const nftLevelForDelay = activeCommitment.playerLevel;
            setBattleCommitLevel(nftLevelForDelay); // 保存提交时的等级

            try {
              const fullInfo = await getFullNFTInfo(activeCommitment.nftId);
              if (fullInfo) {
                console.log('从链上恢复 NFT 信息:', fullInfo);
                const nftEvent: NFTMintedEvent = {
                  nftId: activeCommitment.nftId,
                  owner: account.address,
                  element: activeCommitment.playerElement,
                  monsterType: fullInfo.monsterType ?? 0,
                  level: fullInfo.level, // 使用当前等级（显示用）
                  timestamp: Date.now(),
                };
                setPlayerNFT(nftEvent);
                setFullNFTInfo(fullInfo);
              }
            } catch (error) {
              console.error('恢复 NFT 信息失败:', error);
            }

            // 根据提交时的玩家等级计算延迟时间
            const delayMs = calculateBattleRevealDelay(nftLevelForDelay);
            const delaySeconds = Math.floor(delayMs / 1000);

            console.log('恢复战斗状态时的配置:', {
              nftLevelForDelay,
              delayMs,
              delaySeconds,
              activeNFTId,
            });

            const committedAt = activeCommitment.committedAt;
            const now = Date.now();
            const elapsed = Math.floor((now - committedAt) / 1000);
            const remaining = Math.max(0, delaySeconds - elapsed);

            console.log('倒计时计算:', {
              committedAt: new Date(committedAt).toISOString(),
              now: new Date(now).toISOString(),
              elapsed,
              delaySeconds,
              remaining,
            });

            setBattleCountdown(remaining);

            if (remaining > 0) {
              setBattleStartTime(committedAt);
            } else {
              setBattleStartTime(null);
            }

            console.log('战斗状态已恢复:', {
              commitmentId: activeCommitment.id,
              nftId: activeCommitment.nftId,
              remaining,
              enemyInfo: activeCommitment.enemyInfo,
              committedAt: new Date(committedAt).toISOString(),
            });

            try {
              const nextRandomTime = await getNextEnemyRandomTime(activeCommitment.nftId);
              if (nextRandomTime > 0) {
                const now = Date.now();
                const remainingMs = Math.max(0, nextRandomTime - now);
                const remainingSeconds = Math.floor(remainingMs / 1000);

                if (remainingSeconds > 0) {
                  setEnemyCooldownEndTime(nextRandomTime);
                  setEnemyCooldownRemaining(remainingSeconds);
                } else {
                  setEnemyCooldownEndTime(null);
                  setEnemyCooldownRemaining(0);
                }
              } else {
                setEnemyCooldownEndTime(null);
                setEnemyCooldownRemaining(0);
              }
            } catch (error) {
              console.error('查询敌人冷却时间失败:', error);
            }

            // 成功恢复战斗状态
            return true;
          } else {
            console.warn('找到战斗承诺但没有对应的 secret，可能需要重新开始战斗');
            console.warn('承诺信息:', {
              id: activeCommitment.id,
              nftId: activeCommitment.nftId,
              committedAt: new Date(activeCommitment.committedAt).toISOString(),
            });
            return false;
          }
        }
      } else {
        console.log('没有找到待处理的战斗承诺');
      }
    } catch (error) {
      console.error('恢复战斗状态失败:', error);
      console.error('错误详情:', error);
    } finally {
      setIsRestoringBattleState(false);
    }

    // 没有恢复战斗状态
    return false;
  };

  // 恢复抓捕状态（从localStorage恢复承诺信息，敌人信息从链上获取）
  const restoreCaptureState = async (nftId?: number): Promise<boolean> => {
    setIsRestoringCaptureState(true);
    if (!account?.address) {
      setIsRestoringCaptureState(false);
      return false;
    }

    try {
      // 如果没有提供nftId，尝试从activeNFT获取
      let targetNftId = nftId;
      if (!targetNftId) {
        const activeNFTId = await getActiveNFT(account.address);
        if (activeNFTId === 0) {
          console.log('没有激活的NFT，跳过抓捕状态恢复');
          return false;
        }
        targetNftId = activeNFTId;
      }

      // 从localStorage恢复抓捕承诺
      const savedCommitment = localStorage.getItem(`capture_commitment_${targetNftId}`);

      if (savedCommitment) {
        try {
          const captureData = JSON.parse(savedCommitment);
          console.log('找到保存的抓捕承诺:', captureData);

          // 恢复承诺状态
          setCaptureCommitmentId(captureData.commitmentId);
          setCaptureSecret(captureData.secret);
          setCaptureCommitLevel(captureData.commitLevel);

          // 计算倒计时
          const delayMs = calculateBattleRevealDelay(captureData.commitLevel);
          const delaySeconds = Math.floor(delayMs / 1000);

          const committedAt = captureData.startTime;
          const now = Date.now();
          const elapsed = Math.floor((now - committedAt) / 1000);
          const remaining = Math.max(0, delaySeconds - elapsed);

          console.log('抓捕倒计时计算:', {
            committedAt: new Date(committedAt).toISOString(),
            now: new Date(now).toISOString(),
            elapsed,
            delaySeconds,
            remaining,
          });

          setCaptureCountdown(remaining);

          if (remaining > 0) {
            setCaptureStartTime(committedAt);
          } else {
            setCaptureStartTime(null);
          }

          console.log('抓捕状态已恢复，敌人信息从链上NFT获取');
          return true;
        } catch (error) {
          console.error('解析抓捕承诺数据失败:', error);
          return false;
        }
      } else {
        console.log('没有找到保存的抓捕承诺');
      }
    } catch (error) {
      console.error('恢复抓捕状态失败:', error);
    } finally {
      setIsRestoringCaptureState(false);
    }

    return false;
  };

  // 初始化：加载游戏配置
  useEffect(() => {
    fetchGameConfig();
  }, []);

  // 当NFT信息加载后，显示基于等级的动态时间配置
  useEffect(() => {
    if (fullNFTInfo) {
      // 直接在这里计算，避免依赖函数
      const rerandomCooldownMs = calculateEnemyRerandomCooldown(fullNFTInfo.level);
      const battleDelayMs = calculateBattleRevealDelay(fullNFTInfo.level);
      const rerandomCooldown = Math.floor(rerandomCooldownMs / 1000);
      const battleDelay = Math.floor(battleDelayMs / 1000);

      console.log('玩家NFT等级相关配置:', {
        playerLevel: fullNFTInfo.level,
        calculatedRerandomCooldown: `${rerandomCooldown}秒 (${Math.floor(rerandomCooldown / 60)}分钟)`,
        calculatedBattleDelay: `${battleDelay}秒 (${Math.floor(battleDelay / 60)}分钟)`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullNFTInfo?.level]);

  // 监听市场购买NFT事件，自动刷新
  useEffect(() => {
    const handleNFTPurchased = async () => {
      console.log('收到NFT购买事件，刷新主页面数据...');
      if (account?.address) {
        // 清除当前的战斗状态（购买后NFT可能变更所有权或活跃NFT）
        setBattleCommitmentId(null);
        setBattleSecret(null);
        setBattleStartTime(null);
        setBattleCommitLevel(null);
        setBattleCountdown(0);
        if (playerNFT) {
          localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
        }
        localStorage.removeItem('battle_secret');

        // 清除当前的抓捕状态
        setCaptureCommitmentId(null);
        setCaptureSecret(null);
        setCaptureStartTime(null);
        setCaptureCommitLevel(null);
        setCaptureCountdown(0);
        if (playerNFT) {
          localStorage.removeItem(`capture_commitment_${playerNFT.nftId}`);
        }

        // 等待一段时间后刷新NFT数据（给链上交易确认时间）
        setTimeout(async () => {
          // 先获取NFT信息（跳过敌人更新）
          await fetchUserNFT(true);
          // 尝试恢复战斗状态
          const hadBattleState = await restoreBattleState();
          // 尝试恢复抓捕状态
          const hadCaptureState = await restoreCaptureState();
          // 如果既没有战斗承诺也没有抓捕承诺，再获取敌人信息
          if (!hadBattleState && !hadCaptureState) {
            await fetchUserNFT(false);
          }
          console.log('购买后主页面数据已刷新');
        }, 2000);
      }
    };

    window.addEventListener('nft:purchased', handleNFTPurchased);
    return () => {
      window.removeEventListener('nft:purchased', handleNFTPurchased);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, battleCommitmentId]);

  // 监听NFT选择事件，自动刷新主页面数据
  useEffect(() => {
    const handleNFTSelected = async (event: Event) => {
      const customEvent = event as CustomEvent<{ nftId: number }>;
      console.log('收到NFT选择事件，刷新主页面数据...', customEvent.detail);

      if (account?.address) {
        // 清除当前的战斗状态（因为切换了NFT）
        setBattleCommitmentId(null);
        setBattleSecret(null);
        setBattleStartTime(null);
        setBattleCommitLevel(null);
        setBattleCountdown(0);
        if (playerNFT) {
          localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
        }
        localStorage.removeItem('battle_secret');

        // 清除当前的抓捕状态
        setCaptureCommitmentId(null);
        setCaptureSecret(null);
        setCaptureStartTime(null);
        setCaptureCommitLevel(null);
        setCaptureCountdown(0);
        if (playerNFT) {
          localStorage.removeItem(`capture_commitment_${playerNFT.nftId}`);
        }

        // 等待一段时间后刷新NFT数据（给交易确认时间）
        setTimeout(async () => {
          // 先获取NFT信息（跳过敌人更新）
          await fetchUserNFT(true);
          // 尝试恢复战斗状态
          const hadBattleState = await restoreBattleState();
          // 尝试恢复抓捕状态
          const hadCaptureState = await restoreCaptureState();
          // 如果既没有战斗承诺也没有抓捕承诺，再获取敌人信息
          if (!hadBattleState && !hadCaptureState) {
            await fetchUserNFT(false);
          }
          console.log('主页面数据已刷新');
        }, 2000);
      }
    };

    window.addEventListener('nft:selected', handleNFTSelected);
    return () => {
      window.removeEventListener('nft:selected', handleNFTSelected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, playerNFT]);

  useEffect(() => {
    if (account?.address) {
      const initializeState = async () => {
        await fetchGameConfig();

        // 先获取NFT信息（但跳过敌人信息更新）
        await fetchUserNFT(true);

        // 尝试恢复战斗状态（会从 commitment 中恢复敌人信息）
        const hadBattleState = await restoreBattleState();

        // 尝试恢复抓捕状态（承诺信息从localStorage，敌人信息从链上NFT）
        const hadCaptureState = await restoreCaptureState();

        // 如果既没有战斗承诺也没有抓捕承诺，再获取当前敌人信息
        if (!hadBattleState && !hadCaptureState) {
          await fetchUserNFT(false);
        }
      };
      initializeState();
    } else {
      setPlayerNFT(null);
      setFullNFTInfo(null);
      setEnemyInfo(null);
      setBattleCommitmentId(null);
      setBattleSecret(null);
      setBattleStartTime(null);
      setBattleCommitLevel(null);
      setBattleCountdown(0);
      if (playerNFT) {
        localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
      }
      localStorage.removeItem('battle_secret');

      // 清除抓捕状态
      setCaptureCommitmentId(null);
      setCaptureSecret(null);
      setCaptureStartTime(null);
      setCaptureCommitLevel(null);
      setCaptureCountdown(0);
      if (playerNFT) {
        localStorage.removeItem(`capture_commitment_${playerNFT.nftId}`);
      }

      // 确保在未连接钱包时不显示全局加载层
      setIsLoadingUserNFT(false);
      setIsRestoringBattleState(false);
      setIsRestoringCaptureState(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  // 战斗倒计时逻辑
  // 使用提交战斗承诺时的等级计算延迟时间，而不是当前等级
  useEffect(() => {
    if (battleStartTime !== null && battleCommitLevel !== null) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - battleStartTime) / 1000);
        // 使用提交时的等级计算延迟
        const delayMs = calculateBattleRevealDelay(battleCommitLevel);
        const delaySeconds = Math.floor(delayMs / 1000);
        const remaining = Math.max(0, delaySeconds - elapsed);

        setBattleCountdown(remaining);

        if (remaining === 0) {
          setBattleStartTime(null);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [battleStartTime, battleCommitLevel]);

  // 抓捕倒计时逻辑
  // 使用提交抓捕承诺时的等级计算延迟时间，而不是当前等级
  useEffect(() => {
    if (captureStartTime !== null && captureCommitLevel !== null) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - captureStartTime) / 1000);
        // 使用提交时的等级计算延迟
        const delayMs = calculateBattleRevealDelay(captureCommitLevel);
        const delaySeconds = Math.floor(delayMs / 1000);
        const remaining = Math.max(0, delaySeconds - elapsed);

        setCaptureCountdown(remaining);

        if (remaining === 0) {
          setCaptureStartTime(null);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [captureStartTime, captureCommitLevel]);

  // 敌人刷新冷却倒计时逻辑
  useEffect(() => {
    if (enemyCooldownEndTime !== null && enemyCooldownEndTime > Date.now()) {
      const timer = setInterval(() => {
        const now = Date.now();
        const remainingMs = Math.max(0, enemyCooldownEndTime - now);
        const remainingSeconds = Math.floor(remainingMs / 1000);

        setEnemyCooldownRemaining(remainingSeconds);

        if (remainingSeconds === 0) {
          setEnemyCooldownEndTime(null);
        }
      }, 1000);

      return () => clearInterval(timer);
    } else if (enemyCooldownEndTime !== null) {
      setEnemyCooldownEndTime(null);
      setEnemyCooldownRemaining(0);
    }
  }, [enemyCooldownEndTime]);

  // 购买NFT成功后的回调（暂时不使用）
  // const handleBuyNFTSuccess = async () => {
  //   let retryCount = 0;
  //   const maxRetries = 10;
  //   const retryDelay = 2000;

  //   const tryFetchNFT = async () => {
  //     try {
  //       // 购买NFT后不会有战斗承诺，可以直接获取完整信息
  //       const success = await fetchUserNFT(false);

  //       if (success) {
  //         console.log('NFT信息（包括等级和敌人）获取成功');
  //         return;
  //       }

  //       retryCount++;
  //       if (retryCount < maxRetries) {
  //         console.log(`获取NFT信息中... (${retryCount}/${maxRetries})`);
  //         setTimeout(tryFetchNFT, retryDelay);
  //       } else {
  //         console.warn('获取NFT信息超时，请手动刷新页面');
  //         setTimeout(() => fetchUserNFT(false), 1000);
  //       }
  //     } catch (error) {
  //       console.error('获取NFT信息失败，重试中...', error);
  //       retryCount++;
  //       if (retryCount < maxRetries) {
  //         setTimeout(tryFetchNFT, retryDelay);
  //       }
  //     }
  //   };

  //   setTimeout(tryFetchNFT, 2000);
  // };

  // 购买NFT成功后的回调
  const handleBuyNFTSuccess = async () => {
    console.log('购买NFT成功，刷新数据...');
    setTimeout(async () => {
      if (account?.address) {
        await fetchUserNFT(false);
      }
    }, 2000);
  };

  // 随机生成敌人
  const handleRandomEnemy = () => {
    if (!account || !playerNFT) {
      return;
    }

    setRandomizing(true);
    try {
      const tx = createRandomEnemyTransaction(playerNFT.nftId);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('随机敌人成功:', result);
            setTimeout(async () => {
              if (playerNFT) {
                const enemy = await getNFTCurrentEnemy(playerNFT.nftId);
                setEnemyInfo(enemy);

                const fullInfo = await getFullNFTInfo(playerNFT.nftId);
                if (fullInfo) {
                  setFullNFTInfo(fullInfo);
                  setPlayerNFT({
                    ...playerNFT,
                    level: fullInfo.level,
                  });
                }

                const nextRandomTime = await getNextEnemyRandomTime(playerNFT.nftId);
                if (nextRandomTime > 0) {
                  const now = Date.now();
                  const remainingMs = Math.max(0, nextRandomTime - now);
                  const remainingSeconds = Math.floor(remainingMs / 1000);

                  if (remainingSeconds > 0) {
                    setEnemyCooldownEndTime(nextRandomTime);
                    setEnemyCooldownRemaining(remainingSeconds);
                  } else {
                    setEnemyCooldownEndTime(null);
                    setEnemyCooldownRemaining(0);
                  }
                } else {
                  setEnemyCooldownEndTime(null);
                  setEnemyCooldownRemaining(0);
                }
              }
            }, 3000);
            setRandomizing(false);
          },
          onError: (error) => {
            console.error('随机敌人失败:', error);
            showAlert('error', error.message || t('common.unknown'), t('alerts.randomizeEnemyFail'));
            setRandomizing(false);
          },
        }
      );
    } catch (error) {
      console.error('创建交易失败:', error);
      setRandomizing(false);
    }
  };

  // 取消战斗承诺（逃跑）
  const handleCancelBattleCommit = () => {
    if (!account || !playerNFT || !battleCommitmentId) {
      return;
    }

    setEscaping(true);
    try {
      const tx = createCancelBattleCommitmentTransaction(battleCommitmentId, playerNFT.nftId);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('取消战斗承诺成功:', result);
            showAlert('success', t('alerts.escapeSuccessMessage'), t('alerts.escapeSuccessTitle'));

            // 清除战斗状态与本地secret
            setBattleCommitmentId(null);
            setBattleSecret(null);
            setBattleStartTime(null);
            setBattleCommitLevel(null);
            setBattleCountdown(0);
            if (playerNFT) {
              localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
            }
            localStorage.removeItem('battle_secret');

            // 刷新NFT与敌人信息
            setTimeout(async () => {
              if (playerNFT) {
                await fetchUserNFT(false);
              }
            }, 2000);

            setEscaping(false);
          },
          onError: (error) => {
            console.error('取消战斗承诺失败:', error);
            showAlert('error', error.message || t('common.unknown'), t('alerts.escapeFailTitle'));
            setEscaping(false);
          },
        }
      );
    } catch (error) {
      console.error('创建取消战斗承诺交易失败:', error);
      setEscaping(false);
    }
  };

  // 取消抓捕承诺（逃跑）
  const handleCancelCaptureCommit = () => {
    if (!account || !playerNFT || !captureCommitmentId) {
      return;
    }

    setEscaping(true);
    try {
      const tx = createCancelCaptureCommitmentTransaction(captureCommitmentId, playerNFT.nftId);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('取消抓捕承诺成功:', result);
            showAlert('success', t('alerts.captureEscapeSuccessMessage'), t('alerts.escapeSuccessTitle'));

            // 清除抓捕状态
            setCaptureCommitmentId(null);
            setCaptureSecret(null);
            setCaptureStartTime(null);
            setCaptureCommitLevel(null);
            if (playerNFT) {
              localStorage.removeItem(`capture_commitment_${playerNFT.nftId}`);
            }

            // 刷新NFT与敌人信息
            setTimeout(async () => {
              if (playerNFT) {
                await fetchUserNFT(false);
              }
            }, 2000);

            setEscaping(false);
          },
          onError: (error) => {
            console.error('取消抓捕承诺失败:', error);
            showAlert('error', error.message || t('common.unknown'), t('alerts.escapeFailTitle'));
            setEscaping(false);
          },
        }
      );
    } catch (error) {
      console.error('创建取消抓捕承诺交易失败:', error);
      setEscaping(false);
    }
  };

  // 第一步：提交战斗承诺
  const handleBattleCommit = () => {
    if (!account || !playerNFT || !enemyInfo) {
      return;
    }

    // 金币怪遭遇已超时：允许点击但只弹出提示，不提交交易
    if (enemyInfo.isGoldenMonster && goldenCommitCountdown === 0) {
      showAlert('warning', t('alerts.goldenEncounterTimeout'), t('alerts.goldenEncounterTimeout'));
      return;
    }

    setBattling(true);
    try {
      const secret = Math.random().toString(36).substring(2, 15) + Date.now().toString();
      setBattleSecret(secret);

      const commitmentHash = generateBattleCommitmentHash(
        playerNFT.nftId,
        enemyInfo.level,
        enemyInfo.element,
        secret
      );

      const tx = createBattleCommitTransaction(playerNFT.nftId, commitmentHash);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('战斗承诺提交成功:', result);
            try {
              // 等待交易确认，确保事件/对象变更可用（使用 waitForTransaction）
              await suiClient.waitForTransaction({ digest: result.digest });
              const txResult = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: { showEvents: true, showObjectChanges: true },
              });

              // 从事件中获取承诺地址（按地址揭示/取消）
              const events = (txResult.events ?? []) as Array<{
                type: string;
                parsedJson?: Record<string, unknown>;
              }>;
              // 放宽事件匹配，避免因包ID不一致导致解析失败
              const ev = events.find((e) =>
                typeof e.type === 'string' && e.type.endsWith('::suu::BattleCommitmentCreatedEvent')
              );
              const parsed = ev?.parsedJson as { commitment_id?: unknown; id?: unknown; commitmentId?: unknown } | undefined;
              let commitmentId = parsed?.commitment_id
                ? String(parsed.commitment_id)
                : parsed?.id
                ? String(parsed.id)
                : parsed?.commitmentId
                ? String(parsed.commitmentId)
                : '';

              // 兜底：从对象变更中查找新建的 BattleCommitment 对象ID
              if (!commitmentId) {
                const objChangesUnknown = (txResult as { objectChanges?: unknown }).objectChanges;
                const objChanges = Array.isArray(objChangesUnknown)
                  ? (objChangesUnknown as Array<{ type?: string; objectType?: string; objectId?: string }>)
                  : [];
                const createdCommitment = objChanges.find(
                  (oc) =>
                    oc?.type === 'created' &&
                    typeof oc?.objectType === 'string' &&
                    oc.objectType.endsWith('::suu::BattleCommitment')
                );
                if (createdCommitment?.objectId) {
                  commitmentId = String(createdCommitment.objectId);
                  console.log('通过对象变更获取承诺ID:', commitmentId);
                }
              }
              if (commitmentId) {
                if (playerNFT) {
                  localStorage.setItem(`battle_secret_${playerNFT.nftId}`, secret);
                  console.log('Secret 已保存到 localStorage，key:', `battle_secret_${playerNFT.nftId}`);
                }
                localStorage.setItem('battle_secret', secret);

                const now = Date.now();
                const commitLevel = fullNFTInfo?.level || playerNFT.level; // 保存提交时的等级
                const delayMs = calculateBattleRevealDelay(commitLevel);
                const delaySeconds = Math.floor(delayMs / 1000);

                setBattleCommitmentId(commitmentId);
                setBattleStartTime(now);
                setBattleCommitLevel(commitLevel); // 保存提交时的等级
                setBattleCountdown(delaySeconds);
                console.log('战斗承诺已提交');
                console.log('承诺ID:', commitmentId);
                console.log('NFT ID:', playerNFT.nftId);
                console.log('提交时的等级:', commitLevel);
                console.log('战斗延迟:', delaySeconds, '秒');
                console.log('敌人信息:', enemyInfo);
                console.log('战斗状态已保存在链上，secret已保存到本地');
                console.log('提示：即使刷新页面，战斗状态也会从链上恢复');
              } else {
                throw new Error('未能获取承诺ID');
              }
            } catch (error) {
              console.error('获取承诺ID失败:', error);
              try {
                // 输出更多诊断信息以便生产环境定位问题
                console.log('交易摘要 digest:', result?.digest);
              } catch {}
              showAlert('warning', t('alerts.settleBattleManually'), t('alerts.commitSubmittedNoId'));
            }
            setBattling(false);
          },
          onError: (error) => {
            console.error('战斗承诺失败:', error);
            showAlert('error', error.message || t('common.unknown'), t('alerts.battleCommitFailTitle'));
            setBattleSecret(null);
            setBattleStartTime(null);
            setBattleCommitLevel(null);
            setBattleCountdown(0);
            if (playerNFT) {
              localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
            }
            localStorage.removeItem('battle_secret');
            setBattling(false);
          },
        }
      );
    } catch (error) {
      console.error('创建战斗交易失败:', error);
      setBattleSecret(null);
      setBattleStartTime(null);
      setBattleCountdown(0);
      if (playerNFT) {
        localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
      }
      localStorage.removeItem('battle_secret');
      setBattling(false);
    }
  };

  // 第二步：揭示并结算战斗
  const handleBattleReveal = () => {
    if (!account || !playerNFT || !enemyInfo || !battleCommitmentId || !battleSecret) {
      return;
    }

    setBattling(true);
    try {
      const tx = createBattleRevealTransaction(
        battleCommitmentId,
        playerNFT.nftId,
        enemyInfo.level,
        enemyInfo.element,
        battleSecret,
      );

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('战斗结算成功:', result);
            setBattling(false);

            // 添加重试机制获取战斗事件
            const fetchBattleResult = async (retryCount = 0, maxRetries = 5) => {
              try {
                // 添加延迟，等待节点索引交易
                await new Promise(resolve => setTimeout(resolve, 1000 + retryCount * 500));

                const txResult = await suiClient.getTransactionBlock({
                  digest: result.digest,
                  options: { showEvents: true },
                });

                const battleEvent = txResult.events?.find(
                  (event: { type?: string; parsedJson?: unknown }) => event.type?.includes('BattleEvent')
                );

                if (battleEvent && battleEvent.parsedJson) {
                  const parsed = battleEvent.parsedJson as {
                    is_win: boolean;
                    experience_gained: string | number;
                    level_increased: boolean;
                    is_golden_monster: boolean;
                    reward_amount: string | number;
                  };

                  const battleResultData = {
                    isWin: Boolean(parsed.is_win),
                    experienceGained: Number(parsed.experience_gained || 0),
                    levelIncreased: Boolean(parsed.level_increased || false),
                    isGoldenMonster: Boolean(parsed.is_golden_monster || false),
                    rewardAmount: Number(parsed.reward_amount || 0),
                  };

                  setBattleResult(battleResultData);
                  console.log('战斗结果:', battleResultData);

                  setTimeout(() => {
                    setBattleResult(null);
                  }, 5000);
                } else if (retryCount < maxRetries) {
                  console.log(`未找到战斗事件，重试中... (${retryCount + 1}/${maxRetries})`);
                  await fetchBattleResult(retryCount + 1, maxRetries);
                }
              } catch (error) {
                if (retryCount < maxRetries) {
                  console.log(`获取战斗事件失败，重试中... (${retryCount + 1}/${maxRetries})`, error);
                  await fetchBattleResult(retryCount + 1, maxRetries);
                } else {
                  console.error('获取战斗事件失败（已达最大重试次数）:', error);
                }
              }
            };

            // 开始获取战斗结果
            fetchBattleResult();

            setBattleCommitmentId(null);
            setBattleSecret(null);
            setBattleStartTime(null);
            setBattleCommitLevel(null); // 清除提交时的等级
            setBattleCountdown(0);

            if (playerNFT) {
              localStorage.removeItem(`battle_secret_${playerNFT.nftId}`);
              console.log('战斗结算完成，已清除 secret:', `battle_secret_${playerNFT.nftId}`);
            }
            localStorage.removeItem('battle_secret');

            setTimeout(async () => {
              if (playerNFT) {
                console.log('刷新 NFT 和敌人信息...');
                // 战斗结束后，合约会自动生成新敌人，可以直接获取完整信息
                await fetchUserNFT(false);
                console.log('NFT 和敌人信息已更新');
              }
            }, 3000);
          },
          onError: (error) => {
            console.error('战斗结算失败:', error);
            showAlert('error', error.message || t('common.unknown'), t('alerts.battleRevealFailTitle'));
            setBattling(false);
          },
        }
      );
    } catch (error) {
      console.error('创建结算交易失败:', error);
      setBattling(false);
    }
  };

  // 抓宠
  // 第一步：提交抓捕承诺
  const handleCaptureCommit = () => {
    if (!account || !playerNFT || !enemyInfo) {
      return;
    }

    // 不能抓取金币怪
    if (enemyInfo.isGoldenMonster) {
      showAlert('warning', t('alerts.goldenCannotCapture'), t('alerts.goldenCannotCapture'));
      return;
    }

    setCapturing(true);

    try {
      // 生成随机secret
      const secret = Math.random().toString(36).substring(2, 15);

      const tx = createCaptureCommitTransaction(
        playerNFT.nftId,
        enemyInfo.level,
        enemyInfo.element,
        secret
      );

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('抓捕承诺提交成功:', result);

            // 获取承诺ID（添加延迟等待交易确认）
            try {
              // 直接从事件读取承诺地址
              const txResult = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: { showEvents: true },
              });

              let commitmentId: string | undefined;
              const events = (txResult.events ?? []) as Array<{
                type: string;
                parsedJson?: Record<string, unknown>;
              }>;
              const ev = events.find(
                (e) => e.type === `${CONTRACT_PACKAGE_ID}::suu::CaptureCommitmentCreatedEvent`
              );
              const parsed = ev?.parsedJson as { commitment_id?: string } | undefined;
              if (parsed?.commitment_id) {
                commitmentId = String(parsed.commitment_id);
                console.log('从事件获取承诺地址:', commitmentId);
              }

              if (commitmentId) {
                console.log('抓捕承诺ID:', commitmentId);

                // 只保存必要的承诺信息到localStorage（敌人信息保留在链上）
                const captureData = {
                  commitmentId,
                  secret,
                  startTime: Date.now(),
                  enemyLevel: enemyInfo.level,
                  enemyElement: enemyInfo.element,
                  commitLevel: playerNFT.level,
                };

                setCaptureCommitmentId(commitmentId);
                setCaptureSecret(secret);
                setCaptureStartTime(Date.now());
                setCaptureCommitLevel(playerNFT.level);

                localStorage.setItem(
                  `capture_commitment_${playerNFT.nftId}`,
                  JSON.stringify(captureData)
                );

                console.log('抓捕承诺已提交');
                console.log('承诺ID:', commitmentId);
                console.log('NFT ID:', playerNFT.nftId);
                console.log('提交时的等级:', playerNFT.level);
                console.log('抓捕状态已保存在链上，敌人信息保留在NFT上');

                // 敌人信息保留在链上，无需刷新
              } else {
                console.error('未能从任何方法获取承诺ID');
                console.error('交易详情:', JSON.stringify(txResult, null, 2));
                throw new Error('未能获取承诺ID');
              }
            } catch (error) {
              console.error('获取承诺ID失败:', error);
              showAlert('warning', t('alerts.settleCaptureManually'), t('alerts.commitSubmittedNoId'));
            }
            setCapturing(false);
          },
          onError: (error) => {
            console.error('抓捕承诺提交失败:', error);
            showAlert('error', error instanceof Error ? error.message : t('common.unknown'), t('alerts.captureCommitFailTitle'));
            setCapturing(false);
          },
        }
      );
    } catch (error) {
      console.error('创建抓捕承诺交易失败:', error);
      setCapturing(false);
    }
  };

  // 第二步：揭示并结算抓捕
  const handleCaptureReveal = () => {
    if (!account || !playerNFT || !captureCommitmentId || !captureSecret) {
      return;
    }

    // 从localStorage恢复敌人信息
    const savedCommitment = localStorage.getItem(`capture_commitment_${playerNFT.nftId}`);
    if (!savedCommitment) {
      showAlert('warning', t('alerts.captureRestartRequired'), t('alerts.captureRestartRequired'));
      return;
    }

    const { enemyLevel, enemyElement } = JSON.parse(savedCommitment);

    setCapturing(true);

    try {
      const tx = createCaptureRevealTransaction(
        captureCommitmentId,
        playerNFT.nftId,
        enemyLevel,
        enemyElement,
        captureSecret
      );

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            console.log('抓捕结算成功:', result);

            // 清除承诺信息
            setCaptureCommitmentId(null);
            setCaptureSecret(null);
            setCaptureStartTime(null);
            setCaptureCommitLevel(null);
            localStorage.removeItem(`capture_commitment_${playerNFT.nftId}`);

            // 获取抓捕结果事件
            setTimeout(async () => {
              try {
                const txResult = await suiClient.getTransactionBlock({
                  digest: result.digest,
                  options: { showEvents: true },
                });

                const captureEvent = txResult.events?.find(
                  (event: { type?: string }) => event.type?.includes('CaptureAttemptEvent')
                );

                if (captureEvent && captureEvent.parsedJson) {
                  const parsed = captureEvent.parsedJson as {
                    is_success: boolean;
                    capture_probability: string | number;
                  };

                  const isSuccess = Boolean(parsed.is_success);

                  // 为了与页面展示一致，这里按同一公式计算展示用概率（百分比 0-100）
                  // 与面板一致：基础=战胜概率/2，+同类型10%，再应用等级惩罚
                  let displayProb = 0;
                  if (playerNFT && enemyInfo) {
                    const playerLevelForDisplay = fullNFTInfo?.level ?? playerNFT.level;
                    const winProb = calculateWinProbability(
                      playerLevelForDisplay,
                      playerNFT.element,
                      enemyInfo.level,
                      enemyInfo.element
                    );
                    const baseCaptureProb = winProb / 2;
                    const isSameType = (fullNFTInfo?.monsterType ?? playerNFT.monsterType) === enemyInfo.monsterType;
                    let afterBonus = baseCaptureProb;
                    if (isSameType) afterBonus += 10;
                    const levelPenaltyFactor = calculateCaptureLevelPenaltyFactor(playerLevelForDisplay);
                    const finalCaptureProb = (afterBonus * (100 - levelPenaltyFactor)) / 100;
                    displayProb = Math.min(Math.max(finalCaptureProb, 0), 100);
                  }

                  if (isSuccess && enemyInfo) {
                    // 抓捕成功 - 显示详细的怪物信息（与面板一致的概率显示）
                    showAlert(
                      'success',
                      t('alerts.captureSuccessMessage'),
                      t('alerts.captureSuccessTitle'),
                      {
                        level: enemyInfo.level,
                        element: enemyInfo.element,
                        monsterType: enemyInfo.monsterType,
                        probability: displayProb,
                      },
                      true
                    );
                  } else {
                    // 抓捕失败
                    showAlert(
                      'error',
                      t('alerts.captureFailDetail', { prob: Number(displayProb.toFixed(1)) }),
                      t('alerts.captureFailTitle')
                    );
                  }
                }
              } catch (error) {
                console.error('获取抓捕事件失败:', error);
              }

              // 刷新NFT和敌人信息
              setTimeout(async () => {
                if (playerNFT) {
                  console.log('刷新 NFT 和敌人信息...');
                  await fetchUserNFT(false);
                  console.log('NFT 和敌人信息已更新');
                }
              }, 3000);
            }, 2000);
            setCapturing(false);
          },
          onError: (error) => {
            console.error('抓捕结算失败:', error);
            showAlert('error', error instanceof Error ? error.message : t('common.unknown'), t('alerts.captureRevealFailTitle'));
            setCapturing(false);
          },
        }
      );
    } catch (error) {
      console.error('创建抓捕结算交易失败:', error);
      setCapturing(false);
    }
  };

  const seasonalBg = getSeasonalBackground();
  const decorations = getSeasonalDecorations();
  const seasonalActionBtn = getSeasonalPrimaryButtonClasses();

  return (
    <div className={`h-screen ${seasonalBg} font-sans relative overflow-hidden flex flex-col`}>
      {/* 全局加载指示器 */}
      {(isLoadingGameConfig || isLoadingUserNFT || isRestoringBattleState || isRestoringCaptureState) && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[999]">
          <div className="text-white text-lg flex items-center gap-2">
            <RefreshCw className="animate-spin" size={24} />
          </div>
        </div>
      )}

      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-5">
        <div className={`absolute top-20 left-20 w-32 h-32 ${decorations.top} rounded-full blur-3xl`}></div>
        <div className={`absolute bottom-20 right-20 w-40 h-40 ${decorations.bottom} rounded-full blur-3xl`}></div>
        <div className={`absolute top-1/2 left-1/2 w-48 h-48 ${decorations.center} rounded-full blur-3xl`}></div>
      </div>

      {/* 顶部语言与钱包连接（生产环境不显示网络标签，左右分隔） */}
      {!showLibrary && !showMarket && (
        <div className="absolute top-2 w-screen flex justify-between px-4 items-center gap-2 z-50">
          <div className="flex items-center gap-2 scale-90 md:scale-100 origin-top-left">
            <LanguageSwitcher />
          </div>
          <div className="flex items-center gap-2 scale-90 md:scale-100 origin-top-right">
            <ConnectButton />
          </div>
        </div>
      )}

      {/* 战斗结果提示 */}
      {battleResult && <BattleResultNotification result={battleResult} />}

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

      {/* 主内容区域 - 移动端优化的垂直布局 */}
      <div className="flex-1 relative z-30 pt-18 px-3 pb-3 overflow-y-auto">
        <div className="max-w-2xl mx-auto flex flex-col gap-3 min-h-full">

          {/* 1. 顶部：简洁的对战信息 */}
          {enemyInfo && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3.5 py-3.5 border border-white/20 shadow-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center justify-center gap-2 text-sm md:text-base flex-1 min-w-0">
                  <div className="text-blue-400 font-bold flex items-center gap-1 min-w-0">
                    {fullNFTInfo?.name && (
                      <span className="mr-1 inline-block" title={fullNFTInfo.name}>
                        {fullNFTInfo.name}
                      </span>
                    )}
                    {/* 顶部不显示等级和属性 */}
                  </div>
                  <Zap className="text-white/50 w-5 h-5" />
                  <div className="text-red-400 font-bold flex items-center gap-1 min-w-0">
                    {enemyInfo.isGoldenMonster ? (
                      <span className="flex items-center gap-1">
                        <Coins className="w-4 h-4" /> {t('game.battleResult.reward')}
                      </span>
                    ) : (
                      <span className="inline-block" title={enemyInfo.name || ''}>
                        {enemyInfo.name || ''}
                      </span>
                    )}
                    {/* 顶部不显示等级和属性 */}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1. 顶部：无敌人时的简洁信息 */}
          {/* {!enemyInfo && playerNFT && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3.5 py-3.5 border border-white/20 shadow-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center justify-center gap-2 text-sm md:text-base flex-1 min-w-0">
                  <div className="text-blue-400 font-bold flex items-center gap-1 min-w-0">
                    {fullNFTInfo?.name && (
                      <span className="mr-1 inline-block" title={fullNFTInfo.name}>
                        {fullNFTInfo.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )} */}

          {/* 2. 中间：怪物对战区域 */}
          <div className="flex-1 flex items-center justify-center py-4 relative">
            {/* 信息按钮 - 右上角 */}
            <button
              onClick={() => (document.getElementById('game_info_modal') as HTMLDialogElement)?.showModal()}
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm flex items-center justify-center z-10"
              title={t('home.learnMore')}
            >
              <Info className="w-4 h-4" />
            </button>

            {!enemyInfo ? (
              // 没有敌人：放大显示玩家怪物
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="text-center">
                  {playerNFT ? (
                    <>
                      <h3 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                        <span>{fullNFTInfo?.name || `NFT #${playerNFT.nftId}`}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs md:text-sm">
                          {t('elements.' + getElementKey(playerNFT.element))}
                        </span>
                      </h3>
                      {/* 显示等级 */}
                      {(fullNFTInfo?.level ?? playerNFT.level) !== undefined && (
                        <div className="text-lg font-bold text-blue-400">
                          Lv.{fullNFTInfo?.level ?? playerNFT.level}
                        </div>
                      )}
                      {(fullNFTInfo?.monsterType !== undefined || playerNFT.monsterType !== undefined) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {getMonsterTypeName(fullNFTInfo?.monsterType ?? playerNFT.monsterType ?? 0)}
                        </p>
                      )}
                      {fullNFTInfo && fullNFTInfo.experience >= 0 && (
                        <div className="mt-3 max-w-[200px] mx-auto">
                          <div className="text-xs text-gray-400 mb-1">
                            {t('game.playerCard.experience')} {fullNFTInfo.experience}/100
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${fullNFTInfo.experience}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <h3 className="text-xl font-bold text-white">{t('game.playerCard.waitingNFT')}</h3>
                  )}
                </div>

                {playerNFT ? (
                  <AvatarDisplay
                    name={`${fullNFTInfo?.name}`}
                    element={playerNFT.element}
                    monsterType={fullNFTInfo?.monsterType ?? playerNFT.monsterType}
                    size={200}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-700/50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-600">
                    <span className="text-gray-500 text-3xl">?</span>
                  </div>
                )}
              </div>
            ) : (
              // 有敌人：对战形式显示双方
              <div className="w-full flex items-center justify-between gap-2 px-2">
                {/* 玩家怪物 */}
                <div className="flex flex-col items-center flex-1">
                  <div className="mb-2 text-center">
                    {playerNFT && (
                      <>
                        <div className="text-xl md:text-2xl font-bold text-blue-400">
                          {enemyInfo.isGoldenMonster ? '' : (
                            <>
                              {`Lv.${fullNFTInfo?.level ?? playerNFT.level}`}
                              {fullNFTInfo && fullNFTInfo.experience > 0 && (
                                <span className="ml-2 text-xs md:text-base font-medium text-blue-300">
                                  ({fullNFTInfo.experience}/100)
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <p className="text-base md:text-lg text-gray-200 flex items-center justify-center">
                          {t('elements.' + getElementKey(playerNFT.element))}
                          <span className="mx-1 text-white/40">|</span>
                          {getMonsterTypeName(fullNFTInfo?.monsterType ?? playerNFT.monsterType)}
                        </p>
                      </>
                    )}
                  </div>
                  {playerNFT ? (
                    <AvatarDisplay
                      name={`${fullNFTInfo?.name}`}
                      element={playerNFT.element}
                      monsterType={fullNFTInfo?.monsterType ?? playerNFT.monsterType}
                      size={120}
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] bg-gray-700/50 rounded-full flex items-center justify-center">
                      <span className="text-gray-500 text-xl">?</span>
                    </div>
                  )}
                </div>

                {/* VS标志 */}
                <div className="flex flex-col items-center justify-center px-1">
                  <div className="text-3xl font-bold text-white/20 animate-pulse">
                    VS
                  </div>
                </div>

                {/* 敌人怪物 */}
                <div className="flex flex-col items-center flex-1">
                  <div className="mb-2 text-center">
                    {/* <div className="text-xs text-white font-medium mb-0.5 flex items-center justify-center gap-1">
                      {enemyInfo.isGoldenMonster ? (
                        <>
                          <Coins className="w-3 h-3" /> 金币怪
                        </>
                      ) : (
                        enemyInfo.name || '敌人'
                      )}
                    </div> */}
                    <div className="text-xl md:text-2xl font-bold text-red-400">
                      {enemyInfo.isGoldenMonster ? '' : `Lv.${enemyInfo.level}`}
                    </div>
                    <p className="text-base md:text-lg text-gray-200 flex items-center justify-center">
                      {t('elements.' + getElementKey(enemyInfo.element))}
                      <span className="mx-1 text-white/40">|</span>
                      {enemyInfo.isGoldenMonster ? t('game.battleResult.goldenMonster') : getMonsterTypeName(enemyInfo.monsterType)}
                    </p>
                  </div>
                  <AvatarDisplay
                    name={enemyInfo.isGoldenMonster ? t('game.battleResult.goldenMonster') : `${enemyInfo.name}`}
                    element={enemyInfo.element}
                    monsterType={enemyInfo.isGoldenMonster ? undefined : enemyInfo.monsterType}
                    isGoldenMonster={enemyInfo.isGoldenMonster}
                    size={120}
                    flipHorizontal
                  />
                </div>
              </div>
            )}
          </div>


          {/* 4. 战斗信息（有敌人时显示） */}
          {enemyInfo && (
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-2.5 border border-white/10">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 战胜概率 */}
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px] mb-0.5 flex items-center gap-1">
                    <span>{t('common.successRate')}</span>
                    {playerNFT && enemyInfo && (
                      <button
                        onClick={() => (document.getElementById('win_probability_modal') as HTMLDialogElement)?.showModal()}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title={t('home.learnMore')}
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className={`text-lg font-bold ${(() => {
                    if (!playerNFT || !enemyInfo) return 'text-gray-400';
                    const prob = enemyInfo.isGoldenMonster
                      ? getGoldenMonsterWinProb(fullNFTInfo?.monsterType ?? playerNFT.monsterType ?? 0)
                      : calculateWinProbability(
                        fullNFTInfo?.level ?? playerNFT.level,
                        playerNFT.element,
                        enemyInfo.level,
                        enemyInfo.element
                      );
                    return prob >= 70 ? 'text-green-400' : prob >= 50 ? 'text-yellow-400' : 'text-red-400';
                  })()
                    }`}>
                    {(() => {
                      if (!playerNFT || !enemyInfo) return '--';
                      const prob = enemyInfo.isGoldenMonster
                        ? getGoldenMonsterWinProb(fullNFTInfo?.monsterType ?? playerNFT.monsterType ?? 0)
                        : calculateWinProbability(
                          fullNFTInfo?.level ?? playerNFT.level,
                          playerNFT.element,
                          enemyInfo.level,
                          enemyInfo.element
                        );
                      return `${prob.toFixed(1)}%`;
                    })()}
                  </div>
                </div>
                {/* 抓捕概率或奖励 */}
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px] mb-0.5 flex items-center gap-1">
                    <span>{enemyInfo.isGoldenMonster ? `${t('game.battleResult.reward')}:` : t('common.successRate')}</span>
                    {!enemyInfo.isGoldenMonster && playerNFT && enemyInfo && (
                      <button
                        onClick={() => (document.getElementById('capture_probability_modal') as HTMLDialogElement)?.showModal()}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title={t('home.learnMore')}
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    )}
                    {enemyInfo.isGoldenMonster && (
                      <button
                        onClick={() => (document.getElementById('golden_monster_reward_modal') as HTMLDialogElement)?.showModal()}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title={t('home.learnMore')}
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className={`text-lg font-bold ${enemyInfo.isGoldenMonster ? 'text-yellow-400' : 'text-purple-400'
                    }`}>
                    {enemyInfo.isGoldenMonster ? (
                      <span className="text-sm">
                        {(minGoldenMonsterReward / 1e9).toFixed(3)}~{(maxGoldenMonsterReward / 1e9).toFixed(3)} SUI
                      </span>
                    ) : (
                      (() => {
                        if (!playerNFT) return '--';
                        const winProb = calculateWinProbability(
                          fullNFTInfo?.level ?? playerNFT.level,
                          playerNFT.element,
                          enemyInfo.level,
                          enemyInfo.element
                        );
                        // 基础抓捕概率 = 战胜概率 / 2
                        let captureProb = winProb / 2;
                        // 检查是否同类型
                        const isSameType = fullNFTInfo?.monsterType === enemyInfo.monsterType;
                        if (isSameType) {
                          captureProb += 10; // 同类型额外+10%
                        }
                        // 应用等级惩罚：等级越低，捕捉成功率越低
                        const levelPenaltyFactor = calculateCaptureLevelPenaltyFactor(
                          fullNFTInfo?.level ?? playerNFT.level
                        );
                        captureProb = (captureProb * (100 - levelPenaltyFactor)) / 100;
                        // 确保不超过100%
                        if (captureProb > 100) captureProb = 100;
                        return `${captureProb.toFixed(1)}%`;
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. 最底部：操作按钮 */}
          <div className="pb-1">
            {!enemyInfo ? (
              // 没有敌人时：如果没有NFT则显示购买按钮，如果有NFT则显示遭遇按钮
              <div className="space-y-2">
                {!playerNFT && account ? (
                  // 没有NFT但已连接钱包：显示购买按钮
                  <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
                    <div className="text-center mb-3">
                      <div className="text-white text-sm font-medium mb-1">
              {t('home.noMonster')}
                      </div>
                      <div className="text-gray-400 text-xs">
              {t('home.buyFirst')}
                      </div>
                    </div>
                    <BuyNftButton
                      onSuccess={handleBuyNFTSuccess}
                      className="w-full py-3.5 px-6 rounded-xl text-base font-bold shadow-lg active:scale-95"
                      variant="primary"
                    />
                    <div className="mt-3 text-center">
                      <Link
                        href="/about"
                        className="text-xs text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                      >
              <Info className="w-3 h-3" /> {t('home.learnMore')}
                      </Link>
                    </div>
                  </div>
                ) : playerNFT ? (
                  // 有NFT但没有敌人：显示遭遇按钮
                  enemyCooldownRemaining > 0 ? (
                    <div className="bg-gray-700/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                      <div className="text-white text-xs font-medium mb-1 flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" /> {t('home.cooldown')}
                      </div>
                      <div className="text-2xl font-mono text-purple-400 mb-1">
                        {formatTime(enemyCooldownRemaining)}
                      </div>
                      <div className="text-gray-400 text-[10px]">
              {t('game.playerActions.totalDuration')} {formatTime(getEnemyRerandomCooldownSeconds())}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleRandomEnemy}
                      disabled={randomizing || !account || !playerNFT}
                      className={`w-full ${seasonalActionBtn} disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all text-base shadow-lg active:scale-95 flex items-center justify-center gap-2`}
                    >
                      {randomizing ? (
            t('game.enemyCard.generating')
                      ) : (
                        <>
              <Dice1 className="w-5 h-5" /> {t('home.generateEnemy')}
                        </>
                      )}
                    </button>
                  )
                ) : (
                  // 没有连接钱包：显示提示
                  <div className="bg-gray-700/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                    <div className="text-white text-sm font-medium">
              {t('common.connectWallet')}
                    </div>
                    <div className="mt-2">
                      <Link
                        href="/about"
                        className="text-xs text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                      >
              <Info className="w-3 h-3" /> {t('home.learnMore')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 有敌人时：显示战斗和捕捉按钮
              <div className="space-y-2">
                {/* 战斗按钮（抓捕中隐藏） */}
                {!captureCommitmentId && (
                  <>
                    {!battleCommitmentId ? (
                      <>
                        <button
                          onClick={handleBattleCommit}
                          disabled={
                            battling ||
                            !account ||
                            !playerNFT ||
                            !enemyInfo
                          }
                          className="w-full bg-linear-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all text-base shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                          <div className="flex items-center gap-2">
                            {battling ? (
            t('game.playerActions.battling')
                            ) : (
                              <>
                                <Sword className="w-5 h-5" />
            <span>{t('home.battle')}</span>
                                {enemyInfo?.isGoldenMonster && (
                                  <span className={`ml-2 inline-flex items-center text-xs ${goldenCommitCountdown > 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                                    <Clock className="w-4 h-4 mr-1" />
            {goldenCommitCountdown > 0 ? formatTime(goldenCommitCountdown) : t('game.market.txTimeout')}
                                  </span>
                                )}
                                {!battling && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      (document.getElementById('battle_info_modal') as HTMLDialogElement)?.showModal();
                                    }}
                                    className=" text-white/70 hover:text-white transition-colors cursor-pointer"
            title={t('home.learnMore')}
                                  >
                                    <HelpCircle className="w-4 h-4" />
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {/* 仅保留按钮内部的问号图标，移除外部重复的问号按钮 */}
                        </button>
                        {/* 金币怪倒计时已移至按钮旁，不再单独展示面板 */}
                      </>
                    ) : battleCountdown > 0 ? (
                      <div className="bg-yellow-600/20 backdrop-blur-sm rounded-xl p-3 text-center border border-yellow-500/30">
                        <div className="text-white text-xs font-medium mb-1 flex items-center justify-center gap-1">
            <Clock className="w-4 h-4" /> {t('game.playerActions.battling')}
                        </div>
                        <div className="text-xl font-mono text-yellow-400">
                          {formatTime(battleCountdown)}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleBattleReveal}
                        disabled={battling}
                        className="w-full bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all text-base shadow-lg active:scale-95 flex items-center justify-center gap-2"
                      >
                        {battling ? (
            t('home.settling')
                        ) : (
                          <>
            <PartyPopper className="w-5 h-5" /> {t('game.playerActions.settleBattle')}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                {/* 捕捉按钮（金币怪不显示，战斗中隐藏） */}
                {!enemyInfo.isGoldenMonster && !battleCommitmentId && (
                  <>
                    {!captureCommitmentId ? (
                      <button
                        onClick={handleCaptureCommit}
                        disabled={capturing || !account || !playerNFT || !enemyInfo}
                        className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm shadow-lg active:scale-95 flex items-center justify-center gap-2"
                      >
                        <div className="flex items-center gap-2">
                          {capturing ? (
            t('game.playerActions.capturing')
                          ) : (
                            <>
            <Target className="w-4 h-4" /> {t('game.playerActions.captureMonster')}
                            </>
                          )}
                        </div>
                        {!capturing && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              (document.getElementById('capture_info_modal') as HTMLDialogElement)?.showModal();
                            }}
                            className="text-white/70 hover:text-white transition-colors"
            title={t('home.learnMore')}
                          >
                            <HelpCircle className="w-4 h-4" />
                          </span>
                        )}
                      </button>
                    ) : captureCountdown > 0 ? (
                      <div className="bg-purple-600/20 backdrop-blur-sm rounded-xl p-2.5 text-center border border-purple-500/30">
                        <div className="text-white text-[10px] font-medium mb-0.5 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> {t('game.playerActions.capturing')}
                        </div>
                        <div className="text-lg font-mono text-purple-400">
                          {formatTime(captureCountdown)}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleCaptureReveal}
                        disabled={capturing}
                        className="w-full bg-linear-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm shadow-lg active:scale-95 flex items-center justify-center gap-2"
                      >
                        {capturing ? (
            t('home.settling')
                        ) : (
                          <>
            <Gift className="w-4 h-4" /> {t('game.playerActions.settleBattle')}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                {/* 重新随机敌人按钮 */}
                {/* 逃跑按钮（取消战斗承诺） */}
                {battleCommitmentId && !captureCommitmentId && !battling && (
                  <button
                    onClick={handleCancelBattleCommit}
                    disabled={escaping || !account || !playerNFT}
                    className="w-full bg-red-700/80 hover:bg-red-600 disabled:bg-red-900 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-1 mb-1"
            title={t('home.learnMore')}
                  >
                    {escaping ? (
            t('home.inProgress')
                    ) : (
                      <>
                        <Zap className="w-3 h-3" /> {t('home.escape')}
                      </>
                    )}
                  </button>
                )}
                {captureCommitmentId && !battleCommitmentId && !capturing && (
                  <button
                    onClick={handleCancelCaptureCommit}
                    disabled={escaping || !account || !playerNFT}
                    className="w-full bg-red-700/80 hover:bg-red-600 disabled:bg-red-900 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-1 mb-1"
            title={t('home.learnMore')}
                  >
                    {escaping ? (
            t('home.inProgress')
                    ) : (
                      <>
                        <Zap className="w-3 h-3" /> {t('home.escape')}
                      </>
                    )}
                  </button>
                )}
                {!(battling || capturing || battleCommitmentId !== null || captureCommitmentId !== null) && (
                  <button
                    onClick={handleRandomEnemy}
                    disabled={randomizing || enemyCooldownRemaining > 0 || !account}
                    className="w-full bg-gray-700/80 hover:bg-gray-600 disabled:bg-gray-800 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-1"
            title={t('home.learnMore')}
                  >
                    {randomizing ? (
            t('game.enemyCard.generating')
                    ) : enemyCooldownRemaining > 0 ? (
                      <>
            <Clock className="w-3 h-3" /> {t('home.cooldown')} {formatTime(enemyCooldownRemaining)}
                      </>
                    ) : (
                      <>
            <RefreshCw className="w-3 h-3" /> {t('game.enemyCard.randomizeEnemy')}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 安全与合规说明入口：放在操作按钮区下方 */}
      <div className="mb-2 text-center text-[11px] text-gray-500 hover:text-gray-300 relative z-40 pointer-events-auto">
        <Link href="/safety" className="inline-block px-2 py-1 underline">
          {t('safety.linkLabel')}
        </Link>
      </div>

      {/* 始终渲染GameInfoPanel以提供弹窗功能 */}
      {/* 使用条件渲染：只渲染dialog部分，不渲染主面板 */}
      <GameInfoPanel
        playerNFT={fullNFTInfo}
        enemyInfo={enemyInfo}
        hasBattleCommitment={!!battleCommitmentId}
        enemyRerandomCooldownSeconds={getEnemyRerandomCooldownSeconds()}
        battleRevealDelaySeconds={battleCommitLevel !== null
          ? Math.floor(calculateBattleRevealDelay(battleCommitLevel) / 1000)
          : getBattleRevealDelaySeconds()}
        minGoldenMonsterReward={minGoldenMonsterReward}
        maxGoldenMonsterReward={maxGoldenMonsterReward}
        renderOnlyDialog={true}
      />

      {/* 金币怪奖励范围详情弹窗（共享组件） */}
      <GoldenMonsterRewardModal
        minGoldenMonsterReward={minGoldenMonsterReward}
        maxGoldenMonsterReward={maxGoldenMonsterReward}
      />

      {/* 战胜概率详情弹窗 */}
      {playerNFT && enemyInfo && (
        <dialog id="win_probability_modal" className="modal">
          <div className="modal-box max-w-md bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('common.successRate')}</h3>
            <div className="space-y-3 text-sm text-white">
              {(() => {
                if (enemyInfo.isGoldenMonster) {
                  const playerType = fullNFTInfo?.monsterType ?? playerNFT.monsterType ?? 0;
                  const playerTypeName = getMonsterTypeName(playerType);
                  const winProb = getGoldenMonsterWinProb(playerType);
                  const typeRows = [
                    { name: 'beam', prob: 50 },
                    { name: 'marble', prob: 55 },
                    { name: 'pixel', prob: 60 },
                    { name: 'sunset', prob: 65 },
                    { name: 'bauhaus', prob: 70 },
                    { name: 'ring', prob: 75 },
                  ];
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
            <div className="text-gray-400 mb-1">{t('common.type')}</div>
                          <div className="font-bold">{playerTypeName}</div>
                        </div>
                        <div>
            <div className="text-gray-400 mb-1">{t('common.successRate')}</div>
                          <div className="font-bold text-yellow-400">{winProb.toFixed(1)}%</div>
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-3">
                        <div className="text-gray-400 mb-2">{t('game.winProbModal.goldenTypeWinRatesTitle')}</div>
                        <div className="overflow-x-auto">
                          <table className="table  w-full text-xs">
                            <thead>
                              <tr>
            <th className="text-gray-300">{t('common.type')}</th>
            <th className="text-gray-300">{t('common.successRate')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {typeRows.map((row, idx) => (
                                <tr key={row.name} className={idx === playerType ? 'bg-yellow-500/20' : ''}>
                                  <td className="font-bold">{row.name}</td>
                                  <td className="text-yellow-400">{row.prob}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {t('game.winProbModal.goldenWinRateNote')}
                        </div>
                      </div>
                    </div>
                  );
                }

                const playerLevel = fullNFTInfo?.level ?? playerNFT.level;
                const levelDiff = Math.abs(playerLevel - enemyInfo.level);
                const playerHigher = playerLevel > enemyInfo.level;
                const elementAdvantage = getElementAdvantage(playerNFT.element, enemyInfo.element);
                const elementDisadvantage = getElementAdvantage(enemyInfo.element, playerNFT.element);
                const winProb = calculateWinProbability(
                  playerLevel,
                  playerNFT.element,
                  enemyInfo.level,
                  enemyInfo.element
                );

                // 计算基础概率（根据等级差和属性关系）
                let basePercent = 0;
                let baseCaseKey = '';
                if (levelDiff === 0) {
                  if (elementAdvantage) {
                    basePercent = 75;
                    baseCaseKey = 'game.winProbModal.equalAdvantage';
                  } else if (elementDisadvantage) {
                    basePercent = 25;
                    baseCaseKey = 'game.winProbModal.equalDisadvantage';
                  } else {
                    basePercent = 50;
                    baseCaseKey = 'game.winProbModal.equalNone';
                  }
                } else if (levelDiff === 1) {
                  if (playerHigher) {
                    if (elementAdvantage) {
                      basePercent = 75;
                      baseCaseKey = 'game.winProbModal.higher1Advantage';
                    } else if (elementDisadvantage) {
                      basePercent = 50;
                      baseCaseKey = 'game.winProbModal.higher1Disadvantage';
                    } else {
                      basePercent = 75;
                      baseCaseKey = 'game.winProbModal.higher1None';
                    }
                  } else {
                    if (elementAdvantage) {
                      basePercent = 50;
                      baseCaseKey = 'game.winProbModal.lower1Advantage';
                    } else if (elementDisadvantage) {
                      basePercent = 12.5;
                      baseCaseKey = 'game.winProbModal.lower1Disadvantage';
                    } else {
                      basePercent = 25;
                      baseCaseKey = 'game.winProbModal.lower1None';
                    }
                  }
                } else {
                  if (playerHigher) {
                    if (elementAdvantage) {
                      basePercent = 93.75;
                      baseCaseKey = 'game.winProbModal.higher2PlusAdvantage';
                    } else if (elementDisadvantage) {
                      basePercent = 75;
                      baseCaseKey = 'game.winProbModal.higher2PlusDisadvantage';
                    } else {
                      basePercent = 87.5;
                      baseCaseKey = 'game.winProbModal.higher2PlusNone';
                    }
                  } else {
                    if (elementAdvantage) {
                      basePercent = 25;
                      baseCaseKey = 'game.winProbModal.lower2PlusAdvantage';
                    } else if (elementDisadvantage) {
                      basePercent = 6.25;
                      baseCaseKey = 'game.winProbModal.lower2PlusDisadvantage';
                    } else {
                      basePercent = 12.5;
                      baseCaseKey = 'game.winProbModal.lower2PlusNone';
                    }
                  }
                }

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.winProbModal.playerLevelLabel')}</div>
                        <div className="font-bold">Lv.{playerLevel}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.winProbModal.enemyLevelLabel')}</div>
                        <div className="font-bold">Lv.{enemyInfo.level}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.playerCard.attribute')}</div>
                        <div className="font-bold">{t('elements.' + getElementKey(playerNFT.element))}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.playerCard.attribute')}</div>
                        <div className="font-bold">{t('elements.' + getElementKey(enemyInfo.element))}</div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-gray-400 mb-2">{t('game.winProbModal.relationTitle')}</div>
                      <div className="text-sm">
                        {elementAdvantage ? (
                          <span className="text-green-400">{t('game.winProbModal.relationAdvantage')}</span>
                        ) : elementDisadvantage ? (
                          <span className="text-red-400">{t('game.winProbModal.relationDisadvantage')}</span>
                        ) : (
                          <span className="text-gray-400">{t('game.winProbModal.relationNone')}</span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-gray-400 mb-2">{t('game.winProbModal.baseProbTitle')}</div>
                      <div className="text-base font-bold">{`${basePercent}% (${t(baseCaseKey)})`}</div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-gray-400 mb-2">{t('game.winProbModal.finalWinRateTitle')}</div>
                      <div className={`text-xl font-bold ${winProb >= 70 ? 'text-green-400' : winProb >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {winProb.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      )}

      {/* 抓捕概率详情弹窗 */}
      {playerNFT && enemyInfo && !enemyInfo.isGoldenMonster && (
        <dialog id="capture_probability_modal" className="modal">
          <div className="modal-box max-w-md bg-gray-900 border border-white/20">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
            </form>
            <h3 className="font-bold text-lg text-white mb-4">{t('game.captureProbModal.title')}</h3>
            <div className="space-y-3 text-sm text-white">
              {(() => {
                const playerLevel = fullNFTInfo?.level ?? playerNFT.level;
                const winProb = calculateWinProbability(
                  playerLevel,
                  playerNFT.element,
                  enemyInfo.level,
                  enemyInfo.element
                );

                // 基础抓捕概率 = 战胜概率 / 2
                const baseCaptureProb = winProb / 2;

                // 检查是否同类型
                const isSameType = fullNFTInfo?.monsterType === enemyInfo.monsterType;

                // 应用等级惩罚
                const levelPenaltyFactor = calculateCaptureLevelPenaltyFactor(playerLevel);

                // 计算最终概率
                let captureProbAfterType = baseCaptureProb;
                if (isSameType) {
                  captureProbAfterType += 10; // 同类型额外+10%
                }

                const finalCaptureProb = (captureProbAfterType * (100 - levelPenaltyFactor)) / 100;
                const finalProb = Math.min(finalCaptureProb, 100);

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.winProbModal.playerLevelLabel')}</div>
                        <div className="font-bold">Lv.{playerLevel}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('common.type')}</div>
                        <div className="font-bold">
                          {fullNFTInfo?.monsterType !== undefined
                            ? getMonsterTypeName(fullNFTInfo.monsterType)
                            : '--'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('game.winProbModal.enemyLevelLabel')}</div>
                        <div className="font-bold">Lv.{enemyInfo.level}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">{t('common.type')}</div>
                        <div className="font-bold">
                          {enemyInfo.monsterType !== undefined
                            ? getMonsterTypeName(enemyInfo.monsterType)
                            : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">{t('game.captureProbModal.baseProbLabel')}</span>
                        <span className="font-bold">{baseCaptureProb.toFixed(1)}%</span>
                      </div>

                      {isSameType && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">{t('game.captureProbModal.sameTypeBonusLabel')}</span>
                          <span className="text-green-400 font-bold">+10%</span>
                        </div>
                      )}

                      {isSameType && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">{t('game.captureProbModal.afterBonusProbLabel')}</span>
                          <span className="font-bold">{captureProbAfterType.toFixed(1)}%</span>
                        </div>
                      )}

                      {levelPenaltyFactor > 0 && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-gray-400">{t('game.captureProbModal.levelPenaltyLabel', { level: playerLevel })}</span>
                            <button
                              onClick={() => (document.getElementById('capture_level_penalty_modal') as HTMLDialogElement)?.showModal()}
                              className="text-gray-500 hover:text-gray-300 transition-colors ml-1"
                              title={t('home.learnMore')}
                            >
                              <HelpCircle className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-red-400 font-bold">-{levelPenaltyFactor}%</span>
                        </div>
                      )}

                      {levelPenaltyFactor === 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">{t('game.captureProbModal.levelNoPenaltyLabel', { level: playerLevel })}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-gray-400 mb-2">{t('game.captureProbModal.finalCaptureProbTitle')}</div>
                      <div className="text-xl font-bold text-purple-400">
                        {finalProb.toFixed(1)}%
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-3 p-2 bg-black/20 rounded">
                      <div className="font-bold mb-1">{t('game.captureProbModal.formulaTitle')}</div>
                      <div>{t('game.captureProbModal.formulaBase')}</div>
                      {isSameType && <div>{t('game.captureProbModal.formulaSameTypeBonus')}</div>}
                      {levelPenaltyFactor > 0 && (
                        <div>{t('game.captureProbModal.formulaFinalWithPenalty')}</div>
                      )}
                      {levelPenaltyFactor === 0 && (
                        <div>{t('game.captureProbModal.formulaFinalNoPenalty')}</div>
                      )}
                      <div>{t('game.captureProbModal.captureLevelNote')}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </dialog>
      )}

      {/* 等级惩罚说明弹窗：列出1-10级的捕捉概率惩罚比例 */}
      <dialog id="capture_level_penalty_modal" className="modal">
        <div className="modal-box max-w-md bg-gray-900 border border-white/20">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
          </form>
          <div className="space-y-3 text-sm text-white">
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="table  w-full text-[10px] compact">
                <thead>
                  <tr>
                    <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.infoPanel.levelHeader')}</th>
                    <th className="text-gray-300 text-[10px] py-1 px-2">{t('game.capturePenaltyModal.penaltyHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }, (_, i) => {
                    const level = i + 1;
                    const penalty = calculateCaptureLevelPenaltyFactor(level);
                    const isCurrent = playerNFT && level === (playerNFT.level ?? level);
                    return (
                      <tr key={level} className={isCurrent ? 'bg-purple-500/20' : ''}>
                        <td className="font-bold text-gray-200 py-1 px-2">Lv.{level}</td>
                        <td className="text-red-400 py-1 px-2">-{penalty}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-white/10 pt-3 text-xs text-gray-400">
              <div className="font-bold text-white mb-2">{t('game.infoPanel.explanationTitle')}</div>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('game.capturePenaltyModal.ruleHigherLevel')}</li>
                <li>{t('game.capturePenaltyModal.formulaFinal')}</li>
                <li>{t('game.capturePenaltyModal.sameTypeOrder')}</li>
              </ul>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('common.close')}</button>
        </form>
      </dialog>

      {/* 战斗信息说明弹窗 */}
      <dialog id="battle_info_modal" className="modal">
        <div className="modal-box max-w-md bg-gray-900 border border-white/20">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
          </form>
          <h3 className="font-bold text-lg text-white mb-4">{t('game.battleInfoModal.title')}</h3>
          <div className="space-y-3 text-sm text-white">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">⚠</span>
                <div className="flex-1">
                  <div className="text-gray-200 font-medium mb-1">{t('game.battleInfoModal.importantTitle')}</div>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                    <li>{t('game.battleInfoModal.tipSaveKeyOnCommit')}</li>
                    <li>{t('game.battleInfoModal.tipKeyNeededOnReveal')}</li>
                    <li className="text-red-400 font-medium">{t('game.battleInfoModal.tipKeyLostWarning')}</li>
                  </ul>
                </div>
              </div>
            </div>
            {enemyInfo?.isGoldenMonster && (
              <div className="space-y-2">
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-400 font-medium">
                    <Clock className="w-4 h-4" />
                    <span>{t('game.battleInfoModal.goldenTimeTitle')}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs mt-2">
                    <li>{t('game.battleInfoModal.goldenSubmitWithin')}</li>
                    <li>{t('game.battleInfoModal.goldenCountdownDisable')}</li>
                    <li>{t('game.battleInfoModal.goldenRewardSnapshotNote')}</li>
                    <li>{t('game.battleInfoModal.goldenCountdownDisclaimer')}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </div>
      </dialog>

      {/* 捕捉信息说明弹窗 */}
      <dialog id="capture_info_modal" className="modal">
        <div className="modal-box max-w-md bg-gray-900 border border-white/20">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-white">✕</button>
          </form>
          <h3 className="font-bold text-lg text-white mb-4">{t('game.captureInfoModal.title')}</h3>
          <div className="space-y-3 text-sm text-white">
            <div className="space-y-2">
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 text-yellow-400 font-medium">
                  <Coins className="w-4 h-4" />
                  <span>{t('game.captureInfoModal.feeLabel')}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">⚠</span>
                <div className="flex-1">
                  <div className="text-gray-200 font-medium mb-1">{t('game.captureInfoModal.importantTitle')}</div>
                  <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                    <li>{t('game.captureInfoModal.tipSaveKeyOnCommit')}</li>
                    <li>{t('game.captureInfoModal.tipKeyNeededOnReveal')}</li>
                    <li className="text-red-400 font-medium">{t('game.captureInfoModal.tipKeyLostWarning')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>{t('common.close')}</button>
          </form>
        </div>
      </dialog>

      {/* 悬浮按钮（库和市场） */}
      <BottomActions
        showLibrary={showLibrary}
        setShowLibrary={setShowLibrary}
        showMarket={showMarket}
        setShowMarket={setShowMarket}
      />

      {/* 安全与合规说明入口已移至操作按钮区下方 */}
    </div>
  );
}