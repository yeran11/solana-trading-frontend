import { WalletType } from './Utils';

export interface TradingConfig {
  tokenAddress: string;
  solAmount?: number;
  sellPercent?: number;
}

export interface FormattedWallet {
  address: string;
  privateKey: string;
}

export interface TradingResult {
  success: boolean;
  error?: string;
}

// Moonshot trading functions
export const executeMoonshotTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateMoonBuyInputs, executeMoonBuy } = await import('./utils/moonbuy');
      
      if (walletBalances) {
        const validation = validateMoonBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeMoonBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executeMoonSell } = await import('./utils/moonsell');
      return await executeMoonSell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// BoopFun trading functions
export const executeBoopFunTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateBoopBuyInputs, executeBoopBuy } = await import('./utils/boopbuy');
      
      if (walletBalances) {
        const validation = validateBoopBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeBoopBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executeBoopSell } = await import('./utils/boopsell');
      return await executeBoopSell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// PumpFun trading functions
export const executePumpFunTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validatePumpBuyInputs, executePumpBuy } = await import('./utils/pumpbuy');
      
      if (walletBalances) {
        const validation = validatePumpBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executePumpBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executePumpSell } = await import('./utils/pumpsell');
      return await executePumpSell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Raydium trading functions
export const executeRaydiumTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateRayBuyInputs, executeRayBuy } = await import('./utils/raybuy');
      
      if (walletBalances) {
        const validation = validateRayBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeRayBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executeRaySell } = await import('./utils/raysell');
      return await executeRaySell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Jupiter trading functions
export const executeJupiterTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateJupSwapInputs, executeJupSwap } = await import('./utils/jupbuy');
      
      if (walletBalances) {
        const validation = validateJupSwapInputs(wallets, {
           inputMint: 'So11111111111111111111111111111111111111112', // SOL
           outputMint: config.tokenAddress,
           solAmount: config.solAmount!,
           slippageBps: 100 // 1% slippage
         }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeJupSwap(wallets, {
         inputMint: 'So11111111111111111111111111111111111111112', // SOL
         outputMint: config.tokenAddress,
         solAmount: config.solAmount!,
         slippageBps: 100 // 1% slippage
       });
    } else {
      const { executeJupSell } = await import('./utils/jupsell');
      return await executeJupSell(wallets, {
        inputMint: config.tokenAddress,
        outputMint: 'So11111111111111111111111111111111111111112', // SOL
        sellPercent: config.sellPercent!,
        slippageBps: 100 // 1% slippage
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Launchpad trading functions
export const executeLaunchpadTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateLaunchBuyInputs, executeLaunchBuy } = await import('./utils/launchbuy');
      
      if (walletBalances) {
        const validation = validateLaunchBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeLaunchBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executeLaunchSell } = await import('./utils/launchsell');
      return await executeLaunchSell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// PumpSwap trading functions
export const executePumpSwapTrade = async (
  wallets: FormattedWallet[],
  config: TradingConfig,
  isBuyMode: boolean,
  walletBalances?: Map<string, number>
): Promise<TradingResult> => {
  try {
    if (isBuyMode) {
      const { validateSwapBuyInputs, executeSwapBuy } = await import('./utils/swapbuy');
      
      if (walletBalances) {
        const validation = validateSwapBuyInputs(wallets, {
          tokenAddress: config.tokenAddress,
          solAmount: config.solAmount!
        }, walletBalances);
        
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
      }
      
      return await executeSwapBuy(wallets, {
        tokenAddress: config.tokenAddress,
        solAmount: config.solAmount!
      });
    } else {
      const { executeSwapSell } = await import('./utils/swapsell');
      return await executeSwapSell(wallets, {
        tokenAddress: config.tokenAddress,
        sellPercent: config.sellPercent!
      });
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Main trading executor
export const executeTrade = async (
  dex: string,
  wallets: WalletType[],
  config: TradingConfig,
  isBuyMode: boolean,
  solBalances: Map<string, number>
): Promise<TradingResult> => {
  const activeWallets = wallets.filter(wallet => wallet.isActive);
  
  if (activeWallets.length === 0) {
    return { success: false, error: 'Please activate at least one wallet' };
  }
  
  const formattedWallets = activeWallets.map(wallet => ({
    address: wallet.address,
    privateKey: wallet.privateKey
  }));
  
  const walletBalances = new Map<string, number>();
  activeWallets.forEach(wallet => {
    const balance = solBalances.get(wallet.address) || 0;
    walletBalances.set(wallet.address, balance);
  });
  
  switch (dex) {
    case 'moonshot':
      return await executeMoonshotTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'boopfun':
      return await executeBoopFunTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'pumpfun':
      return await executePumpFunTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'raydium':
      return await executeRaydiumTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'auto':
      return await executeJupiterTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'launchpad':
      return await executeLaunchpadTrade(formattedWallets, config, isBuyMode, walletBalances);
    case 'pumpswap':
      return await executePumpSwapTrade(formattedWallets, config, isBuyMode, walletBalances);
    default:
      return { success: false, error: `Unsupported DEX: ${dex}` };
  }
};