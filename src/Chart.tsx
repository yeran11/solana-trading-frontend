import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Search, AlertCircle, BarChart } from 'lucide-react';

interface ChartPageProps {
  isLoadingChart: boolean;
  tokenAddress: string;
  ammKey: string | null;
  walletAddresses: string[];
}


// Button component with animation
const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}> = ({ icon, onClick, title, variant = 'primary', className = '' }) => {
  const variants = {
    primary: 'bg-[#87D693]/20 hover:bg-[#87D693]/30 text-[#87D693]',
    secondary: 'bg-neutral-800/40 hover:bg-neutral-700/50 text-white'
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
  ammKey,
  walletAddresses
}) => {
  const [frameLoading, setFrameLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [showGMGN, setShowGMGN] = useState(false);
  
  // Reset loading state when token changes
  useEffect(() => {
    if (tokenAddress) {
      setFrameLoading(true);
    }
  }, [tokenAddress, ammKey, showGMGN]);
  
  // Handle iframe load completion
  const handleFrameLoad = () => {
    setFrameLoading(false);
  };

  // Toggle between frame.fury.bot and GMGN graph
  const toggleGraphSource = () => {
    setFrameLoading(true);
    setShowGMGN(prev => !prev);
    setIframeKey(Date.now()); // Change key to force iframe reload
  };

  // Format wallet addresses to first 5 characters each
  const formatWalletAddresses = (addresses: string[]) => {
    return addresses
      .map(address => address.substring(0, 5)) // Take first 5 characters
      .join(','); // Join with commas
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
  
  // Render controls
  const renderControls = () => (
    <motion.div 
      className="absolute top-3 right-6 z-30 flex items-center space-x-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <IconButton
        icon={<BarChart className="h-4 w-4" />}
        onClick={toggleGraphSource}
        title={showGMGN ? "Switch to Fury graph" : "Switch to GMGN graph"}
        variant="primary"
      />
    </motion.div>
  );
  
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
  
  // Render iframe based on selected source
  const renderFrame = () => {
    const walletParams = walletAddresses && walletAddresses.length > 0 
      ? `&wallets=${formatWalletAddresses(walletAddresses)}` 
      : '';
    
    if (showGMGN) {
      // GMGN graph with transactions iframe below
      const transactionsSrc = `https://frame.fury.bot/?token=${tokenAddress}${walletParams}&view=transactions`;
      
      return (
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {renderLoader(frameLoading || isLoadingChart)}
          
          <div className="absolute inset-0 overflow-hidden flex flex-col">
            {/* GMGN Chart takes up 70% of the height */}
            <div className="h-[70%] relative">
              <iframe 
                key={`gmgn-${iframeKey}`}
                src={`https://www.gmgn.cc/kline/sol/${tokenAddress}`}
                className="absolute inset-0 w-full h-[calc(100%+35px)]"
                style={{ marginBottom: '-35px' }}
                title="GMGN Chart"
                loading="lazy"
                onLoad={handleFrameLoad}
              />
            </div>
            {/* Transactions list takes up 30% of the height */}
            <div className="h-[30%] relative border-t border-[#222222]">
              <iframe 
                key={`transactions-${iframeKey}`}
                src={transactionsSrc}
                className="absolute inset-0 w-full h-full"
                title="Transactions"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      );
    } else {
      // Fury.bot frame (unchanged)
      const iframeSrc = `https://frame.fury.bot/?token=${tokenAddress}${walletParams}`;
      
      return (
        <div className="relative flex-1 overflow-hidden">
          {renderLoader(frameLoading || isLoadingChart)}
          
          <div className="absolute inset-0 overflow-hidden">
            <iframe 
              key={iframeKey}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full"
              title="Token Frame"
              loading="lazy"
              onLoad={handleFrameLoad}
            />
          </div>
        </div>
      );
    }
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
      className="relative h-full w-full rounded-lg overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0f0f0f 0%, #141414 100%)",
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a]/10 to-transparent pointer-events-none" />
      
      {renderControls()}
      
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