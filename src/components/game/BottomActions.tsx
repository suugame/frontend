import { useState, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import {
  getOwnerNFTIds,
  getMarketListedIds,
  getMarketListedIdsPaged,
  queryPurchasedEvents,
  queryListingCreatedEvents,
  queryListingCancelledEvents,
  getFullNFTInfo,
  getActiveNFT,
  getUserPendingBattleCommitments,
  getUserPendingCaptureCommitments,
  ListingPurchasedEvt,
  ListingCreatedEvt,
  ListingCancelledEvt,
  type HealthNFT,
  createSetActiveNftTransaction,
  createListNftTransaction,
  createCancelListingTransaction,
  createBuyListedNftTransaction,
  getListingInfo,
  suiClient,
  getUserBalance,
  createCancelBattleCommitmentTransaction,
  createCancelCaptureCommitmentTransaction,
} from '@/sui';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { AvatarDisplay, BuyNftButton, Message } from '@/components';
import { useI18n } from '@/i18n/useI18n';
import { getElementKey, getMonsterTypeName } from '@/utils/gameHelpers';
import type { MessageType } from '@/components/Message';

interface BottomActionsProps {
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  showMarket: boolean;
  setShowMarket: (show: boolean) => void;
}

export default function BottomActions({
  showLibrary,
  setShowLibrary,
  showMarket,
  setShowMarket,
}: BottomActionsProps) {

  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      }),
  });
  const { t } = useI18n();

  const [availableNFTs, setAvailableNFTs] = useState<HealthNFT[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingLib, setLoadingLib] = useState(false);
  const [settingActive, setSettingActive] = useState(false);

  const [purchased, setPurchased] = useState<ListingPurchasedEvt[]>([]);
  const [created, setCreated] = useState<ListingCreatedEvt[]>([]);
  const [cancelled, setCancelled] = useState<ListingCancelledEvt[]>([]);
  const [loadingMkt, setLoadingMkt] = useState(false);

  // 市场-我的NFT可上架列表与我已上架的NFT
  const [myListableNFTs, setMyListableNFTs] = useState<HealthNFT[]>([]);
  const [loadingMyListables, setLoadingMyListables] = useState(false);
  const [listingPriceInputs, setListingPriceInputs] = useState<Record<number, string>>({});
  const [listingLoading, setListingLoading] = useState<Record<number, boolean>>({});
  const [delistingLoading, setDelistingLoading] = useState<Record<number, boolean>>({});
  const [marketListings, setMarketListings] = useState<Array<{ nftId: number; seller: string; price: number; listedAt: number; nft?: HealthNFT }>>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [buyingListed, setBuyingListed] = useState<Record<number, boolean>>({});
  // 市场筛选/排序
  const [priceOrder, setPriceOrder] = useState<'desc' | 'asc'>('asc');
  const [elementFilter, setElementFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');

  const visibleListings = useMemo(() => {
    let arr = marketListings.filter((l) => !!l.nft);
    if (elementFilter !== 'all') {
      arr = arr.filter((l) => (l.nft!.element === elementFilter));
    }
    if (typeFilter !== 'all') {
      arr = arr.filter((l) => (l.nft!.monsterType === typeFilter));
    }
    arr = arr.slice().sort((a, b) => {
      const pa = a.price ?? 0;
      const pb = b.price ?? 0;
      if (pa === pb) {
        // 次级排序：最新优先
        return (b.listedAt ?? 0) - (a.listedAt ?? 0);
      }
      return priceOrder === 'desc' ? pb - pa : pa - pb;
    });
    return arr;
  }, [marketListings, priceOrder, elementFilter, typeFilter]);
  // 市场分页加载控制
  const PAGE_SIZE = 20;
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  // 更细粒度的刷新标记，避免不必要的全局刷新
  const [marketListingsReloadTick, setMarketListingsReloadTick] = useState(0);
  const [myListablesReloadTick, setMyListablesReloadTick] = useState(0);
  const [marketEventsReloadTick, setMarketEventsReloadTick] = useState(0);
  const [balanceReloadTick, setBalanceReloadTick] = useState(0);
  // 挂单历史的 NFT 信息映射
  const [listingHistoryNfts, setListingHistoryNfts] = useState<Record<number, HealthNFT>>({});

  // 用户余额（MIST）
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // 战斗中NFT集合（nftId -> true）
  const [battlingNFTs, setBattlingNFTs] = useState<Set<number>>(new Set());
  // 抓捕中NFT集合（nftId -> true，基于链上未揭示的承诺）
  const [capturingNFTs, setCapturingNFTs] = useState<Set<number>>(new Set());

  // Message 通知状态
  const [messageConfig, setMessageConfig] = useState<{
    type: MessageType;
    title?: string;
    message: string;
    autoClose?: boolean;
  } | null>(null);

  // 显示 Message 的辅助函数
  const showMessage = (
    type: MessageType,
    message: string,
    title?: string,
    autoClose = true
  ) => {
    setMessageConfig({
      type,
      title,
      message,
      autoClose,
    });
  };

  // 名字长按查看全文：状态与事件处理
  const [fullNameView, setFullNameView] = useState<{ text: string } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const startLongPress = (text: string, e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    // 500ms 以上判定为长按
    longPressTimerRef.current = window.setTimeout(() => {
      setFullNameView({ text });
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setFullNameView(null);
  };

  // 使用钱包连接地址

  // refresh library data
  useEffect(() => {
    console.log(showLibrary, 'showLibrary')
    if (!showLibrary) return;
    let mounted = true;
    (async () => {
      const effectiveAddress = account?.address || '';
      if (!effectiveAddress) {
        setAvailableNFTs([]);
        setSelectedId(null);
        return;
      }
      setLoadingLib(true);
      console.log('loading library data')
      try {
        let ids: number[] = [];
        let mkt: number[] = [];
        let activeId = 0;
        try {
          [ids, mkt, activeId] = await Promise.all([
            getOwnerNFTIds(effectiveAddress),
            getMarketListedIds(),
            getActiveNFT(effectiveAddress),
          ]);
        } catch (error) {
          console.log('error loading library data')
          console.log(error, 'error')
          // ignore errors; keep lists empty
        }
        if (!mounted) return;
        const mktSet = new Set(mkt);
        const avail = ids.filter((id) => !mktSet.has(id));

        // 加载每个 NFT 的完整信息
        const nftInfoPromises = avail.map(id => getFullNFTInfo(id));
        const nftInfos = await Promise.all(nftInfoPromises);
        const validNFTs = nftInfos.filter((nft): nft is HealthNFT => nft !== null);
        if (!mounted) return;
        setAvailableNFTs(validNFTs);

        // 设置当前使用的 NFT ID
        if (activeId > 0) {
          setSelectedId(activeId);
        } else if (validNFTs.length > 0) {
          // 如果没有设置，默认选择第一个
          setSelectedId(validNFTs[0].nftId);
        }
      } finally {
        setLoadingLib(false);
      }
    })();
    return () => { mounted = false; };
  }, [showLibrary, account?.address]);

  // refresh market data
  useEffect(() => {
    if (!showMarket) return;
    let mounted = true;
    (async () => {
      setLoadingMkt(true);
      try {
        const [p, c, x] = await Promise.all([
          queryPurchasedEvents(400).catch(() => []),
          queryListingCreatedEvents(400).catch(() => []),
          queryListingCancelledEvents(400).catch(() => []),
        ]);
        if (!mounted) return;
        setPurchased(p);
        setCreated(c);
        setCancelled(x);
      } finally {
        setLoadingMkt(false);
      }
    })();
    return () => { mounted = false; };
  }, [showMarket, marketEventsReloadTick]);

  // refresh 战斗中NFT状态（始终加载，不受面板开关影响）
  useEffect(() => {
    if (!account?.address) {
      setBattlingNFTs(new Set());
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const commitments = await getUserPendingBattleCommitments(account.address);
        if (!mounted) return;
        const battlingSet = new Set(commitments.map(c => c.nftId));
        setBattlingNFTs(battlingSet);
      } catch (error) {
        console.error('Error loading battle commitments:', error);
        if (mounted) setBattlingNFTs(new Set());
      }
    })();
    return () => { mounted = false; };
  }, [account?.address, marketEventsReloadTick]);

  // refresh 抓捕中NFT状态（始终加载，不受面板开关影响）
  useEffect(() => {
    if (!account?.address) {
      setCapturingNFTs(new Set());
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const commitments = await getUserPendingCaptureCommitments(account.address);
        if (!mounted) return;
        const capturingSet = new Set(commitments.map(c => c.nftId));
        setCapturingNFTs(capturingSet);
      } catch (error) {
        console.error('Error loading capture commitments:', error);
        if (mounted) setCapturingNFTs(new Set());
      }
    })();
    return () => { mounted = false; };
  }, [account?.address, marketEventsReloadTick]);

  // refresh 我的可上架NFT（拥有但未在市场上）
  useEffect(() => {
    if (!showMarket) return;
    let mounted = true;
    (async () => {
      setLoadingMyListables(true);
      try {
        const owner = account?.address || '';
        if (!owner) {
          if (mounted) setMyListableNFTs([]);
          return;
        }
        let ids: number[] = [];
        let mkt: number[] = [];
        try {
          [ids, mkt] = await Promise.all([
            getOwnerNFTIds(owner),
            getMarketListedIds(),
          ]);
        } catch { }
        if (!mounted) return;
        const mktSet = new Set(mkt);
        const listableIds = ids.filter((id) => !mktSet.has(id));
        const infos = await Promise.all(listableIds.map((id) => getFullNFTInfo(id)));
        const listables = infos.filter((nft): nft is HealthNFT => nft !== null);
        if (!mounted) return;
        setMyListableNFTs(listables);
      } finally {
        setLoadingMyListables(false);
      }
    })();
    return () => { mounted = false; };
  }, [showMarket, account?.address, myListablesReloadTick]);

  // 分页加载：载入更多在售列表
  const loadMoreListings = async (initial: boolean = false) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = initial ? 0 : nextOffset;
      const ids = await getMarketListedIdsPaged(PAGE_SIZE, offset);
      const infos = await Promise.all(ids.map(async (id) => {
        const info = await getListingInfo(id);
        if (!info) return null;
        const nft = await getFullNFTInfo(id).catch(() => null);
        return { nftId: id, seller: info.seller, price: info.price, listedAt: info.listedAt, nft: nft || undefined };
      }));

      const validInfos = infos.filter((x): x is NonNullable<typeof x> => x !== null);

      setMarketListings((prev) => {
        const seen = new Set(prev.map((p) => p.nftId));
        const merged = [...prev, ...validInfos.filter((x) => !seen.has(x.nftId))];
        merged.sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
        return merged;
      });

      setNextOffset(offset + ids.length);
      setHasMore(ids.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  // 初始刷新或外部触发刷新：重置并加载第一页
  useEffect(() => {
    if (!showMarket) return;
    let mounted = true;
    (async () => {
      setLoadingListings(true);
      try {
        if (!mounted) return;
        // 重置分页状态
        setMarketListings([]);
        setNextOffset(0);
        setHasMore(true);
        await loadMoreListings(true);
      } finally {
        setLoadingListings(false);
      }
    })();
    return () => { mounted = false; };
  }, [showMarket, marketListingsReloadTick]);

  // 触底自动加载更多（IntersectionObserver）
  useEffect(() => {
    if (!showMarket) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMore && !loadingMore) {
        loadMoreListings(false);
      }
    }, { root: null, rootMargin: '0px', threshold: 1.0 });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [showMarket, hasMore, loadingMore]);

  // 查询用户余额
  useEffect(() => {
    if (!showMarket && !showLibrary) return;
    const addr = account?.address;
    if (!addr) {
      setUserBalance(0);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingBalance(true);
      try {
        const balance = await getUserBalance(addr);
        if (!mounted) return;
        setUserBalance(balance);
      } finally {
        setLoadingBalance(false);
      }
    })();
    return () => { mounted = false; };
  }, [showMarket, showLibrary, account?.address, balanceReloadTick]);

  // 加载挂单历史的 NFT 信息
  useEffect(() => {
    if (!showMarket) return;
    let mounted = true;
    (async () => {
      try {
        // 获取所有唯一的 NFT ID
        const uniqueIds = Array.from(new Set(created.map(e => e.nftId)));
        // 加载每个 NFT 的信息
        const nftPromises = uniqueIds.map(async (id) => {
          try {
            const nft = await getFullNFTInfo(id);
            return nft ? [id, nft] as const : null;
          } catch {
            return null;
          }
        });
        const results = await Promise.all(nftPromises);
        if (!mounted) return;
        const nftMap: Record<number, HealthNFT> = {};
        results.forEach((result) => {
          if (result) {
            const [id, nft] = result;
            nftMap[id] = nft;
          }
        });
        setListingHistoryNfts(nftMap);
      } catch (error) {
        console.error(t('game.market.fetchListingHistoryFailPrefix'), error);
      }
    })();
    return () => { mounted = false; };
  }, [showMarket, created, marketEventsReloadTick]);

  const myPurchased = useMemo(() => {
    const addr = (account?.address || '').toLowerCase();
    return purchased.filter((e) => e.seller?.toLowerCase() === addr || e.buyer?.toLowerCase() === addr);
  }, [purchased, account?.address]);

  const myCreated = useMemo(() => {
    const addr = (account?.address || '').toLowerCase();
    return created.filter((e) => e.seller?.toLowerCase() === addr);
  }, [created, account?.address]);

  const myCancelled = useMemo(() => {
    const addr = (account?.address || '').toLowerCase();
    return cancelled.filter((e) => e.seller?.toLowerCase() === addr);
  }, [cancelled, account?.address]);

  const cancelledMap = useMemo(() => {
    const map = new Map<string, number>();
    cancelled.forEach((e) => map.set(`${e.nftId}_${e.seller}`.toLowerCase(), e.timestamp));
    return map;
  }, [cancelled]);

  const soldMap = useMemo(() => {
    const map = new Map<number, number>();
    purchased.forEach((e) => map.set(e.nftId, e.timestamp));
    return map;
  }, [purchased]);

  const myListingWithStatus = useMemo(() => {
    if (!myCreated) return [];

    // Find the latest event for each type for each NFT
    const latestEvents = new Map<number, { type: 'purchased' | 'cancelled', timestamp: number }>();

    for (const p of (myPurchased || [])) {
      const existing = latestEvents.get(p.nftId);
      if (!existing || existing.timestamp < p.timestamp) {
        latestEvents.set(p.nftId, { type: 'purchased', timestamp: p.timestamp });
      }
    }
    for (const c of (myCancelled || [])) {
      const existing = latestEvents.get(c.nftId);
      if (!existing || existing.timestamp < c.timestamp) {
        latestEvents.set(c.nftId, { type: 'cancelled', timestamp: c.timestamp });
      }
    }

    // Deduplicate listings, keeping only the most recent one for each nftId
    const uniqueListings = new Map<number, ListingCreatedEvt>();
    for (const listing of myCreated) {
      if (!uniqueListings.has(listing.nftId) || uniqueListings.get(listing.nftId)!.timestamp < listing.timestamp) {
        uniqueListings.set(listing.nftId, listing);
      }
    }

    return Array.from(uniqueListings.values()).map(listing => {
      const latestEvent = latestEvents.get(listing.nftId);

      if (latestEvent && latestEvent.timestamp > listing.timestamp) {
        if (latestEvent.type === 'purchased') {
          return { ...listing, status: 'sold' };
        }
        if (latestEvent.type === 'cancelled') {
          return { ...listing, status: 'cancelled' };
        }
      }

      return { ...listing, status: 'ongoing' };
    });
  }, [myCreated, myPurchased, myCancelled]);

  const myOngoingListingIds = useMemo(() => {
    const ids = new Set<number>();
    myListingWithStatus.forEach(listing => {
      if (listing.status === 'ongoing') {
        ids.add(listing.nftId);
      }
    });
    return ids;
  }, [myListingWithStatus]);

  // 打开市场面板时，触发一次轻量刷新以确保最新数据
  useEffect(() => {
    if (showMarket) {
      refreshMarketPanels('all');
    }
  }, [showMarket]);

  // 所有挂单历史（包括所有人的）
  const allListingWithStatus = useMemo(() => {
    return created.map((e) => {
      const key = `${e.nftId}_${e.seller}`.toLowerCase();
      const wasCancelled = cancelledMap.has(key) && cancelledMap.get(key)! >= e.timestamp;
      const wasSold = soldMap.has(e.nftId) && soldMap.get(e.nftId)! >= e.timestamp;
      const status = wasCancelled ? 'cancelled' : wasSold ? 'sold' : 'ongoing';
      return { ...e, status };
    });
  }, [created, cancelledMap, soldMap]);

  // 购买NFT成功后的回调
  const handleBuySuccess = async () => {
    // 刷新NFT列表
    setTimeout(async () => {
      if (account?.address) {
        try {
          const ids = await getOwnerNFTIds(account.address);
          const nftInfoPromises = ids.map(id => getFullNFTInfo(id));
          const nftInfos = await Promise.all(nftInfoPromises);
          const validNFTs = nftInfos.filter((nft): nft is HealthNFT => nft !== null);
          setAvailableNFTs(validNFTs);

          // 触发自定义事件，通知主页面刷新
          window.dispatchEvent(new CustomEvent('nft:purchased'));

          // 刷新余额（避免全局刷新）
          setBalanceReloadTick((x) => x + 1);
        } catch (error) {
          console.error(t('game.market.refreshNftListFailPrefix'), error);
        }
      }
    }, 3000);
  };

  function setPriceInput(nftId: number, v: string) {
    setListingPriceInputs((prev) => ({ ...prev, [nftId]: v }));
  }

  function suiToMistInput(v: string): number | null {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 1e9);
  }

  function refreshMarketPanels(target?: 'all' | 'listings' | 'myListables' | 'events' | 'balance') {
    // 轻量刷新：按目标触发相应的 effect 重新拉取
    switch (target) {
      case 'listings':
        setMarketListingsReloadTick((x) => x + 1);
        break;
      case 'myListables':
        setMyListablesReloadTick((x) => x + 1);
        break;
      case 'events':
        setMarketEventsReloadTick((x) => x + 1);
        break;
      case 'balance':
        setBalanceReloadTick((x) => x + 1);
        break;
      default:
        setMarketListingsReloadTick((x) => x + 1);
        setMyListablesReloadTick((x) => x + 1);
        setMarketEventsReloadTick((x) => x + 1);
        setBalanceReloadTick((x) => x + 1);
        break;
    }
  }

  function onBuyListed(nftId: number, priceMist: number, seller: string) {
    if (!account) { showMessage('warning', t('common.connectWallet')); return; }
    const me = (account.address || '').toLowerCase();
    if (seller.toLowerCase() === me) { showMessage('warning', t('game.market.cannotBuyOwn')); return; }
    if (buyingListed[nftId]) return;

    // 显示价格信息以便调试
    const priceSUI = (priceMist / 1_000_000_000).toFixed(4);
    const gasBudget = 50_000_000; // 0.05 SUI (MIST)
    const totalNeeded = priceMist + gasBudget;

    // 检查余额
    if (userBalance < totalNeeded) {
      const balanceSUI = (userBalance / 1e9).toFixed(4);
      const neededSUI = (totalNeeded / 1e9).toFixed(2);
      showMessage('warning', `${t('game.buyNft.insufficient')}\n\n${t('game.buyNft.currentBalance')}: ${balanceSUI} SUI\n${t('game.buyNft.need')}: ${neededSUI} SUI (NFT: ${priceSUI} SUI + Gas: 0.05 SUI)\n\n${t('game.buyNft.topUp')}`);
      return;
    }

    console.log(`准备购买 NFT #${nftId}:`);
    console.log(`  - 价格: ${priceSUI} SUI`);
    console.log(`  - Gas预算: 0.05 SUI`);
    console.log(`  - 总共需要: ${(totalNeeded / 1e9).toFixed(4)} SUI`);
    console.log(`  - 当前余额: ${(userBalance / 1e9).toFixed(4)} SUI`);

    setBuyingListed((m) => ({ ...m, [nftId]: true }));
    const tx = createBuyListedNftTransaction(nftId, priceMist);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res: { digest?: string } | unknown) => {
          try {
            // 确认上链成功
            const digest = (typeof res === 'object' && res && 'digest' in (res as Record<string, unknown>)) ? String((res as { digest?: string }).digest || '') : '';
            console.log('购买成功回调, digest:', digest);

            if (digest) {
              try {
                // 等待交易确认
                console.log('等待交易确认...');
                await suiClient.waitForTransaction({ digest });
                console.log('交易已确认，查询详情...');

                const detail = await suiClient.getTransactionBlock({ digest, options: { showEffects: true } });
                console.log('交易详情:', detail);
                console.log('交易状态:', detail?.effects?.status);

                const status = detail?.effects?.status?.status;
                console.log('状态值:', status);

                // Sui 返回的状态可能是 'success' 或者其他格式
                const isSuccess = status === 'success' ||
                  (detail && detail.effects && typeof detail.effects.status === 'object' &&
                    'status' in detail.effects.status && detail.effects.status.status === 'success');

                if (isSuccess) {
                  showMessage('success', t('game.buyNft.success'));
                } else {
                  // 检查具体失败原因
                  const statusObj = detail?.effects?.status as { status?: string; error?: string } | undefined;
                  const errorMsg = statusObj && typeof statusObj === 'object' && 'error' in statusObj ? statusObj.error : '';

                  if (errorMsg && errorMsg.includes('InsufficientCoinBalance')) {
                    showMessage('error', t('game.market.buyInsufficient'));
                  } else if (errorMsg) {
                    showMessage('error', `${t('game.buyNft.failPrefix')} ${errorMsg}`);
                  } else {
                    showMessage('warning', t('game.market.txPending'));
                  }
                }
              } catch (error) {
                console.error('确认交易失败:', error);
                showMessage('warning', t('game.market.txTimeout'));
              }
            } else {
              showMessage('info', t('game.market.txSubmitted'));
            }
          } finally {
            setBuyingListed((m) => ({ ...m, [nftId]: false }));
            // 仅刷新在售列表与余额，避免全局刷新
            refreshMarketPanels('listings');
            refreshMarketPanels('balance');
            // 通知主页面刷新相关数据
            window.dispatchEvent(new CustomEvent('nft:purchased'));
          }
        },
        onError: (err) => {
          console.error('购买失败详情:', err);
          let errorMsg = t('game.buyNft.failPrefix') + ' ';
          if (err && typeof err === 'object' && 'message' in err) {
            const msg = String(err.message || '');
            if (msg.includes('InsufficientCoinBalance')) {
              const balanceSUI = (userBalance / 1e9).toFixed(4);
              const neededSUI = (totalNeeded / 1e9).toFixed(2);
              errorMsg += `${t('game.buyNft.insufficient')}\n\n${t('game.buyNft.currentBalance')}: ${balanceSUI} SUI\n${t('game.buyNft.need')}: ${neededSUI} SUI (NFT: ${priceSUI} SUI + Gas: 0.05 SUI)\n\n${t('game.buyNft.topUp')}`;
            } else {
              errorMsg += msg || t('game.buyNft.unknown');
            }
          } else {
            errorMsg += t('game.buyNft.unknown');
          }
          showMessage('error', errorMsg);
          setBuyingListed((m) => ({ ...m, [nftId]: false }));
        },
      }
    );
  }

  // 判断某个NFT是否处于抓捕流程（基于链上承诺，避免本地存储误判）
  function isNftCapturing(nftId: number): boolean {
    return capturingNFTs.has(nftId);
  }

  async function onList(nftId: number) {
    // 立即进入“上架中”状态，提升点击反馈
    setListingLoading((m) => ({ ...m, [nftId]: true }));
    if (!account) { showMessage('warning', t('common.connectWallet')); setListingLoading((m) => ({ ...m, [nftId]: false })); return; }
    // 上架前仅以链上最新状态判断，避免事件集合误拦截
    const latestNft = await getFullNFTInfo(nftId).catch(() => null);
    const hasActiveCommitment = latestNft?.has_active_commitment === true;
    console.log('[List Check]', { nftId, hasActiveCommitment });
    if (hasActiveCommitment) {
      try {
        const [battleCommitments, captureCommitments] = await Promise.all([
          getUserPendingBattleCommitments((account.address || '')), // may return []
          getUserPendingCaptureCommitments((account.address || '')), // may return []
        ]);
        const pendingBattle = battleCommitments.filter((c) => c.nftId === nftId);
        const pendingCapture = captureCommitments.filter((c) => c.nftId === nftId);
        if (pendingBattle.length === 0 && pendingCapture.length === 0) {
          // 链上标记存在，但未查询到承诺对象，尝试继续上架（若失败再提示）
          console.warn('has_active_commitment=true，但未找到承诺对象，尝试继续上架');
        } else {
          const _str = t('game.market.confirmCancelCommitments')
          const confirmCancel = window.confirm(_str);
          if (!confirmCancel) {
            showMessage('warning', t('game.market.cannotListBattling'));
            setListingLoading((m) => ({ ...m, [nftId]: false }));
            return;
          }
          // 顺序取消抓捕与战斗承诺
          for (const cap of pendingCapture) {
            try {
              const txCancelCap = createCancelCaptureCommitmentTransaction(cap.id, nftId);
              await new Promise<void>((resolve, reject) => {
                signAndExecute(
                  { transaction: txCancelCap },
                  {
                    onSuccess: async (res: { digest?: string } | unknown) => {
                      const digest = (typeof res === 'object' && res && 'digest' in (res as Record<string, unknown>)) ? String((res as { digest?: string }).digest || '') : '';
                      if (digest) {
                        try { await suiClient.waitForTransaction({ digest }); } catch { }
                      }
                      showMessage('success', t('game.market.cancelCaptureSuccess'));
                      resolve();
                    },
                    onError: (err: unknown) => {
                      console.error('取消抓捕承诺失败:', err);
                      const msg = (err && typeof err === 'object' && 'message' in err) ? String((err as { message?: unknown }).message ?? '') : '';
                      showMessage('error', t('game.market.cancelCaptureFailPrefix') + ' ' + (msg || t('game.buyNft.unknown')));
                      reject(err as Error);
                    },
                  }
                );
              });
            } catch { }
          }
          for (const bat of pendingBattle) {
            try {
              const txCancelBat = createCancelBattleCommitmentTransaction(bat.id, nftId);
              await new Promise<void>((resolve, reject) => {
                signAndExecute(
                  { transaction: txCancelBat },
                  {
                    onSuccess: async (res: { digest?: string } | unknown) => {
                      const digest = (typeof res === 'object' && res && 'digest' in (res as Record<string, unknown>)) ? String((res as { digest?: string }).digest || '') : '';
                      if (digest) {
                        try { await suiClient.waitForTransaction({ digest }); } catch { }
                      }
                      showMessage('success', t('game.market.cancelBattleSuccess'));
                      resolve();
                    },
                    onError: (err: unknown) => {
                      console.error('取消战斗承诺失败:', err);
                      const msg = (err && typeof err === 'object' && 'message' in err) ? String((err as { message?: unknown }).message ?? '') : '';
                      showMessage('error', t('game.market.cancelBattleFailPrefix') + ' ' + (msg || t('game.buyNft.unknown')));
                      reject(err as Error);
                    },
                  }
                );
              });
            } catch { }
          }

          // 取消后刷新状态并再次检查
          setMarketEventsReloadTick((x) => x + 1);
          setMyListablesReloadTick((x) => x + 1);
          const recheck = await getFullNFTInfo(nftId).catch(() => null);
          const stillActive = recheck?.has_active_commitment === true;
          console.log('[List Recheck]', { nftId, stillActive });
          if (stillActive) {
            showMessage('warning', t('game.market.cannotListBattling'));
            setListingLoading((m) => ({ ...m, [nftId]: false }));
            return;
          }
        }
      } catch (err) {
        console.error('检查/取消承诺失败:', err);
        const msg = (err && typeof err === 'object' && 'message' in err) ? String((err as { message?: unknown }).message ?? '') : '';
        showMessage('error', t('game.market.cancelCheckFailPrefix') + ' ' + (msg || t('game.buyNft.unknown')));
        setListingLoading((m) => ({ ...m, [nftId]: false }));
        return;
      }
    }
    const input = listingPriceInputs[nftId];
    const mist = suiToMistInput(input);
    if (mist === null) { showMessage('warning', t('game.market.enterValidPrice')); setListingLoading((m) => ({ ...m, [nftId]: false })); return; }
    const tx = createListNftTransaction(nftId, mist);
    const effectiveAddress = account?.address || '';
    const _activeNft = await getActiveNFT(effectiveAddress);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res: { digest?: string } | unknown) => {
          try {
            const digest = (typeof res === 'object' && res && 'digest' in (res as Record<string, unknown>)) ? String((res as { digest?: string }).digest || '') : '';
            if (digest) {
              try {
                await suiClient.waitForTransaction({ digest });
                const detail = await suiClient.getTransactionBlock({ digest, options: { showEffects: true } });
                const status = detail?.effects?.status?.status;
                const isSuccess = status === 'success' || (
                  detail && detail.effects && typeof detail.effects.status === 'object' &&
                  'status' in detail.effects.status && (detail.effects.status as { status?: string }).status === 'success'
                );
                if (isSuccess) {
                  showMessage('success', t('game.market.listSuccess'));
                } else {
                  const statusObj = detail?.effects?.status as { status?: string; error?: string } | undefined;
                  const errorMsg = statusObj && typeof statusObj === 'object' && 'error' in statusObj ? statusObj.error : '';
                  if (errorMsg) {
                    showMessage('error', t('game.market.listFailPrefix') + ' ' + errorMsg);
                  } else {
                    showMessage('warning', t('game.market.txPending'));
                  }
                }
              } catch (error) {
                console.error('确认上架交易失败:', error);
                showMessage('warning', t('game.market.txTimeout'));
              }
            } else {
              // 没有 digest，说明仅提交成功，等待事件刷新
              showMessage('info', t('game.market.txSubmitted'));
            }
          } finally {
            setListingLoading((m) => ({ ...m, [nftId]: false }));
            // 清空该 NFT 的价格输入，避免残留
            setListingPriceInputs((prev) => {
              const next = { ...prev };
              delete next[nftId];
              return next;
            });
            // 当上架的是当前活跃的NFT，就设置为当前上架的NFT
            if (_activeNft === nftId) {
              window.dispatchEvent(new CustomEvent('nft:selected', { detail: { nftId } }));
            }
            // 成功上链后刷新在售列表、我的可上架与事件（用于“我的已上架”）
            refreshMarketPanels('listings');
            refreshMarketPanels('myListables');
            refreshMarketPanels('events');
          }
        },
        onError: (err: unknown) => {
          console.error(err);
          const msg = (err && typeof err === 'object' && 'message' in err) ? String((err as { message?: unknown }).message ?? '') : '';
          showMessage('error', t('game.market.listFailPrefix') + ' ' + (msg || t('game.buyNft.unknown')));
          setListingLoading((m) => ({ ...m, [nftId]: false }));
        },
      }
    );
  }

  async function onDelist(nftId: number) {
    if (!account) { showMessage('warning', t('common.connectWallet')); return; }
    setDelistingLoading((m) => ({ ...m, [nftId]: true }));
    const tx = createCancelListingTransaction(nftId);
    const effectiveAddress = account?.address || '';
    const _activeNft = await getActiveNFT(effectiveAddress);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (res: { digest?: string } | unknown) => {
          try {
            const digest = (typeof res === 'object' && res && 'digest' in (res as Record<string, unknown>)) ? String((res as { digest?: string }).digest || '') : '';
            if (digest) {
              try {
                await suiClient.waitForTransaction({ digest });
                const detail = await suiClient.getTransactionBlock({ digest, options: { showEffects: true } });
                const status = detail?.effects?.status?.status;
                const isSuccess = status === 'success' || (
                  detail && detail.effects && typeof detail.effects.status === 'object' &&
                  'status' in detail.effects.status && (detail.effects.status as { status?: string }).status === 'success'
                );
                if (isSuccess) {
                  showMessage('success', t('game.market.delistSuccess'));
                } else {
                  const statusObj = detail?.effects?.status as { status?: string; error?: string } | undefined;
                  const errorMsg = statusObj && typeof statusObj === 'object' && 'error' in statusObj ? statusObj.error : '';
                  if (errorMsg) {
                    showMessage('error', t('game.market.delistFailPrefix') + ' ' + errorMsg);
                  } else {
                    showMessage('warning', t('game.market.txPending'));
                  }
                }
              } catch (error) {
                console.error('确认下架交易失败:', error);
                showMessage('warning', t('game.market.txTimeout'));
              }
            } else {
              showMessage('info', t('game.market.txSubmitted'));
            }
          } finally {
            // 假如当前没有活跃的NFT，就设置为当前下架的NFT
            if (!_activeNft) {
              window.dispatchEvent(new CustomEvent('nft:selected', { detail: { nftId } }));
            }
            setDelistingLoading((m) => ({ ...m, [nftId]: false }));
            // 成功下架后刷新在售列表、我的可上架与事件（用于“我的已上架”）
            refreshMarketPanels('listings');
            refreshMarketPanels('myListables');
            refreshMarketPanels('events');
          }
        },
        onError: (err) => {
          console.error(err);
          showMessage('error', t('game.market.delistFailPrefix') + ' ' + (err.message || t('game.buyNft.unknown')));
          setDelistingLoading((m) => ({ ...m, [nftId]: false }));
        },
      }
    );
  }

  async function selectNFT(id: number) {
    if (!account) {
      showMessage('warning', t('common.connectWallet'));
      return;
    }

    setSettingActive(true);
    try {
      const tx = createSetActiveNftTransaction(id);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            console.log('设置当前使用的NFT成功:', id);
            setSelectedId(id);
            // 触发自定义事件，通知主页面刷新
            window.dispatchEvent(new CustomEvent('nft:selected', { detail: { nftId: id } }));
            setSettingActive(false);
          },
          onError: (error) => {
            console.error('设置当前使用的NFT失败:', error);
            showMessage('error', t('game.market.setActiveFailPrefix') + ' ' + (error.message || t('game.buyNft.unknown')));
            setSettingActive(false);
          },
        }
      );
    } catch (error) {
      console.error('创建交易失败:', error);
      setSettingActive(false);
    }
  }

  // 悬浮按钮菜单状态
  const [showFabMenu, setShowFabMenu] = useState(false);

  return (
    <>
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

      {/* 悬浮按钮组 */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
        {/* 子菜单按钮 - 从下往上展开 */}
        {showFabMenu && (
          <>
            <button
              className="btn btn-circle btn-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl border-0 transform transition-all hover:scale-110"
              onClick={() => {
                setShowLibrary(true);
                setShowFabMenu(false);
              }}
              title={t('game.bottom.library')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </button>
            <button
              className="btn btn-circle btn-lg bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-xl border-0 transform transition-all hover:scale-110"
              onClick={() => {
                setShowMarket(true);
                setShowFabMenu(false);
              }}
              title={t('game.bottom.market')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              </svg>
            </button>
          </>
        )}

        {/* 主按钮 */}
        <button
          className={`btn btn-circle btn-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-2xl border-0 transform transition-all ${showFabMenu ? 'rotate-45' : ''}`}
          onClick={() => setShowFabMenu(!showFabMenu)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <div className="drawer z-40">
        <input id="my-drawer-library" type="checkbox" className="drawer-toggle" checked={showLibrary} readOnly />
        <div className="drawer-content">
          {/* Page content here */}
        </div>
        <div className="drawer-side w-full">
          <label htmlFor="my-drawer-library" aria-label="close sidebar" className="drawer-overlay" onClick={() => setShowLibrary(false)}></label>
          <div className="menu p-4 w-full min-h-full bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-base-content flex flex-col">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">{t('game.bottom.library')}</h3>
              <button className="text-white hover:text-neutral-700" onClick={() => setShowLibrary(false)}>{t('common.close')}</button>
            </div>
            <div className="px-5 pt-3 pb-0">
              <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800 p-3 flex items-center justify-between">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">{t('game.bottom.myBalance')}</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  {loadingBalance ? '...' : `${(userBalance / 1e9).toFixed(4)} SUI`}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <p className="text-sm text-white">{t('game.bottom.libraryDesc')}</p>

              {loadingLib ? (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-white">{t('common.loading')}</div>
              ) : availableNFTs.length === 0 ? (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-white">{t('game.bottom.noAvailable')}</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {availableNFTs.map((nft) => (
                    <div key={nft.nftId} className="relative flex flex-col items-center justify-center p-4 rounded-xl border border-white/20 shadow-lg bg-black/60 backdrop-blur-sm text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl">
                      <div className="shrink-0 mb-2">
                        <AvatarDisplay name={nft.name} element={nft.element} monsterType={nft.monsterType} size={80} />
                      </div>
                      <div className="text-center mb-3">
                        <div
                          className="text-lg font-bold text-blue-400 truncate"
                          onMouseDown={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                          onTouchStart={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                          onTouchEnd={cancelLongPress}
                        >
                          {nft.name || `NFT #${nft.nftId}`}
                        </div>
                        <div className="text-xs text-white mt-2">{t('game.bottom.attribute')}: {t('elements.' + getElementKey(nft.element))}</div>
                        {nft.monsterType !== undefined && (
                          <div className="text-xs text-white">{t('game.bottom.type')}: {getMonsterTypeName(nft.monsterType)}</div>
                        )}
                        <div className="text-xs text-white">{t('common.level')}: Lv.{nft.level} ({nft.experience} EXP)</div>
                      </div>
                      <button
                        className={`w-full px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${selectedId === nft.nftId ? 'bg-green-600 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}
                        onClick={() => selectNFT(nft.nftId)}
                        disabled={settingActive || selectedId === nft.nftId}
                      >
                        {settingActive ? t('common.setting') : selectedId === nft.nftId ? t('common.inUse') : t('common.select')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <BuyNftButton
                  onSuccess={handleBuySuccess}
                  variant="primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="drawer z-40 transition-all duration-300">
        <input id="my-drawer-market" type="checkbox" className="drawer-toggle" checked={showMarket} readOnly />
        <div className="drawer-content">
          {/* Page content here */}
        </div>
        <div className="drawer-side w-full transition-all duration-300">
          <label htmlFor="my-drawer-market" aria-label="close sidebar" className="drawer-overlay" onClick={() => setShowMarket(false)}></label>
          <div className="menu p-4 w-full min-h-full bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-base-content flex flex-col transition-all duration-300">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">{t('game.bottom.market')}</h3>
              <button className="text-white hover:text-neutral-700" onClick={() => setShowMarket(false)}>{t('common.close')}</button>
            </div>
            <div className="px-5 pt-3 pb-0">
              <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800 p-3 flex items-center justify-between">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">{t('game.bottom.myBalance')}</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  {loadingBalance ? '...' : `${(userBalance / 1e9).toFixed(4)} SUI`}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              {/* Tabs for My Listings and Market Listings */}
              <div role="tablist" className="tabs tabs-boxed flex justify-center">
                <input type="radio" name="market_tabs" role="tab" className="tab tab-bordered text-white font-semibold rounded-md hover:bg-white/5 checked:bg-white/10 checked:border-white checked:text-white whitespace-nowrap" aria-label={t('game.market.myListingsTab')} defaultChecked />
                <div role="tabpanel" className="tab-content bg-transparent p-6">
                  {/* <p className="text-sm text-white mb-4">展示你拥有的NFT中可上架的，以及你已上架的NFT。</p> */}
                  {loadingMyListables ? (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-white">{t('common.loading')}</div>
                  ) : myListableNFTs.length === 0 && myListingWithStatus.length === 0 ? (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 text-sm text-white">{t('game.market.noListablesOrListings')}</div>
                  ) : (
                    <>
                      {myListableNFTs.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold mb-3 text-white">{t('game.market.listableNfts')}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {myListableNFTs.filter(nft => !myOngoingListingIds.has(nft.nftId)).map((nft) => (
                              <div key={nft.nftId} className="relative flex flex-col items-center justify-center p-4 rounded-xl border border-white/20 shadow-lg bg-black/60 backdrop-blur-sm text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl">
                                <div className="shrink-0 mb-2">
                                  <AvatarDisplay name={nft.name} element={nft.element} monsterType={nft.monsterType} size={80} />
                                </div>
                                <div className="text-center mb-3">
                                  <div
                                    className="text-lg font-bold text-blue-400 truncate"
                                    onMouseDown={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                                    onMouseUp={cancelLongPress}
                                    onMouseLeave={cancelLongPress}
                                    onTouchStart={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                                    onTouchEnd={cancelLongPress}
                                  >
                                    {nft.name || `NFT #${nft.nftId}`}
                                  </div>
                                  <div className="text-xs text-white">{t('common.element')}: {t('elements.' + getElementKey(nft.element))}</div>
                                  {nft.monsterType !== undefined && (
                                    <div className="text-xs text-white">{t('common.type')}: {getMonsterTypeName(nft.monsterType)}</div>
                                  )}
                                  <div className="text-xs text-white">{t('common.level')}: Lv.{nft.level} ({nft.experience} EXP)</div>
                                </div>
                                <input
                                  type="number"
                                  placeholder={t('game.market.pricePlaceholder')}
                                  className="input input-bordered w-full mb-2 text-black"
                                  value={listingPriceInputs[nft.nftId] || ''}
                                  onChange={(e) => setPriceInput(nft.nftId, e.target.value)}
                                />
                                <button
                                  className="w-full px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                                  onClick={() => onList(nft.nftId)}
                                  disabled={listingLoading[nft.nftId]}
                                >
                                  {listingLoading[nft.nftId] ? t('game.market.listing') : t('game.market.list')}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {myListingWithStatus.filter((listing) => listing.status === 'ongoing').length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold mb-3 text-white">{t('game.market.myListed')}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {myListingWithStatus
                              .filter((listing) => listing.status === 'ongoing')
                              .map((listing) => {
                                const nft = listingHistoryNfts[listing.nftId];
                                if (!nft) return null;
                                return (
                                  <div key={listing.nftId} className="relative flex flex-col items-center justify-center p-4 rounded-xl border border-white/20 shadow-lg bg-black/60 backdrop-blur-sm text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl">
                                    <div className="shrink-0 mb-2">
                                      <AvatarDisplay name={nft.name} element={nft.element} monsterType={nft.monsterType} size={80} />
                                    </div>
                                    <div className="text-center mb-3">
                                      <div
                                        className="text-lg font-bold text-blue-400 truncate"
                                        onMouseDown={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                                        onMouseUp={cancelLongPress}
                                        onMouseLeave={cancelLongPress}
                                        onTouchStart={(e) => startLongPress(nft.name || `NFT #${nft.nftId}`, e)}
                                        onTouchEnd={cancelLongPress}
                                      >
                                        {nft.name || `NFT #${nft.nftId}`}
                                      </div>
                                      <div className="text-xs text-neutral-400">{t('common.price')}: {(listing.price / 1e9).toFixed(4)} SUI</div>
                                      <div className="text-xs text-neutral-400">{t('common.status')}: {listing.status === 'ongoing' ? t('game.market.statusOngoing') : listing.status === 'cancelled' ? t('game.market.statusCancelled') : listing.status === 'sold' ? t('game.market.statusSold') : listing.status}</div>
                                    </div>
                                    {listing.status === 'ongoing' && (
                                      <button
                                        className="w-full px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                        onClick={() => onDelist(nft.nftId)}
                                        disabled={delistingLoading[nft.nftId]}
                                      >
                                        {delistingLoading[nft.nftId] ? t('game.market.delisting') : t('game.market.delist')}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <input type="radio" name="market_tabs" role="tab" className="tab tab-bordered text-white font-semibold rounded-md hover:bg-white/5 checked:bg-white/10 checked:border-white checked:text-white whitespace-nowrap" aria-label={t('game.market.inSaleTab')} />
                <div role="tabpanel" className="tab-content bg-transparent p-6">
                  {/* <p className="text-sm mb-4 text-white">展示所有玩家正在出售的NFT。</p> */}
                  <p className="text-xs mb-3 text-white/70">{t('game.market.purchaseLevelNote')}</p>
                  {loadingListings ? (
                    <div className="rounded-lg border border-white/20 p-4 text-sm text-white">{t('common.loading')}</div>
                  ) : marketListings.length === 0 ? (
                    <div className="rounded-lg border border-white/20 p-4 text-sm text-white">{t('game.market.noListings')}</div>
                  ) : (
                    <>
                      {/* 筛选工具栏（移动端优先：三列栅格，上行标题、下行当前值） */}
                      <div className="mb-3 grid grid-cols-3 divide-x divide-white/20 text-xs">
                        <div className="flex flex-col items-center gap-2 px-2">
                          <span className="text-white/80">{t('common.price')}</span>
                          <button
                            className="w-24 sm:w-28 px-2 py-1 rounded-md bg-black/50 text-white border border-white/20 hover:bg-black/60"
                            onClick={() => setPriceOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            title={t('game.market.priceSortTitle')}
                          >
                            {priceOrder === 'asc' ? t('game.market.priceLowToHigh') : t('game.market.priceHighToLow')}
                          </button>
                        </div>
                        <div className="flex flex-col items-center gap-2 px-2">
                          <span className="text-white/80">{t('common.element')}</span>
                          <select
                            className="select select-xs bg-black/50 text-white border-white/20 w-24 sm:w-28"
                            value={elementFilter}
                            onChange={(e) => setElementFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                          >
                            <option value="all">{t('common.all')}</option>
                            <option value={0}>{t('elements.metal')}</option>
                            <option value={1}>{t('elements.wood')}</option>
                            <option value={2}>{t('elements.water')}</option>
                            <option value={3}>{t('elements.fire')}</option>
                            <option value={4}>{t('elements.earth')}</option>
                          </select>
                        </div>
                        <div className="flex flex-col items-center gap-2 px-2">
                          <span className="text-white/80">{t('common.type')}</span>
                          <select
                            className="select select-xs bg-black/50 text-white border-white/20 w-24 sm:w-28"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                          >
                            <option value="all">{t('common.all')}</option>
                            <option value={0}>beam</option>
                            <option value={1}>marble</option>
                            <option value={2}>pixel</option>
                            <option value={3}>sunset</option>
                            <option value={4}>bauhaus</option>
                            <option value={5}>ring</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {visibleListings.map((listing) => {
                          const nft = listing.nft;
                          if (!nft) return null;
                          const isMe = (account?.address || '').toLowerCase() === listing.seller.toLowerCase();
                          return (
                            <div key={listing.nftId} className="relative flex flex-col items-center justify-center p-3 rounded-lg border border-white/20 shadow bg-black/60 backdrop-blur-sm text-white transition-all duration-200">
                              <div className="shrink-0 mb-1">
                                <AvatarDisplay name={nft.name} element={nft.element} monsterType={nft.monsterType} size={64} />
                              </div>
                              <div className="text-center mb-2">
                                <div
                                  className="text-sm font-semibold text-blue-400 leading-snug truncate"
                                  title={nft.name || `NFT #${listing.nftId}`}
                                  onMouseDown={(e) => startLongPress(nft.name || `NFT #${listing.nftId}`, e)}
                                  onMouseUp={cancelLongPress}
                                  onMouseLeave={cancelLongPress}
                                  onTouchStart={(e) => startLongPress(nft.name || `NFT #${listing.nftId}`, e)}
                                  onTouchEnd={cancelLongPress}
                                >
                                  {nft.name || `NFT #${listing.nftId}`}
                                </div>
                                <div className="text-[11px] text-white/90">{t('common.price')}: {(listing.price / 1e9).toFixed(4)} SUI</div>
                                <div className="text-[11px] text-white/80">{t('common.element')}: {t('elements.' + getElementKey(nft.element))}</div>
                                <div className="text-[11px] text-white/80">{t('common.type')}: {getMonsterTypeName(nft.monsterType)}</div>
                                <div className="text-[11px] text-white/80">{t('common.seller')}: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</div>
                              </div>
                              <button
                                className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${isMe ? 'bg-gray-600 text-white cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} disabled:opacity-50`}
                                onClick={() => onBuyListed(listing.nftId, listing.price, listing.seller)}
                                disabled={isMe || buyingListed[listing.nftId]}
                              >
                                {isMe ? t('game.market.cannotBuy') : (buyingListed[listing.nftId] ? t('game.market.buying') : t('game.market.buy'))}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div ref={loadMoreRef} className="h-1" />
                      <div className="mt-4 flex justify-center">
                        {hasMore ? (
                          <button
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                            onClick={() => loadMoreListings(false)}
                            disabled={loadingMore}
                          >
                            {loadingMore ? t('common.loading') : t('common.loadMore')}
                          </button>
                        ) : (
                          <span className="text-xs text-white/60">{t('common.noMore')}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <input type="radio" name="market_tabs" role="tab" className="tab tab-bordered text-white font-semibold rounded-md hover:bg-white/5 checked:bg-white/10 checked:border-white checked:text-white whitespace-nowrap" aria-label={t('game.market.myHistoryTab')} />
                <div role="tabpanel" className="tab-content bg-transparent p-6 ">
                  {/* <p className="text-sm mb-4 text-white">展示你的购买历史和上架历史。</p> */}
                  {loadingMkt ? (
                    <div className="rounded-lg border border-white/20 p-4 text-sm text-white">{t('common.loading')}</div>
                  ) : myPurchased.length === 0 && myListingWithStatus.length === 0 ? (
                    <div className="rounded-lg border border-white/20 p-4 text-sm text-white">{t('game.market.noHistory')}</div>
                  ) : (
                    <div className="space-y-4">
                      {myPurchased.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold mb-3 text-white">{t('game.market.myPurchases')}</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {myPurchased.map((p, idx) => (
                              <div key={idx} className="p-3 rounded-lg border border-white/20 bg-black/60 text-sm text-white">
                                <div className="flex justify-between">
                                  <span>{t('game.market.nftId')}:</span>
                                  <span className="font-medium text-blue-400">#{p.nftId}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{t('common.price')}:</span>
                                  <span className="font-medium text-blue-400">{(p.price / 1e9).toFixed(4)} SUI</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{t('common.seller')}:</span>
                                  <span className="font-medium text-blue-400">{p.seller.slice(0, 6)}...{p.seller.slice(-4)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{t('common.time')}:</span>
                                  <span className="font-medium text-blue-400">{new Date(p.timestamp).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {myListingWithStatus.length > 0 && (
                        <div>
                          {/* <h4 className="text-lg font-semibold mb-3 text-white">我的上架历史</h4> */}
                          <div className="grid grid-cols-1 gap-3">
                            {myListingWithStatus.map((listing, idx) => {
                              const nft = listingHistoryNfts[listing.nftId];
                              return (
                                <div key={idx} className="p-3 rounded-lg border border-white/20 bg-black/60 text-sm text-white">
                                  <div className="flex justify-between">
                                    <span>{t('common.name')}:</span>
                                    <span className="font-medium text-blue-400">{(nft?.name) || ("#" + listing.nftId)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{t('common.price')}:</span>
                                    <span className="font-medium text-blue-400">{(listing.price / 1e9).toFixed(4)} SUI</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{t('common.status')}:</span>
                                    <span className="font-medium text-blue-400">{listing.status === 'ongoing' ? t('game.market.statusOngoing') : listing.status === 'cancelled' ? t('game.market.statusCancelled') : listing.status === 'sold' ? t('game.market.statusSold') : listing.status}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{t('common.time')}:</span>
                                    <span className="font-medium text-blue-400">{new Date(listing.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {fullNameView && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onMouseUp={cancelLongPress}
          onTouchEnd={cancelLongPress}
        >
          <div className="max-w-[90vw] bg-white text-black dark:bg-neutral-800 dark:text-white rounded-lg p-4 shadow-xl">
            <div className="text-sm break-words">{fullNameView.text}</div>
          </div>
        </div>
      )}
    </>
  );
}
