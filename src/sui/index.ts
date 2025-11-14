import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
// Ed25519Keypair 已废弃，不再使用
// import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import { keccak256 } from 'js-sha3';
import { envConfig } from '@/config/environment';

// Use environment variables to configure contract addresses
const CONTRACT_PACKAGE_ID = envConfig.contractPackageId;
const CONTRACT_OBJECT_ID = envConfig.contractObjectId;

// Create Sui client - using environment configured network
export const suiClient = new SuiClient({
  url: getFullnodeUrl(envConfig.suiNetwork),
});

// 查询用户的 SUI 余额（返回 MIST）
export async function getUserBalance(address: string): Promise<number> {
  try {
    const balance = await suiClient.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI',
    });
    return Number(balance.totalBalance || 0);
  } catch (error) {
    console.error('查询余额失败:', error);
    return 0;
  }
}

// 构建购买 NFT 的交易（默认价格 1 SUI = 10^9 MIST）
export function createBuyNftTransaction(priceMist = 1_000_000_000): Transaction {
  const tx = new Transaction();
  // 设置合理的 gas budget，避免预留过多
  tx.setGasBudget(50_000_000); // 0.05 SUI 应该足够
  // tx.gas 会自动合并账户中的所有 SUI coin 对象，确保有足够余额
  const [coin] = tx.splitCoins(tx.gas, [priceMist]);
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::buy_nft`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      coin,
      tx.object('0x8'), // Random
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}

// 设置当前使用的 NFT
export function createSetActiveNftTransaction(nftId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::set_active_nft`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
    ],
  });
  return tx;
}

// 取消战斗承诺（逃跑）
export function createCancelBattleCommitmentTransaction(
  commitmentAddr: string,
  nftId: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::cancel_battle_commitment_by_address`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.address(commitmentAddr),
      tx.pure.u64(nftId),
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}

// 取消抓捕承诺（逃跑）
export function createCancelCaptureCommitmentTransaction(
  commitmentAddr: string,
  nftId: number,
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000); // 0.05 SUI
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::cancel_capture_commitment_by_address`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.address(commitmentAddr),
      tx.pure.u64(nftId),
      tx.object('0x6'), // Clock
    ],
  });
  return tx;
}

// 随机生成敌人
export function createRandomEnemyTransaction(nftId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::random_enemy`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.object('0x8'),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 提交战斗承诺
export function createBattleCommitTransaction(
  nftId: number,
  commitmentHash: Uint8Array,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::battle_commit`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.vector('u8', Array.from(commitmentHash)),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 揭示并结算战斗
export function createBattleRevealTransaction(
  commitmentAddr: string,
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::battle_reveal_by_address`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.address(commitmentAddr),
      tx.pure.u64(nftId),
      tx.pure.u8(enemyLevel),
      tx.pure.u8(enemyElement),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(secret))),
      tx.object('0x8'),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 抓宠交易（支付 0.5 SUI = 500,000,000 MIST）
// 抓捕承诺交易（第一步）
export function createCaptureCommitTransaction(
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string,
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000); // 0.05 SUI

  // 计算承诺哈希
  const data = new Uint8Array(10 + secret.length);
  // nft_id (8 bytes)
  for (let i = 0; i < 8; i++) {
    data[i] = Number((BigInt(nftId) >> BigInt(i * 8)) & BigInt(0xFF));
  }
  // enemy_level (1 byte)
  data[8] = enemyLevel;
  // enemy_element (1 byte)
  data[9] = enemyElement;
  // secret
  const secretBytes = new TextEncoder().encode(secret);
  data.set(secretBytes, 10);

  // 使用keccak256计算哈希，并确保返回Uint8Array
  const hashResult = keccak256(data) as unknown;
  
  // 处理不同的返回类型
  let hashBytes: Uint8Array;
  if (typeof hashResult === 'string') {
    // 如果返回字符串（hex），转换为Uint8Array
    const hexString = hashResult.startsWith('0x') ? hashResult.slice(2) : hashResult;
    hashBytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    console.log('从hex字符串转换哈希');
  } else if (hashResult instanceof Uint8Array) {
    // 如果已经是Uint8Array
    hashBytes = hashResult;
    console.log('已经是Uint8Array');
  } else if (ArrayBuffer.isView(hashResult)) {
    // 如果是其他TypedArray
    hashBytes = new Uint8Array(hashResult.buffer, hashResult.byteOffset, hashResult.byteLength);
    console.log('从TypedArray转换');
  } else {
    // 其他类型，尝试转换为Uint8Array
    hashBytes = new Uint8Array(hashResult as ArrayBuffer);
    console.log('从其他类型转换');
  }
  
  // 确保哈希长度为32字节
  console.log('哈希长度:', hashBytes.length, '预期: 32');
  if (hashBytes.length !== 32) {
    console.error('❌ 哈希长度错误:', hashBytes.length, '预期: 32');
    console.error('哈希内容:', Array.from(hashBytes));
    throw new Error(`Invalid hash length: ${hashBytes.length}, expected 32`);
  }
  
  const commitmentHash = Array.from(hashBytes);
  console.log('✅ 承诺哈希生成成功，长度:', commitmentHash.length);

  const [coin] = tx.splitCoins(tx.gas, [500_000_000]); // 0.5 SUI

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::capture_commit`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.vector('u8', commitmentHash),
      coin,
      tx.object('0x6'), // Clock
    ],
  });

  return tx;
}

