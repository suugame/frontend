import colors from '@/config/color';
import {
  ELEMENT_METAL,
  ELEMENT_WOOD,
  ELEMENT_WATER,
  ELEMENT_FIRE,
  ELEMENT_EARTH,
  MONSTER_TYPE_BEAM,
  MONSTER_TYPE_MARBLE,
  MONSTER_TYPE_PIXEL,
  MONSTER_TYPE_SUNSET,
  MONSTER_TYPE_BAUHAUS,
  MONSTER_TYPE_RING,
} from '@/sui';

// 根据元素获取颜色
export function getElementColors(element: number): string[] {
  switch (element) {
    case ELEMENT_METAL:
      return Array.from(colors.metal) as string[];
    case ELEMENT_WOOD:
      return Array.from(colors.wood) as string[];
    case ELEMENT_WATER:
      return Array.from(colors.water) as string[];
    case ELEMENT_FIRE:
      return Array.from(colors.fire) as string[];
    case ELEMENT_EARTH:
      return Array.from(colors.earth) as string[];
    default:
      return Array.from(colors.metal) as string[];
  }
}

// 根据元素获取键名（用于 i18n）
export function getElementKey(element: number): 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'unknown' {
  switch (element) {
    case ELEMENT_METAL:
      return 'metal';
    case ELEMENT_WOOD:
      return 'wood';
    case ELEMENT_WATER:
      return 'water';
    case ELEMENT_FIRE:
      return 'fire';
    case ELEMENT_EARTH:
      return 'earth';
    default:
      return 'unknown';
  }
}

// 根据元素获取名称（英文默认，避免代码中残留中文硬编码）
export function getElementName(element: number): string {
  const names = ['Metal', 'Wood', 'Water', 'Fire', 'Earth'];
  return names[element] || 'Unknown';
}

// 根据怪物类型获取名称
export function getMonsterTypeName(monsterType: number): string {
  switch (monsterType) {
    case MONSTER_TYPE_BEAM:
      return 'beam';
    case MONSTER_TYPE_MARBLE:
      return 'marble';
    case MONSTER_TYPE_PIXEL:
      return 'pixel';
    case MONSTER_TYPE_SUNSET:
      return 'sunset';
    case MONSTER_TYPE_BAUHAUS:
      return 'bauhaus';
    case MONSTER_TYPE_RING:
      return 'ring';
    default:
      return 'beam';
  }
}

// 根据怪物类型获取variant（用于boring-avatars）
export function getMonsterTypeVariant(monsterType: number): 'beam' | 'marble' | 'pixel' | 'sunset' | 'bauhaus' | 'ring' {
  switch (monsterType) {
    case MONSTER_TYPE_BEAM:
      return 'beam';
    case MONSTER_TYPE_MARBLE:
      return 'marble';
    case MONSTER_TYPE_PIXEL:
      return 'pixel';
    case MONSTER_TYPE_SUNSET:
      return 'sunset';
    case MONSTER_TYPE_BAUHAUS:
      return 'bauhaus';
    case MONSTER_TYPE_RING:
      return 'ring';
    default:
      return 'beam';
  }
}

// 格式化时间（秒转换为 时:分:秒 或 分:秒）
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// 合约中的基础常量（毫秒）
const BASE_ENEMY_RERANDOM_COOLDOWN_MS = 60000;  // 1分钟
const BASE_BATTLE_REVEAL_DELAY_MS = 30000;      // 0.5分钟

/**
 * 根据玩家NFT等级计算敌人刷新冷却时间（毫秒）
 * 1级1分钟，2级2分钟，3级4分钟... 每升一级翻倍
 * 计算公式：基础时间 * 2^(level-1)
 */
export function calculateEnemyRerandomCooldown(level: number): number {
  if (level <= 1) {
    return BASE_ENEMY_RERANDOM_COOLDOWN_MS;
  }
  const multiplier = Math.pow(2, level - 1);
  return BASE_ENEMY_RERANDOM_COOLDOWN_MS * multiplier;
}

/**
 * 根据玩家NFT等级计算战斗揭示延迟时间（毫秒）
 * 1级0.5分钟，2级1分钟，3级2分钟... 每升一级翻倍
 * 计算公式：基础时间 * 2^(level-1)
 */
export function calculateBattleRevealDelay(level: number): number {
  if (level <= 1) {
    return BASE_BATTLE_REVEAL_DELAY_MS;
  }
  const multiplier = Math.pow(2, level - 1);
  return BASE_BATTLE_REVEAL_DELAY_MS * multiplier;
}

