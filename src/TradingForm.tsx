import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, ArrowDownCircle, ArrowUpCircle, Loader2, Sparkles, Move } from 'lucide-react';
import { loadConfigFromCookies } from './Utils';

// Helper function to format numbers with k, M, B suffixes
const formatNumber = (num) => {
  const number = parseFloat(num);
  if (isNaN(number) || number === 0) return "0";
  
  const absNum = Math.abs(number);
  
  if (absNum >= 1000000000) {
    return (number / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  } else if (absNum >= 1000000) {
    return (number / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  } else if (absNum >= 1000) {
    return (number / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k';
  } else if (absNum >= 1) {
    return number.toFixed(2).replace(/\.?0+$/, '');
  } else {
    // For very small numbers, show more decimal places
    return number.toFixed(6).replace(/\.?0+$/, '');
  }
};

// Cyberpunk Tooltip component (simplified)
const Tooltip = ({ children, content, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2'
  };

  return (
    <div className="relative group">
      {children}
      <div className={`absolute hidden group-hover:block px-3 py-1.5 text-xs font-mono tracking-wide
                    bg-[#050a0e] text-[#02b36d] rounded-lg backdrop-blur-md
                    border border-[#02b36d40] shadow-lg shadow-[#00000080]
                    ${positionClasses[position]}`}>
        <div className="relative z-10">{content}</div>
      </div>
    </div>
  );
};

// Cyberpunk Input component (unchanged)
const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-2 py-1.5 bg-[#050a0e80] rounded-lg
              text-[#e4fbf2] placeholder-[#7ddfbd60] font-mono tracking-wide text-sm
              border border-[#02b36d40] 
              focus:outline-none focus:border-[#02b36d] focus:ring-1 focus:ring-[#02b36d40]
              transition-all duration-300 shadow-inner shadow-[#00000080]
              disabled:opacity-50 disabled:cursor-not-allowed cyberpunk-input ${className}`}
    {...props}
  />
);

const TradingCard = ({ 
  tokenAddress, 
  wallets,
  selectedDex,
  setSelectedDex,
  isDropdownOpen,
  setIsDropdownOpen,
  buyAmount,
  setBuyAmount,
  sellAmount,
  setSellAmount,
  handleTradeSubmit,
  isLoading,
  dexOptions,
  validateActiveWallets,
  getScriptName,
  countActiveWallets,
  maxWalletsConfig,
  currentMarketCap,
  tokenBalances,
  onOpenFloating,
  isFloatingCardOpen
}) => {
  const [bestDex, setBestDex] = useState(null);
  const [estimatedBuyTokens, setEstimatedBuyTokens] = useState("0");
  const [estimatedSellSol, setEstimatedSellSol] = useState("0");
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  
  // Cache for route fetching with 10 sec expiry
  const [routeCache, setRouteCache] = useState(new Map());
  const CACHE_DURATION = 10000; // 10 sec in milliseconds
  
  // Helper function to generate cache key
  const generateCacheKey = (action, tokenAddress, amount) => {
    return `${action}-${tokenAddress}-${amount}`;
  };
  
  // Helper function to check if cache is valid
  const isCacheValid = (timestamp) => {
    return Date.now() - timestamp < CACHE_DURATION;
  };
  
  const handleAmountChange = (e, type) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    if (type === 'buy') setBuyAmount(value);
    else setSellAmount(value);
  };
  
  // Fetch real estimated tokens from API
  const fetchEstimatedTokens = async (amount) => {
    if (!amount || isNaN(parseFloat(amount)) || !tokenAddress) return "0";
    
    // Count active wallets
    const activeWallets = wallets.filter(wallet => wallet.isActive).length;
    if (activeWallets === 0) return "0";
    
    // Multiply amount by number of active wallets
    const totalAmount = (parseFloat(amount) * activeWallets).toString();
    console.log(`Buy estimate: ${amount} SOL × ${activeWallets} wallets = ${totalAmount} SOL total`);
    
    // Check cache first
    const cacheKey = generateCacheKey("buy", tokenAddress, totalAmount);
    const cachedData = routeCache.get(cacheKey);
    
    if (cachedData && isCacheValid(cachedData.timestamp)) {
      console.log("Using cached buy estimate");
      setEstimatedBuyTokens(cachedData.tokenAmount);
      if (cachedData.bestDex && selectedDex === 'auto') {
        setBestDex(cachedData.bestDex);
      }
      return cachedData.tokenAmount;
    }
    
    try {
      setIsLoadingEstimate(true);
      const savedConfig = loadConfigFromCookies();
      const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
      const response = await fetch(`${baseUrl}/api/tokens/route`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "buy",
          tokenMintAddress: tokenAddress,
          amount: totalAmount,
          rpcUrl: savedConfig?.rpcEndpoint || "https://api.mainnet-beta.solana.com"
        })
      });
      
      const data = await response.json();
      
      let matchedDex = null;
      if (data.success && selectedDex === 'auto') {
        // Set best DEX based on protocol returned
        const protocolToDex = {
          'pumpfun': 'pumpfun',
          'moonshot': 'moonshot',
          'pumpswap': 'pumpswap',
          'raydium': 'raydium',
          'jupiter': 'jupiter',
          'launchpad': 'launchpad',
          'boopfun': 'boopfun'
        };
        
        matchedDex = protocolToDex[data.protocol.toLowerCase()];
        if (matchedDex) {
          setBestDex(matchedDex);
        }
      }
      
      // Convert from raw token amount to readable format (assume 9 decimals for most SOL tokens)
      const tokenAmount = data.success ? 
        (parseFloat(data.outputAmount)).toFixed(2) : 
        "0";
      
      // Cache the result
      const newRouteCache = new Map(routeCache);
      newRouteCache.set(cacheKey, {
        tokenAmount,
        bestDex: matchedDex,
        timestamp: Date.now()
      });
      setRouteCache(newRouteCache);
        
      setEstimatedBuyTokens(tokenAmount);
      return tokenAmount;
    } catch (error) {
      console.error("Error fetching token estimate:", error);
      return "0";
    } finally {
      setIsLoadingEstimate(false);
    }
  };
  
  // Fetch real estimated SOL from API
  const fetchEstimatedSell = async (percentage) => {
    if (!percentage || isNaN(parseFloat(percentage)) || !tokenAddress) return "0";
    
    // We need to calculate token amount based on percentage
    const activeWallets = wallets.filter(wallet => wallet.isActive);
    if (activeWallets.length === 0) return "0";
    
    // Calculate total token balance across all active wallets
    // Using tokenBalances from the props which is a Map<string, number>
    const totalTokenBalance = activeWallets.reduce((sum, wallet) => {
      // Get the token balance from the tokenBalances map
      const balance = tokenBalances.get(wallet.address) || 0;
      return sum + balance;
    }, 0);
    
    // Calculate amount to sell based on percentage
    const sellPercentage = parseFloat(percentage);
    const tokenAmount = totalTokenBalance * (sellPercentage / 100);
    
    if (tokenAmount <= 0) return "0";
    console.log(`Selling ${sellPercentage}% of ${totalTokenBalance} tokens = ${tokenAmount} tokens (${Math.floor(tokenAmount)} raw)`);
    
    // Check cache first
    const rawTokenAmount = Math.floor(tokenAmount).toString();
    const cacheKey = generateCacheKey("sell", tokenAddress, rawTokenAmount);
    const cachedData = routeCache.get(cacheKey);
    
    if (cachedData && isCacheValid(cachedData.timestamp)) {
      console.log("Using cached sell estimate");
      setEstimatedSellSol(cachedData.solAmount);
      if (cachedData.bestDex && selectedDex === 'auto') {
        setBestDex(cachedData.bestDex);
      }
      return cachedData.solAmount;
    }
    
    try {
      
      const savedConfig = loadConfigFromCookies();
      setIsLoadingEstimate(true);
      const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
      const response = await fetch(`${baseUrl}/api/tokens/route`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "sell",
          tokenMintAddress: tokenAddress,
          amount: rawTokenAmount, // Convert to raw token amount
          rpcUrl: savedConfig?.rpcEndpoint ||"https://api.mainnet-beta.solana.com"
        })
      });
      
      const data = await response.json();
      
      let matchedDex = null;
      if (data.success && selectedDex === 'auto') {
        // Set best DEX based on protocol returned
        const protocolToDex = {
          'pumpfun': 'pumpfun',
          'moonshot': 'moonshot',
          'pumpswap': 'pumpswap',
          'raydium': 'raydium',
          'jupiter': 'jupiter',
          'launchpad': 'launchpad',
          'boopfun': 'boopfun'
        };
        
        matchedDex = protocolToDex[data.protocol.toLowerCase()];
        if (matchedDex) {
          setBestDex(matchedDex);
        }
      }
      
      // Convert from lamports to SOL (divide by 1e9)
      const solAmount = data.success ? 
        (parseFloat(data.outputAmount) / 1e9).toFixed(4) : 
        "0";
      
      // Cache the result
      const newRouteCache = new Map(routeCache);
      newRouteCache.set(cacheKey, {
        solAmount,
        bestDex: matchedDex,
        timestamp: Date.now()
      });
      setRouteCache(newRouteCache);
        
      setEstimatedSellSol(solAmount);
      return solAmount;
    } catch (error) {
      console.error("Error fetching sell estimate:", error);
      return "0";
    } finally {
      setIsLoadingEstimate(false);
    }
  };
  
  // Update estimates when amounts change (with debounce to prevent excessive API calls)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (buyAmount && parseFloat(buyAmount) > 0) {
        fetchEstimatedTokens(buyAmount);
      } else {
        setEstimatedBuyTokens("0");
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [buyAmount, tokenAddress, selectedDex]);
  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (sellAmount && parseFloat(sellAmount) > 0) {
        fetchEstimatedSell(sellAmount);
      } else {
        setEstimatedSellSol("0");
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [sellAmount, tokenAddress, selectedDex]);
  
  // Handle trade submission with the best DEX when auto is selected
  const handleTradeWithBestDex = async (wallets, isBuy) => {
    // If auto is selected, ensure we have a best DEX
    if (selectedDex === 'auto') {
      if (bestDex) {
        // Use the already determined best DEX
        handleTradeSubmit(wallets, isBuy, bestDex);
      } else {
        // Fetch the best DEX immediately if not available
        try {
          const activeWallets = wallets.filter(wallet => wallet.isActive);
          if (activeWallets.length === 0) {
            handleTradeSubmit(wallets, isBuy); // Fallback to normal flow
            return;
          }
          
          let amount;
          if (isBuy) {
            amount = buyAmount ? (parseFloat(buyAmount) * activeWallets.length).toString() : "0.01";
          } else {
            // Calculate sell amount
            const totalTokenBalance = activeWallets.reduce((sum, wallet) => {
              const balance = tokenBalances.get(wallet.address) || 0;
              return sum + balance;
            }, 0);
            const sellPercentage = sellAmount ? parseFloat(sellAmount) : 100;
            const tokenAmount = totalTokenBalance * (sellPercentage / 100);
            amount = Math.floor(tokenAmount).toString();
          }
          
          const savedConfig = loadConfigFromCookies();
          const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
          const response = await fetch(`${baseUrl}/api/tokens/route`, {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: isBuy ? "buy" : "sell",
              tokenMintAddress: tokenAddress,
              amount: amount,
              rpcUrl: savedConfig?.rpcEndpoint || "https://api.mainnet-beta.solana.com"
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            const protocolToDex = {
              'pumpfun': 'pumpfun',
              'moonshot': 'moonshot',
              'pumpswap': 'pumpswap',
              'raydium': 'raydium',
              'jupiter': 'jupiter',
              'launchpad': 'launchpad',
              'boopfun': 'boopfun'
            };
            
            const determinedDex = protocolToDex[data.protocol.toLowerCase()];
            if (determinedDex) {
              setBestDex(determinedDex);
              handleTradeSubmit(wallets, isBuy, determinedDex);
              return;
            }
          }
        } catch (error) {
          console.error("Error determining best DEX for trade:", error);
        }
        
        // Fallback to normal flow if route determination fails
        handleTradeSubmit(wallets, isBuy);
      }
    } else {
      // Normal flow with selected DEX
      handleTradeSubmit(wallets, isBuy);
    }
  };
  
  // Reference to track if we're clicking inside the dropdown
  const dropdownRef = React.useRef(null);
  
  // Cyberpunk-themed custom select component (simplified)
  const CustomSelect = () => {
    // Function to handle DEX selection
    const handleDexSelect = (dexValue, e) => {
      // Prevent event propagation
      e.stopPropagation();
      
      // Log the selection for debugging
      console.log("Selected DEX:", dexValue);
      
      // Update the selected DEX
      setSelectedDex(dexValue);
      
      // Reset best DEX if manually selecting something other than auto
      if (dexValue !== 'auto') {
        setBestDex(null);
      }
      
      // Close the dropdown
      setIsDropdownOpen(false);
    };
    
    return (
    <div className="relative w-full sm:max-w-xs" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent event from bubbling up
          setIsDropdownOpen(!isDropdownOpen);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md
                 bg-[#091217] text-[#b3f0d7] border border-[#02b36d40]
                 hover:bg-[#0a1c23] hover:border-[#02b36d80]
                 transition-all duration-300 focus:outline-none text-sm font-mono
                 ${isDropdownOpen ? 'shadow-[0_0_10px_rgba(2,179,109,0.3)]' : ''}`}
      >
        <span className="truncate flex items-center">
          {selectedDex === 'auto' && bestDex && (
            <>
              <Sparkles size={14} className="text-[#02b36d] mr-1" />
              <span>Auto • {dexOptions.find(d => d.value === bestDex)?.label || 'Best DEX'}</span>
            </>
          ) || dexOptions.find(d => d.value === selectedDex)?.label || 'Select DEX'}
        </span>
        <div className={`transform transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} className="text-[#02b36d]" />
        </div>
      </button>

      {isDropdownOpen && (
        <div 
          className="absolute z-50 w-64 mt-1 rounded-md bg-[#050a0e]
                    border border-[#02b36d40] shadow-lg shadow-[#00000080]"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
        >
          {/* Auto option at the top */}
          <button
            key="auto"
            className={`w-full px-2 py-1 text-left text-[#b3f0d7] text-xs font-mono
                   hover:bg-[#02b36d20] transition-colors duration-200 flex items-center
                   ${selectedDex === 'auto' ? 'bg-[#02b36d15] border-l-2 border-[#02b36d]' : ''}`}
            onClick={(e) => handleDexSelect('auto', e)}
          >
            <Sparkles size={12} className="text-[#02b36d] mr-1" />
            <span>Auto</span>
          </button>
          
          {/* Thin separator */}
          <div className="border-t border-[#02b36d20]"></div>
          
          {/* Other DEX options in 3 columns */}
          <div className="grid grid-cols-3 gap-0">
            {dexOptions.filter(dex => dex.value !== 'auto').map((dex) => (
              <button
                key={dex.value}
                className={`px-2 py-1 text-left text-[#b3f0d7] text-xs font-mono truncate
                       hover:bg-[#02b36d20] transition-colors duration-200
                       ${selectedDex === dex.value ? 'bg-[#02b36d15] border-l border-[#02b36d]' : ''}`}
                onClick={(e) => handleDexSelect(dex.value, e)}
              >
                {dex.label.replace('', '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  };
  
  // Cyberpunk-themed wallet counter (simplified)
  const WalletCounter = () => {
    const isBuyValid = validateActiveWallets(wallets, getScriptName(selectedDex, true)).isValid;
    const isSellValid = validateActiveWallets(wallets, getScriptName(selectedDex, false)).isValid;
    const buyLimit = maxWalletsConfig[getScriptName(selectedDex, true)];
    const sellLimit = maxWalletsConfig[getScriptName(selectedDex, false)];
    const activeWallets = countActiveWallets(wallets);

    return (
      <Tooltip content="WALLETS ACTIVE" position="top">
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-[#091217] border border-[#02b36d40]"
        >
          <Users size={14} className={`${isBuyValid && isSellValid ? 'text-[#02b36d]' : 'text-[#ff3232]'}`} />
          <div className="text-sm font-mono">
            <span className={`font-medium ${isBuyValid && isSellValid ? 'text-[#02b36d]' : 'text-[#ff3232]'}`}>
              {activeWallets}
            </span>
            <span className="text-[#7ddfbd60]">/{Math.max(buyLimit, sellLimit)}</span>
          </div>
        </div>
      </Tooltip>
    );
  };

  // Cyberpunk-themed trade button (simplified)
  const TradeButton = ({ isBuy, amount }) => (
    <Tooltip content={isBuy ? "BUY SOL" : "SELL TOKENS"} position="top">
      <button
        onClick={() => handleTradeWithBestDex(wallets, isBuy)}
        disabled={!selectedDex || !amount || isLoading || !tokenAddress}
        className={`p-2 rounded-lg border
                  transition-all duration-300
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#091217]
                  disabled:border-[#02b36d20]
                  ${isBuy 
                    ? 'bg-[#091217] hover:bg-[#02b36d20] border-[#02b36d] text-[#02b36d]' 
                    : 'bg-[#091217] hover:bg-[#ff323220] border-[#ff3232] text-[#ff3232]'}`}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin text-[#7ddfbd]" />
        ) : isBuy ? (
          <ArrowUpCircle size={16} />
        ) : (
          <ArrowDownCircle size={16} />
        )}
      </button>
    </Tooltip>
  );

  // Estimate display component with formatted numbers
  const EstimateDisplay = ({ isBuy, amount }) => {
    // Use real estimated values from API
    const estimatedValue = isBuy 
      ? estimatedBuyTokens
      : estimatedSellSol;
    
    // Format the number with k, M, B suffixes
    const formattedValue = formatNumber(estimatedValue);
      
    return (
      <div 
        className={`flex items-center justify-center gap-1 text-xs font-mono w-full px-2 py-1 rounded
                   ${isBuy 
                     ? 'text-[#02b36d80] bg-[#02b36d08] border border-[#02b36d20]' 
                     : 'text-[#ff323280] bg-[#ff323208] border border-[#ff323220]'}`}
      >
        <span className={`font-bold ${isBuy ? 'text-[#02b36d]' : 'text-[#ff3232]'}`}>
          {formattedValue}
        </span>
      </div>
    );
  };



  return (
    <>
      <div 
        className="relative overflow-hidden p-5 rounded-xl cyberpunk-border"
        style={{
          background: "linear-gradient(135deg, rgba(9,18,23,0.8) 0%, rgba(5,10,14,0.9) 100%)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(2,179,109,0.3)"
        }}
      >
        {/* Curved corners with subtle glow - all four corners - slimmer and taller */}
        {/* Top-right corner */}
        <div
          onClick={onOpenFloating}
          className="absolute top-0 right-0 w-6 h-16 cursor-pointer group z-30"
          title="Open floating trading card"
        >
          <div className="absolute top-0 right-0 w-full h-full">
            <svg
              width="24"
              height="64"
              viewBox="0 0 24 64"
              className="absolute top-0 right-0"
            >
              <path
                d="M 0 0 L 24 0 L 24 64 Q 24 32 12 32 Q 0 32 0 0 Z"
                fill="rgba(2,179,109,0.1)"
                stroke="rgba(2,179,109,0.4)"
                strokeWidth="1"
                className="transition-all duration-300 group-hover:fill-[rgba(2,179,109,0.2)] group-hover:stroke-[rgba(2,179,109,0.6)]"
              />
            </svg>
            <Move 
              size={10} 
              className="absolute top-2 right-1 text-[#02b36d80] group-hover:text-[#02b36d] transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Top-left corner */}
        <div
          onClick={onOpenFloating}
          className="absolute top-0 left-0 w-6 h-16 cursor-pointer group z-30"
          title="Open floating trading card"
        >
          <div className="absolute top-0 left-0 w-full h-full">
            <svg
              width="24"
              height="64"
              viewBox="0 0 24 64"
              className="absolute top-0 left-0 transform scale-x-[-1]"
            >
              <path
                d="M 0 0 L 24 0 L 24 64 Q 24 32 12 32 Q 0 32 0 0 Z"
                fill="rgba(2,179,109,0.1)"
                stroke="rgba(2,179,109,0.4)"
                strokeWidth="1"
                className="transition-all duration-300 group-hover:fill-[rgba(2,179,109,0.2)] group-hover:stroke-[rgba(2,179,109,0.6)]"
              />
            </svg>
            <Move 
              size={10} 
              className="absolute top-2 left-1 text-[#02b36d80] group-hover:text-[#02b36d] transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Bottom-right corner */}
        <div
          onClick={onOpenFloating}
          className="absolute bottom-0 right-0 w-6 h-16 cursor-pointer group z-30"
          title="Open floating trading card"
        >
          <div className="absolute bottom-0 right-0 w-full h-full">
            <svg
              width="24"
              height="64"
              viewBox="0 0 24 64"
              className="absolute bottom-0 right-0 transform scale-y-[-1]"
            >
              <path
                d="M 0 0 L 24 0 L 24 64 Q 24 32 12 32 Q 0 32 0 0 Z"
                fill="rgba(2,179,109,0.1)"
                stroke="rgba(2,179,109,0.4)"
                strokeWidth="1"
                className="transition-all duration-300 group-hover:fill-[rgba(2,179,109,0.2)] group-hover:stroke-[rgba(2,179,109,0.6)]"
              />
            </svg>
            <Move 
              size={10} 
              className="absolute bottom-2 right-1 text-[#02b36d80] group-hover:text-[#02b36d] transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Bottom-left corner */}
        <div
          onClick={onOpenFloating}
          className="absolute bottom-0 left-0 w-6 h-16 cursor-pointer group z-30"
          title="Open floating trading card"
        >
          <div className="absolute bottom-0 left-0 w-full h-full">
            <svg
              width="24"
              height="64"
              viewBox="0 0 24 64"
              className="absolute bottom-0 left-0 transform scale-x-[-1] scale-y-[-1]"
            >
              <path
                d="M 0 0 L 24 0 L 24 64 Q 24 32 12 32 Q 0 32 0 0 Z"
                fill="rgba(2,179,109,0.1)"
                stroke="rgba(2,179,109,0.4)"
                strokeWidth="1"
                className="transition-all duration-300 group-hover:fill-[rgba(2,179,109,0.2)] group-hover:stroke-[rgba(2,179,109,0.6)]"
              />
            </svg>
            <Move 
              size={10} 
              className="absolute bottom-2 left-1 text-[#02b36d80] group-hover:text-[#02b36d] transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Header - Title & Type selector */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between relative z-20"> 
            <CustomSelect />
            <WalletCounter />
        </div>
        <br></br>
        {/* Trading Interface - THINNER & MORE MINIMAL */}
        {!isFloatingCardOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
            {/* Buy Section */}
            <div className="space-y-2 p-2 rounded-lg border border-[#02b36d20] bg-[#02b36d08]">
              <div className="flex items-center gap-1">
                <span className="block text-xs font-medium font-mono uppercase tracking-wider text-[#02b36d]">Buy</span>
                <div className="text-xs text-[#7ddfbd60] font-mono">[SOL]</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={buyAmount}
                  onChange={(e) => handleAmountChange(e, 'buy')}
                  placeholder="0.5"
                  disabled={!tokenAddress}
                />
                <TradeButton isBuy={true} amount={buyAmount} />
              </div>
              {buyAmount && <EstimateDisplay isBuy={true} amount={buyAmount} />}
            </div>

            {/* Sell Section */}
            <div className="space-y-2 p-2 rounded-lg border border-[#ff323220] bg-[#ff323208]">
              <div className="flex items-center gap-1">
                <span className="block text-xs font-medium font-mono uppercase tracking-wider text-[#ff3232]">Sell</span>
                <div className="text-xs text-[#ff323260] font-mono">[%]</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={sellAmount}
                  onChange={(e) => handleAmountChange(e, 'sell')}
                  placeholder="20"
                  disabled={!tokenAddress}
                  className="border-[#ff323240] focus:border-[#ff3232] focus:ring-[#ff323240]"
                />
                <TradeButton isBuy={false} amount={sellAmount} />
              </div>
              {sellAmount && <EstimateDisplay isBuy={false} amount={sellAmount} />}
            </div>
          </div>
        )}
        {/* Show message when floating card is open */}
        {isFloatingCardOpen && (
          <div className="text-center py-8">
            <div className="text-[#02b36d] font-mono text-sm">
              Close the draggable trading view to go back to default view.
            </div>
          </div>
        )}
      </div>

    </>
  );
};

export default TradingCard;