// 抓捕揭示交易（第二步）
export function createCaptureRevealTransaction(
  commitmentAddr: string,
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string,
): Transaction {
  const tx = new Transaction();
  tx.setGasBudget(50_000_000); // 0.05 SUI
  
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::capture_reveal_by_address`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.address(commitmentAddr),
      tx.pure.u64(nftId),
      tx.pure.u8(enemyLevel),
      tx.pure.u8(enemyElement),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(secret))),
      tx.object('0x8'), // Random
      tx.object('0x6'), // Clock
    ],
  });
  
  return tx;
}

// 合约入金（banker）
export function createDepositTransaction(amountMist: number): Transaction {
  const tx = new Transaction();
  // 设置合理的 gas budget，避免预留过多（入金可能金额较大，但 gas 不需要太多）
  tx.setGasBudget(50_000_000); // 0.05 SUI 应该足够
  // tx.gas 会自动合并账户中的所有 SUI coin 对象，确保有足够余额
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::deposit`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      coin,
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 合约出金（banker）
export function createWithdrawTransaction(amountMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::withdraw`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(amountMist),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 管理：更新 NFT 等级
export function createUpdateNftLevelTransaction(nftId: number, level: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::update_nft_level`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.u8(level),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 管理：更新 NFT 元素
export function createUpdateNftElementTransaction(nftId: number, element: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::update_nft_element`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.u8(element),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 管理：更新敌人刷新冷却（毫秒）
export function createUpdateEnemyRerandomCooldownTransaction(ms: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::update_enemy_rerandom_cooldown`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(ms),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 管理：更新战斗揭示延迟（毫秒）
export function createUpdateBattleRevealDelayTransaction(ms: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::update_battle_reveal_delay`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(ms),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 管理：更新金币怪奖励范围（最小、最大，单位 MIST）
// 奖励范围已改为随合约余额动态计算（1% - 50%），不再支持手动设置

// 管理：更新金币怪概率（base、max）
export function createUpdateGoldenMonsterProbabilityTransaction(base: number, max: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::update_golden_monster_probability`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(base),
      tx.pure.u64(max),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// ============================================
// NFT Game Types
// ============================================

// NFT元素类型
export const ELEMENT_METAL = 0;  // 金
export const ELEMENT_WOOD = 1;   // 木
export const ELEMENT_WATER = 2;  // 水
export const ELEMENT_FIRE = 3;    // 火
export const ELEMENT_EARTH = 4;   // 土

// 怪物类型
export const MONSTER_TYPE_BEAM = 0;      // beam
export const MONSTER_TYPE_MARBLE = 1;    // marble
export const MONSTER_TYPE_PIXEL = 2;     // pixel
export const MONSTER_TYPE_SUNSET = 3;    // sunset
export const MONSTER_TYPE_BAUHAUS = 4;   // bauhaus
export const MONSTER_TYPE_RING = 5;      // ring

// 敌人信息
export interface EnemyInfo {
  name: string;
  level: number;
  element: number;
  monsterType: number;
  isGoldenMonster: boolean;
  generatedAt: number;
}

// NFT数据结构
export interface HealthNFT {
  id: string;
  owner: string;
  name: string;
  element: number;
  monsterType: number;
  level: number;
  experience: number;
  mintTime: number;
  defeatedGoldenMonster: boolean;
  currentEnemy: EnemyInfo | null;
  lastEnemyGeneratedAt: number;
  is_listed: boolean; // 是否已上架到市场
  has_active_commitment: boolean; // 是否有未揭示的战斗/抓捕承诺
  nftId: number;  // NFT在合约中的ID
}

// 战斗承诺对象
export interface BattleCommitment {
  id: string;
  player: string;
  nftId: number;
  commitmentHash: string;
  enemyInfo: EnemyInfo;
  playerLevel: number;
  playerElement: number;
  committedAt: number;
  isRevealed: boolean;
}

// 战斗事件
export interface BattleEvent {
  nftId: number;
  player: string;
  isGoldenMonster: boolean;
  enemyLevel: number;
  enemyElement: number;
  playerLevel: number;
  playerElement: number;
  isWin: boolean;
  experienceGained: number;
  levelIncreased: boolean;
  rewardAmount: number;
  timestamp: number;
}

// NFT铸造事件
export interface NFTMintedEvent {
  nftId: number;
  owner: string;
  element: number;
  monsterType: number;
  level: number;
  timestamp: number;
}

// 合约信息类型
export interface ContractInfo {
  banker: string;
  contractBalance: string;
  totalMinted: number;
}

// 合约余额拆分类型（不可提款与可提款）
export interface ContractBalances {
  locked: string;        // 不可提款余额（MIST）
  withdrawable: string;  // 可提款余额（MIST）
}

// 游戏配置类型
export interface GameConfig {
  enemyRerandomCooldown: string;      // 敌人刷新冷却时间（毫秒）
  battleRevealDelay: string;          // 战斗揭示延迟时间（毫秒）
  minGoldenMonsterReward: string;     // 金币怪最小奖励（MIST）
  maxGoldenMonsterReward: string;     // 金币怪最大奖励（MIST）
  goldenMonsterBaseProb: string;      // 金币怪基础概率（0-10000）
  goldenMonsterMaxProb: string;       // 金币怪最大概率（0-10000）
}

// ============================================
// Legacy Types (保留以兼容旧代码)
// ============================================

// Game record type (旧版本)
export interface GameRecord {
  player: string;
  betAmount: string;
  betType: number;
  diceValues: number[];
  totalPoints: number;
  isWin: boolean;
  payout: string;
  timestamp: number;
}

// Bet commitment object type (旧版本)
export interface BetCommitment {
  id: string;
  player: string;
  commitmentHash: string;
  betAmount: string;
  lockedAmount: string;
  committedAt: number;
  isRevealed: boolean;
}

// ============================================
// NFT Game Functions
// ============================================

// 注意：以下旧式的 signer 函数已废弃
// 现在使用 useSignAndExecuteTransaction hook 替代
// 保留以下注释代码仅供参考

/*
// 购买NFT（支付1 SUI）- 已废弃，请使用 useSignAndExecuteTransaction
export async function buyNFT(
  signer: Ed25519Keypair
): Promise<string> {
  const tx = new Transaction();

  const NFT_PRICE = 1000000000; // 1 SUI = 10^9 MIST

  // Split SUI tokens for payment (tx.gas 会自动合并所有 coin)
  const [coin] = tx.splitCoins(tx.gas, [NFT_PRICE]);

  // Call contract buy_nft method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::buy_nft`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      coin,
      tx.object('0x8'), // Random object
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}

// 随机生成敌人并绑定到NFT - 已废弃，请使用 useSignAndExecuteTransaction
export async function randomEnemy(
  signer: Ed25519Keypair,
  nftId: number
): Promise<string> {
  const tx = new Transaction();

  // Call contract random_enemy method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::random_enemy`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.object('0x8'), // Random object
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}
*/

// 生成战斗承诺哈希 (keccak256) - 仍在使用
// 导出以便在主页面使用
export function generateBattleCommitmentHash(
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string
): Uint8Array {
  // 构建数据：nft_id (8 bytes) + enemy_level (1 byte) + enemy_element (1 byte) + secret (bytes)
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

  // 使用 keccak256 哈希（js-sha3库）
  const hashHex = keccak256(data);
  // 将hex字符串转换为Uint8Array
  const hashBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    hashBytes[i] = parseInt(hashHex.substr(i * 2, 2), 16);
  }

  return hashBytes;
}

/*
// 第一步：提交战斗承诺 - 已废弃，请使用 useSignAndExecuteTransaction
export async function battleCommit(
  signer: Ed25519Keypair,
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string
): Promise<{ txDigest: string; commitmentId: string }> {
  const tx = new Transaction();

  // 生成承诺哈希
  const commitmentHash = generateBattleCommitmentHash(
    nftId,
    enemyLevel,
    enemyElement,
    secret
  );

  // Call contract battle_commit method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::battle_commit`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.vector('u8', Array.from(commitmentHash)),
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  // 从交易结果获取承诺对象ID
  const txResult = await suiClient.getTransactionBlock({
    digest: result.digest,
    options: { showEffects: true }
  });

  const commitmentId = txResult.effects?.created?.[0]?.reference?.objectId;
  if (!commitmentId) {
    throw new Error('Failed to get commitment ID from transaction');
  }

  return {
    txDigest: result.digest,
    commitmentId,
  };
}

// 第二步：揭示并结算战斗 - 已废弃，请使用 useSignAndExecuteTransaction
export async function battleReveal(
  signer: Ed25519Keypair,
  commitmentId: string,
  nftId: number,
  enemyLevel: number,
  enemyElement: number,
  secret: string
): Promise<string> {
  const tx = new Transaction();

  // Call contract battle_reveal method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::battle_reveal`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.object(commitmentId),
      tx.pure.u64(nftId),
      tx.pure.u8(enemyLevel),
      tx.pure.u8(enemyElement),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(secret))),
      tx.object('0x8'), // Random object
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}
*/

// 通过事件查询NFT铸造历史（获取所有NFT的ID列表）
export async function getNFTsByEvents(ownerAddress?: string): Promise<NFTMintedEvent[]> {
  try {
    // 构建查询过滤器
    // 注意：NFTMintedEvent 没有 sender 字段，需要通过 owner 字段过滤
    const query = {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::NFTMintedEvent`,
    } as {
      MoveEventType: string;
      Sender?: string;
    };

    const events = await suiClient.queryEvents({
      query,
      limit: 1000, // 获取最多1000个NFT
      order: 'descending',
    });

    if (!events.data || events.data.length === 0) {
      return [];
    }

    // 解析NFT铸造事件
    let nftEvents: NFTMintedEvent[] = events.data.map((event) => {
      const parsed = event.parsedJson as {
        nft_id: string | number;
        owner: string;
        element: string | number;
        monster_type?: string | number;
        level: string | number;
        timestamp: string | number;
      };

      return {
        nftId: Number(parsed.nft_id),
        owner: String(parsed.owner),
        element: Number(parsed.element),
        monsterType: parsed.monster_type !== undefined ? Number(parsed.monster_type) : 0, // 默认beam类型
        level: Number(parsed.level),
        timestamp: Number(parsed.timestamp),
      };
    });

    // 如果指定了ownerAddress，进行过滤
    if (ownerAddress) {
      nftEvents = nftEvents.filter(e => e.owner.toLowerCase() === ownerAddress.toLowerCase());
    }

    return nftEvents;
  } catch (error) {
    console.error('Error fetching NFTs by events:', error);
    return [];
  }
}

// 获取用户拥有的所有NFT（通过合约查询所有权，包括从市场购买的NFT）
export async function getUserNFTs(userAddress: string): Promise<NFTMintedEvent[]> {
  try {
    // 使用 getOwnerNFTIds 直接从合约查询用户拥有的NFT ID列表
    // 这样可以找到所有NFT，包括从市场购买的
    const nftIds = await getOwnerNFTIds(userAddress);
    
    if (nftIds.length === 0) {
      return [];
    }

    // 获取每个NFT的完整信息
    const nftInfos = await Promise.all(
      nftIds.map(id => getFullNFTInfo(id))
    );

    // 转换为 NFTMintedEvent 格式
    const nftEvents: NFTMintedEvent[] = [];
    
    for (const nftInfo of nftInfos) {
      if (nftInfo && nftInfo.owner.toLowerCase() === userAddress.toLowerCase()) {
        nftEvents.push({
          nftId: nftInfo.nftId,
          owner: nftInfo.owner,
          element: nftInfo.element,
          monsterType: nftInfo.monsterType ?? 0, // 默认beam类型
          level: nftInfo.level,
          timestamp: nftInfo.mintTime,
        });
      }
    }

    // 按NFT ID降序排序（最新的在前）
    nftEvents.sort((a, b) => b.nftId - a.nftId);

    return nftEvents;
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    // 如果新方法失败，回退到旧的事件查询方法
    return getNFTsByEvents(userAddress);
  }
}

// 获取NFT信息
// 注意：由于NFT存储在合约的object_table中，无法直接通过devInspect获取
// 这个函数提供一个基础框架，实际使用时建议：
// 1. 通过 getNFTsByEvents() 获取NFT列表
// 2. 通过事件订阅追踪NFT状态变化
// 3. 通过 getNFTCurrentEnemy() 获取当前敌人信息
export async function getNFT(
  nftId: number
): Promise<HealthNFT | null> {
  try {
    // 首先尝试通过事件查询获取NFT基本信息
    const events = await getNFTsByEvents();
    const nftEvent = events.find(e => e.nftId === nftId);

    if (!nftEvent) {
      return null;
    }

    // 获取当前敌人信息
    const currentEnemy = await getNFTCurrentEnemy(nftId);

    // 由于无法直接获取完整NFT信息，返回通过事件获取的基础信息
    // 注意：经验值、等级变化等需要通过BattleEvent事件追踪
    return {
      id: `nft-${nftId}`, // 生成的ID
      owner: nftEvent.owner,
      name: `NFT #${nftId}`, // 默认名称，实际名称需要通过其他方式获取
      element: nftEvent.element,
      monsterType: nftEvent.monsterType ?? 0, // 默认beam类型
      level: nftEvent.level, // 初始等级，实际等级可能已变化
      experience: 0, // 需要通过事件追踪
      mintTime: nftEvent.timestamp,
      defeatedGoldenMonster: false, // 需要通过事件追踪
      currentEnemy: currentEnemy,
      lastEnemyGeneratedAt: currentEnemy?.generatedAt || 0,
      is_listed: false, // 默认未上架
      has_active_commitment: false, // 默认无承诺标记（需基于链上对象实时判断）
      nftId: nftId,
    };
  } catch (error) {
    console.error('Error getting NFT:', error);
    return null;
  }
}

// 定义 EnemyInfo 的 BCS 结构
const EnemyInfoBCS = bcs.struct('EnemyInfo', {
  name: bcs.vector(bcs.u8()),
  level: bcs.u8(),
  element: bcs.u8(),
  monster_type: bcs.u8(),  // 怪物类型：0=beam, 1=marble, 2=pixel, 3=sunset, 4=bauhaus, 5=ring
  is_golden_monster: bcs.bool(),
  generated_at: bcs.u64(),
});

// 获取NFT的当前敌人信息
export async function getNFTCurrentEnemy(
  nftId: number
): Promise<EnemyInfo | null> {
  try {
    const tx = new Transaction();

    tx.moveCall({
      target: `${CONTRACT_PACKAGE_ID}::suu::get_nft_current_enemy`,
      arguments: [
        tx.object(CONTRACT_OBJECT_ID),
        tx.pure.u64(nftId),
      ],
    });

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    const returnValues = result.results?.[0]?.returnValues;
    if (!returnValues || returnValues.length === 0) {
      return null;
    }

    // 解析 Option<EnemyInfo>
    const optionBytes = returnValues[0][0] as number[];

    // Option<T> 的 BCS 编码：第一个字节是 tag (0=None, 1=Some)
    if (optionBytes.length === 0 || optionBytes[0] === 0) {
      return null; // None
    }

    // 提取 Some 值的数据（跳过第一个字节的 tag）
    const dataBytes = optionBytes.slice(1);

    try {
      // 使用 BCS 解析 EnemyInfo
      const enemyInfoData = EnemyInfoBCS.parse(new Uint8Array(dataBytes)) as unknown as {
        name: number[];
        level: number;
        element: number;
        monster_type?: number;
        is_golden_monster: boolean;
        generated_at: bigint | string | number;
      };

      // 将 name 字段从 vector<u8> 转换为字符串
      const nameBytes = enemyInfoData.name;
      const name = new TextDecoder().decode(new Uint8Array(nameBytes));

      return {
        name: name,
        level: Number(enemyInfoData.level),
        element: Number(enemyInfoData.element),
        monsterType: Number(enemyInfoData.monster_type ?? 0), // 默认beam类型
        isGoldenMonster: Boolean(enemyInfoData.is_golden_monster),
        generatedAt: typeof enemyInfoData.generated_at === 'bigint'
          ? Number(enemyInfoData.generated_at)
          : Number(enemyInfoData.generated_at),
      };
    } catch (parseError) {
      console.error('Error parsing EnemyInfo BCS:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error getting NFT current enemy:', error);
    return null;
  }
}

// 获取完整NFT信息（包括经验值）
export async function getFullNFTInfo(nftId: number): Promise<HealthNFT | null> {
  try {
    const tx = new Transaction();

    tx.moveCall({
      target: `${CONTRACT_PACKAGE_ID}::suu::get_nft`,
      arguments: [
        tx.object(CONTRACT_OBJECT_ID),
        tx.pure.u64(nftId),
      ],
    });

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    const returnValues = result.results?.[0]?.returnValues;
    if (!returnValues || returnValues.length === 0) {
      console.error('getFullNFTInfo: 没有返回值');
      return null;
    }

    // 获取返回的字节数组
    const nftBytes = returnValues[0][0] as number[];

    console.log('NFT原始数据:', {
      length: nftBytes.length,
      hex: nftBytes.slice(0, 100).map(b => b.toString(16).padStart(2, '0')).join(' '),
    });

    // 手动解析 BCS 编码的 HealthNFT 结构
    // 结构顺序：UID (32字节) + owner (32字节) + name (vector<u8>) + element (u8) + level (u8) + 
    //          experience (u64) + mint_time (u64) + defeated_golden_monster (bool) + 
    //          current_enemy (Option<EnemyInfo>) + last_enemy_generated_at (u64)

    let offset = 32; // 跳过 UID (32字节)

    // 1. owner (address, 32字节)
    const ownerBytes = nftBytes.slice(offset, offset + 32);
    const owner = '0x' + ownerBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('');
    offset += 32;

    // 2. name (vector<u8>) - BCS 编码: length (ULEB128) + bytes
    const nameLength = readULEB128(nftBytes, offset);
    const nameLengthBytes = getULEB128ByteLength(nftBytes, offset);
    offset += nameLengthBytes;
    const nameBytes = nftBytes.slice(offset, offset + nameLength);
    const name = new TextDecoder().decode(new Uint8Array(nameBytes));
    offset += nameLength;

    // 3. element (u8)
    const element = nftBytes[offset];
    offset += 1;

    // 4. monster_type (u8)
    const monsterType = nftBytes[offset];
    offset += 1;

    // 5. level (u8)
    const level = nftBytes[offset];
    offset += 1;

    // 6. experience (u64, 8字节, little endian)
    const experience = readU64(nftBytes, offset);
    offset += 8;

    // 7. mint_time (u64, 8字节)
    const mintTime = readU64(nftBytes, offset);
    offset += 8;

    // 8. defeated_golden_monster (bool, 1字节)
    const defeatedGoldenMonster = nftBytes[offset] !== 0;
    offset += 1;

    // 9. current_enemy (Option<EnemyInfo>)
    const enemyOptionTag = nftBytes[offset];
    offset += 1;
    let currentEnemy: EnemyInfo | null = null;

    if (enemyOptionTag === 1) {
      // Some - 解析 EnemyInfo
      // EnemyInfo 结构：name (vector<u8>) + level (u8) + element (u8) + monster_type (u8) + is_golden_monster (bool) + generated_at (u64)
      
      // 1. name (vector<u8>)
      const enemyNameLength = readULEB128(nftBytes, offset);
      const enemyNameLengthBytes = getULEB128ByteLength(nftBytes, offset);
      offset += enemyNameLengthBytes;
      const enemyNameBytes = nftBytes.slice(offset, offset + enemyNameLength);
      const enemyName = new TextDecoder().decode(new Uint8Array(enemyNameBytes));
      offset += enemyNameLength;
      
      // 2. level (u8)
      const enemyLevel = nftBytes[offset];
      offset += 1;

      // 3. element (u8)
      const enemyElement = nftBytes[offset];
      offset += 1;

      // 4. monster_type (u8)
      const enemyMonsterType = nftBytes[offset];
      offset += 1;

      // 5. is_golden_monster (bool)
      const isGoldenMonster = nftBytes[offset] !== 0;
      offset += 1;

      // 6. generated_at (u64)
      const generatedAt = readU64(nftBytes, offset);
      offset += 8;

      currentEnemy = {
        name: enemyName,
        level: enemyLevel,
        element: enemyElement,
        monsterType: enemyMonsterType,
        isGoldenMonster,
        generatedAt,
      };
    }

    // 10. last_enemy_generated_at (u64, 8字节)
    const lastEnemyGeneratedAt = readU64(nftBytes, offset);
    offset += 8;

    // 11. is_listed (bool, 1字节)
    const isListed = readBool(nftBytes, offset);
    offset += 1;

    // 12. has_active_commitment (bool, 1字节)
    const hasActiveCommitment = readBool(nftBytes, offset);
    offset += 1;

    const nftInfo: HealthNFT = {
      id: `nft-${nftId}`,
      owner,
      name,
      element,
      monsterType,
      level,
      experience,
      mintTime,
      defeatedGoldenMonster,
      currentEnemy,
      lastEnemyGeneratedAt,
      is_listed: isListed,
      has_active_commitment: hasActiveCommitment,
      nftId,
    };

    console.log('解析NFT信息成功:', {
      nftId,
      name,
      level,
      element,
      experience,
      defeatedGoldenMonster,
      hasEnemy: currentEnemy !== null,
    });

    return nftInfo;
  } catch (error) {
    console.error('获取NFT完整信息失败:', error);
    return null;
  }
}

// 辅助函数：读取 u64 (little endian)
function readU64(bytes: number[], offset: number): number {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    result += bytes[offset + i] * Math.pow(256, i);
  }
  return result;
}

// 辅助函数：从字节数组中读取一个布尔值 (1字节)
function readBool(bytes: number[], offset: number): boolean {
    const value = bytes[offset];
    return value === 1;
}

// 辅助函数：读取 ULEB128 编码的长度
function readULEB128(bytes: number[], offset: number): number {
  let result = 0;
  let shift = 0;
  let i = offset;

  while (i < bytes.length) {
    const byte = bytes[i];
    result |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    i++;
  }

  return result;
}

// 辅助函数：获取 ULEB128 编码占用的字节数
function getULEB128ByteLength(bytes: number[], offset: number): number {
  let length = 0;
  let i = offset;

  while (i < bytes.length) {
    length++;
    if ((bytes[i] & 0x80) === 0) break;
    i++;
  }

  return length;
}

// 获取下次可以重新随机敌人的时间（毫秒时间戳）
export async function getNextEnemyRandomTime(
  nftId: number
): Promise<number> {
  try {
    const tx = new Transaction();

    tx.moveCall({
      target: `${CONTRACT_PACKAGE_ID}::suu::get_next_enemy_random_time`,
      arguments: [
        tx.object(CONTRACT_OBJECT_ID),
        tx.pure.u64(nftId),
      ],
    });

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    const returnValues = result.results?.[0]?.returnValues;
    if (!returnValues) {
      return 0;
    }

    // Parse u64 value
    const timeBytes = returnValues[0][0] as number[];
    const parseU64 = (bytes: number[]) => {
      let value = 0;
      for (let i = 0; i < 8; i++) {
        value += bytes[i] * Math.pow(256, i);
      }
      return value;
    };

    return parseU64(timeBytes);
  } catch (error) {
    console.error('Error getting next enemy random time:', error);
    return 0;
  }
}

// 获取用户的战斗承诺（未揭示的）
// 注意：BattleCommitment 是共享对象，需要通过事件查询
export async function getUserPendingBattleCommitments(
  userAddress: string
): Promise<BattleCommitment[]> {
  try {
    console.log('Fetching pending battle commitments for user:', userAddress);

    // 查询用户的战斗承诺创建事件
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::BattleCommitmentCreatedEvent`,
      },
      limit: 100, // 获取最近100个战斗承诺事件
      order: 'descending',
    });

    console.log('Found BattleCommitmentCreatedEvent events:', events);

    if (!events.data || events.data.length === 0) {
      return [];
    }

    // 过滤出该用户的承诺事件
    const userCommitmentInfos = events.data
      .map((event) => {
        const parsed = event.parsedJson as {
          commitment_id: string;
          player: string;
          nft_id: string | number;
          timestamp: string | number;
        };
        return {
          commitmentId: String(parsed.commitment_id),
          player: String(parsed.player),
          nftId: Number(parsed.nft_id),
          timestamp: Number(parsed.timestamp),
        };
      })
      .filter((info) => info.player.toLowerCase() === userAddress.toLowerCase());

    console.log('User commitment infos:', userCommitmentInfos);

    if (userCommitmentInfos.length === 0) {
      return [];
    }

    // 查询每个承诺对象，检查是否已揭示
    const commitments: BattleCommitment[] = [];

    for (const info of userCommitmentInfos) {
      try {
        // 查询共享对象
        const obj = await suiClient.getObject({
          id: info.commitmentId,
          options: {
            showContent: true,
            showType: true,
          },
        });

        console.log('Fetched commitment object:', obj);

        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as {
            id?: { id: string };
            player?: string;
            nft_id?: string | number;
            commitment_hash?: string | number[];
            enemy_info?: {
              fields?: { name?: string | number[]; level?: number; element?: number; monster_type?: number; is_golden_monster?: boolean; generated_at?: number | string };
              name?: string | number[];
              level?: number;
              element?: number;
              monster_type?: number;
              is_golden_monster?: boolean;
              generated_at?: number | string;
            };
            player_level?: string | number;
            player_element?: string | number;
            committed_at?: string | number;
            is_revealed?: boolean;
          };

          // Only return unrevealed commitments
          if (!fields.is_revealed) {
            // Parse enemy_info
            const enemyInfoFields = fields.enemy_info?.fields || fields.enemy_info;
            
            // 解析 name 字段
            let enemyName = '';
            const nameField = enemyInfoFields?.name;
            if (typeof nameField === 'string') {
              enemyName = nameField;
            } else if (Array.isArray(nameField)) {
              enemyName = new TextDecoder().decode(new Uint8Array(nameField));
            }
            
            const enemyInfo: EnemyInfo = {
              name: enemyName,
              level: Number(enemyInfoFields?.level || 0),
              element: Number(enemyInfoFields?.element || 0),
              monsterType: Number(enemyInfoFields?.monster_type ?? 0), // 默认beam类型
              isGoldenMonster: Boolean(enemyInfoFields?.is_golden_monster || false),
              generatedAt: Number(enemyInfoFields?.generated_at || 0),
            };

            // Parse commitment_hash (可能是数组格式)
            let commitmentHashStr = '';
            if (Array.isArray(fields.commitment_hash)) {
              commitmentHashStr = fields.commitment_hash.map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
              commitmentHashStr = String(fields.commitment_hash || '');
            }

            commitments.push({
              id: info.commitmentId,
              player: String(fields.player || info.player),
              nftId: Number(fields.nft_id || info.nftId),
              commitmentHash: commitmentHashStr,
              enemyInfo,
              playerLevel: Number(fields.player_level || 0),
              playerElement: Number(fields.player_element || 0),
              committedAt: Number(fields.committed_at || info.timestamp),
              isRevealed: Boolean(fields.is_revealed || false),
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching commitment ${info.commitmentId}:`, error);
        // 继续处理下一个
      }
    }

    console.log('Parsed pending battle commitments:', commitments);
    return commitments;
  } catch (error) {
    console.error('Error fetching pending battle commitments:', error);
    return [];
  }
}

