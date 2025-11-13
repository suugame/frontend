'use client';

import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';
import { envConfig } from '@/config/environment';
import { I18nProvider } from '@/i18n/I18nProvider';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
  devnet: { url: getFullnodeUrl('devnet') },
  localnet: { url: getFullnodeUrl('localnet') },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SuiClientProvider networks={networkConfig} defaultNetwork={envConfig.suiNetwork}>
          <WalletProvider
            autoConnect
            slushWallet={{ name: 'Slush' }}
            preferredWallets={['Slush', 'Phantom', 'OKX Wallet']}
          >
            {children}
          </WalletProvider>
        </SuiClientProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
