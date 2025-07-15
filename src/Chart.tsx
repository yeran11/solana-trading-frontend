import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Search, AlertCircle, BarChart, Activity, TrendingUp, Users } from 'lucide-react';
import { WalletType, getWalletDisplayName } from './Utils';

interface ChartPageProps {
  isLoadingChart: boolean;
  tokenAddress: string;
  wallets: WalletType[];
}

// Iframe communication types
interface Wallet {
  address: string;
  label?: string;
}

type IframeMessage = 
  | AddWalletsMessage
  | ClearWalletsMessage
  | GetWalletsMessage;

interface AddWalletsMessage {
  type: 'ADD_WALLETS';
  wallets: (string | Wallet)[];
}

interface ClearWalletsMessage {
  type: 'CLEAR_WALLETS';
}

interface GetWalletsMessage {
  type: 'GET_WALLETS';
}

type IframeResponse = 
  | IframeReadyResponse
  | WalletsAddedResponse
  | WalletsClearedResponse
  | CurrentWalletsResponse
  | WhitelistTradingStatsResponse
  | SolPriceUpdateResponse;

interface IframeReadyResponse {
  type: 'IFRAME_READY';
}

interface WalletsAddedResponse {
  type: 'WALLETS_ADDED';
  success: boolean;
  count: number;
}

interface WalletsClearedResponse {
  type: 'WALLETS_CLEARED';
  success: boolean;
}

interface CurrentWalletsResponse {
  type: 'CURRENT_WALLETS';
  wallets: any[];
}

interface WhitelistTradingStatsResponse {
  type: 'WHITELIST_TRADING_STATS';
  data: {
    bought: number;
    sold: number;
    net: number;
    trades: number;
    solPrice: number;
    timestamp: number;
  };
}

interface SolPriceUpdateResponse {
  type: 'SOL_PRICE_UPDATE';
  data: {
    solPrice: number;
    timestamp: number;
  };
}

