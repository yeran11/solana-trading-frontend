import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Workflow
} from 'lucide-react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { WalletType } from "./Utils";
import { useToast } from "./Notifications";
import { countActiveWallets, validateActiveWallets, getScriptName, maxWalletsConfig } from './Wallets';
import TradingCard from './TradingForm';

import { executePumpSell, validatePumpSellInputs } from './utils/pumpsell';
import { executePumpBuy, validatePumpBuyInputs } from './utils/pumpbuy';

// Enhanced cyberpunk-styled Switch component
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
    {/* Glow effect */}
    <span className="absolute inset-0 data-[state=checked]:bg-[#02b36d20] data-[state=unchecked]:bg-transparent
                    data-[state=checked]:blur-md transition-all duration-300"></span>
    
    <SwitchPrimitive.Thumb
      className={`
        pointer-events-none block h-5 w-5 rounded-full
        bg-white shadow-lg ring-0 transition-transform
        data-[state=checked]:translate-x-5 data-[state=checked]:bg-[#e4fbf2]
        data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-[#7ddfbd]
        data-[state=checked]:shadow-[0_0_8px_2px_rgba(2,179,109,0.7)]`}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

// Enhanced cyberpunk-styled Label component
const Label: React.FC<React.HTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={`text-sm font-mono tracking-wide text-[#7ddfbd] ${className}`} {...props} />
);

// Enhanced cyberpunk-styled Input component
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    className={`
      flex h-10 w-full rounded-md border border-[#02b36d40]
      bg-[#0a1419] px-3 py-2 text-sm text-[#e4fbf2] font-mono
      focus:outline-none focus:border-[#02b36d] focus:ring-2 focus:ring-[#02b36d20]
      focus:ring-offset-1 focus:ring-offset-[#0a1419]
      disabled:cursor-not-allowed disabled:opacity-50
      transition-all duration-300 ${className}`}
    {...props}
  />
);

interface ActionsPageProps {
  tokenAddress: string;
  transactionFee: string;
  ammKey: string | null;
  handleRefresh: () => void;
  wallets: WalletType[];
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
  // Add modal state control props
  setBurnModalOpen: (open: boolean) => void;
  setCalculatePNLModalOpen: (open: boolean) => void;
  setDeployModalOpen: (open: boolean) => void;
  setCleanerTokensModalOpen: (open: boolean) => void;
  setCustomBuyModalOpen: (open: boolean) => void;
}

// Enhanced cyberpunk-styled Tooltip component
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
        <motion.div 
          initial={{ opacity: 0, y: position === 'top' ? 10 : position === 'bottom' ? -10 : 0, 
                     x: position === 'left' ? 10 : position === 'right' ? -10 : 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          className={`absolute z-50 ${positionClasses[position]}`}
        >
          <div className="bg-[#051014] border border-[#02b36d40] text-[#02b36d] text-xs px-2 py-1 rounded 
                         shadow-lg shadow-[#02b36d20] whitespace-nowrap font-mono tracking-wide">
            {content}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const ActionsPage: React.FC<ActionsPageProps> = ({
  tokenAddress,
  transactionFee,
  handleRefresh,
  wallets,
  ammKey,
  solBalances,
  tokenBalances,
  // Destructure modal state control props
  setBurnModalOpen,
  setCalculatePNLModalOpen,
  setDeployModalOpen,
  setCleanerTokensModalOpen,
  setCustomBuyModalOpen
}) => {
  // State management (no changes)
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [selectedDex, setSelectedDex] = useState('jupiter');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const { showToast } = useToast();

  // Token price fetching effect (unchanged)
  useEffect(() => {
    const fetchTokenPrice = async () => {
      if (!tokenAddress) {
        setTokenPrice(null);
        return;
      }
      
      try {
        setPriceLoading(true);
        const response = await fetch(`https://api.jup.ag/price/v2?ids=${tokenAddress}`);
        const data = await response.json();
        setTokenPrice(data.data[tokenAddress]?.price || null);
      } catch (error) {
        console.error('Error fetching token price:', error);
        showToast('Failed to fetch token price', 'error');
        setTokenPrice("0");
      } finally {
        setPriceLoading(false);
      }
    };
  
    fetchTokenPrice();
  }, [tokenAddress, showToast]);

  const dexOptions = [
    { value: 'pumpfun', label: 'PumpFun' },
    { value: 'moonshot', label: 'Moonshot' },
    { value: 'pumpswap', label: 'PumpSwap' },
    { value: 'raydium', label: 'Raydium' },
    { value: 'jupiter', label: 'Jupiter' },
  ];
  
  const handleTradeSubmit = async (wallets: WalletType[], isBuyMode: boolean) => {
    setIsLoading(true);
    
    if (!tokenAddress) {
      showToast("Please select a token first", "error");
      setIsLoading(false);
      return;
    }
    // Replace the moonshot branch in handleTradeSubmit with this implementation
    if (selectedDex === 'moonshot') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for MoonBuy/MoonSell
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // MoonBuy flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            solAmount: parseFloat(buyAmount)
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateMoonBuyInputs, executeMoonBuy } = await import('./utils/moonbuy');
          
          const validation = validateMoonBuyInputs(formattedWallets, tokenConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing MoonBuy for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute MoonBuy operation
          const result = await executeMoonBuy(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("MoonBuy transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`MoonBuy failed: ${result.error}`, "error");
          }
        } else {
          // MoonSell flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            sellPercent: parseFloat(sellAmount)
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = tokenBalances.get(wallet.address) || 0;
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateMoonSellInputs, executeMoonSell } = await import('./utils/moonsell');
          
          const validation = validateMoonSellInputs(formattedWallets, tokenConfig, tokenBalanceMap);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing MoonSell for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute MoonSell operation
          const result = await executeMoonSell(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("MoonSell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`MoonSell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Moonshot ${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Special handling for PumpFun operations with client-side transaction signing
    if (selectedDex === 'pumpfun') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for PumpBuy/PumpSell
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // PumpBuy flow 
          const tokenConfig = {
            tokenAddress: tokenAddress,
            solAmount: parseFloat(buyAmount)
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Validate inputs before executing
          const validation = validatePumpBuyInputs(formattedWallets, tokenConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing PumpBuy for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute PumpBuy operation
          const result = await executePumpBuy(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("PumpBuy transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`PumpBuy failed: ${result.error}`, "error");
          }
        } else {
          // PumpSell flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            sellPercent: parseFloat(sellAmount)
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = tokenBalances.get(wallet.address) || 0;
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Validate inputs before executing
          const validation = validatePumpSellInputs(formattedWallets, tokenConfig, tokenBalanceMap);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing PumpSell for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute PumpSell operation
          const result = await executePumpSell(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("PumpSell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`PumpSell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Pump${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Special handling for Jupiter operations with client-side transaction signing
    if (selectedDex === 'jupiter') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for Jupiter operations
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // Jupiter Buy flow - implementation unchanged
          const swapConfig = {
            inputMint: "So11111111111111111111111111111111111111112", // SOL
            outputMint: tokenAddress,
            solAmount: parseFloat(buyAmount),
            slippageBps: 9900 // Default to 1% slippage
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateJupSwapInputs, executeJupSwap } = await import('./utils/jupbuy');
          
          const validation = validateJupSwapInputs(formattedWallets, swapConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing Jupiter Swap (Buy) for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute JupSwap operation
          const result = await executeJupSwap(formattedWallets, swapConfig);
          
          if (result.success) {
            showToast("Jupiter Buy transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`Jupiter Buy failed: ${result.error}`, "error");
          }
        } else {
          // Jupiter Sell flow - implementation unchanged
          const sellConfig = {
            inputMint: tokenAddress, // Token to sell
            outputMint: "So11111111111111111111111111111111111111112", // SOL
            sellPercent: parseFloat(sellAmount), // Percentage of tokens to sell
            slippageBps: 9900 // Default to 1% slippage
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, bigint>();
          activeWallets.forEach(wallet => {
            // Convert to bigint for compatibility with selljup validation
            const balance = BigInt(Math.floor((tokenBalances.get(wallet.address) || 0) * 1e9));
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Import the dedicated sell functions from selljup
          const { validateJupSellInputs, executeJupSell } = await import('./utils/jupsell');
          
          
          console.log(`Executing Jupiter Sell for ${tokenAddress} with ${activeWallets.length} wallets (${sellConfig.sellPercent}%)`);
          
          // Execute JupSell operation with RPC URL
          const result = await executeJupSell(formattedWallets, sellConfig);
          
          if (result.success) {
            showToast("Jupiter Sell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`Jupiter Sell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Jupiter ${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
  
    // Replace the raydium branch in handleTradeSubmit with this implementation
    if (selectedDex === 'raydium') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for RayBuy/Ray
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // Ray flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            solAmount: parseFloat(buyAmount)
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateRayBuyInputs, executeRayBuy } = await import('./utils/raybuy');
          
          const validation = validateRayBuyInputs(formattedWallets, tokenConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing RayBuy for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute MoonBuy operation
          const result = await executeRayBuy(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("RayBuy transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`RayBuy failed: ${result.error}`, "error");
          }
        } else {
          // RaySell flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            sellPercent: parseFloat(sellAmount)
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = tokenBalances.get(wallet.address) || 0;
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateRaySellInputs, executeRaySell } = await import('./utils/raysell');
          
          const validation = validateRaySellInputs(formattedWallets, tokenConfig, tokenBalanceMap);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing RaySell for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute RaySell operation
          const result = await executeRaySell(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("RaySell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`RaySell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Moonshot ${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    // Replace the raydium branch in handleTradeSubmit with this implementation
    if (selectedDex === 'launchpad') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for RayBuy/Ray
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // Ray flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            solAmount: parseFloat(buyAmount)
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateLaunchBuyInputs, executeLaunchBuy } = await import('./utils/launchbuy');
          
          const validation = validateLaunchBuyInputs(formattedWallets, tokenConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing RayBuy for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute MoonBuy operation
          const result = await executeLaunchBuy(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("RayBuy transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`RayBuy failed: ${result.error}`, "error");
          }
        } else {
          // RaySell flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            sellPercent: parseFloat(sellAmount)
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = tokenBalances.get(wallet.address) || 0;
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateLaunchSellInputs, executeLaunchSell } = await import('./utils/launchsell');
          
          const validation = validateLaunchSellInputs(formattedWallets, tokenConfig, tokenBalanceMap);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing RaySell for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute RaySell operation
          const result = await executeLaunchSell(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("RaySell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`RaySell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Moonshot ${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Replace the pumpswap branch in handleTradeSubmit with this implementation
    if (selectedDex === 'pumpswap') {
      try {
        // Get active wallets
        const activeWallets = wallets.filter(wallet => wallet.isActive);
        
        if (activeWallets.length === 0) {
          showToast("Please activate at least one wallet", "error");
          setIsLoading(false);
          return;
        }
        
        // Format wallets for MoonBuy/MoonSell
        const formattedWallets = activeWallets.map(wallet => ({
          address: wallet.address,
          privateKey: wallet.privateKey
        }));
        
        if (isBuyMode) {
          // MoonBuy flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            solAmount: parseFloat(buyAmount)
          };
          
          // Create a balance map for validation
          const walletBalances = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = solBalances.get(wallet.address) || 0;
            walletBalances.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateSwapBuyInputs, executeSwapBuy } = await import('./utils/swapbuy');
          
          const validation = validateSwapBuyInputs(formattedWallets, tokenConfig, walletBalances);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing Swap for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute Swap operation
          const result = await executeSwapBuy(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("Swap transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`MoonBuy failed: ${result.error}`, "error");
          }
        } else {
          // MoonSell flow - implementation unchanged
          const tokenConfig = {
            tokenAddress: tokenAddress,
            sellPercent: parseFloat(sellAmount)
          };
          
          // Create a token balance map for validation
          const tokenBalanceMap = new Map<string, number>();
          activeWallets.forEach(wallet => {
            const balance = tokenBalances.get(wallet.address) || 0;
            tokenBalanceMap.set(wallet.address, balance);
          });
          
          // Import and validate inputs before executing
          const { validateSwapSellInputs, executeSwapSell } = await import('./utils/swapsell');
          
          const validation = validateSwapSellInputs(formattedWallets, tokenConfig, tokenBalanceMap);
          if (!validation.valid) {
            showToast(`Validation failed: ${validation.error}`, "error");
            setIsLoading(false);
            return;
          }
          
          console.log(`Executing MoonSell for ${tokenAddress} with ${activeWallets.length} wallets`);
          
          // Execute MoonSell operation
          const result = await executeSwapSell(formattedWallets, tokenConfig);
          
          if (result.success) {
            showToast("MoonSell transactions submitted successfully", "success");
            handleRefresh(); // Refresh balances
          } else {
            showToast(`MoonSell failed: ${result.error}`, "error");
          }
        }
      } catch (error) {
        console.error(`Moonshot ${isBuyMode ? 'Buy' : 'Sell'} error:`, error);
        showToast(`Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    },
    hover: { 
      scale: 1.05,
      boxShadow: "0px 10px 20px rgba(2, 179, 109, 0.2)",
      transition: { type: "spring", stiffness: 400, damping: 10 }
    }
  };

  const statsVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };
  
  // Cyberpunk grid background with scanlines
  const backgroundElement = (
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
      
      {/* Scanline effect */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute w-full h-8 bg-gradient-to-b from-transparent via-[#02b36d10] to-transparent"
          animate={{ top: ['-10%', '120%'] }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: "linear",
            repeatType: "loop"
          }}
        ></motion.div>
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
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto bg-[#050a0e] p-4 md:p-6 relative"
    >
      {/* Background effects */}
      {backgroundElement}
      
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
          validateActiveWallets={validateActiveWallets}
          getScriptName={getScriptName}
          countActiveWallets={countActiveWallets}
          maxWalletsConfig={maxWalletsConfig}
        />
        
        {/* Token Operations */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg"
            >
              <Settings2 size={16} className="text-[#02b36d]" />
            </motion.div>
            <span className="font-mono text-sm tracking-wider text-[#7ddfbd] uppercase">Token Operations</span>
          </motion.div>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="bg-gradient-to-br from-[#0a141980] to-[#05080a80] backdrop-blur-sm rounded-xl p-4 shadow-xl border border-[#02b36d20] relative overflow-hidden"
          >
            {/* Highlight effect */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-[#02b36d05] to-transparent"
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
              {/* Cleaner Button */}
              <motion.button
                variants={itemVariants}
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
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
                <motion.div 
                  className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg"
                  animate={{ 
                    boxShadow: ["0px 0px 0px rgba(2, 179, 109, 0)", "0px 0px 8px rgba(2, 179, 109, 0.5)", "0px 0px 0px rgba(2, 179, 109, 0)"],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Waypoints size={20} className="text-[#02b36d]" />
                </motion.div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Cleaner</span>
              </motion.button>
              
              {/* Deploy Button */}
              <motion.button
                variants={itemVariants}
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeployModalOpen(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30] hover:border-[#02b36d60]
                          transition-all duration-300"
              >
                <motion.div 
                  className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg"
                  animate={{ 
                    boxShadow: ["0px 0px 0px rgba(2, 179, 109, 0)", "0px 0px 8px rgba(2, 179, 109, 0.5)", "0px 0px 0px rgba(2, 179, 109, 0)"],
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                >
                  <Blocks size={20} className="text-[#02b36d]" />
                </motion.div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Deploy</span>
              </motion.button>
              
              {/* Burn Button */}
              <motion.button
                variants={itemVariants}
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
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
                <motion.div 
                  className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg"
                  animate={{ 
                    boxShadow: ["0px 0px 0px rgba(2, 179, 109, 0)", "0px 0px 8px rgba(2, 179, 109, 0.5)", "0px 0px 0px rgba(2, 179, 109, 0)"],
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                >
                  <Trash2 size={20} className="text-[#02b36d]" />
                </motion.div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">Burn</span>
              </motion.button>
              
              {/* PumpBuy Button */}
              <motion.button
                variants={itemVariants}
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
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
                <motion.div 
                  className="p-3 bg-gradient-to-br from-[#02b36d20] to-[#02b36d05] rounded-lg"
                  animate={{ 
                    boxShadow: ["0px 0px 0px rgba(2, 179, 109, 0)", "0px 0px 8px rgba(2, 179, 109, 0.5)", "0px 0px 0px rgba(2, 179, 109, 0)"],
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                >
                  <Workflow size={20} className="text-[#02b36d]" />
                </motion.div>
                <span className="text-xs font-mono tracking-wider text-[#7ddfbd] uppercase">PumpBuy</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Token Stats Dashboard */}
      <AnimatePresence>
        {tokenAddress && (
          <motion.div 
            key="token-stats"
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: 20 }}
            variants={statsVariants}
            className="mt-8 mx-auto max-w-4xl"
          >
            <motion.div 
              className="bg-gradient-to-br from-[#0a141980] to-[#05080a80] backdrop-blur-sm rounded-xl p-6 
                         relative overflow-hidden shadow-lg border border-[#02b36d20]"
              whileHover={{ boxShadow: "0px 8px 30px rgba(2, 179, 109, 0.2)" }}
            >
              {/* Background glow effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-br from-[#02b36d05] to-transparent"
                animate={{ 
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  ease: "easeInOut" 
                }}
              />
            
              {/* Dashboard Header */}
              <div className="relative z-10 mb-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="p-2 bg-[#02b36d20] rounded-lg"
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <ChartSpline size={18} className="text-[#02b36d]" />
                  </motion.div>
                </div>
                
                {/* PNL Button in Header */}
                <motion.button
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
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {/* Glow effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ffffff30] to-transparent"
                    animate={{ 
                      x: ['-100%', '200%'],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      repeatDelay: 3
                    }}
                  />
                  
                  <ChartSpline size={16} className="text-black relative z-10" />
                  <span className="text-sm font-mono tracking-wider text-black font-medium relative z-10">Calculate PNL</span>
                </motion.button>
              </div>
              
              <div className="relative z-10 space-y-6">
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Holdings Value */}
                  <motion.div 
                    className="p-5 rounded-lg bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30]
                               flex flex-col relative overflow-hidden"
                    whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(2, 179, 109, 0.2)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {/* Circuit line decoration */}
                    <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10">
                      <div className="absolute bottom-8 right-0 w-16 h-px bg-[#02b36d]"></div>
                      <div className="absolute bottom-8 right-16 w-px h-16 bg-[#02b36d]"></div>
                      <div className="absolute bottom-0 right-8 w-px h-8 bg-[#02b36d]"></div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono tracking-wider text-[#7ddfbd] uppercase">Holdings</span>
                    </div>
                    <div className="mt-auto text-3xl font-bold font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#02b36d] to-[#7ddfbd]">
                      {priceLoading ? (
                        <div className="flex items-center space-x-2">
                          <motion.div 
                            className="h-8 w-8 bg-[#02b36d20] rounded"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                          <motion.div 
                            className="h-8 w-16 bg-[#02b36d20] rounded"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                          />
                          <motion.div 
                            className="h-8 w-12 bg-[#02b36d20] rounded"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                          />
                        </div>
                      ) : tokenPrice ? (
                        `${wallets.reduce((total, wallet) => 
                          total + (Number(wallet.tokenBalance) || 0) * Number(tokenPrice), 0
                        ).toLocaleString('en-US', { 
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2 
                        })}`
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </motion.div>

                  {/* Market Cap with K/M formatting */}
                  <motion.div 
                    className="p-5 rounded-lg bg-gradient-to-br from-[#0a141990] to-[#05080a90] border border-[#02b36d30]
                               flex flex-col relative overflow-hidden"
                    whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(2, 179, 109, 0.2)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {/* Circuit line decoration */}
                    <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
                      <div className="absolute top-8 left-0 w-16 h-px bg-[#02b36d]"></div>
                      <div className="absolute top-8 left-16 w-px h-16 bg-[#02b36d]"></div>
                      <div className="absolute top-24 left-8 w-px h-8 bg-[#02b36d]"></div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono tracking-wider text-[#7ddfbd] uppercase">Market Cap</span>
                    </div>
                    <div className="mt-auto text-3xl font-bold font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#02b36d] to-[#7ddfbd]">
                      {priceLoading ? (
                        <div className="flex items-center space-x-2">
                          <motion.div 
                            className="h-8 w-12 bg-[#02b36d20] rounded"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                          <motion.div 
                            className="h-8 w-8 bg-[#02b36d20] rounded"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                          />
                        </div>
                      ) : tokenPrice ? (
                        (() => {
                          const marketCap = Number(tokenPrice) * 1_000_000_000;
                          if (marketCap >= 1_000_000) {
                            return `${(marketCap / 1_000_000).toFixed(2)}M`;
                          } else if (marketCap >= 1_000) {
                            return `${(marketCap / 1_000).toFixed(2)}K`;
                          } else {
                            return `${marketCap.toFixed(2)}`;
                          }
                        })()
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer Credits Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-12 mb-2 mx-auto max-w-4xl"
      >
        <div className="bg-gradient-to-br from-[#0a141970] to-[#05080a70] backdrop-blur-sm 
                    rounded-xl p-4 relative overflow-hidden border border-[#02b36d20]">
          {/* Background circuit effect */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-32 h-32">
              <div className="absolute top-4 right-8 w-16 h-px bg-[#02b36d]"></div>
              <div className="absolute top-4 right-8 w-px h-8 bg-[#02b36d]"></div>
              <div className="absolute top-12 right-8 w-8 h-px bg-[#02b36d]"></div>
            </div>
            <div className="absolute bottom-0 left-0 w-32 h-32">
              <div className="absolute bottom-4 left-8 w-16 h-px bg-[#02b36d]"></div>
              <div className="absolute bottom-4 left-8 w-px h-8 bg-[#02b36d]"></div>
              <div className="absolute bottom-12 left-8 w-8 h-px bg-[#02b36d]"></div>
            </div>
          </div>
          
          {/* Credits content */}
          <div className="flex flex-col md:flex-row items-center justify-between relative z-10">
            <div className="mb-2 md:mb-0">
              <p className="text-xs text-center md:text-left font-mono tracking-wider text-[#7ddfbd80]">
                POWERED BY CUTTING-EDGE TECHNOLOGY
              </p>
            </div>
            
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              {/* API Provider Links */}
              <motion.a 
                href="https://gmgn.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-mono tracking-wider text-[#02b36d] hover:text-[#7ddfbd] transition-colors duration-300"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                gmgn.ai
              </motion.a>
              
              <div className="w-px h-4 bg-[#02b36d30]"></div>
              
              <motion.a 
                href="https://defined.fi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-mono tracking-wider text-[#02b36d] hover:text-[#7ddfbd] transition-colors duration-300"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                defined.fi
              </motion.a>
              
              <div className="w-px h-4 bg-[#02b36d30]"></div>
              
              <motion.a 
                href="https://fury.bot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-mono tracking-wider text-[#02b36d] hover:text-[#7ddfbd] transition-colors duration-300"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                fury.bot
              </motion.a>
            </div>
          </div>
          
          {/* Animated glow effect */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-[#02b36d05] via-transparent to-[#02b36d05]"
            animate={{ 
              x: ['-100%', '100%'] 
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              repeatType: "mirror"
            }}
          />
        </div>
      </motion.div>
      
      {/* GitHub Download Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mb-4 mx-auto max-w-4xl"
      >
        <motion.div 
          className="bg-gradient-to-br from-[#0a141950] to-[#05080a50] backdrop-blur-sm 
                     rounded-xl p-3 relative overflow-hidden border border-[#02b36d10] 
                     hover:border-[#02b36d30] transition-all duration-300"
          whileHover={{ 
            boxShadow: "0px 4px 15px rgba(2, 179, 109, 0.15)",
            y: -2
          }}
        >
          {/* Pulse effect */}
          <motion.div 
            className="absolute inset-0 bg-[#02b36d]"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.03, 0],
              scale: [0.85, 1.05, 0.85]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* GitHub link content */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center">
              <motion.svg 
                viewBox="0 0 24 24" 
                width="18" 
                height="18" 
                className="text-[#02b36d] mr-2"
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 15 }}
              >
                <path
                  fill="currentColor"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.934.359.31.678.92.678 1.855 0 1.337-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                />
              </motion.svg>
              <span className="text-xs font-mono tracking-wider text-[#7ddfbd]">
                OPEN SOURCE 
              </span>
            </div>
            
            <motion.a 
              href="https://github.com/furydotbot/solana-ui" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center py-1 px-3 rounded-md bg-gradient-to-r 
                         from-[#02b36d20] to-[#02b36d10] border border-[#02b36d30]
                         hover:from-[#02b36d30] hover:to-[#02b36d20] 
                         transition-all duration-300"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="14" 
                height="14" 
                className="text-[#02b36d] mr-1"
              >
                <path
                  fill="currentColor"
                  d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"
                />
              </svg>
              <span className="text-xs font-mono tracking-wider text-[#02b36d]">
                DOWNLOAD REPOSITORY
              </span>
            </motion.a>
          </div>
        </motion.div>
      </motion.div>
      
    </motion.div>
  );
};