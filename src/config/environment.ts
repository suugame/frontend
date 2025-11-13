// src/config/environment.ts
export interface EnvironmentConfig {
  isProduction: boolean;
  suiNetwork: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  contractPackageId: string;
  contractObjectId: string;
  bankerAddress: string; // Note: Banker address is now dynamic and fetched from contract
  environment: 'production' | 'development' | 'staging';
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  // Detect current environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isStaging = process.env.VERCEL_ENV === 'preview' || process.env.CF_PAGES_BRANCH === 'dev';
  
  // Debug logging for troubleshooting
  console.log('Environment Debug Info:', {
    NODE_ENV: process.env.NODE_ENV,
    SUI_NETWORK: process.env.SUI_NETWORK,
    CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH,
    VERCEL_ENV: process.env.VERCEL_ENV,
    isProduction,
    isStaging
  });
  
  // Determine network - SUI_NETWORK is the primary source of truth
  let suiNetwork: EnvironmentConfig['suiNetwork'];
  
  if (process.env.SUI_NETWORK) {
    // Use SUI_NETWORK environment variable (set in Cloudflare Pages)
    suiNetwork = process.env.SUI_NETWORK as EnvironmentConfig['suiNetwork'];
    console.log('✅ Using SUI_NETWORK from Cloudflare Pages:', suiNetwork);
  } else {
    // Fallback: Use production detection if SUI_NETWORK is not set
    suiNetwork = isProduction ? 'mainnet' : 'testnet';
    console.log('⚠️ SUI_NETWORK not set, using fallback based on NODE_ENV:', suiNetwork);
    console.warn('Please set SUI_NETWORK environment variable in Cloudflare Pages settings');
  }
  
  // Determine environment type
  const environment: 'production' | 'development' | 'staging' = isProduction ? 'production' : 
    isStaging ? 'staging' : 'development';
  
  // Contract addresses based on network
  const getContractAddresses = () => {
    if (suiNetwork === 'mainnet') {
      console.log('Using MAINNET contract addresses');
      return {
        contractPackageId: '0x8ba4d7710351b6ef3044515d206625dc26116712eac155003e9813350fd46421',
        contractObjectId: '0x56a57376fb68d041723b1119f5b9d7f6a1863c0331d0f215506f6e78ba5e4e14',
        bankerAddress: '0xbed3a24d91f2fb75ab90d6dfddbfc5f59a7a4b62f5779c1118dc22ab176fca44',
      };
    } else {
      console.log('Using TESTNET contract addresses');
      // Testnet addresses - UPDATED from deploy_info_testnet.txt
      return {
        contractPackageId: '0x7ceff956432740658ada869243d30cf30bbc76bfba703669ee264a047cd930ab',
        contractObjectId: '0xf43fd10d5892124eb8eb5b8e61fda0d2c8c7a524d594d00a7585088da1a4063e',
        bankerAddress: '0xbed3a24d91f2fb75ab90d6dfddbfc5f59a7a4b62f5779c1118dc22ab176fca44',
      };
    }
  };
  
  const contractAddresses = getContractAddresses();
  
  const config = {
    isProduction,
    suiNetwork,
    environment,
    contractPackageId: contractAddresses.contractPackageId,
    contractObjectId: contractAddresses.contractObjectId,
    bankerAddress: contractAddresses.bankerAddress,
  };
  
  console.log('Final config:', config);
  
  return config;
};

// Export current environment configuration
export const envConfig = getEnvironmentConfig();

// Environment info display
export const getEnvironmentInfo = () => {
  const config = getEnvironmentConfig();
  
  return {
    environment: config.environment,
    suiNetwork: config.suiNetwork,
    isProduction: config.isProduction,
    displayText: `${config.environment.toUpperCase()} - ${config.suiNetwork.toUpperCase()}`,
    badgeColor: config.isProduction ? 'bg-green-500' : 'bg-yellow-500',
  };
};
