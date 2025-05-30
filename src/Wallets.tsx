import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, ExternalLink, DollarSign, Activity } from 'lucide-react';
import { saveWalletsToCookies, WalletType, formatAddress, formatTokenBalance, copyToClipboard, toggleWallet, fetchSolBalance } from './Utils';
import { useToast } from "./Notifications";
import { Connection } from '@solana/web3.js';
// WalletOperationsButtons moved to App.tsx

// Tooltip Component with cyberpunk styling - Optimized with React.memo
export const Tooltip = React.memo(({ 
  children, 
  content,
  position = 'top'
}: { 
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = useMemo(() => ({
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }), []);

  const handleMouseEnter = useCallback(() => setIsVisible(true), []);
  const handleMouseLeave = useCallback(() => setIsVisible(false), []);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-[#051014] cyberpunk-border text-[#02b36d] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
});

// Max wallets configuration
export const maxWalletsConfig = {
  'raybuy': 120,
  'raysell': 120,
  'pumpbuy': 140,
  'pumpsell': 180,
  'jupbuy': 120,
  'swapbuy': 120,
  'swapsell': 120,
  'jupsell': 120,
  'moonbuy': 160,
  'launchsell': 160,
  'launchbuy': 160,
  'moonsell': 160,
  'boopbuy': 160,
  'boopsell': 160
} as const;

// Updated toggle function for wallets based on token and SOL conditions
export const toggleWalletsByBalance = (
  wallets: WalletType[], 
  showWithTokens: boolean,
  solBalances: Map<string, number>,
  tokenBalances: Map<string, number>
): WalletType[] => {
  return wallets.map(wallet => ({
    ...wallet,
    isActive: showWithTokens 
      ? (tokenBalances.get(wallet.address) || 0) > 0  // Select wallets with tokens
      : (solBalances.get(wallet.address) || 0) > 0 && (tokenBalances.get(wallet.address) || 0) === 0  // Select wallets with only SOL
  }));
};

export type ScriptType = keyof typeof maxWalletsConfig;

/**
 * Counts the number of active wallets in the provided wallet array
 * @param wallets Array of wallet objects
 * @returns Number of active wallets
 */
export const countActiveWallets = (wallets: WalletType[]): number => {
  return wallets.filter(wallet => wallet.isActive).length;
};

/**
 * Returns an array of only the active wallets
 * @param wallets Array of wallet objects
 * @returns Array of active wallets
 */
export const getActiveWallets = (wallets: WalletType[]): WalletType[] => {
  return wallets.filter(wallet => wallet.isActive);
};

/**
 * Checks if the number of active wallets exceeds the maximum allowed for a specific script
 * @param wallets Array of wallet objects
 * @param scriptName Name of the script to check against
 * @returns Object containing validation result and relevant information
 */
export const validateActiveWallets = (wallets: WalletType[], scriptName: ScriptType) => {
  const activeCount = countActiveWallets(wallets);
  const maxAllowed = maxWalletsConfig[scriptName];
  const isValid = activeCount <= maxAllowed;

  return {
    isValid,
    activeCount,
    maxAllowed,
    scriptName,
    message: isValid 
      ? `Valid: ${activeCount} active wallets (max ${maxAllowed})`
      : `Error: Too many active wallets (${activeCount}). Maximum allowed for ${scriptName} is ${maxAllowed}`
  };
};

// New function to toggle all wallets regardless of balance
export const toggleAllWallets = (wallets: WalletType[]): WalletType[] => {
  const allActive = wallets.every(wallet => wallet.isActive);
  return wallets.map(wallet => ({
    ...wallet,
    isActive: !allActive
  }));
};

// Updated to use separate SOL balance tracking
export const toggleAllWalletsWithBalance = (
  wallets: WalletType[],
  solBalances: Map<string, number>
): WalletType[] => {
  // Check if all wallets with balance are already active
  const walletsWithBalance = wallets.filter(wallet => 
    (solBalances.get(wallet.address) || 0) > 0
  );
  const allWithBalanceActive = walletsWithBalance.every(wallet => wallet.isActive);
  
  // Toggle based on current state
  return wallets.map(wallet => ({
    ...wallet,
    isActive: (solBalances.get(wallet.address) || 0) > 0 
      ? !allWithBalanceActive 
      : wallet.isActive
  }));
};

/**
 * Gets the appropriate script name based on selected DEX and mode
 * @param selectedDex Selected DEX name
 * @param isBuyMode Whether in buy mode
 * @returns The corresponding script name
 */
export const getScriptName = (selectedDex: string, isBuyMode: boolean): ScriptType => {
  switch(selectedDex) {
    case 'raydium':
      return isBuyMode ? 'raybuy' : 'raysell';
    case 'jupiter':
      return isBuyMode ? 'jupbuy' : 'jupsell';
    case 'pumpfun':
      return isBuyMode ? 'pumpbuy' : 'pumpsell';
    case 'pumpswap':
      return isBuyMode ? 'swapbuy' : 'swapsell';
    case 'moonshot':
      return isBuyMode ? 'moonbuy' : 'moonsell';
    case 'launchpad':
      return isBuyMode ? 'launchbuy' : 'launchsell';
    case 'boopfun':
      return isBuyMode ? 'boopbuy' : 'boopsell';
    default:
      return isBuyMode ? 'pumpbuy' : 'pumpsell';
  }
};

interface WalletsPageProps {
  wallets: WalletType[];
  setWallets: React.Dispatch<React.SetStateAction<WalletType[]>>;
  handleRefresh: () => void;
  isRefreshing: boolean;
  setIsModalOpen: (open: boolean) => void;
  tokenAddress: string;
  sortDirection: string;
  handleSortWallets: () => void;
  connection: Connection;
  
  // Balance props
  solBalances?: Map<string, number>;
  setSolBalances?: (balances: Map<string, number>) => void;
  tokenBalances?: Map<string, number>;
  setTokenBalances?: (balances: Map<string, number>) => void;
  totalSol?: number;
  setTotalSol?: (total: number) => void;
  activeSol?: number;
  setActiveSol?: (active: number) => void;
  totalTokens?: number;
  setTotalTokens?: (total: number) => void;
  activeTokens?: number;
  setActiveTokens?: (active: number) => void;
}
export const WalletsPage: React.FC<WalletsPageProps> = ({
  wallets,
  setWallets,
  handleRefresh,
  isRefreshing,
  setIsModalOpen,
  tokenAddress,
  sortDirection,
  handleSortWallets,
  connection,
  
  // Balance props with defaults
  solBalances: externalSolBalances,
  setSolBalances: setExternalSolBalances,
  tokenBalances: externalTokenBalances,
  setTokenBalances: setExternalTokenBalances,
  totalSol: externalTotalSol,
  setTotalSol: setExternalTotalSol,
  activeSol: externalActiveSol,
  setActiveSol: setExternalActiveSol,
  totalTokens: externalTotalTokens,
  setTotalTokens: setExternalTotalTokens,
  activeTokens: externalActiveTokens,
  setActiveTokens: setExternalActiveTokens
}) => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showingTokenWallets, setShowingTokenWallets] = useState(true);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  
  // Use internal state if external state is not provided
  const [internalSolBalances, setInternalSolBalances] = useState<Map<string, number>>(new Map());
  const [internalTokenBalances, setInternalTokenBalances] = useState<Map<string, number>>(new Map());
  const [refreshingWalletId, setRefreshingWalletId] = useState<number | null>(null);
  
  const solBalances = externalSolBalances || internalSolBalances;
  const setSolBalances = setExternalSolBalances || setInternalSolBalances;
  const tokenBalances = externalTokenBalances || internalTokenBalances;
  const setTokenBalances = setExternalTokenBalances || setInternalTokenBalances;
  
  const { showToast } = useToast();

  // Fetch SOL balances for all wallets one by one
  const fetchSolBalances = async () => {
    const newBalances = new Map<string, number>(solBalances);
    
    // Process wallets sequentially
    for (const wallet of wallets) {
      setRefreshingWalletId(wallet.id);
      try {
        const balance = await fetchSolBalance(connection, wallet.address);
        newBalances.set(wallet.address, balance);
        // Update balances after each wallet to show progress
        setSolBalances(new Map(newBalances));
      } catch (error) {
        console.error(`Error fetching SOL balance for ${wallet.address}:`, error);
        newBalances.set(wallet.address, 0);
      }
      
      // Add a small delay to make the sequential update visible
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    setRefreshingWalletId(null);
    return newBalances;
  };

  // Fetch SOL balances initially and when wallets change
  useEffect(() => {
    fetchSolBalances();
  }, [wallets.length, connection]);

  // Calculate balances and update external state
  useEffect(() => {
    // Calculate total SOL and token balances
    const calculatedTotalSol = Array.from(solBalances.values()).reduce((sum, balance) => sum + balance, 0);
    const calculatedTotalTokens = Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);

    // Calculate SOL and token balances for active wallets only
    const activeWallets = wallets.filter(wallet => wallet.isActive);
    const calculatedActiveSol = activeWallets.reduce((sum, wallet) => sum + (solBalances.get(wallet.address) || 0), 0);
    const calculatedActiveTokens = activeWallets.reduce((sum, wallet) => sum + (tokenBalances.get(wallet.address) || 0), 0);

    // Update external state if provided
    if (setExternalTotalSol) setExternalTotalSol(calculatedTotalSol);
    if (setExternalActiveSol) setExternalActiveSol(calculatedActiveSol);
    if (setExternalTotalTokens) setExternalTotalTokens(calculatedTotalTokens);
    if (setExternalActiveTokens) setExternalActiveTokens(calculatedActiveTokens);
  }, [wallets, solBalances, tokenBalances]);

  // Use either external state or calculated values
  const totalSol = externalTotalSol !== undefined ? externalTotalSol : 
    Array.from(solBalances.values()).reduce((sum, balance) => sum + balance, 0);
  
  const totalTokens = externalTotalTokens !== undefined ? externalTotalTokens :
    Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);
  
  const activeWallets = wallets.filter(wallet => wallet.isActive);
  
  const activeSol = externalActiveSol !== undefined ? externalActiveSol :
    activeWallets.reduce((sum, wallet) => sum + (solBalances.get(wallet.address) || 0), 0);
  
  const activeTokens = externalActiveTokens !== undefined ? externalActiveTokens :
    activeWallets.reduce((sum, wallet) => sum + (tokenBalances.get(wallet.address) || 0), 0);

  const handleBalanceToggle = () => {
    setShowingTokenWallets(!showingTokenWallets);
    setWallets(prev => {
      const newWallets = toggleWalletsByBalance(prev, !showingTokenWallets, solBalances, tokenBalances);
      saveWalletsToCookies(newWallets);
      return newWallets;
    });
  };

  const handleRefreshAll = async () => {
    if (isRefreshing || refreshingWalletId !== null) return;
    
    // Call the parent's refresh handler to indicate the refresh has started
    handleRefresh();
    
    // Perform the wallet-by-wallet refresh
    await fetchSolBalances();
  };

  return (
    <div className="flex-1 bg-[#050a0e] relative cyberpunk-bg">
      {/* Cyberpunk scanline effect - pointer-events-none ensures it doesn't block clicks */}
      <div className="absolute top-0 left-0 w-full h-full cyberpunk-scanline pointer-events-none z-1 opacity-30"></div>
      
      {/* Balance info header - sticky at top */}
      <div className="sticky top-0 bg-[#050a0e99] backdrop-blur-sm border-b border-[#02b36d40] z-10 shadow-sm">
        <div className="py-2 px-3 bg-[#0a141980]">
          <div className="flex justify-between text-sm">
            <div>
              <div className="text-[#7ddfbd] font-mono flex items-center gap-2">
                <DollarSign size={14} className="text-[#02b36d]" />
                <span>
                  <span className="text-[#e4fbf2]">{totalSol.toFixed(2)}</span> (
                  <span className="text-[#02b36d]">{activeSol.toFixed(2)}</span>) SOL
                </span>
              </div>
            </div>
            {tokenAddress && (
              <div className="text-right">
                <div className="text-[#7ddfbd] font-mono flex items-center justify-end gap-2">
                  <span>
                    <span className="text-[#e4fbf2]">{formatTokenBalance(totalTokens)}</span> (
                    <span className="text-[#02b36d]">{formatTokenBalance(activeTokens)}</span>) Tokens
                  </span>
                  <Activity size={14} className="text-[#02b36d]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Wallets table */}
      <div className="pt-2 relative">
        <div className="min-w-full overflow-auto relative">
          <table className="w-full border-separate border-spacing-0">
            <tbody className="text-sm">
              {wallets.map((wallet) => (
                <tr 
                  key={wallet.id}
                  onClick={() => {
                    setWallets(prev => {
                      const newWallets = toggleWallet(prev, wallet.id);
                      saveWalletsToCookies(newWallets);
                      return newWallets;
                    });
                  }}
                  onMouseEnter={() => setHoverRow(wallet.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  className={`
                    border-b border-[#02b36d15] cursor-pointer
                    ${hoverRow === wallet.id ? 'bg-[#02b36d15]' : ''}
                    ${wallet.isActive ? 'bg-[#02b36d10]' : ''}
                    ${refreshingWalletId === wallet.id ? 'bg-[#02b36d20]' : ''}
                  `}
                >
                  {/* Indicator dot */}
                  <td className="py-2.5 pl-3 pr-1 w-6">
                    <div 
                      className={`
                        w-3 h-3 rounded-full
                        ${wallet.isActive 
                          ? 'bg-[#02b36d] shadow-sm shadow-[#02b36d40]' 
                          : 'bg-[#091217] border border-[#02b36d40]'
                        }
                      `} 
                    />
                  </td>
                  
                  {/* Address with proper sizing */}
                  <td className="py-2.5 px-2 font-mono">
                    <div className="flex items-center">
                      {refreshingWalletId === wallet.id && (
                        <RefreshCw size={12} className="text-[#02b36d] mr-2" />
                      )}
                      <span 
                        className="text-sm font-mono cursor-pointer hover:text-[#02b36d] tracking-wide"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const success = await copyToClipboard(wallet.address, showToast);
                          if (success) {
                            setCopiedAddress(wallet.address);
                            setTimeout(() => setCopiedAddress(null), 2000);
                          }
                        }}
                      >
                        {formatAddress(wallet.address)}
                        {copiedAddress === wallet.address && (
                          <span className="ml-1 text-xs text-[#02b36d] animate-pulse">
                            ✓
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  
                  {/* SOL balance */}
                  <td className="py-2.5 px-2 text-right font-mono text-[#e4fbf2]">
                    <span className={`${(solBalances.get(wallet.address) || 0) > 0 ? 'text-[#7ddfbd]' : 'text-[#7ddfbd60]'}`}>
                      {(solBalances.get(wallet.address) || 0).toFixed(3)}
                    </span>
                  </td>
                  
                  {/* Token balance if needed */}
                  {tokenAddress && (
                    <td className="py-2.5 px-2 text-right font-mono">
                      <span className={`${(tokenBalances.get(wallet.address) || 0) > 0 ? 'text-[#02b36d]' : 'text-[#02b36d40]'}`}>
                        {formatTokenBalance(tokenBalances.get(wallet.address) || 0)}
                      </span>
                    </td>
                  )}
                  
                  {/* Explorer link */}
                  <td className="py-2.5 pl-2 pr-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://solscan.io/account/${wallet.address}`, '_blank');
                      }}
                      className="text-[#7ddfbd60] hover:text-[#02b36d]"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};