// Button component with animation
const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'solid';
  className?: string;
}> = ({ icon, onClick, title, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'bg-[#87D693]/20 hover:bg-[#87D693]/30 text-[#87D693]',
    secondary: 'bg-neutral-800/40 hover:bg-neutral-700/50 text-white',
    solid: 'bg-[#87D693] hover:bg-[#87D693]/90 text-black shadow-lg shadow-[#87D693]/25'
  };
  
  return (
      <motion.button
        className={`p-2 rounded-md transition-colors ${variants[variant]} ${className}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
      >
        {icon}
      </motion.button>
  );
};

export const ChartPage: React.FC<ChartPageProps> = ({
  isLoadingChart,
  tokenAddress,
  wallets
}) => {
  const [frameLoading, setFrameLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [isIframeReady, setIsIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messageQueue = useRef<IframeMessage[]>([]);
  
  // State for iframe data
  const [tradingStats, setTradingStats] = useState<{
    bought: number;
    sold: number;
    net: number;
    trades: number;
    timestamp: number;
  } | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [currentWallets, setCurrentWallets] = useState<any[]>([]);


  
  // Setup iframe message listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent<IframeResponse>) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      
      switch (event.data.type) {
        case 'IFRAME_READY':
          setIsIframeReady(true);
          // Process queued messages
          messageQueue.current.forEach(message => {
            sendMessageToIframe(message);
          });
          messageQueue.current = [];
          break;
        
        case 'WALLETS_ADDED':
          console.log(`Successfully added ${event.data.count} wallets to iframe`);
          break;
        
        case 'WALLETS_CLEARED':
          console.log('Cleared all iframe wallets');
          break;
        
        case 'CURRENT_WALLETS':
          console.log('Current wallets in iframe:', event.data.wallets);
          setCurrentWallets(event.data.wallets);
          break;
        
        case 'WHITELIST_TRADING_STATS':
          console.log('Trading stats updated:', event.data.data);
          setTradingStats(event.data.data);
          break;
        
        case 'SOL_PRICE_UPDATE':
          console.log('SOL price updated:', event.data.data.solPrice);
          setSolPrice(event.data.data.solPrice);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Send message to iframe
  const sendMessageToIframe = (message: IframeMessage): void => {
    if (!isIframeReady || !iframeRef.current) {
      messageQueue.current.push(message);
      return;
    }

    iframeRef.current.contentWindow?.postMessage(message, '*');
  };

  // Send wallets to iframe when they change
  useEffect(() => {
    if (wallets && wallets.length > 0) {
      const iframeWallets: Wallet[] = wallets.map((wallet) => ({
        address: wallet.address,
        label: getWalletDisplayName(wallet)
      }));
      
      sendMessageToIframe({
        type: 'ADD_WALLETS',
        wallets: iframeWallets
      });
    } else {
      // Clear wallets if no addresses provided
      sendMessageToIframe({
        type: 'CLEAR_WALLETS'
      });
    }
  }, [wallets, isIframeReady]);
  
  // Reset loading state when token changes
  useEffect(() => {
    if (tokenAddress) {
      setFrameLoading(true);
      setIsIframeReady(false);
    }
  }, [tokenAddress]);
  
  // Handle iframe load completion
  const handleFrameLoad = () => {
    setFrameLoading(false);
  };


  
  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 300,
        damping: 24
      }
    }
  };

  const pulseVariants: Variants = {
    initial: { opacity: 0.5, scale: 0.98 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as "reverse",
        ease: "easeInOut"
      }
    }
  };

  const loaderVariants: Variants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };
  

  
  // Render loader
  const renderLoader = (loading: boolean) => (
    <AnimatePresence>
      {loading && (
        <motion.div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f0f]/90 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div 
            className="w-12 h-12 rounded-full border-2 border-t-transparent border-[#87D693]/30"
            variants={loaderVariants}
            animate="animate"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
  
  // Render data display box
  const renderDataBox = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 z-20 bg-[#0f0f0f]/95 backdrop-blur-sm border border-[#87D693]/20 rounded-lg p-4 min-w-[280px] max-w-[320px]"
      style={{
        background: "linear-gradient(145deg, #0f0f0f/95 0%, #141414/95 100%)",
        boxShadow: "0 8px 32px rgba(135, 214, 147, 0.1)"
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-[#87D693]" />
        <h3 className="text-sm font-medium text-[#87D693]">Iframe Data</h3>
      </div>
      
      {/* SOL Price */}
      {solPrice && (
        <div className="mb-3 p-2 bg-[#87D693]/10 rounded border border-[#87D693]/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-[#87D693]" />
            <span className="text-xs text-gray-400">SOL Price</span>
          </div>
          <div className="text-lg font-bold text-[#87D693]">
            ${solPrice.toFixed(2)}
          </div>
        </div>
      )}
      
      {/* Trading Stats */}
      {tradingStats && (
        <div className="mb-3 p-2 bg-[#87D693]/5 rounded border border-[#87D693]/10">
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="h-3 w-3 text-[#87D693]" />
            <span className="text-xs text-gray-400">Trading Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Bought:</span>
              <div className="text-green-400 font-mono">{tradingStats.bought.toFixed(3)} SOL</div>
            </div>
            <div>
              <span className="text-gray-500">Sold:</span>
              <div className="text-red-400 font-mono">{tradingStats.sold.toFixed(3)} SOL</div>
            </div>
            <div>
              <span className="text-gray-500">Net:</span>
              <div className={`font-mono ${tradingStats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tradingStats.net.toFixed(3)} SOL
              </div>
            </div>
            <div>
              <span className="text-gray-500">Trades:</span>
              <div className="text-[#87D693] font-mono">{tradingStats.trades}</div>
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Updated: {new Date(tradingStats.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
      
      {/* Current Wallets */}
      {currentWallets.length > 0 && (
        <div className="p-2 bg-[#87D693]/5 rounded border border-[#87D693]/10">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3 w-3 text-[#87D693]" />
            <span className="text-xs text-gray-400">Wallets ({currentWallets.length})</span>
          </div>
          <div className="max-h-24 overflow-y-auto">
            {currentWallets.slice(0, 3).map((wallet, index) => (
              <div key={index} className="text-xs text-gray-300 mb-1 font-mono">
                {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-4)}
                {wallet.label && <span className="text-gray-500 ml-1">({wallet.label})</span>}
              </div>
            ))}
            {currentWallets.length > 3 && (
              <div className="text-xs text-gray-500">+{currentWallets.length - 3} more</div>
            )}
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#87D693]/10">
        <div className={`w-2 h-2 rounded-full ${isIframeReady ? 'bg-green-400' : 'bg-yellow-400'}`} />
        <span className="text-xs text-gray-500">
          {isIframeReady ? 'Connected' : 'Connecting...'}
        </span>
      </div>
    </motion.div>
  );

  // Render iframe with single frame
  const renderFrame = () => {
    return (
      <div className="relative flex-1 overflow-hidden iframe-container">
        {renderLoader(frameLoading || isLoadingChart)}
        
        {/* Data display box overlay */}
        {tokenAddress && renderDataBox()}
        
        <div className="absolute inset-0 overflow-hidden">
          <iframe 
            ref={iframeRef}
            key={`frame-${iframeKey}`}
            src={`https://frame.fury.bot/?tokenMint=${tokenAddress}&theme=green`}
            className="absolute inset-0 w-full h-full border-0"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              minHeight: '100%'
            }}
            title="BetterSkill Frame"
            loading="eager"
            onLoad={handleFrameLoad}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    );
  };
  
  // Render placeholder when no token is selected
  const renderPlaceholder = () => (
    <motion.div 
      key="placeholder"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col items-center justify-center p-8"
    >
      <motion.div
        variants={pulseVariants}
        initial="initial"
        animate="animate" 
        className="rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#101010] p-4 mb-6"
      >
        <Search className="h-10 w-10 text-gray-600 opacity-50" />
      </motion.div>
      
      <motion.h3 
        variants={itemVariants}
        className="text-lg font-medium text-gray-400 mb-2"
      >
        Set token address
      </motion.h3>
      
      <motion.p 
        variants={itemVariants}
        className="text-gray-500 text-sm max-w-md text-center"
      >
        Enter a valid token address in the search bar above to view the token frame
      </motion.p>
      
      <motion.div
        variants={itemVariants}
        className="mt-6 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20"
      >
        <AlertCircle size={16} className="text-green-400" />
        <span className="text-green-300 text-sm">No token selected</span>
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative w-full rounded-lg overflow-hidden h-full md:h-full min-h-[calc(100vh-4rem)] md:min-h-full"
      style={{
        background: "linear-gradient(145deg, #0f0f0f 0%, #141414 100%)",
        touchAction: 'manipulation',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a]/10 to-transparent pointer-events-none" />
      

      
      <AnimatePresence mode="wait">
        {isLoadingChart ? (
          <div className="h-full flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <BarChart size={24} className="text-[#87D693]" />
            </motion.div>
          </div>
        ) : !tokenAddress ? (
          renderPlaceholder()
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 h-full"
          >
            {renderFrame()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChartPage;