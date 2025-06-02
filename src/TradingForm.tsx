import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, ArrowDownCircle, ArrowUpCircle, Loader2, Sparkles } from 'lucide-react';

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
  tokenBalances
}) => {
  const [bestDex, setBestDex] = useState(null);
  const [estimatedBuyTokens, setEstimatedBuyTokens] = useState("0");
  const [estimatedSellSol, setEstimatedSellSol] = useState("0");
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  
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
    
    try {
      setIsLoadingEstimate(true);
      const response = await fetch('https://solana.Raze.bot/api/tokens/route', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "buy",
          tokenMintAddress: tokenAddress,
          amount: totalAmount,
          rpcUrl: "https://api.mainnet-beta.solana.com"
        })
      });
      
      const data = await response.json();
      
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
        
        const matchedDex = protocolToDex[data.protocol.toLowerCase()];
        if (matchedDex) {
          setBestDex(matchedDex);
        }
      }
      
      // Convert from raw token amount to readable format (assume 9 decimals for most SOL tokens)
      const tokenAmount = data.success ? 
        (parseFloat(data.outputAmount) / 1e9).toFixed(2) : 
        "0";
        
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
    console.log(`Selling ${sellPercentage}% of ${totalTokenBalance} tokens = ${tokenAmount} tokens (${Math.floor(tokenAmount * 1e9)} raw)`);
    
    try {
      setIsLoadingEstimate(true);
      const response = await fetch('https://solana.Raze.bot/api/tokens/route', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "sell",
          tokenMintAddress: tokenAddress,
          amount: Math.floor(tokenAmount * 1e9).toString(), // Convert to raw token amount
          rpcUrl: "https://api.mainnet-beta.solana.com"
        })
      });
      
      const data = await response.json();
      
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
        
        const matchedDex = protocolToDex[data.protocol.toLowerCase()];
        if (matchedDex) {
          setBestDex(matchedDex);
        }
      }
      
      // Convert from lamports to SOL (divide by 1e9)
      const solAmount = data.success ? 
        (parseFloat(data.outputAmount) / 1e9).toFixed(4) : 
        "0";
        
      setEstimatedSellSol(solAmount);
      return solAmount;
    } catch (error) {
      console.error("Error fetching sell estimate:", error);
      return "0";
    } finally {
      setIsLoadingEstimate(false);
    }
  };
  
  // Update estimates when amounts change
  useEffect(() => {
    if (buyAmount && parseFloat(buyAmount) > 0) {
      fetchEstimatedTokens(buyAmount);
    } else {
      setEstimatedBuyTokens("0");
    }
  }, [buyAmount, tokenAddress, selectedDex]);
  
  useEffect(() => {
    if (sellAmount && parseFloat(sellAmount) > 0) {
      fetchEstimatedSell(sellAmount);
    } else {
      setEstimatedSellSol("0");
    }
  }, [sellAmount, tokenAddress, selectedDex]);
  
  // Handle trade submission with the best DEX when auto is selected
  const handleTradeWithBestDex = (wallets, isBuy) => {
    // If auto is selected and we have a best DEX, use that for the trade
    // but keep the UI showing "auto"
    if (selectedDex === 'auto' && bestDex) {
      // Call the handleTradeSubmit with the best DEX instead of 'auto'
      handleTradeSubmit(wallets, isBuy, bestDex);
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

  // Estimate display component (simplified)
  const EstimateDisplay = ({ isBuy, amount }) => {
    // Use real estimated values from API
    const estimatedValue = isBuy 
      ? estimatedBuyTokens
      : estimatedSellSol;
      
    return (
      <div 
        className={`flex items-center justify-center gap-1 text-xs font-mono w-full px-2 py-1 rounded
                   ${isBuy 
                     ? 'text-[#02b36d80] bg-[#02b36d08] border border-[#02b36d20]' 
                     : 'text-[#ff323280] bg-[#ff323208] border border-[#ff323220]'}`}
      >
        <span className={`font-bold ${isBuy ? 'text-[#02b36d]' : 'text-[#ff3232]'}`}>
          {estimatedValue}
        </span>
      </div>
    );
  };

  return (
    <div 
      className="relative overflow-hidden p-5 rounded-xl cyberpunk-border"
      style={{
        background: "linear-gradient(135deg, rgba(9,18,23,0.8) 0%, rgba(5,10,14,0.9) 100%)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(2,179,109,0.3)"
      }}
    >
      {/* Header - Title & Type selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between relative z-20"> 
          <CustomSelect />
          <WalletCounter />
      </div>
      <br></br>
      {/* Trading Interface - THINNER & MORE MINIMAL */}
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
    </div>
  );
};

export default TradingCard;