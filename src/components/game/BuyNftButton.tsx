import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { createBuyNftTransaction, getUserBalance } from '@/sui';
import { Message } from '@/components';
import type { MessageType } from '@/components/Message';
import { useI18n } from '@/i18n/useI18n';

interface BuyNftButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}

const NFT_PRICE = 1_000_000_000; // 1 SUI
const GAS_BUDGET = 50_000_000; // 0.05 SUI

export default function BuyNftButton({ 
  onSuccess, 
  className = '',
  variant = 'primary' 
}: BuyNftButtonProps) {
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
  
  const [buying, setBuying] = useState(false);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

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

  // 查询余额
  useEffect(() => {
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
  }, [account?.address, buying]); // 购买后也刷新余额

  const handleBuy = () => {
    if (!account) {
      showMessage('warning', t('game.buyNft.connectWallet'));
      return;
    }

    const totalNeeded = NFT_PRICE + GAS_BUDGET;
    
    // 检查余额
    if (userBalance < totalNeeded) {
      const balanceSUI = (userBalance / 1e9).toFixed(4);
      const neededSUI = (totalNeeded / 1e9).toFixed(2);
      showMessage(
        'warning',
        `${t('game.buyNft.insufficient')}\n\n${t('game.buyNft.currentBalance')}: ${balanceSUI} SUI\n${t('game.buyNft.need')}: ${neededSUI} SUI (1 SUI + 0.05 gas)\n\n${t('game.buyNft.topUp')}`
      );
      return;
    }

    setBuying(true);
    
    const tx = createBuyNftTransaction(NFT_PRICE);

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          console.log('购买NFT成功:', result);
          showMessage('success', t('game.buyNft.success'));
          setBuying(false);
          
          // 调用外部的成功回调
          if (onSuccess) {
            onSuccess();
          }
        },
        onError: (error) => {
          console.error('购买NFT失败:', error);
          
          let errorMsg = t('game.buyNft.failPrefix');
          if (error && typeof error === 'object' && 'message' in error) {
            const msg = String(error.message || '');
            if (msg.includes('InsufficientCoinBalance')) {
              const balanceSUI = (userBalance / 1e9).toFixed(4);
              const neededSUI = (totalNeeded / 1e9).toFixed(2);
              errorMsg += ` ${t('game.buyNft.insufficient')}\n\n${t('game.buyNft.currentBalance')}: ${balanceSUI} SUI\n${t('game.buyNft.need')}: ${neededSUI} SUI\n\n${t('game.buyNft.topUp')}`;
            } else {
              errorMsg += ' ' + (msg || t('game.buyNft.unknown'));
            }
          } else {
            errorMsg += ' ' + t('game.buyNft.unknown');
          }
          
          showMessage('error', errorMsg);
          setBuying(false);
        },
      }
    );
  };

  // 变体样式
  const variantClasses = variant === 'primary'
    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  // 是否禁用
  const isDisabled = buying || loadingBalance || !account;
  
  // 按钮文本
  const buttonText = buying 
    ? t('game.buyNft.buying') 
    : loadingBalance 
    ? t('game.buyNft.checkingBalance') 
    : t('game.buyNft.buyWithOne');

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
      
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60 transition-all ${variantClasses} ${className}`}
        onClick={handleBuy}
        disabled={isDisabled}
        title={!account ? t('game.buyNft.connectWallet') : userBalance < (NFT_PRICE + GAS_BUDGET) ? t('game.buyNft.insufficient') : ''}
      >
        {buttonText}
      </button>
    </>
  );
}

