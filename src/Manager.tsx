import { Connection } from "@solana/web3.js";
import { WalletType, fetchSolBalance, fetchTokenBalance } from "./Utils";

/**
 * Extract API key from URL and clean the URL
 */
export const handleApiKeyFromUrl = (
  setConfig: Function,
  saveConfigToCookies: Function,
  showToast: Function
) => {
  const url = new URL(window.location.href);
  const apiKey = url.searchParams.get('apikey');
  
  // If API key is in the URL
  if (apiKey) {
    console.log('API key found in URL, saving to config');
    
    // Update config state with the new API key
    setConfig((prev: any) => {
      const newConfig = { ...prev, apiKey };
      // Save to cookies
      saveConfigToCookies(newConfig);
      return newConfig;
    });
    
    // Remove the apikey parameter from URL without reloading the page
    url.searchParams.delete('apikey');
    
    // Replace current URL without reloading the page
    window.history.replaceState({}, document.title, url.toString());
    
    // Optional: Show a toast notification that API key was set
    if (showToast) {
      showToast("API key has been set from URL", "success");
    }
  }
};

/**
 * Fetch SOL balances for all wallets with batching for better performance
 */
export const fetchSolBalances = async (
  connection: Connection,
  wallets: WalletType[],
  setSolBalances: Function,
  batchSize: number = 20
) => {
  const newBalances = new Map<string, number>();
  
  // Process wallets in batches to reduce memory pressure
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    
    const promises = batch.map(async (wallet) => {
      try {
        const balance = await fetchSolBalance(connection, wallet.address);
        newBalances.set(wallet.address, balance);
      } catch (error) {
        console.error(`Error fetching SOL balance for ${wallet.address}:`, error);
        newBalances.set(wallet.address, 0);
      }
    });
    
    await Promise.all(promises);
    
    // Progressive UI update after each batch
    setSolBalances(new Map(newBalances));
    
    // Small delay to prevent overwhelming the RPC
    if (i + batchSize < wallets.length) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  
  return newBalances;
};

/**
 * Fetch token balances for all wallets with batching for better performance
 */
export const fetchTokenBalances = async (
  connection: Connection,
  wallets: WalletType[],
  tokenAddress: string,
  setTokenBalances: Function,
  batchSize: number = 20
) => {
  if (!tokenAddress) return new Map<string, number>();
  
  const newBalances = new Map<string, number>();
  
  // Process wallets in batches to reduce memory pressure
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    
    const promises = batch.map(async (wallet) => {
      try {
        const balance = await fetchTokenBalance(connection, wallet.address, tokenAddress);
        newBalances.set(wallet.address, balance);
      } catch (error) {
        console.error(`Error fetching token balance for ${wallet.address}:`, error);
        newBalances.set(wallet.address, 0);
      }
    });
    
    await Promise.all(promises);
    
    // Progressive UI update after each batch
    setTokenBalances(new Map(newBalances));
    
    // Small delay to prevent overwhelming the RPC
    if (i + batchSize < wallets.length) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  
  return newBalances;
};

/**
 * Fetch AMM key for a token
 */
export const fetchAmmKey = async (
  tokenAddress: string,
  setAmmKey: Function,
  setIsLoadingChart: Function
) => {
  if (!tokenAddress) return null;
  setIsLoadingChart(true);
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=100000000&slippageBps=1`
    );
    const data = await response.json();
    if (data.routePlan?.[0]?.swapInfo?.ammKey) {
      setAmmKey(data.routePlan[0].swapInfo.ammKey);
    }
  } catch (error) {
    console.error('Error fetching AMM key:', error);
  }
  setIsLoadingChart(false);
};

/**
 * Handle market cap updates
 */
export const handleMarketCapUpdate = (
  marketcap: number | null,
  setCurrentMarketCap: Function
) => {
  setCurrentMarketCap(marketcap);
  console.log("Main component received marketcap update:", marketcap);
};

/**
 * Handle wallet sorting by balance
 */
export const handleSortWallets = (
  wallets: WalletType[],
  sortDirection: 'asc' | 'desc',
  setSortDirection: Function,
  solBalances: Map<string, number>,
  setWallets: Function
) => {
  setWallets((prev: WalletType[]) => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    
    return [...prev].sort((a, b) => {
      const balanceA = solBalances.get(a.address) || 0;
      const balanceB = solBalances.get(b.address) || 0;
      
      if (newDirection === 'asc') {
        return balanceA - balanceB;
      } else {
        return balanceB - balanceA;
      }
    });
  });
};

/**
 * Clean up wallets by removing empty and duplicate wallets
 */
export const handleCleanupWallets = (
  wallets: WalletType[],
  solBalances: Map<string, number>,
  tokenBalances: Map<string, number>,
  setWallets: Function,
  showToast: Function
) => {
  setWallets((prev: WalletType[]) => {
    // Keep track of seen addresses
    const seenAddresses = new Set<string>();
    // Keep track of removal counts
    let emptyCount = 0;
    let duplicateCount = 0;
    
    // Filter out empty wallets and duplicates
    const cleanedWallets = prev.filter(wallet => {
      // Check for empty balance (no SOL and no tokens)
      const solBalance = solBalances.get(wallet.address) || 0;
      const tokenBalance = tokenBalances.get(wallet.address) || 0;
      
      if (solBalance <= 0 && tokenBalance <= 0) {
        emptyCount++;
        return false;
      }
      
      // Check for duplicates
      if (seenAddresses.has(wallet.address)) {
        duplicateCount++;
        return false;
      }
      
      seenAddresses.add(wallet.address);
      return true;
    });

    // Show appropriate toast message
    if (emptyCount > 0 || duplicateCount > 0) {
      const messages: string[] = [];
      if (emptyCount > 0) {
        messages.push(`${emptyCount} empty wallet${emptyCount === 1 ? '' : 's'}`);
      }
      if (duplicateCount > 0) {
        messages.push(`${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`);
      }
      showToast(`Removed ${messages.join(' and ')}`, "success");
    } else {
      showToast("No empty wallets or duplicates found", "success");
    }
    
    return cleanedWallets;
  });
};