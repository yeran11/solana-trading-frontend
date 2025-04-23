import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Tooltip Component with cyberpunk styling
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
          <div className="bg-[#051014] cyberpunk-border text-[#02b36d] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

const CyberpunkServiceButton = ({ 
  icon, 
  label, 
  url,
  description 
}) => {
  const handleClick = () => {
    if (url) {
      window.open(url);
    }
  };

  return (
    <Tooltip content={description || label} position="top">
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex flex-col items-center w-20 p-2 hover:bg-[#02b36d20] border border-[#02b36d30] 
                  hover:border-[#02b36d60] rounded-lg cursor-pointer transition-all duration-300"
        onClick={handleClick}
      >
        <motion.div 
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2 
                    bg-[#051014] border border-[#02b36d40] overflow-hidden"
          whileHover={{ borderColor: "#02b36d", boxShadow: "0 0 8px rgba(2,179,109,0.4)" }}
        >
          {icon}
        </motion.div>
        <span className="text-[#7ddfbd] text-xs font-mono tracking-wider">{label}</span>
      </motion.div>
    </Tooltip>
  );
};

const CyberpunkServiceSelector = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSelector = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative inline-block">
      {/* Main button to open the selector */}
      <Tooltip content="Services" position="bottom">
        <button
          onClick={toggleSelector}
          className="flex items-center justify-center p-2 overflow-hidden
                  border border-[#02b36d30] hover:border-[#02b36d60] rounded 
                  transition-all duration-300 cyberpunk-btn"
        >
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <img 
              src="https://i.ibb.co/wZ7PmfPF/logo-2.png" 
              alt="Fury Bundler" 
              className="h-8 filter drop-shadow-[0_0_8px_rgba(2,179,109,0.7)]" 
            />
          </motion.div>
        </button>
      </Tooltip>

      {/* Service selector modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 bg-[#050a0e] rounded-lg p-4 shadow-lg 
                        w-80 border border-[#02b36d40] cyberpunk-border z-50 
                        backdrop-blur-sm"
          >
            <div className="relative">
              {/* Cyberpunk scanline effect */}
              <div className="absolute top-0 left-0 w-full h-full cyberpunk-scanline pointer-events-none z-1 opacity-30"></div>
              
              {/* Glow accents in corners */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#02b36d] opacity-50 rounded-full blur-md"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 bg-[#02b36d] opacity-50 rounded-full blur-md"></div>
              
              <motion.div 
                className="flex flex-wrap justify-center gap-3 relative z-10"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.05
                    }
                  }
                }}
                initial="hidden"
                animate="show"
              >
                {/* Solana */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <CyberpunkServiceButton 
                    icon={<div className="bg-[#9945FF] rounded-full w-8 h-8 flex items-center justify-center overflow-hidden">
                      <svg viewBox="0 0 397 311" width="22" height="22">
                        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h320.3c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#FFFFFF"/>
                        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h320.3c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#FFFFFF"/>
                        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H3.6c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h320.3c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#FFFFFF"/>
                      </svg>
                    </div>} 
                    label="Solana" 
                    url="https://solana.com"
                    description="Solana Explorer"
                  />
                </motion.div>
                
                {/* Binance */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <CyberpunkServiceButton 
                    icon={<div className="bg-[#F0B90B] rounded-full w-8 h-8 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path d="M12 7.5L7.5 12 12 16.5 16.5 12 12 7.5z" fill="#FFFFFF" />
                        <path d="M4.5 12L0 16.5 4.5 21 9 16.5 4.5 12z" fill="#FFFFFF" />
                        <path d="M19.5 12L15 16.5 19.5 21 24 16.5 19.5 12z" fill="#FFFFFF" />
                        <path d="M12 0L7.5 4.5 12 9 16.5 4.5 12 0z" fill="#FFFFFF" />
                        <path d="M12 15L9 18 12 21 15 18 12 15z" fill="#FFFFFF" />
                      </svg>
                    </div>} 
                    label="Binance" 
                    url="https://binance.com"
                    description="Binance Exchange"
                  />
                </motion.div>
                
                {/* Docs */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <CyberpunkServiceButton 
                    icon={<div className="bg-[#0066FF] rounded-lg w-8 h-8 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="0.5" />
                        <polyline points="14 2 14 8 20 8" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                        <line x1="16" y1="13" x2="8" y2="13" stroke="#FFFFFF" strokeWidth="1" />
                        <line x1="16" y1="17" x2="8" y2="17" stroke="#FFFFFF" strokeWidth="1" />
                        <polyline points="10 9 9 9 8 9" stroke="#FFFFFF" strokeWidth="1" />
                      </svg>
                    </div>} 
                    label="Docs" 
                    url="https://docs.example.com"
                    description="Documentation"
                  />
                </motion.div>
                
                {/* GitHub */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <CyberpunkServiceButton 
                    icon={<div className="bg-[#171515] rounded-full w-8 h-8 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.03-1.61-4.03-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.84 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.3.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF" />
                      </svg>
                    </div>} 
                    label="GitHub" 
                    url="https://github.com"
                    description="GitHub Repository"
                  />
                </motion.div>
              </motion.div>
            
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CyberpunkServiceSelector;