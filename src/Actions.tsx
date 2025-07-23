import React, { useEffect, useState } from 'react';
import {
   Download, 
   Settings2,
   ChevronDown, 
   Share2,
   Waypoints,
   Blocks,
   Trash2,
   ChartSpline,
   Send,
   Workflow,
   Sparkles,
   Activity,
   TrendingUp,
   Users,
   BarChart,
   Coins
 } from 'lucide-react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { WalletType, loadConfigFromCookies } from "./Utils";
import { useToast } from "./Notifications";
import { countActiveWallets, getScriptName } from './utils/wallets';
import TradingCard from './TradingForm';

import { executeTrade } from './utils/trading';

// Enhanced cyberpunk-styled Switch component (simplified)
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={`
      peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
      border-2 border-[#02b36d40] transition-colors duration-300
      focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-[#02b36d] focus-visible:ring-offset-2
      focus-visible:ring-offset-[#050a0e] disabled:cursor-not-allowed
      disabled:opacity-50 data-[state=checked]:bg-[#02b36d] data-[state=unchecked]:bg-[#0a1419]
      relative overflow-hidden ${className}`}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={`
        pointer-events-none block h-5 w-5 rounded-full
        bg-white shadow-lg ring-0 transition-transform
        data-[state=checked]:translate-x-5 data-[state=checked]:bg-[#e4fbf2]
        data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-[#7ddfbd]`}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

interface ActionsPageProps {
  tokenAddress: string;
  transactionFee: string;
  handleRefresh: () => void;
  wallets: WalletType[];
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
  currentMarketCap: number | null;
  setBurnModalOpen: (open: boolean) => void;
  setCalculatePNLModalOpen: (open: boolean) => void;
  setDeployModalOpen: (open: boolean) => void;
  setCleanerTokensModalOpen: (open: boolean) => void;
  setCustomBuyModalOpen: (open: boolean) => void;
  onOpenFloating: () => void;
  isFloatingCardOpen: boolean;
  iframeData?: {
    tradingStats: any;
    solPrice: number | null;
    currentWallets: any[];
    recentTrades: {
      type: 'buy' | 'sell';
      address: string;
      tokensAmount: number;
      avgPrice: number;
      solAmount: number;
      timestamp: number;
      signature: string;
    }[];
    tokenPrice: {
      tokenPrice: number;
      tokenMint: string;
      timestamp: number;
      tradeType: 'buy' | 'sell';
      volume: number;
    } | null;
  } | null;
}

// Simplified Tooltip component without animations
export const Tooltip = ({ 
  children, 
  content,
  position = 'top'
}: { 
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-[#051014] border border-[#02b36d40] text-[#02b36d] text-xs px-2 py-1 rounded 
                         shadow-lg shadow-[#02b36d20] whitespace-nowrap font-mono tracking-wide">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};
// Cyberpunk-themed DataBox with minimal clean column layout
const DataBox: React.FC<{
  iframeData?: {
    tradingStats: any;
    solPrice: number | null;
    currentWallets: any[];
    recentTrades: {
      type: 'buy' | 'sell';
      address: string;
      tokensAmount: number;
      avgPrice: number;
      solAmount: number;
      timestamp: number;
      signature: string;
    }[];
    tokenPrice: {
      tokenPrice: number;
      tokenMint: string;
      timestamp: number;
      tradeType: 'buy' | 'sell';
      volume: number;
    } | null;
  } | null;
  tokenAddress: string;
  tokenBalances: Map<string, number>;
}> = ({ iframeData, tokenAddress, tokenBalances }) => {
  if (!tokenAddress || !iframeData) return null;

  const { tradingStats, solPrice, currentWallets, recentTrades, tokenPrice } = iframeData;

  // Calculate holdings value
  const totalTokens = Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);
  const currentTokenPrice = tokenPrice?.tokenPrice || 0;
  const holdingsValue = totalTokens * currentTokenPrice;

  return (
    <div className="mb-4">
      <div className="bg-gradient-to-br from-[#0a141980] to-[#05080a80] backdrop-blur-sm rounded-xl p-6 shadow-xl border border-[#02b36d20] relative overflow-hidden">
        
        {/* Cyberpunk accent lines */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#02b36d40] to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#02b36d40] to-transparent"></div>
        
        {/* Main stats grid - clean 4-column layout */}
        <div className="grid grid-cols-4 gap-8 relative z-10">
          
          {/* Bought */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-[#7ddfbd80] uppercase mb-2 font-medium">
              Bought
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-[#02b36d] font-mono tracking-tight">
                {tradingStats ? tradingStats.bought.toFixed(2) : '0.00'}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-[#02b36d] rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#02b36d] rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#02b36d] rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* Sold */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-[#7ddfbd80] uppercase mb-2 font-medium">
              Sold
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-[#ff6b6b] font-mono tracking-tight">
                {tradingStats ? tradingStats.sold.toFixed(2) : '0.00'}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-[#ff6b6b] rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#ff6b6b] rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#ff6b6b] rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* Holding */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-[#7ddfbd80] uppercase mb-2 font-medium">
              Holding
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-[#7ddfbd] font-mono tracking-tight">
                {holdingsValue.toFixed(2)}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-[#7ddfbd] rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#7ddfbd] rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-[#7ddfbd] rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* PnL */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-[#7ddfbd80] uppercase mb-2 font-medium">
              PnL
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-lg font-bold font-mono tracking-tight ${
                tradingStats && tradingStats.net >= 0 ? 'text-[#02b36d]' : 'text-[#ff6b6b]'
              }`}>
                {tradingStats ? (
                  <div>
                    {tradingStats.net >= 0 ? '+' : ''}{tradingStats.net.toFixed(2)}
                  </div>
                ) : (
                  <div>+0.00</div>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className={`w-2 h-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity ${
                  tradingStats && tradingStats.net >= 0 ? 'bg-[#02b36d]' : 'bg-[#ff6b6b]'
                }`}></div>
                <div className={`w-2 h-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity ${
                  tradingStats && tradingStats.net >= 0 ? 'bg-[#02b36d]' : 'bg-[#ff6b6b]'
                }`}></div>
                <div className={`w-2 h-0.5 rounded opacity-40 group-hover:opacity-100 transition-opacity ${
                  tradingStats && tradingStats.net >= 0 ? 'bg-[#02b36d]' : 'bg-[#ff6b6b]'
                }`}></div>
              </div>
            </div>
          </div>

        </div>

        {/* Minimal footer info */}
        {currentWallets && currentWallets.length > 0 && (
          <div className="mt-8 pt-4 border-t border-[#02b36d20]">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="w-2 h-2 rounded-full bg-[#02b36d] animate-pulse"></div>
                <span className="text-[#7ddfbd] font-mono text-xs tracking-wider">
                  {currentWallets.length} ACTIVE
                </span>
              </div>
              {tradingStats && (
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-[#02b36d]"></div>
                  <span className="text-[#7ddfbd] font-mono text-xs tracking-wider">
                    {tradingStats.trades} TRADES
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d05] to-transparent pointer-events-none"></div>
        
      </div>
    </div>
  );
};
export const ActionsPage: React.FC<ActionsPageProps> = ({ 
  tokenAddress, 
  transactionFee, 
  handleRefresh, 
  wallets, 
  solBalances, 
  tokenBalances, 
  currentMarketCap,
  setBurnModalOpen,
  setCalculatePNLModalOpen,
  setDeployModalOpen,
  setCleanerTokensModalOpen,
  setCustomBuyModalOpen,
  onOpenFloating,
  isFloatingCardOpen,
  iframeData
}) => {
  // State management (no changes)
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [selectedDex, setSelectedDex] = useState('auto'); // Default to auto
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const { showToast } = useToast();


  const dexOptions = [
    { value: 'auto', label: '⭐ Auto', icon: '⭐' },
    { value: 'pumpfun', label: 'PumpFun' },
    { value: 'moonshot', label: 'Moonshot' },
    { value: 'pumpswap', label: 'PumpSwap' },
    { value: 'raydium', label: 'Raydium' },
    { value: 'launchpad', label: 'Launchpad' },
    { value: 'boopfun', label: 'BoopFun' },
  ];
  
  const handleTradeSubmit = async (wallets: WalletType[], isBuyMode: boolean, dex?: string, buyAmount?: string, sellAmount?: string) => {
    setIsLoading(true);
    
    if (!tokenAddress) {
      showToast("Please select a token first", "error");
      setIsLoading(false);
      return;
    }
    
    try {
      // Use the provided dex parameter if available, otherwise use selectedDex
      const dexToUse = dex || selectedDex;
      
      // Create trading config
       const config = {
         tokenAddress: tokenAddress,
         ...(isBuyMode 
           ? { solAmount: parseFloat(buyAmount || '0') }
           : { sellPercent: parseFloat(sellAmount || '0') }
         )
       };
      
      console.log(`Executing ${isBuyMode ? 'Buy' : 'Sell'} on ${dexToUse} for ${tokenAddress}`);
      
      // Execute trade using centralized logic
      const result = await executeTrade(dexToUse, wallets, config, isBuyMode, solBalances);
      
      if (result.success) {
        showToast(`${dexToUse} ${isBuyMode ? 'Buy' : 'Sell'} transactions submitted successfully`, "success");
      } else {
        showToast(`${dexToUse} ${isBuyMode ? 'Buy' : 'Sell'} failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error(`Trading error:`, error);
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050a0e] p-4 md:p-6 relative">
      {/* Background effects - keeping original */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[#050a0e] opacity-90">
          <div className="absolute inset-0 bg-gradient-to-b from-[#02b36d05] to-transparent"></div>
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(2, 179, 109, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(2, 179, 109, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: 'center center',
            }}
          ></div>
        </div>
        
        {/* Glowing corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
          <div className="absolute top-0 left-0 w-px h-16 bg-gradient-to-b from-[#02b36d] to-transparent"></div>
          <div className="absolute top-0 left-0 w-16 h-px bg-gradient-to-r from-[#02b36d] to-transparent"></div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
          <div className="absolute top-0 right-0 w-px h-16 bg-gradient-to-b from-[#02b36d] to-transparent"></div>
          <div className="absolute top-0 right-0 w-16 h-px bg-gradient-to-l from-[#02b36d] to-transparent"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 opacity-20">
          <div className="absolute bottom-0 left-0 w-px h-16 bg-gradient-to-t from-[#02b36d] to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-16 h-px bg-gradient-to-r from-[#02b36d] to-transparent"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-20">
          <div className="absolute bottom-0 right-0 w-px h-16 bg-gradient-to-t from-[#02b36d] to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-16 h-px bg-gradient-to-l from-[#02b36d] to-transparent"></div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Trading Card (unchanged) */}
        <TradingCard
          tokenAddress={tokenAddress}
          wallets={wallets}
          selectedDex={selectedDex}
          setSelectedDex={setSelectedDex}
          isDropdownOpen={isDropdownOpen}
          setIsDropdownOpen={setIsDropdownOpen}
          buyAmount={buyAmount}
          setBuyAmount={setBuyAmount}
          sellAmount={sellAmount}
          setSellAmount={setSellAmount}
          handleTradeSubmit={handleTradeSubmit}
          isLoading={isLoading}
          dexOptions={dexOptions}
          getScriptName={getScriptName}
          countActiveWallets={countActiveWallets}
          currentMarketCap={currentMarketCap}
          tokenBalances={tokenBalances}
          onOpenFloating={onOpenFloating}
          isFloatingCardOpen={isFloatingCardOpen}
        />
        
        {/* Token Operations */}
        <div className="space-y-4">          
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
              {/* Cleaner Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCleanerTokensModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30] hover:border-[#02b36d60]
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg">
                  <Waypoints size={20} className="text-[#02b36d]" />
                </div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Cleaner</span>
              </button>
              
              {/* Deploy Button */}
              <button
                onClick={() => setDeployModalOpen(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30] hover:border-[#02b36d60]
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg">
                  <Blocks size={20} className="text-[#02b36d]" />
                </div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Deploy</span>
              </button>
              
              {/* Burn Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setBurnModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30] hover:border-[#02b36d60]
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg">
                  <Trash2 size={20} className="text-[#02b36d]" />
                </div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Burn</span>
              </button>
              
              {/* Stagger Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCustomBuyModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30] hover:border-[#02b36d60]
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg">
                  <Workflow size={20} className="text-[#02b36d]" />
                </div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Stagger</span>
              </button>
          </div>
          
          {/* Live Data Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg">
                  <Activity size={16} className="text-[#02b36d]" />
                </div>
                <span className="font-mono text-sm tracking-wider text-[#7ddfbd] uppercase">Live Data</span>
              </div>
              
              {/* Share PNL Button moved next to Live Data */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCalculatePNLModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                          bg-gradient-to-r from-[#02b36d] to-[#01a35f] hover:from-[#01a35f] hover:to-[#029359]
                          shadow-md shadow-[#02b36d40] hover:shadow-[#02b36d60]
                          transition-all duration-300 relative overflow-hidden"
              >
                <ChartSpline size={16} className="text-black relative z-10" />
                <span className="text-sm font-mono tracking-wider text-black font-medium relative z-10">Share PNL</span>
              </button>
            </div>
            <DataBox iframeData={iframeData} tokenAddress={tokenAddress} tokenBalances={tokenBalances} />
          </div>
        </div>
      </div>

      <br></br>
      
      {/* Enhanced GitHub & Website Section */}
      <div className="mb-4 mx-auto max-w-4xl">
        <div className="bg-gradient-to-br from-[#0a141950] to-[#05080a50] backdrop-blur-sm 
                     rounded-xl p-4 relative overflow-hidden border border-[#02b36d10] 
                     hover:border-[#02b36d30] transition-all duration-300">
          
          {/* Header */}
          <div className="flex items-center mb-3">
            <svg 
              viewBox="0 0 24 24" 
              width="20" 
              height="20" 
              className="text-[#02b36d] mr-2"
            >
              <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.934.359.31.678.92.678 1.855 0 1.337-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            <span className="text-sm font-mono tracking-wider text-[#7ddfbd] font-semibold">
              OPEN SOURCE PROJECT
            </span>
          </div>
          
          {/* Description */}
          <p className="text-xs text-[#7ddfbd80] mb-4 leading-relaxed">
            Built with transparency in mind. Explore the code, contribute, or fork for your own use.
          </p>
          
          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Main Website Link */}
            <a 
              href="https://raze.bot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center py-2 px-4 rounded-lg bg-gradient-to-r 
                         from-[#02b36d] to-[#02b36d90] text-black font-mono text-xs font-semibold
                         hover:from-[#02b36d90] hover:to-[#02b36d] 
                         transition-all duration-300 transform hover:scale-105"
            >
              <svg 
                viewBox="0 0 24 24" 
                width="16" 
                height="16" 
                className="mr-2"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              RAZE.BOT
            </a>
            
            {/* GitHub Link */}
            <a 
              href="https://github.com/razedotbot/solana-ui/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center py-2 px-4 rounded-lg bg-gradient-to-r 
                         from-[#02b36d20] to-[#02b36d10] border border-[#02b36d30]
                         hover:from-[#02b36d30] hover:to-[#02b36d20] 
                         transition-all duration-300 transform hover:scale-105"
            >
              <svg 
                viewBox="0 0 24 24" 
                width="16" 
                height="16" 
                className="mr-2 text-[#02b36d]"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.934.359.31.678.92.678 1.855 0 1.337-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              <span className="text-xs font-mono tracking-wider text-[#02b36d] font-semibold">
                @RAZEDOTBOT
              </span>
            </a>
          </div>
        </div>
      </div>
      
    </div>
  );
};