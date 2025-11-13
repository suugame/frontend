import { keccak256 } from 'js-sha3';
import {
  ELEMENT_METAL,
  ELEMENT_WOOD,
  ELEMENT_WATER,
  ELEMENT_FIRE,
  ELEMENT_EARTH,
} from '@/sui';

export function getGoldenMonsterWinProb(playerElement: number): number {
  if (playerElement === 0) { // beam
    return 50;
  } else if (playerElement === 1) { // marble
    return 55;
  } else if (playerElement === 2) { // pixel
    return 60;
  } else if (playerElement === 3) { // sunset
    return 65;
  } else if (playerElement === 4) { // bauhaus
    return 70;
  } else if (playerElement === 5) { // ring
    return 75;
  } else {
    return 50; // Default to 50 if element is unknown
  }
}

// 计算属性优势（金克木、木克土、土克水、水克火、火克金）
export function getElementAdvantage(playerElement: number, enemyElement: number): boolean {
  if (playerElement === enemyElement) {
    return false; // 相同属性不相克
  }

  // 五行相克：金(0)克木(1)、木(1)克土(4)、土(4)克水(2)、水(2)克火(3)、火(3)克金(0)
  if (playerElement === ELEMENT_METAL && enemyElement === ELEMENT_WOOD) return true;
  if (playerElement === ELEMENT_WOOD && enemyElement === ELEMENT_EARTH) return true;
  if (playerElement === ELEMENT_EARTH && enemyElement === ELEMENT_WATER) return true;
  if (playerElement === ELEMENT_WATER && enemyElement === ELEMENT_FIRE) return true;
  if (playerElement === ELEMENT_FIRE && enemyElement === ELEMENT_METAL) return true;

  return false;
}

// 计算战胜几率（完全按照合约代码的实际值）
export function calculateWinProbability(
  playerLevel: number,
  playerElement: number,
  enemyLevel: number,
  enemyElement: number
): number {
  // 计算等级差
  const levelDiff = Math.abs(playerLevel - enemyLevel);
  const playerHigher = playerLevel > enemyLevel;

  // 判断属性相克
  const elementAdvantage = getElementAdvantage(playerElement, enemyElement);
  const elementDisadvantage = getElementAdvantage(enemyElement, playerElement);

  // 计算基础获胜概率（返回0-10000之间的值，表示百分比*100）
  // 完全按照合约代码的实际值，不按注释
  let baseProb: number;

  if (levelDiff === 0) {
    // 等级相同
    if (elementAdvantage) {
      baseProb = 7500; // 75%
    } else if (elementDisadvantage) {
      baseProb = 2500; // 25%
    } else {
      baseProb = 5000; // 50%
    }
  } else if (levelDiff === 1) {
    // 相差1级
    if (playerHigher) {
      // 玩家高1级
      if (elementAdvantage) {
        baseProb = 7500; // 75%（合约代码值，注释说是87.5%但代码是7500）
      } else if (elementDisadvantage) {
        baseProb = 5000; // 75%（高一级同属性）
      } else {
        baseProb = 7500; // 75%（高一级同属性）
      }
    } else {
      // 玩家低1级
      if (elementAdvantage) {
        baseProb = 5000; // 50%（合约代码值，注释说是62.5%但代码是5000）
      } else if (elementDisadvantage) {
        baseProb = 1250; // 12.5%
      } else {
        baseProb = 2500; // 25%（低一级同属性）
      }
    }
  } else {
    // 相差2级或更多
    if (playerHigher) {
      // 玩家高2级或更多
      if (elementAdvantage) {
        baseProb = 9375; // 93.75%
      } else if (elementDisadvantage) {
        baseProb = 7500; // 75%（高一级同属性）
      } else {
        baseProb = 8750; // 87.5%（合约代码值，注释说是87.5%但代码是7500）
      }
    } else {
      // 玩家低2级或更多
      if (elementAdvantage) {
        baseProb = 2500; // 25%（合约代码值，注释说是81.25%但代码是2500）
      } else if (elementDisadvantage) {
        baseProb = 625; // 6.25%
      } else {
        baseProb = 1250; // 12.5%
      }
    }
  }

  // 转换为百分比 (0-100)
  return baseProb / 100;
}

// 计算捕捉时的等级惩罚系数（返回0-100之间的值，表示百分比）
// 等级越低，惩罚越大，防止玩家故意停留在低级快速捕捉
// 1级：50%系数（惩罚50%）
// 2级：45%系数（惩罚45%）
// 3级：40%系数（惩罚40%）
// 4级：35%系数（惩罚35%）
// 5级：30%系数（惩罚30%）
// 6级：25%系数（惩罚25%）
// 7级：20%系数（惩罚20%）
// 8级：15%系数（惩罚15%）
// 9级：10%系数（惩罚10%）
// 10级：100%系数（无惩罚）
export function calculateCaptureLevelPenaltyFactor(playerLevel: number): number {
  if (playerLevel <= 1) {
    return 50; // 50%
  } else if (playerLevel === 2) {
    return 45; // 45%
  } else if (playerLevel === 3) {
    return 40; // 40%
  } else if (playerLevel === 4) {
    return 35; // 35%
  } else if (playerLevel === 5) {
    return 30; // 30%
  } else if (playerLevel === 6) {
    return 25; // 25%
  } else if (playerLevel === 7) {
    return 20; // 20%
  } else if (playerLevel === 8) {
    return 15; // 15%
  } else if (playerLevel === 9) {
    return 10; // 10%
  } else {
    return 0; // 0%，10级无惩罚
  }
}

// 计算经验值获取（完全按照合约代码）
export function calculateExperienceGain(
  playerLevel: number,
  enemyLevel: number
): number {
  const levelDiff = Math.abs(playerLevel - enemyLevel);
  const playerHigher = playerLevel > enemyLevel;

  if (playerHigher) {
    // 玩家等级更高
    if (levelDiff >= 2) {
      return 10; // 高2级或更多获胜：10
    } else if (levelDiff === 1) {
      return 20; // 高1级获胜：20
    } else {
      return 40; // 同级：40
    }
  } else {
    // 玩家等级更低
    if (levelDiff >= 2) {
      return 100; // 低2级或更多获胜：直接升级（返回100表示满经验）
    } else if (levelDiff === 1) {
      return 80; // 低1级获胜：80
    } else {
      return 40; // 同级：40
    }
  }
}

// 生成战斗承诺哈希
export function generateBattleCommitmentHash(
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string
): Uint8Array {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);

  const data = new Uint8Array(8 + 1 + 1 + secretBytes.length);

  // 添加nft_id (little endian, 8 bytes)
  let nftIdValue = BigInt(nftId);
  for (let i = 0; i < 8; i++) {
    data[i] = Number(nftIdValue & BigInt(0xFF));
    nftIdValue = nftIdValue >> BigInt(8);
  }

  // 添加enemy_level
  data[8] = enemyLevel;

  // 添加enemy_element
  data[9] = enemyElement;

  // 添加secret
  data.set(secretBytes, 10);

  // 使用 keccak256 哈希
  const hashHex = keccak256(data);
  // 将hex字符串转换为Uint8Array
  const hashBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    hashBytes[i] = parseInt(hashHex.substr(i * 2, 2), 16);
  }

  return hashBytes;
}

