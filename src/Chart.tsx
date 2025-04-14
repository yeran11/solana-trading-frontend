import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Search, RefreshCw, Rows, Columns, AlertCircle } from 'lucide-react';

interface ChartPageProps {
  isLoadingChart: boolean;
  tokenAddress: string;
  ammKey: string | null;
}



// Custom hook for handling resize functionality
const useResizable = (initialSize: number, layoutMode: 'row' | 'column', minSize = 20, maxSize = 80) => {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPositionRef = useRef<number>(0);
  const initialSizeRef = useRef<number>(size);
  const lastPositionRef = useRef<number>(0); // Track last position for better handling of fast moves
  
  // raf-based throttle for smoother performance with fast mouse movements
  const rafThrottle = <T extends (...args: any[]) => any>(func: T): T => {
    let rafId: number | null = null;
    let lastArgs: Parameters<T> | null = null;
    
    return ((...args: Parameters<T>): void => {
      lastArgs = args;
      
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (lastArgs) func(...lastArgs);
          rafId = null;
        });
      }
    }) as T;
  };

  const handleResizeMove = useCallback(
    rafThrottle((e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      // Store the current position for tracking fast movements
      lastPositionRef.current = layoutMode === 'row' ? e.clientY : e.clientX;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      let newSize;

      if (layoutMode === 'row') {
        const deltaY = e.clientY - initialPositionRef.current;
        const containerHeight = containerRect.height;
        // Use a smoother calculation
        newSize = initialSizeRef.current + (deltaY / containerHeight) * 100;
      } else {
        const deltaX = e.clientX - initialPositionRef.current;
        const containerWidth = containerRect.width;
        // Use a smoother calculation
        newSize = initialSizeRef.current + (deltaX / containerWidth) * 100;
      }

      // Constrain size between min and max
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      
      // Round to one decimal place for smoother visual updates
      setSize(Math.round(newSize * 10) / 10);
    }),
    [isResizing, layoutMode]
  );

  // Add touch support for mobile devices
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
      });
      handleResizeMove(mouseEvent);
    }
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const position = layoutMode === 'row' ? e.clientY : e.clientX;
    initialPositionRef.current = position;
    lastPositionRef.current = position; // Initialize last position
    initialSizeRef.current = size;
    setIsResizing(true);
    
    // Add cursor styles to the entire document during resize
    document.body.style.cursor = layoutMode === 'row' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection during resize
    
    // Disable pointer events on iframes to prevent mouse capture issues
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      iframe.style.pointerEvents = 'none';
    });

    // Add event listeners for mouse and touch events
    document.addEventListener('mousemove', handleResizeMove, { passive: false });
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleResizeEnd);
    document.addEventListener('touchcancel', handleResizeEnd);
  }, [size, layoutMode, handleResizeMove, handleTouchMove]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    
    // Reset cursor styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Re-enable pointer events on iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      iframe.style.pointerEvents = '';
    });
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleResizeEnd);
    document.removeEventListener('touchcancel', handleResizeEnd);
  }, [handleResizeMove, handleTouchMove]);
  
  // Clean up event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleResizeEnd);
      document.removeEventListener('touchcancel', handleResizeEnd);
      
      // Reset styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Re-enable pointer events on iframes
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = '';
      });
    };
  }, [handleResizeMove, handleResizeEnd, handleTouchMove]);

  return {
    size,
    setSize,
    isResizing,
    containerRef,
    handleResizeStart,
  };
};

// Reusable tooltip component
const Tooltip: React.FC<{
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ children, content, position = 'top' }) => (
  <div className="relative group">
    {children}
    <AnimatePresence>
      <motion.div 
        className={`absolute hidden group-hover:block px-3 py-1.5 text-xs
                    bg-black/80 text-neutral-100 rounded-lg backdrop-blur-md
                    border border-[#222222] shadow-xl z-50
                    ${position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : ''}
                    ${position === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' : ''}
                    ${position === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : ''}
                    ${position === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : ''}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  </div>
);

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
    <Tooltip content={title}>
      <motion.button
        className={`p-2 rounded-md transition-colors ${variants[variant]} ${className}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
      >
        {icon}
      </motion.button>
    </Tooltip>
  );
};

export const ChartPage: React.FC<ChartPageProps> = ({
  isLoadingChart,
  tokenAddress,
  ammKey
}) => {
  const [layoutMode, setLayoutMode] = useState<'row' | 'column'>('row');
  const [chartLoading, setChartLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const transactionsIframeRef = useRef<HTMLIFrameElement>(null);
  
  // Use the custom resizable hook
  const { 
    size: chartSize, 
    setSize: setChartSize, 
    isResizing, 
    containerRef, 
    handleResizeStart 
  } = useResizable(70, layoutMode);
  

  
  // Reset loading state when token changes
  useEffect(() => {
    if (tokenAddress) {
      setChartLoading(true);
      setTransactionsLoading(true);
    }
  }, [tokenAddress, ammKey]);
  
  // Handle iframe load completion
  const handleChartLoad = () => {
    setChartLoading(false);
  };

  // Handle transactions iframe load completion
  const handleTransactionsLoad = () => {
    setTransactionsLoading(false);
  };
  
  // Toggle layout mode
  const toggleLayoutMode = () => {
    setLayoutMode(prev => prev === 'row' ? 'column' : 'row');
  };

  // Reload transactions iframe
  const reloadTransactions = () => {
    if (transactionsIframeRef.current) {
      setTransactionsLoading(true);
      transactionsIframeRef.current.src = transactionsIframeRef.current.src;
    }
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
  
  // Calculate styles based on layout mode
  const getContainerStyles = () => {
    return {
      display: 'flex',
      flexDirection: layoutMode === 'row' ? 'column' : 'row',
      height: '100%',
      position: 'relative',
      background: "linear-gradient(145deg, #0f0f0f 0%, #141414 100%)",
    } as React.CSSProperties;
  };

  const getChartStyles = () => {
    if (layoutMode === 'row') {
      return {
        height: `${chartSize}%`,
        width: '100%',
        transition: isResizing ? 'none' : 'height 0.1s ease-out',
      };
    } else {
      return {
        height: '100%',
        width: `${chartSize}%`,
        transition: isResizing ? 'none' : 'width 0.1s ease-out',
      };
    }
  };

  const getTransactionsStyles = () => {
    if (layoutMode === 'row') {
      return {
        height: `${100 - chartSize}%`,
        width: '100%',
        overflow: 'auto',
        opacity: 1,
        transition: isResizing ? 'none' : 'height 0.1s ease-out',
      };
    } else {
      return {
        height: '100%',
        width: `${100 - chartSize}%`,
        overflow: 'auto',
        opacity: 1,
        transition: isResizing ? 'none' : 'width 0.1s ease-out',
      };
    }
  };

  const getResizeHandleStyles = () => {
    // Much larger hit area for capturing fast mouse movements
    const handleSize = layoutMode === 'row' ? '24px' : '24px';
    
    const baseStyles = {
      position: 'absolute',
      zIndex: 20,
      backgroundColor: 'transparent', // Make invisible but keep hit area
      opacity: 1,
      cursor: layoutMode === 'row' ? 'row-resize' : 'col-resize',
    } as React.CSSProperties;

    if (layoutMode === 'row') {
      return {
        ...baseStyles,
        left: 0,
        right: 0,
        height: handleSize,
        // Position it so part of the hit area extends to both sides of the border
        bottom: `-${parseInt(handleSize)/2 - 6}px`,
      };
    } else {
      return {
        ...baseStyles,
        top: 0,
        bottom: 0,
        width: handleSize,
        // Position it so part of the hit area extends to both sides of the border
        right: `-${parseInt(handleSize)/2 - 6}px`,
      };
    }
  };
  
  // Improved resize handle with much larger hit area and better visual feedback
  const renderResizeHandle = () => {
    const isHorizontal = layoutMode === 'row';
    // Larger visual indicator for better visibility
    const dragIndicatorSize = isHorizontal ? 'w-16 h-2' : 'w-2 h-16';
    
    return (
      <div 
        className={`absolute ${isHorizontal ? 'bottom-0 left-0 right-0' : 'right-0 top-0 bottom-0'} overflow-visible flex items-center justify-center z-20`}
        style={getResizeHandleStyles()}
        onMouseDown={handleResizeStart}
        onTouchStart={(e) => {
          // Add touch support
          e.preventDefault();
          const touch = e.touches[0];
          const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
          });
          handleResizeStart(mouseEvent as unknown as React.MouseEvent);
        }}
      >
        {/* Visual indicator */}
        <motion.div 
          className={`bg-[#87D693] ${dragIndicatorSize} rounded-full`}
          initial={{ opacity: 0.6 }}
          animate={{ 
            opacity: isResizing ? 0.9 : 0.6,
            scale: isResizing ? 1.2 : 1
          }}
          transition={{ duration: 0.1 }}
          whileHover={{ opacity: 0.8, scale: 1.1 }}
        />
        
        {/* Add drag guides that appear during resize */}
        {isResizing && (
          <motion.div 
            className={`absolute ${isHorizontal ? 'left-0 right-0 h-px' : 'top-0 bottom-0 w-px'} bg-[#87D693]`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
          />
        )}
        
        {/* Additional invisible hit area for fast mouse movements */}
        <div className={`absolute ${isHorizontal ? 'left-0 right-0 -bottom-12 h-24' : '-right-12 top-0 bottom-0 w-24'}`} />
      </div>
    );
  };
  
  // Render controls
  const renderControls = () => (
    <motion.div 
      className="absolute top-1 right-6 z-30 flex items-center space-x-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <IconButton
        icon={layoutMode === 'row' ? <Columns className="h-4 w-4" /> : <Rows className="h-4 w-4" />}
        onClick={toggleLayoutMode}
        title={layoutMode === 'row' ? 'Switch to columns layout' : 'Switch to rows layout'}
        variant="secondary"
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
  
  // Render chart iframe
  const renderChart = () => (
    <div 
      className="relative flex-1 overflow-hidden"
      style={getChartStyles()}
    >
      {renderLoader(chartLoading || isLoadingChart)}
      
      <div className="absolute inset-0 overflow-hidden">
        <iframe 
          src={`https://www.gmgn.cc/kline/sol/${tokenAddress}`}
          className="absolute inset-0 w-full h-[calc(100%+35px)]"
          style={{ marginBottom: '-35px' }}
          title="Token Chart"
          loading="lazy"
          onLoad={handleChartLoad}
        />
      </div>
      
      {renderResizeHandle()}
    </div>
  );
  
  // Render transactions iframe
  const renderTransactions = () => {
    const isVertical = layoutMode === 'row';
    
    return (
      <div 
        className={`relative transition-all ${isVertical ? 'border-t' : 'border-l'} border-[#222222]`}
        style={getTransactionsStyles()}
      >
        {/* Reload button for transactions section */}
        <motion.div 
          className="absolute top-1 right-1 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <IconButton
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={reloadTransactions}
            title="Reload transactions"
            variant="primary"
          />
        </motion.div>
        
        {renderLoader(transactionsLoading)}
        
        <div className="w-full h-full overflow-hidden">
          <iframe 
            ref={transactionsIframeRef}
            src={`https://www.defined.fi/sol/${tokenAddress}?quoteToken=token1&embedded=1&hideTxTable=0&hideSidebar=1&hideChart=1&hideChartEmptyBars=1&chartSmoothing=0&embedColorMode=DEFAULT&cache=36356`}
            className="w-full h-[calc(100%+45px)]"
            style={{ marginBottom: '-45px' }}
            title="Token Transactions"
            loading="lazy"
            onLoad={handleTransactionsLoad}
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
        Enter a valid token address in the search bar above to view the chart and trading data
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
      ref={containerRef}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative h-full w-full rounded-lg overflow-hidden shadow-lg shadow-[#87D693]/5 border border-[#222222]"
      style={getContainerStyles()}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a]/10 to-transparent pointer-events-none" />
      
      {/* Glass-like border highlight */}
      <div className="absolute inset-0 rounded-lg border border-white/5 pointer-events-none" />
      
      {renderControls()}
      
      <AnimatePresence mode="wait">
        {isLoadingChart ? (
          <div className="h-full flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw size={24} className="text-[#87D693]" />
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
            className="flex flex-1 p-1"
            style={{ 
              flexDirection: layoutMode === 'row' ? 'column' : 'row',
              height: '100%',
              gap: '2px'
            }}
          >
            {renderChart()}
            {renderTransactions()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChartPage;