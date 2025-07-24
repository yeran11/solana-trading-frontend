import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, Coins, CheckSquare, Square, ArrowDownAZ, ArrowUpAZ, 
  Wallet, Share2, Network, Send, HandCoins, DollarSign, 
  Menu, X, ChevronRight,
  Share, Zap
} from 'lucide-react';
import { Connection } from '@solana/web3.js';
import { WalletType, saveWalletsToCookies } from './Utils';
import { DistributeModal } from './modals/DistributeModal';
import { ConsolidateModal } from './modals/ConsolidateModal';
import { TransferModal } from './modals/TransferModal';
import { DepositModal } from './modals/DepositModal';
import { MixerModal } from './modals/MixerModal';

interface WalletOperationsButtonsProps {
  wallets: WalletType[];
  solBalances: Map<string, number>;
  connection: Connection;
  tokenBalances: Map<string, number>;
  tokenAddress: string;
  
  handleRefresh: () => void;
  isRefreshing: boolean;
  showingTokenWallets: boolean;
  handleBalanceToggle: () => void;
  setWallets: (wallets: WalletType[]) => void;
  sortDirection: string;
  handleSortWallets: () => void;
  setIsModalOpen: (open: boolean) => void;
  quickBuyAmount?: number;
  setQuickBuyAmount?: (amount: number) => void;
  quickBuyEnabled?: boolean;
  setQuickBuyEnabled?: (enabled: boolean) => void;
  quickBuyMinAmount?: number;
  setQuickBuyMinAmount?: (amount: number) => void;
  quickBuyMaxAmount?: number;
  setQuickBuyMaxAmount?: (amount: number) => void;
  useQuickBuyRange?: boolean;
  setUseQuickBuyRange?: (enabled: boolean) => void;
}

type OperationTab = 'distribute' | 'consolidate' | 'transfer' | 'deposit' | 'mixer' | 'fund';

export const WalletOperationsButtons: React.FC<WalletOperationsButtonsProps> = ({
  wallets,
  solBalances,
  connection,
  tokenBalances,
  tokenAddress,
  handleRefresh,
  isRefreshing,
  showingTokenWallets,
  handleBalanceToggle,
  setWallets,
  sortDirection,
  handleSortWallets,
  setIsModalOpen,
  quickBuyAmount = 0.01,
  setQuickBuyAmount,
  quickBuyEnabled = true,
  setQuickBuyEnabled,
  quickBuyMinAmount = 0.01,
  setQuickBuyMinAmount,
  quickBuyMaxAmount = 0.05,
  setQuickBuyMaxAmount,
  useQuickBuyRange = false,
  setUseQuickBuyRange
}) => {
  // State for active modal
  const [activeModal, setActiveModal] = useState<OperationTab | null>(null);
  
  // State for fund wallets modal
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  
  // State for operations drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for quick buy settings modal
  const [isQuickBuySettingsOpen, setIsQuickBuySettingsOpen] = useState(false);
  const [tempQuickBuyAmount, setTempQuickBuyAmount] = useState(quickBuyAmount);
  const [tempQuickBuyEnabled, setTempQuickBuyEnabled] = useState(quickBuyEnabled);
  const [tempQuickBuyMinAmount, setTempQuickBuyMinAmount] = useState(quickBuyMinAmount);
  const [tempQuickBuyMaxAmount, setTempQuickBuyMaxAmount] = useState(quickBuyMaxAmount);
  const [tempUseQuickBuyRange, setTempUseQuickBuyRange] = useState(useQuickBuyRange);
  
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
  
  // Function to open quick buy settings
  const openQuickBuySettings = () => {
    setTempQuickBuyAmount(quickBuyAmount);
    setTempQuickBuyEnabled(quickBuyEnabled);
    setTempQuickBuyMinAmount(quickBuyMinAmount);
    setTempQuickBuyMaxAmount(quickBuyMaxAmount);
    setTempUseQuickBuyRange(useQuickBuyRange);
    setIsQuickBuySettingsOpen(true);
    setIsDrawerOpen(false);
  };
  
  // Function to save quick buy settings
  const saveQuickBuySettings = () => {
    if (setQuickBuyAmount && tempQuickBuyAmount > 0) {
      setQuickBuyAmount(tempQuickBuyAmount);
    }
    if (setQuickBuyEnabled) {
      setQuickBuyEnabled(tempQuickBuyEnabled);
    }
    if (setQuickBuyMinAmount && tempQuickBuyMinAmount > 0) {
      setQuickBuyMinAmount(tempQuickBuyMinAmount);
    }
    if (setQuickBuyMaxAmount && tempQuickBuyMaxAmount > 0) {
      setQuickBuyMaxAmount(tempQuickBuyMaxAmount);
    }
    if (setUseQuickBuyRange !== undefined) {
      setUseQuickBuyRange(tempUseQuickBuyRange);
    }
    setIsQuickBuySettingsOpen(false);
  };

  // Check if all wallets are active
  const allWalletsActive = wallets.every(wallet => wallet.isActive);

  // Function to toggle all wallets
  const toggleAllWalletsHandler = () => {
    const allActive = wallets.every(wallet => wallet.isActive);
    const newWallets = wallets.map(wallet => ({
      ...wallet,
      isActive: !allActive
    }));
    saveWalletsToCookies(newWallets);
    setWallets(newWallets);
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
        tokenBalances={tokenBalances}
        tokenAddress={tokenAddress}
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
            className="fixed inset-0 bg-app-overlay flex items-center justify-center z-50"
            onClick={closeFundModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-app-primary border border-app-primary-30 rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-mono color-primary tracking-wider">Fund Wallets</h2>
                <button
                  onClick={closeFundModal}
                  className="color-primary hover-color-primary-light transition-colors"
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
                           bg-app-quaternary border border-app-primary-30 hover-border-primary-60
                           color-primary hover-color-primary-light transition-all duration-300
                           hover:shadow-md hover:shadow-app-primary-15"
                >
                  <Share2 size={20} />
                  <div className="text-left">
                    <div className="font-mono text-sm tracking-wider">Distribute SOL</div>
                    <div className="text-xs text-app-secondary-80 mt-1">Send SOL from main wallet to multiple wallets</div>
                  </div>
                </motion.button>
                
                <motion.button
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  onClick={openMixerFromFund}
                  className="w-full flex items-center gap-3 p-4 rounded-md
                           bg-app-quaternary border border-app-primary-30 hover-border-primary-60
                           color-primary hover-color-primary-light transition-all duration-300
                           hover:shadow-md hover:shadow-app-primary-15"
                >
                  <Share size={20} />
                  <div className="text-left">
                    <div className="font-mono text-sm tracking-wider">Mixer SOL</div>
                    <div className="text-xs text-app-secondary-80 mt-1">Mix SOL between wallets for privacy</div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
      
      {/* Quick Buy Settings Modal */}
      {isQuickBuySettingsOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-app-overlay flex items-center justify-center z-50"
            onClick={() => setIsQuickBuySettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-app-primary border border-app-primary-30 rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-mono color-primary tracking-wider">Quick Buy Settings</h2>
                <button
                  onClick={() => setIsQuickBuySettingsOpen(false)}
                  className="color-primary hover-color-primary-light transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-mono color-primary block mb-1">
                        Quick Buy Feature
                      </span>
                      <p className="text-xs text-app-secondary-80">
                        Show quick buy buttons in wallet rows
                      </p>
                    </div>
                    
                    {/* Custom Toggle Switch */}
                    <button
                      onClick={() => setTempQuickBuyEnabled(!tempQuickBuyEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 ring-app-primary-color focus:ring-offset-2 ring-offset-app-primary ${
                        tempQuickBuyEnabled 
                          ? 'bg-gradient-to-r from-app-primary-color to-app-primary-light' 
                          : 'bg-app-secondary border border-app-primary-30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                          tempQuickBuyEnabled 
                            ? 'translate-x-6 bg-app-quaternary shadow-lg' 
                            : 'translate-x-1 bg-primary-60'
                        }`}
                      />
                      {/* Glow effect when enabled */}
                      {tempQuickBuyEnabled && (
                        <div className="absolute inset-0 rounded-full bg-app-primary-color opacity-20 blur-sm" />
                      )}
                    </button>
                  </div>
                  
                </div>
                
                <div className={tempQuickBuyEnabled ? '' : 'opacity-50'}>
                  {/* Range Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-mono color-primary block mb-1">
                        Random Amount Range
                      </span>
                      <p className="text-xs text-app-secondary-80">
                        Use random amounts between min and max
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setTempUseQuickBuyRange(!tempUseQuickBuyRange)}
                      disabled={!tempQuickBuyEnabled}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 ring-app-primary-color focus:ring-offset-2 ring-offset-app-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                        tempUseQuickBuyRange && tempQuickBuyEnabled
                          ? 'bg-gradient-to-r from-app-primary-color to-app-primary-light' 
                          : 'bg-app-secondary border border-app-primary-30'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full transition-transform duration-200 ${
                          tempUseQuickBuyRange && tempQuickBuyEnabled
                            ? 'translate-x-5 bg-app-quaternary shadow-lg' 
                            : 'translate-x-1 bg-primary-60'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Amount Inputs */}
                  {tempUseQuickBuyRange ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-mono color-primary mb-2">
                          Minimum SOL Amount
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="10"
                          value={tempQuickBuyMinAmount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0.001;
                            setTempQuickBuyMinAmount(value);
                            if (value >= tempQuickBuyMaxAmount) {
                              setTempQuickBuyMaxAmount(value + 0.01);
                            }
                          }}
                          disabled={!tempQuickBuyEnabled}
                          className="w-full px-3 py-2 bg-app-quaternary border border-app-primary-30 rounded-md
                                   text-app-primary font-mono text-sm focus-border-primary focus:outline-none
                                   transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="0.01"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-mono color-primary mb-2">
                          Maximum SOL Amount
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min={tempQuickBuyMinAmount + 0.001}
                          max="10"
                          value={tempQuickBuyMaxAmount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || tempQuickBuyMinAmount + 0.001;
                            if (value > tempQuickBuyMinAmount) {
                              setTempQuickBuyMaxAmount(value);
                            }
                          }}
                          disabled={!tempQuickBuyEnabled}
                          className="w-full px-3 py-2 bg-app-quaternary border border-app-primary-30 rounded-md
                                   text-app-primary font-mono text-sm focus-border-primary focus:outline-none
                                   transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="0.05"
                        />
                      </div>
                      
                      <div className="bg-primary-10 border border-app-primary-20 rounded-md p-3">
                        <p className="text-xs text-app-secondary-80">
                          Each quick buy will use a random amount between {tempQuickBuyMinAmount.toFixed(3)} and {tempQuickBuyMaxAmount.toFixed(3)} SOL
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-mono color-primary mb-2">
                        Fixed SOL Amount
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max="10"
                        value={tempQuickBuyAmount}
                        onChange={(e) => setTempQuickBuyAmount(parseFloat(e.target.value) || 0.001)}
                        disabled={!tempQuickBuyEnabled}
                        className="w-full px-3 py-2 bg-app-quaternary border border-app-primary-30 rounded-md
                                 text-app-primary font-mono text-sm focus-border-primary focus:outline-none
                                 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="0.01"
                      />
                      <p className="text-xs text-app-secondary-80 mt-1">
                        Fixed amount of SOL to spend when clicking quick buy buttons
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4">
                  <motion.button
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setIsQuickBuySettingsOpen(false)}
                    className="flex-1 py-2 px-4 rounded-md border border-app-primary-30
                             color-primary hover-color-primary-light transition-colors duration-200"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    onClick={saveQuickBuySettings}
                    disabled={tempQuickBuyEnabled && (
                      tempUseQuickBuyRange 
                        ? (tempQuickBuyMinAmount <= 0 || tempQuickBuyMaxAmount <= 0 || tempQuickBuyMinAmount >= tempQuickBuyMaxAmount)
                        : tempQuickBuyAmount <= 0
                    )}
                    className="flex-1 py-2 px-4 rounded-md bg-app-primary-color text-app-quaternary
                             hover:bg-app-primary-light disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors duration-200 font-mono"
                  >
                    Save
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Main controls bar - slimmer and more minimal */}
      <div className="w-full mb-1 bg-app-primary-80 backdrop-blur-sm rounded-md p-0.5 
                    border border-app-primary-20">
        <div className="flex justify-between items-center">
          {/* Primary action buttons - without tooltips */}
          <div className="flex items-center gap-0.5 flex-1">
            {wallets.length === 0 ? (
              <motion.button
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                onClick={() => {
                  // Open settings modal with wallets tab active
                  setIsModalOpen(false); // Close wallet modal if open
                  // These functions should be passed from parent component
                  if (typeof window !== 'undefined' && window.dispatchEvent) {
                    // Create and dispatch a custom event to open settings with wallets tab
                    const event = new CustomEvent('openSettingsWalletsTab');
                    window.dispatchEvent(event);
                  }
                }}
                className="flex items-center text-xs font-mono tracking-wider color-primary 
                           hover-color-primary-light px-2 py-1 rounded bg-app-quaternary border 
                           border-app-primary-30 hover-border-primary-60 transition-colors duration-200"
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
                  className="p-1.5 color-primary hover-color-primary-light disabled:opacity-50 
                           bg-app-quaternary border border-app-primary-20 hover-border-primary-40 rounded 
                           transition-colors duration-200 flex-shrink-0 flex items-center justify-center"
                >
                  <span>{action.icon}</span>
                </motion.button>
              ))
            )}
          </div>
          
          {/* Quick Buy Settings and Menu toggle buttons */}
          <div className="flex items-center gap-0.5">
            {wallets.length > 0 && (
              <motion.button
                variants={buttonVariants}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                onClick={openQuickBuySettings}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-mono tracking-wider
                         bg-app-quaternary border rounded transition-colors duration-200 ${
                  quickBuyEnabled 
                    ? 'color-primary hover-color-primary-light border-app-primary-20 hover-border-primary-40'
                    : 'color-primary-40 border-app-primary-10 opacity-60'
                }`}
              >
                <Zap size={12} />
                <span>
                  {quickBuyEnabled 
                    ? (useQuickBuyRange 
                        ? `${quickBuyMinAmount?.toFixed(3)}-${quickBuyMaxAmount?.toFixed(3)} SOL` 
                        : `${quickBuyAmount} SOL`
                      ) 
                    : 'OFF'
                  }
                </span>
              </motion.button>
            )}
            
            <motion.button
              variants={buttonVariants}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              onClick={toggleDrawer}
              className="ml-0.5 p-1.5 flex items-center justify-center rounded
                       bg-gradient-to-r from-app-primary-color to-app-primary-dark 
                       text-app-quaternary hover-from-app-primary-light hover-to-app-primary-color
                       transition-colors duration-200"
            >
              {isDrawerOpen ? <X size={14} /> : <Menu size={14} />}
            </motion.button>
          </div>
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
            className="bg-app-primary-80 backdrop-blur-sm rounded-lg overflow-hidden
                     border border-app-primary-30 shadow-lg shadow-app-primary-10"
          >
            <div className="p-3">
              {/* Drawer header */}
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-app-primary-20">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-1 h-4 bg-app-primary-color"
                    animate={{ 
                      height: [4, 16, 4],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      repeatType: "mirror" 
                    }}
                  />
                  <span className="text-xs font-mono tracking-wider color-primary uppercase">Wallet Operations</span>
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
                             bg-app-quaternary border border-app-primary-30 hover-border-primary-60
                             color-primary hover-color-primary-light transition-all duration-300
                             hover:shadow-md hover:shadow-app-primary-15 relative overflow-hidden"
                  >
                    {/* Subtle glow effect */}
                    <motion.div 
                      className="absolute inset-0 bg-app-primary-color"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 0.05 }}
                    />
                    <div className="flex items-center gap-3 relative z-10">
                      <span>{op.icon}</span>
                      <span className="text-xs font-mono tracking-wider">{op.label}</span>
                    </div>
                    <ChevronRight size={14} className="relative z-10 text-app-secondary-80" />
                  </motion.button>
                ))}
              </div>
            </div>
            
            {/* Decorative bottom edge */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-app-primary-40 to-transparent"/>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};