// 获取用户的抓捕承诺（未揭示的）
// 通过 CaptureCommitmentCreatedEvent 查询，再读取对象判断 is_revealed
export interface CaptureCommitment {
  id: string;
  player: string;
  nftId: number;
  committedAt: number;
  isRevealed: boolean;
}

export async function getUserPendingCaptureCommitments(
  userAddress: string
): Promise<CaptureCommitment[]> {
  try {
    console.log('Fetching pending capture commitments for user:', userAddress);

    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::CaptureCommitmentCreatedEvent`,
      },
      limit: 100,
      order: 'descending',
    });

    if (!events.data || events.data.length === 0) {
      return [];
    }

    const userCommitmentInfos = events.data
      .map((event) => {
        const parsed = event.parsedJson as {
          commitment_id?: string;
          player?: string;
          nft_id?: string | number;
          timestamp?: string | number;
        };
        return {
          commitmentId: String(parsed?.commitment_id ?? ''),
          player: String(parsed?.player ?? ''),
          nftId: Number(parsed?.nft_id ?? 0),
          timestamp: Number(parsed?.timestamp ?? 0),
        };
      })
      .filter((info) => info.player.toLowerCase() === userAddress.toLowerCase())
      .filter((info) => !!info.commitmentId);

    if (userCommitmentInfos.length === 0) {
      return [];
    }

    const commitments: CaptureCommitment[] = [];

    for (const info of userCommitmentInfos) {
      try {
        const obj = await suiClient.getObject({
          id: info.commitmentId,
          options: {
            showContent: true,
            showType: true,
          },
        });

        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = (obj.data.content as { fields?: Record<string, unknown> }).fields ?? {};
          const isRevealed = Boolean((fields as { is_revealed?: boolean }).is_revealed || false);
          if (!isRevealed) {
            commitments.push({
              id: info.commitmentId,
              player: info.player,
              nftId: Number((fields as { nft_id?: number | string }).nft_id ?? info.nftId),
              committedAt: Number((fields as { committed_at?: number | string }).committed_at ?? info.timestamp),
              isRevealed: false,
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching capture commitment ${info.commitmentId}:`, error);
        // 忽略该条，继续处理下一条
      }
    }

    console.log('Parsed pending capture commitments:', commitments);
    return commitments;
  } catch (error) {
    console.error('Error fetching pending capture commitments:', error);
    return [];
  }
}

