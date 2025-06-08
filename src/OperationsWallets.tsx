import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, Coins, CheckSquare, Square, ArrowDownAZ, ArrowUpAZ, 
  Wallet, Share2, Network, Send, HandCoins, DollarSign, 
  Menu, X, ChevronUp, ChevronDown, ChevronRight,
  Share
} from 'lucide-react';
import { Connection } from '@solana/web3.js';
import { WalletType, saveWalletsToCookies } from './Utils';
import { DistributeModal } from './DistributeModal';
import { ConsolidateModal } from './ConsolidateModal';
import { TransferModal } from './TransferModal';
import { DepositModal } from './DepositModal';
import { MixerModal } from './MixerModal';

interface WalletOperationsButtonsProps {
  wallets: WalletType[];
  solBalances: Map<string, number>;
  connection: Connection;
  tokenBalances: Map<string, number>;
  
  handleRefresh: () => void;
  isRefreshing: boolean;
  showingTokenWallets: boolean;
  handleBalanceToggle: () => void;
  setWallets: React.Dispatch<React.SetStateAction<WalletType[]>>;
  sortDirection: string;
  handleSortWallets: () => void;
  setIsModalOpen: (open: boolean) => void;
}

type OperationTab = 'distribute' | 'consolidate' | 'transfer' | 'deposit' | 'mixer' | 'fund';

export const WalletOperationsButtons: React.FC<WalletOperationsButtonsProps> = ({
  wallets,
  solBalances,
  connection,
  tokenBalances,
  handleRefresh,
  isRefreshing,
  showingTokenWallets,
  handleBalanceToggle,
  setWallets,
  sortDirection,
  handleSortWallets,
  setIsModalOpen
}) => {
  // State for active modal
  const [activeModal, setActiveModal] = useState<OperationTab | null>(null);
  
  // State for fund wallets modal
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  
  // State for operations drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Function to toggle drawer
  const toggleDrawer = () => {
    setIsDrawerOpen(prev => !prev);
  };
  
  // Function to open a specific modal
  const openModal = (modal: OperationTab) => {
    setActiveModal(modal);
    setIsDrawerOpen(false); // Close drawer when opening modal
  };
  
  // Function to close the active modal
  const closeModal = () => {
    setActiveModal(null);
  };
  
  // Function to open fund wallets modal
  const openFundModal = () => {
    setIsFundModalOpen(true);
    setIsDrawerOpen(false);
  };
  
  // Function to close fund wallets modal
  const closeFundModal = () => {
    setIsFundModalOpen(false);
  };
  
  // Function to open distribute from fund modal
  const openDistributeFromFund = () => {
    setIsFundModalOpen(false);
    setActiveModal('distribute');
  };
  
  // Function to open mixer from fund modal
  const openMixerFromFund = () => {
    setIsFundModalOpen(false);
    setActiveModal('mixer');
  };

  // Check if all wallets are active
  const allWalletsActive = wallets.every(wallet => wallet.isActive);

  // Function to toggle all wallets
  const toggleAllWalletsHandler = () => {
    setWallets(prev => {
      const allActive = prev.every(wallet => wallet.isActive);
      const newWallets = prev.map(wallet => ({
        ...wallet,
        isActive: !allActive
      }));
      saveWalletsToCookies(newWallets);
      return newWallets;
    });
  };

  // Function to open wallets modal
  const openWalletsModal = () => {
    setIsModalOpen(true);
  };

  // Primary action buttons
  const primaryActions = [
    {
      icon: <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />,
      onClick: handleRefresh,
      disabled: isRefreshing
    },
    {
      icon: showingTokenWallets ? <Coins size={14} /> : <DollarSign size={14} />,
      onClick: handleBalanceToggle
    },
    {
      icon: allWalletsActive ? <Square size={14} /> : <CheckSquare size={14} />,
      onClick: toggleAllWalletsHandler
    },
    {
      icon: sortDirection === 'asc' ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />,
      onClick: handleSortWallets
    }
  ];

  // Operations in drawer
  const operations = [
    {
      icon: <Wallet size={16} />,
      label: "Manage Wallets",
      onClick: () => {
        setIsModalOpen(true);
        setIsDrawerOpen(false);
      }
    },
    {
      icon: <HandCoins size={16} />,
      label: "Fund Wallets",
      onClick: openFundModal
    },
    {
      icon: <Share size={16} />,
      label: "Consolidate SOL",
      onClick: () => openModal('consolidate')
    },
    {
      icon: <Network size={16} />,
      label: "Transfer Assets",
      onClick: () => openModal('transfer')
    },
    {
      icon: <Send size={16} />,
      label: "Deposit SOL",
      onClick: () => openModal('deposit')
    }
  ];

  // Animation variants
  const drawerVariants = {
    hidden: { 
      y: 20, 
      opacity: 0,
      height: 0,
      marginBottom: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      height: 'auto',
      marginBottom: 12,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30
      }
    }
  };
  
  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  return (
    <>
      {/* Modals */}
      <DistributeModal
        isOpen={activeModal === 'distribute'}
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
     
     <MixerModal
        isOpen={activeModal === 'mixer'}
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
      <ConsolidateModal
        isOpen={activeModal === 'consolidate'}
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
     
      <TransferModal
        isOpen={activeModal === 'transfer'}
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
     
      <DepositModal
        isOpen={activeModal === 'deposit'}
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
      
      {/* Fund Wallets Modal */}
      {isFundModalOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={closeFundModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#05080a] border border-[#02b36d30] rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-mono text-[#02b36d] tracking-wider">Fund Wallets</h2>
                <button
                  onClick={closeFundModal}
                  className="text-[#02b36d] hover:text-[#7ddfbd] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-3">
                <motion.button
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={openDistributeFromFund}
                  className="w-full flex items-center gap-3 p-4 rounded-md
                           bg-[#071015] border border-[#02b36d30] hover:border-[#02b36d50]
                           text-[#02b36d] hover:text-[#7ddfbd] transition-all duration-300
                           hover:shadow-md hover:shadow-[#02b36d15]"
                >
                  <Share2 size={20} />
                  <div className="text-left">
                    <div className="font-mono text-sm tracking-wider">Distribute SOL</div>
                    <div className="text-xs text-[#02b36d80] mt-1">Send SOL from main wallet to multiple wallets</div>
                  </div>
                </motion.button>
                
                <motion.button
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={openMixerFromFund}
                  className="w-full flex items-center gap-3 p-4 rounded-md
                           bg-[#071015] border border-[#02b36d30] hover:border-[#02b36d50]
                           text-[#02b36d] hover:text-[#7ddfbd] transition-all duration-300
                           hover:shadow-md hover:shadow-[#02b36d15]"
                >
                  <Share size={20} />
                  <div className="text-left">
                    <div className="font-mono text-sm tracking-wider">Mixer SOL</div>
                    <div className="text-xs text-[#02b36d80] mt-1">Mix SOL between wallets for privacy</div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Main controls bar - slimmer and more minimal */}
      <div className="w-full mb-1 bg-[#05080a95] backdrop-blur-sm rounded-md p-0.5 
                    border border-[#02b36d20]">
        <div className="flex justify-between items-center">
          {/* Primary action buttons - without tooltips */}
          <div className="flex items-center gap-0.5 flex-1">
            {wallets.length === 0 ? (
              <motion.button
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                onClick={openWalletsModal}
                className="flex items-center text-xs font-mono tracking-wider text-[#02b36d] 
                           hover:text-[#7ddfbd] px-2 py-1 rounded bg-[#071015] border 
                           border-[#02b36d30] hover:border-[#02b36d50] transition-colors duration-200"
              >
                <span>Start Here &gt;</span>
              </motion.button>
            ) : (
              primaryActions.map((action, index) => (
                <motion.button
                  key={index}
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="p-1.5 text-[#02b36d] hover:text-[#7ddfbd] disabled:opacity-50 
                           bg-[#071015] border border-[#02b36d20] hover:border-[#02b36d40] rounded 
                           transition-colors duration-200 flex-shrink-0 flex items-center justify-center"
                >
                  <span>{action.icon}</span>
                </motion.button>
              ))
            )}
          </div>
          
          {/* Menu toggle button */}
          <motion.button
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={toggleDrawer}
            className="ml-0.5 p-1.5 flex items-center justify-center rounded
                     bg-gradient-to-r from-[#02b36d] to-[#018a54] 
                     text-[#051014] hover:from-[#02c377] hover:to-[#01a35f]
                     transition-colors duration-200"
          >
            {isDrawerOpen ? <X size={14} /> : <Menu size={14} />}
          </motion.button>
        </div>
      </div>

      {/* Operations drawer - expandable */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div 
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="bg-[#05080a95] backdrop-blur-sm rounded-lg overflow-hidden
                     border border-[#02b36d30] shadow-lg shadow-[#02b36d10]"
          >
            <div className="p-3">
              {/* Drawer header */}
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#02b36d20]">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-1 h-4 bg-[#02b36d]"
                    animate={{ 
                      height: [4, 16, 4],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      repeatType: "mirror" 
                    }}
                  />
                  <span className="text-xs font-mono tracking-wider text-[#02b36d] uppercase">Wallet Operations</span>
                </div>
              </div>
              
              {/* Operation buttons - Single column slim layout */}
              <div className="flex flex-col space-y-1">
                {operations.map((op, index) => (
                  <motion.button
                    key={index}
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    onClick={op.onClick}
                    className="flex justify-between items-center w-full py-2 px-3 rounded-md
                             bg-[#071015] border border-[#02b36d30] hover:border-[#02b36d50]
                             text-[#02b36d] hover:text-[#7ddfbd] transition-all duration-300
                             hover:shadow-md hover:shadow-[#02b36d15] relative overflow-hidden"
                  >
                    {/* Subtle glow effect */}
                    <motion.div 
                      className="absolute inset-0 bg-[#02b36d]"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 0.05 }}
                    />
                    <div className="flex items-center gap-3 relative z-10">
                      <span>{op.icon}</span>
                      <span className="text-xs font-mono tracking-wider">{op.label}</span>
                    </div>
                    <ChevronRight size={14} className="relative z-10 text-[#02b36d80]" />
                  </motion.button>
                ))}
              </div>
            </div>
            
            {/* Decorative bottom edge */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#02b36d40] to-transparent"/>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};