// ============================================
// Banker Functions (已废弃的旧式 signer 函数)
// ============================================
// 这些函数已废弃，请使用 useSignAndExecuteTransaction hook

/*
// Banker deposit - 已废弃
export async function depositToContract(
  signer: Ed25519Keypair,
  amount: number
): Promise<string> {
  const tx = new Transaction();

  // Split SUI tokens (tx.gas 会自动合并所有 coin)
  const [coin] = tx.splitCoins(tx.gas, [amount]);

  // Call contract deposit method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::deposit`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      coin,
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}

// Banker withdrawal - 已废弃
export async function withdrawFromContract(
  signer: Ed25519Keypair,
  amount: number
): Promise<string> {
  const tx = new Transaction();

  // Call contract withdraw method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::withdraw`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(amount),
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}

// Step 1: Submit commitment - 已废弃
export async function commitBet(
  signer: Ed25519Keypair,
  betAmount: number,
  isBig: boolean,
  secret: string
): Promise<string> {
  const tx = new Transaction();

  // Split SUI tokens for betting (tx.gas 会自动合并所有 coin)
  const [coin] = tx.splitCoins(tx.gas, [betAmount]);

  // Generate commitment hash
  const commitmentHash = await generateCommitmentHash(isBig, secret);

  // Call contract commit_bet method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::sbbbs::commit_bet`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.vector('u8', Array.from(commitmentHash)),
      coin,
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}

// Step 2: Reveal and play - 已废弃
export async function revealAndPlay(
  signer: Ed25519Keypair,
  commitmentId: string,
  isBig: boolean,
  secret: string
): Promise<string> {
  const tx = new Transaction();

  // Call contract reveal_and_play method
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::sbbbs::reveal_and_play`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.object(commitmentId),
      tx.pure.bool(isBig),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(secret))),
      tx.object('0x8'), // Random object
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result.digest;
}

// Generate commitment hash
async function generateCommitmentHash(isBig: boolean, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = new Uint8Array(1 + secret.length);
  data[0] = isBig ? 1 : 0;
  data.set(encoder.encode(secret), 1);

  // Use Web Crypto API to generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Compatibility: Keep old playGame function name but use new commit-reveal pattern - 已废弃
export async function playGame(
  signer: Ed25519Keypair,
  betAmount: number,
  isBig: boolean
): Promise<{ commitmentTx: string; commitmentId: string; secret: string }> {
  // Generate random secret
  const secret = Math.random().toString(36).substring(2, 15);

  // Submit commitment
  const commitmentTx = await commitBet(signer, betAmount, isBig, secret);

  // Get commitment object ID from transaction result
  const txResult = await suiClient.getTransactionBlock({
    digest: commitmentTx,
    options: { showEffects: true }
  });

  const commitmentId = txResult.effects?.created?.[0]?.reference?.objectId;
  if (!commitmentId) {
    throw new Error('Failed to get commitment ID');
  }

  return {
    commitmentTx,
    commitmentId,
    secret
  };
}
*/

// Get contract info
export async function getContractInfo(): Promise<ContractInfo> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::get_contract_info`,
    arguments: [tx.object(CONTRACT_OBJECT_ID)],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues) {
    throw new Error('Failed to get contract info');
  }

  // Add debug info
  console.log('Contract info return values:', returnValues);

  // get_contract_info 返回 (address, u64, u64) = (banker, contract_balance, total_minted)
  const bankerBytes = returnValues[0][0] as number[];
  const balanceBytes = returnValues[1][0] as number[];
  const totalMintedBytes = returnValues[2][0] as number[];

  // Parse address (32 bytes)
  const bankerAddress = '0x' + bankerBytes.map(b => b.toString(16).padStart(2, '0')).join('');

  // Parse u64 value (8 bytes, little endian)
  const parseU64 = (bytes: number[]) => {
    let value = 0;
    for (let i = 0; i < 8; i++) {
      value += bytes[i] * Math.pow(256, i);
    }
    return value;
  };

  const contractBalance = parseU64(balanceBytes);
  const totalMinted = parseU64(totalMintedBytes);

  console.log('Parsed values:');
  console.log('Banker Address:', bankerAddress);
  console.log('Contract Balance (MIST):', contractBalance);
  console.log('Total Minted:', totalMinted);

  return {
    banker: bankerAddress,
    contractBalance: contractBalance.toString(),
    totalMinted: totalMinted,
  };
}

// 获取合约的不可提款与可提款余额
export async function getContractBalances(): Promise<ContractBalances> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::get_contract_balances`,
    arguments: [tx.object(CONTRACT_OBJECT_ID)],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues || returnValues.length < 2) {
    throw new Error('Failed to get contract balances');
  }

  const parseU64 = (bytes: number[]) => {
    let value = BigInt(0);
    let mul = BigInt(1);
    for (let i = 0; i < 8; i++) {
      const b = BigInt((bytes && bytes.length > i ? bytes[i] : 0));
      value += b * mul;
      mul *= BigInt(256);
    }
    return value.toString();
  };

  const locked = parseU64(returnValues[0][0] as number[]);
  const withdrawable = parseU64(returnValues[1][0] as number[]);

  return { locked, withdrawable };
}

// 获取游戏配置
export async function getGameConfig(): Promise<GameConfig> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::get_game_config_values`,
    arguments: [tx.object(CONTRACT_OBJECT_ID)],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues) {
    throw new Error('Failed to get game config');
  }

  // get_game_config_values 返回 (u64, u64, u64, u64)
  // 对应: (min_golden_monster_reward, max_golden_monster_reward, golden_monster_base_prob, golden_monster_max_prob)
  const parseU64 = (bytes: number[]) => {
    let value = BigInt(0);
    let mul = BigInt(1);
    for (let i = 0; i < 8; i++) {
      const b = BigInt((bytes && bytes.length > i ? bytes[i] : 0));
      value += b * mul;
      mul *= BigInt(256);
    }
    return value.toString();
  };

  // 基础常量值（与合约中的常量对应）
  // BASE_ENEMY_RERANDOM_COOLDOWN = 600000 (10分钟)
  // BASE_BATTLE_REVEAL_DELAY = 180000 (3分钟)
  // 与合约常量一致（每级翻倍的基础值）
  const BASE_ENEMY_RERANDOM_COOLDOWN = '60000';
  const BASE_BATTLE_REVEAL_DELAY = '30000';

  // 确保 returnValues 有足够的元素
  if (returnValues.length < 4) {
    throw new Error(`Expected 4 return values, got ${returnValues.length}`);
  }

  return {
    enemyRerandomCooldown: BASE_ENEMY_RERANDOM_COOLDOWN,
    battleRevealDelay: BASE_BATTLE_REVEAL_DELAY,
    minGoldenMonsterReward: parseU64(returnValues[0][0] as number[]),
    maxGoldenMonsterReward: parseU64(returnValues[1][0] as number[]),
    goldenMonsterBaseProb: parseU64(returnValues[2][0] as number[]),
    goldenMonsterMaxProb: parseU64(returnValues[3][0] as number[]),
  };
}

// Get recent game records
export async function getRecentGames(count: number): Promise<GameRecord[]> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::sbbbs::get_recent_games`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(count),
    ],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues) {
    return [];
  }

  // Parse returned game records
  return parseGameRecords(returnValues[0][0]);
}

// Get player game records
export async function getPlayerGames(playerAddress: string): Promise<GameRecord[]> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::sbbbs::get_player_games`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.address(playerAddress),
    ],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues) {
    return [];
  }

  // Parse returned game records
  return parseGameRecords(returnValues[0][0]);
}

// Define BCS structures
// Note: GameRecord now uses u8 for bet_type (0=Small, 1=Big, 2=Odd, 3=Even, etc.)
const GameRecordBCS = bcs.struct('GameRecord', {
  player: bcs.Address,
  bet_amount: bcs.u64(),
  bet_type: bcs.u8(),        // Changed from BetType struct to u8
  bet_value: bcs.u64(),      // Added: bet value field
  dice_values: bcs.vector(bcs.u64()),
  total_points: bcs.u64(),
  is_win: bcs.bool(),
  payout: bcs.u64(),
  timestamp: bcs.u64(),
});

// Parse game record data
function parseGameRecords(data: number[] | Uint8Array | string): GameRecord[] {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return [];
  }

  try {
    console.log('Parsing game records, data:', data);

    // data is BCS encoded vector<GameRecord>
    const bytes = new Uint8Array(data as number[]);
    console.log('Bytes to parse:', bytes);

    // Use BCS to parse vector<GameRecord>
    const GameRecordVector = bcs.vector(GameRecordBCS);
    const parsed = GameRecordVector.parse(bytes) as unknown as Array<{
      player: string;
      bet_amount: bigint;
      bet_type: number;
      bet_value: bigint;
      dice_values: bigint[];
      total_points: bigint;
      is_win: boolean;
      payout: bigint;
      timestamp: bigint;
    }>;

    console.log('Parsed raw data:', parsed);

    // Convert to frontend GameRecord format
    const records: GameRecord[] = parsed.map((record) => ({
      player: record.player,
      betAmount: record.bet_amount.toString(),
      betType: Number(record.bet_type), // Now using u8 directly (0=Small, 1=Big, 2=Odd, 3=Even)
      diceValues: record.dice_values.map((v: bigint) => Number(v)),
      totalPoints: Number(record.total_points),
      isWin: record.is_win,
      payout: record.payout.toString(),
      timestamp: Number(record.timestamp),
    }));

    console.log('Parsed game records:', records);
    return records;
  } catch (error) {
    console.error('Failed to parse game records:', error);
    return [];
  }
}

// Get user's unrevealed commitments
export async function getUserPendingCommitments(userAddress: string): Promise<BetCommitment[]> {
  try {
    console.log('Fetching pending commitments for user:', userAddress);

    // Query all objects owned by user
    const objects = await suiClient.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${CONTRACT_PACKAGE_ID}::sbbbs::BetCommitment`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    console.log('Found BetCommitment objects:', objects);

    if (!objects.data || objects.data.length === 0) {
      return [];
    }

    // Parse commitment objects
    const commitments: BetCommitment[] = [];

    for (const obj of objects.data) {
      if (obj.data && obj.data.content && 'fields' in obj.data.content) {
        const fields = obj.data.content.fields as {
          id?: { id: string };
          player?: string;
          commitment_hash?: string;
          bet_amount?: string | number;
          locked_amount?: string | number;
          committed_at?: string | number;
          is_revealed?: boolean;
        };

        // Only return unrevealed commitments
        if (!fields.is_revealed) {
          commitments.push({
            id: fields.id?.id || '',
            player: String(fields.player || ''),
            commitmentHash: String(fields.commitment_hash || ''),
            betAmount: String(fields.bet_amount || '0'),
            lockedAmount: String(fields.locked_amount || '0'),
            committedAt: Number(fields.committed_at || 0),
            isRevealed: Boolean(fields.is_revealed || false),
          });
        }
      }
    }

    console.log('Parsed pending commitments:', commitments);
    return commitments;
  } catch (error) {
    console.error('Error fetching pending commitments:', error);
    return [];
  }
}

// Get all pending commitments (from all users) via events
export async function getAllPendingCommitments(): Promise<BetCommitment[]> {
  try {
    console.log('Fetching all pending commitments via events...');

    // Query CommitmentCreatedEvent to find all commitment IDs
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_PACKAGE_ID}::sbbbs::CommitmentCreatedEvent`,
      },
      limit: 100, // Get last 100 commitment events
      order: 'descending',
    });

    console.log('Found commitment created events:', events);

    if (!events.data || events.data.length === 0) {
      return [];
    }

    // Extract commitment IDs and other info from events
    const commitmentInfos = events.data.map((event) => {
      const parsed = event.parsedJson as {
        commitment_id: string;
        player: string;
        bet_amount: string | number;
        timestamp: string | number;
      };
      return {
        commitmentId: String(parsed.commitment_id),
        player: String(parsed.player),
        betAmount: String(parsed.bet_amount),
        timestamp: Number(parsed.timestamp),
      };
    });

    console.log('Extracted commitment infos:', commitmentInfos);

    // Fetch each commitment object to check if it still exists (not revealed/unlocked)
    const commitments: BetCommitment[] = [];

    for (const info of commitmentInfos) {
      try {
        const obj = await suiClient.getObject({
          id: info.commitmentId,
          options: {
            showContent: true,
            showType: true,
          },
        });

        // If object exists and not revealed, add to list
        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as {
            id?: { id: string };
            player?: string;
            commitment_hash?: string;
            bet_amount?: string | number;
            locked_amount?: string | number;
            committed_at?: string | number;
            is_revealed?: boolean;
          };

          if (!fields.is_revealed) {
            commitments.push({
              id: fields.id?.id || '',
              player: String(fields.player || ''),
              commitmentHash: String(fields.commitment_hash || ''),
              betAmount: String(fields.bet_amount || '0'),
              lockedAmount: String(fields.locked_amount || '0'),
              committedAt: Number(fields.committed_at || 0),
              isRevealed: Boolean(fields.is_revealed || false),
            });
          }
        }
      } catch {
        // Object might be deleted (revealed/unlocked), skip it
        console.log(`Commitment ${info.commitmentId} not found (might be revealed/unlocked)`);
      }
    }

    console.log('Parsed all pending commitments:', commitments);
    return commitments;
  } catch (error) {
    console.error('Error fetching all pending commitments:', error);
    return [];
  }
}

// ============================================
// Event Subscriptions
// ============================================

// Subscribe to NFT minted events
export async function subscribeToNFTMintedEvents(
  callback: (event: NFTMintedEvent) => void
): Promise<() => void> {
  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::NFTMintedEvent`,
    },
    onMessage: (event) => {
      const parsed = event.parsedJson as {
        nft_id: string | number;
        owner: string;
        element: string | number;
        monster_type?: string | number;
        level: string | number;
        timestamp: string | number;
      };
      callback({
        nftId: Number(parsed.nft_id),
        owner: String(parsed.owner),
        element: Number(parsed.element),
        monsterType: parsed.monster_type !== undefined ? Number(parsed.monster_type) : 0, // 默认beam类型
        level: Number(parsed.level),
        timestamp: Number(parsed.timestamp),
      });
    },
  });

  return unsubscribe;
}

// Subscribe to battle events
export async function subscribeToBattleEvents(
  callback: (event: BattleEvent) => void
): Promise<() => void> {
  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::BattleEvent`,
    },
    onMessage: (event) => {
      const parsed = event.parsedJson as {
        nft_id: string | number;
        player: string;
        is_golden_monster: boolean;
        enemy_level: string | number;
        enemy_element: string | number;
        player_level: string | number;
        player_element: string | number;
        is_win: boolean;
        experience_gained: string | number;
        level_increased: boolean;
        reward_amount: string | number;
        timestamp: string | number;
      };
      callback({
        nftId: Number(parsed.nft_id),
        player: String(parsed.player),
        isGoldenMonster: Boolean(parsed.is_golden_monster),
        enemyLevel: Number(parsed.enemy_level),
        enemyElement: Number(parsed.enemy_element),
        playerLevel: Number(parsed.player_level),
        playerElement: Number(parsed.player_element),
        isWin: Boolean(parsed.is_win),
        experienceGained: Number(parsed.experience_gained),
        levelIncreased: Boolean(parsed.level_increased),
        rewardAmount: Number(parsed.reward_amount),
        timestamp: Number(parsed.timestamp),
      });
    },
  });

  return unsubscribe;
}

// Subscribe to battle commitment created events
export async function subscribeToBattleCommitmentCreatedEvents(
  callback: (event: { commitmentId: string; player: string; nftId: number; timestamp: number }) => void
): Promise<() => void> {
  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::BattleCommitmentCreatedEvent`,
    },
    onMessage: (event) => {
      const parsed = event.parsedJson as {
        commitment_id: string;
        player: string;
        nft_id: string | number;
        timestamp: string | number;
      };
      callback({
        commitmentId: String(parsed.commitment_id),
        player: String(parsed.player),
        nftId: Number(parsed.nft_id),
        timestamp: Number(parsed.timestamp),
      });
    },
  });

  return unsubscribe;
}

// Subscribe to deposit events
export async function subscribeToDepositEvents(
  callback: (event: { banker: string; amount: number; new_balance: number; timestamp: number }) => void
): Promise<() => void> {
  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::DepositEvent`,
    },
    onMessage: (event) => {
      const parsed = event.parsedJson as {
        banker: string;
        amount: string | number;
        new_balance: string | number;
        timestamp: string | number;
      };
      callback({
        banker: String(parsed.banker),
        amount: Number(parsed.amount),
        new_balance: Number(parsed.new_balance),
        timestamp: Number(parsed.timestamp),
      });
    },
  });

  return unsubscribe;
}

// Subscribe to withdrawal events
export async function subscribeToWithdrawEvents(
  callback: (event: { banker: string; amount: number; new_balance: number; timestamp: number }) => void
): Promise<() => void> {
  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::WithdrawEvent`,
    },
    onMessage: (event) => {
      const parsed = event.parsedJson as {
        banker: string;
        amount: string | number;
        new_balance: string | number;
        timestamp: string | number;
      };
      callback({
        banker: String(parsed.banker),
        amount: Number(parsed.amount),
        new_balance: Number(parsed.new_balance),
        timestamp: Number(parsed.timestamp),
      });
    },
  });

  return unsubscribe;
}

// ============================================
// Legacy Event Subscriptions (保留以兼容旧代码)
// ============================================

// Subscribe to game events (旧版本)
// 注意：旧版本的事件可能不存在，保留接口以兼容
export async function subscribeToGameEvents(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _callback: (event: unknown) => void
): Promise<() => void> {
  // 返回空取消函数
  return () => { };
}


// Get available balance
export async function getAvailableBalance(): Promise<string> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::sbbbs::get_available_balance`,
    arguments: [tx.object(CONTRACT_OBJECT_ID)],
  });

  const result = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  const returnValues = result.results?.[0]?.returnValues;
  if (!returnValues) {
    throw new Error('Failed to get available balance');
  }

  // Parse u64 value (8 bytes, little endian)
  const balanceBytes = returnValues[0][0] as number[];
  const parseU64 = (bytes: number[]) => {
    let value = 0;
    for (let i = 0; i < 8; i++) {
      value += bytes[i] * Math.pow(256, i);
    }
    return value;
  };

  const availableBalance = parseU64(balanceBytes);
  return availableBalance.toString();
}

// ============================================
// Time Contract Functions
// ============================================

// Get current timestamp from Sui Clock object (0x6)
// This directly reads from the shared Clock object on-chain
export async function getChainTimestamp(): Promise<number> {
  try {
    const clockObject = await suiClient.getObject({
      id: '0x6',
      options: { showContent: true },
    });

    if (!clockObject.data?.content || !('fields' in clockObject.data.content)) {
      throw new Error('Failed to get Clock object');
    }

    const fields = clockObject.data.content.fields as { timestamp_ms: string };
    const timestampMs = Number(fields.timestamp_ms);

    console.log('Chain timestamp:', timestampMs, new Date(timestampMs).toISOString());
    return timestampMs;
  } catch (error) {
    console.error('Error fetching chain timestamp:', error);
    throw error;
  }
}

// Get contract deployment timestamp
export async function getContractDeployTime(): Promise<number | null> {
  try {
    const contract = await suiClient.getObject({
      id: CONTRACT_OBJECT_ID,
      options: { showPreviousTransaction: true },
    });

    if (contract.data?.previousTransaction) {
      const tx = await suiClient.getTransactionBlock({
        digest: contract.data.previousTransaction,
        options: { showEffects: true },
      });

      // Try to get timestamp from event timestamp
      if (tx.effects && 'timestamp' in tx.effects && tx.effects.timestamp) {
        return Number(tx.effects.timestamp);
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching contract deploy time:', error);
    return null;
  }
}

// 已移除时间合约相关方法（不再依赖外部时间合约）

// ============================================
// Helpers for read-only devInspect and events
// ============================================

function parseU64LE(bytes: number[] | Uint8Array): number {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let value = 0;
  for (let i = 0; i < Math.min(arr.length, 8); i++) {
    value += arr[i] * Math.pow(256, i);
  }
  return value;
}

function decodeReturnU64(ret: [number[], string]): number {
  const [bytes] = ret;
  return parseU64LE(bytes);
}

async function devInspectU64(
  target: string,
  buildArgs: (tx: Transaction) => (import('@mysten/sui/transactions').TransactionArgument | ReturnType<Transaction['pure']>)[],
  senderAddr?: string,
): Promise<number> {
  const tx = new Transaction();
  const sender = senderAddr ?? envConfig.bankerAddress;
  const args = buildArgs(tx);
  tx.moveCall({ target, arguments: args });
  const res = await suiClient.devInspectTransactionBlock({
    transactionBlock: tx,
    sender,
  });
  const ret = res.results?.[0]?.returnValues?.[0] as [number[], string] | undefined;
  if (!ret) throw new Error(`No return value for ${target}`);
  return decodeReturnU64(ret);
}

// 获取某地址拥有的 NFT ID 列表（不含是否上架标志；前端可与市场列表比对过滤）
export async function getOwnerNFTIds(owner: string): Promise<number[]> {
  const count = await devInspectU64(
    `${CONTRACT_PACKAGE_ID}::suu::get_owner_nft_count`,
    (tx) => [tx.object(CONTRACT_OBJECT_ID), tx.pure.address(owner)],
    owner,
  );
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = await devInspectU64(
      `${CONTRACT_PACKAGE_ID}::suu::get_owner_nft_id_at`,
      (tx) => [tx.object(CONTRACT_OBJECT_ID), tx.pure.address(owner), tx.pure.u64(i)],
      owner,
    );
    ids.push(id);
  }
  return ids;
}

// 获取当前市场上架的所有 NFT ID 列表
export async function getMarketListedIds(): Promise<number[]> {
  const count = await devInspectU64(
    `${CONTRACT_PACKAGE_ID}::suu::get_market_list_len`,
    (tx) => [tx.object(CONTRACT_OBJECT_ID)],
    envConfig.bankerAddress,
  );
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = await devInspectU64(
      `${CONTRACT_PACKAGE_ID}::suu::get_market_list_id_at`,
      (tx) => [tx.object(CONTRACT_OBJECT_ID), tx.pure.u64(i)],
      envConfig.bankerAddress,
    );
    ids.push(id);
  }
  return ids;
}

// 分页获取市场上架NFT的ID，按“最新在上面”返回
// page 从 0 开始，limit 默认为 20
export async function getMarketListedIdsPaged(limit = 20, page = 0): Promise<number[]> {
  const count = await devInspectU64(
    `${CONTRACT_PACKAGE_ID}::suu::get_market_list_len`,
    (tx) => [tx.object(CONTRACT_OBJECT_ID)],
    envConfig.bankerAddress,
  );
  if (count === 0) return [];

  const safeLimit = Math.max(1, Math.min(limit, 200)); // 简单防护，避免一次性取太多
  const startExclusive = Math.max(0, count - page * safeLimit);
  const startIndex = Math.max(0, startExclusive - safeLimit);
  const endIndex = Math.max(0, startExclusive);

  const ids: number[] = [];
  // 从最新（高索引）到较旧（低索引）
  for (let i = endIndex - 1; i >= startIndex; i--) {
    const id = await devInspectU64(
      `${CONTRACT_PACKAGE_ID}::suu::get_market_list_id_at`,
      (tx) => [tx.object(CONTRACT_OBJECT_ID), tx.pure.u64(i)],
      envConfig.bankerAddress,
    );
    ids.push(id);
  }
  return ids;
}

// 获取用户当前使用的 NFT ID（返回 0 表示未设置）
export async function getActiveNFT(owner: string): Promise<number> {
  return devInspectU64(
    `${CONTRACT_PACKAGE_ID}::suu::get_active_nft`,
    (tx) => [tx.object(CONTRACT_OBJECT_ID), tx.pure.address(owner)],
    owner,
  );
}

// 设置当前使用的 NFT
// 注意：这个函数应该在组件中直接使用 signAndExecuteTransaction 调用
// 示例：
// const tx = new Transaction();
// tx.moveCall({
//   target: `${CONTRACT_PACKAGE_ID}::suu::set_active_nft`,
//   arguments: [tx.object(CONTRACT_OBJECT_ID), tx.pure.u64(nftId)],
// });
// signAndExecute({ transaction: tx }, { onSuccess, onError });
export function setActiveNFT(): void {
  throw new Error('请使用 signAndExecuteTransaction 调用 set_active_nft');
}

// 市场：上架 NFT（price 为 MIST）
export function createListNftTransaction(nftId: number, priceMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::list_nft`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.pure.u64(priceMist),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 市场：下架 NFT
export function createCancelListingTransaction(nftId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::cancel_listing`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 市场：购买已上架 NFT（按指定价格，price 为 MIST）
export function createBuyListedNftTransaction(nftId: number, priceMist: number): Transaction {
  const tx = new Transaction();
  // 设置合理的 gas budget，避免预留过多
  tx.setGasBudget(50_000_000); // 0.05 SUI 应该足够
  // tx.gas 会自动合并账户中的所有 SUI coin 对象，确保有足够余额
  const [coin] = tx.splitCoins(tx.gas, [priceMist]);
  tx.moveCall({
    target: `${CONTRACT_PACKAGE_ID}::suu::buy_listed_nft`,
    arguments: [
      tx.object(CONTRACT_OBJECT_ID),
      tx.pure.u64(nftId),
      coin,
      tx.object('0x6'),
    ],
  });
  return tx;
}

// 购买成交事件（ListingPurchasedEvent）
export interface ListingPurchasedEvt {
  nftId: number;
  seller: string;
  buyer: string;
  price: number;
  fee: number;
  sellerAmount: number;
  timestamp: number;
}

export async function queryPurchasedEvents(limit = 200): Promise<ListingPurchasedEvt[]> {
  const events = await suiClient.queryEvents({
    query: { MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::ListingPurchasedEvent` },
    limit,
    order: 'descending',
  });
  return (events.data ?? []).map((e) => {
    const p = e.parsedJson as Record<string, unknown>;
    return {
      nftId: Number(p.nft_id as string),
      seller: String(p.seller as string),
      buyer: String(p.buyer as string),
      price: Number(p.price as string),
      fee: Number(p.fee as string),
      sellerAmount: Number(p.seller_amount as string),
      timestamp: Number(p.timestamp as string),
    } as ListingPurchasedEvt;
  });
}

// 上架/下架事件（用于“挂单历史”）
export interface ListingCreatedEvt { nftId: number; seller: string; price: number; timestamp: number; }
export interface ListingCancelledEvt { nftId: number; seller: string; timestamp: number; }

export async function queryListingCreatedEvents(limit = 200): Promise<ListingCreatedEvt[]> {
  const events = await suiClient.queryEvents({
    query: { MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::ListingCreatedEvent` },
    limit,
    order: 'descending',
  });
  return (events.data ?? []).map((e) => {
    const p = e.parsedJson as Record<string, unknown>;
    return {
      nftId: Number(p.nft_id as string),
      seller: String(p.seller as string),
      price: Number(p.price as string),
      timestamp: Number(p.timestamp as string),
    };
  });
}

// 获取某个 NFT 的上架信息（seller, price, listed_at）
export async function getListingInfo(nftId: number): Promise<{ seller: string; price: number; listedAt: number } | null> {
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONTRACT_PACKAGE_ID}::suu::get_listing_info`,
      arguments: [
        tx.object(CONTRACT_OBJECT_ID),
        tx.pure.u64(nftId),
      ],
    });
    const res = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: envConfig.bankerAddress,
    });
    const ret = res.results?.[0]?.returnValues;
    if (!ret || ret.length < 3) return null;
    const sellerBytes = ret[0][0] as number[];
    const priceBytes = ret[1][0] as number[];
    const listedAtBytes = ret[2][0] as number[];
    const seller = '0x' + sellerBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    const price = parseU64LE(priceBytes);
    const listedAt = parseU64LE(listedAtBytes);
    return { seller, price, listedAt };
  } catch {
    return null;
  }
}

export async function queryListingCancelledEvents(limit = 200): Promise<ListingCancelledEvt[]> {
  const events = await suiClient.queryEvents({
    query: { MoveEventType: `${CONTRACT_PACKAGE_ID}::suu::ListingCancelledEvent` },
    limit,
    order: 'descending',
  });
  return (events.data ?? []).map((e) => {
    const p = e.parsedJson as Record<string, unknown>;
    return {
      nftId: Number(p.nft_id as string),
      seller: String(p.seller as string),
      timestamp: Number(p.timestamp as string),
    };
  });
}
