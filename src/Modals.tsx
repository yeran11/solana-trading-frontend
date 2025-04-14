import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, CircleDollarSign, Coins, DollarSign, Info, Search, Wallet, X } from 'lucide-react';
import { getWallets } from './Utils';
import { useToast } from "./Notifications"
import { loadConfigFromCookies } from './Utils';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

const STEPS_BURN = ['Select Source', 'Burn Details', 'Review'];
const STEPS_CUSTOMBUY = ['Select Wallets', 'Configure Buy', 'Review'];
const STEPS_BUYSELL = ['Select Seller', 'Select Buyer', 'Review'];
const STEPS_DEPLOY = ["Token Details", "Select Wallets", "Review"];

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BurnModalProps extends BaseModalProps {
  onBurn: (amount: string) => void;
  handleRefresh: () => void;
  tokenAddress: string; 
}

interface CustomBuyModalProps extends BaseModalProps { 
  onCustomBuy: (data: any) => void;
  handleRefresh: () => void;
  tokenAddress: string;
}

interface CleanerTokensModalProps extends BaseModalProps {
  onCleanerTokens: (data: any) => void;
  handleRefresh: () => void;
  tokenAddress: string; // Automatically used token address
}

interface DeployModalProps extends BaseModalProps {
  onDeploy: (data: any) => void;
  handleRefresh: () => void;
  solBalances: Map<string, number>;
}

export const BurnModal: React.FC<BurnModalProps> = ({
  isOpen,
  onClose,
  onBurn,
  handleRefresh,
  tokenAddress,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sourceWallet, setSourceWallet] = useState<string>('');
  const [tokenAccounts, setTokenAccounts] = useState<Array<{
    mint: string;
    balance: number;
    symbol: string;
  }>>([]);
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('address');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showInfoTip, setShowInfoTip] = useState(false);
  
  const wallets = getWallets();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      // Reset form state when modal opens
      setCurrentStep(0);
      setSourceWallet('');
      setAmount('');
      setIsConfirmed(false);
      setSearchTerm('');
    }
  }, [isOpen]);

  // Fetch token accounts when source wallet is selected
  useEffect(() => {
    const fetchTokenAccounts = async () => {
      if (!sourceWallet) return;
      
      setIsLoadingTokens(true);
      try {
        const savedConfig = loadConfigFromCookies();
        const rpcurl = (savedConfig as any).rpcEndpoint
        const connection = new web3.Connection(rpcurl);

        const keypair = web3.Keypair.fromSecretKey(
          bs58.decode(sourceWallet)
        );
        const publicKey = keypair.publicKey;
              
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          {
            programId: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          }
        );

        // Transform the token accounts data - exclude SOL
        const transformedAccounts = await Promise.all(tokenAccounts.value.map(async (account) => {
          const parsedInfo = account.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const balance = parsedInfo.tokenAmount.uiAmount;

          return {
            mint: mintAddress,
            balance: balance,
            symbol: mintAddress.slice(0, 4) // Placeholder - you should fetch actual symbols
          };
        }));

        setTokenAccounts(transformedAccounts.filter(account => account.balance > 0));
      } catch (error) {
        console.error('Error fetching token accounts:', error);
        showToast("Failed to fetch token accounts", "error");
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokenAccounts();
  }, [sourceWallet]);

  const handleNext = () => {
    if (currentStep === 0 && !sourceWallet) {
      showToast("Please select source wallet", "error");
      return;
    }
    
    if (currentStep === 1) {
      if (!amount || parseFloat(amount) <= 0) {
        showToast("Please enter a valid amount", "error");
        return;
      }
      // No token balance validation check
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS_BURN.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      const data = {
        sourceKey: sourceWallet,
        tokenAddress: tokenAddress,
        amount: amount,
      };

      const response = await fetch(`${baseUrl}/burn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showToast("Token burn completed successfully", "success");
      setSourceWallet('');
      setAmount('');
      setIsConfirmed(false);
      setCurrentStep(0);
      onClose();
    } catch (error) {
      console.error('Error:', error);
      showToast("Token burn failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Filter and sort wallets based on search term and other criteria
  const filterWallets = (walletList: any[], search: string) => {
    // First apply search filter
    let filtered = walletList;
    if (search) {
      filtered = filtered.filter(wallet => 
        wallet.address.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Sort the wallets
    return filtered.sort((a, b) => {
      if (sortOption === 'address') {
        return sortDirection === 'asc' 
          ? a.address.localeCompare(b.address)
          : b.address.localeCompare(a.address);
      }
      return 0;
    });
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform animate-slide-up">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-neutral-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10 mr-3">
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Burn Tokens
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full h-1 bg-neutral-800">
          <div 
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS_BURN.length) * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="p-6">

          {/* Step Content */}
          <form onSubmit={currentStep === STEPS_BURN.length - 1 ? handleBurn : (e) => e.preventDefault()}>
            {/* Step 1: Select Source Wallet */}
            {currentStep === 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <path d="M16 10h2M6 14h12" />
                    </svg>
                    <h3 className="text-lg font-medium text-white">Select Source Wallet</h3>
                  </div>
                </div>

                {/* Search and Sort */}
                <div className="mb-3 flex space-x-2">
                  <div className="relative flex-grow">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/70 transition-all"
                      placeholder="Search wallets..."
                    />
                  </div>
                  
                  <select 
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 text-sm text-white focus:outline-none focus:border-red-500"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                  >
                    <option value="address">Address</option>
                  </select>
                  
                  <button
                    type="button"
                    className="p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-all"
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                {/* Wallet Selection */}
                <div className="bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {filterWallets(wallets, searchTerm).length > 0 ? (
                      filterWallets(wallets, searchTerm).map((wallet) => (
                        <div 
                          key={wallet.id}
                          className={`flex items-center p-2.5 hover:bg-neutral-700/30 cursor-pointer border-b border-neutral-700/30 last:border-b-0 transition-all duration-150
                                    ${sourceWallet === wallet.privateKey ? 'bg-red-500/10' : ''}`}
                          onClick={() => setSourceWallet(wallet.privateKey)}
                        >
                          <div className={`w-4 h-4 mr-2 rounded-full flex items-center justify-center transition-all duration-200
                                          ${sourceWallet === wallet.privateKey
                                            ? 'bg-red-500' 
                                            : 'border border-neutral-600'}`}>
                            {sourceWallet === wallet.privateKey && (
                              <CheckCircle size={12} className="text-neutral-900" />
                            )}
                          </div>
                          <div className="flex-1 flex justify-between items-center">
                            <span className="font-mono text-sm text-white">{formatAddress(wallet.address)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-neutral-400 text-center">
                        {searchTerm ? "No wallets found" : "No wallets available"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Enter Burn Amount */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l-7-7 7-7M5 12h14" />
                  </svg>
                  <h3 className="text-lg font-medium text-white">Burn Amount</h3>
                </div>

                {isLoadingTokens ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Token Info */}
                    <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-300 font-medium">Selected Token</span>
                        {tokenAccounts.find(t => t.mint === tokenAddress) ? (
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center mr-2">
                              <span className="text-xs text-white">
                                {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || 'TKN'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-white">
                                {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || 'Token'}
                              </span>
                              <span className="text-xs text-neutral-400">
                                Balance: {tokenAccounts.find(t => t.mint === tokenAddress)?.balance || 0}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-400">
                            {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <label className="text-sm font-medium text-neutral-300">
                            Amount to Burn
                          </label>
                          <div className="relative" onMouseEnter={() => setShowInfoTip(true)} onMouseLeave={() => setShowInfoTip(false)}>
                            <Info size={14} className="text-neutral-500 cursor-help" />
                            {showInfoTip && (
                              <div className="absolute left-0 bottom-full mb-2 p-2 bg-neutral-800 rounded shadow-lg text-xs text-neutral-300 w-48 z-10">
                                This amount of tokens will be permanently burned
                              </div>
                            )}
                          </div>
                        </div>
                        {tokenAccounts.find(t => t.mint === tokenAddress) && (
                          <button
                            type="button"
                            onClick={() => setAmount(tokenAccounts.find(t => t.mint === tokenAddress)?.balance.toString() || '')}
                            className="text-xs px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-all"
                          >
                            Max
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setAmount(value);
                            }
                          }}
                          placeholder="Enter amount to burn"
                          className="w-full pl-4 pr-12 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500/70 transition-all"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-neutral-400">
                          {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || 'Tokens'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review and Confirm */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <h3 className="text-lg font-medium text-white">Review Burn</h3>
                </div>

                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-neutral-400 mb-1">Token</div>
                      <div className="text-sm text-white flex items-center">
                        <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center mr-2">
                          <span className="text-xs text-white">
                            {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol?.[0] || 'T'}
                          </span>
                        </div>
                        {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || tokenAddress.slice(0, 8) + '...'}
                      </div>
                    </div>

                    <div className="h-px bg-neutral-700"></div>

                    <div>
                      <div className="text-sm text-neutral-400 mb-1">From Wallet</div>
                      <div className="text-sm text-white flex items-center">
                        <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center mr-2">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <path d="M16 10h2M6 14h12" />
                          </svg>
                        </div>
                        {sourceWallet ? formatAddress(wallets.find(w => w.privateKey === sourceWallet)?.address || '') : ''}
                      </div>
                    </div>

                    <div className="h-px bg-neutral-700"></div>

                    <div>
                      <div className="text-sm text-neutral-400 mb-1">Amount to Burn</div>
                      <div className="text-xl font-semibold text-red-400">
                        {amount} {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || 'Tokens'}
                      </div>
                    </div>

                    <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 mt-2">
                      <div className="flex items-center text-red-300 text-sm">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        This burn operation is irreversible and cannot be undone.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        id="confirm"
                        checked={isConfirmed}
                        onChange={(e) => setIsConfirmed(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 border border-neutral-600 rounded-md peer-checked:bg-red-500 peer-checked:border-0 transition-all"></div>
                      <svg 
                        className={`absolute w-3 h-3 text-white top-1 left-1 transition-all ${isConfirmed ? 'opacity-100' : 'opacity-0'}`} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <label htmlFor="confirm" className="text-sm text-neutral-300 leading-relaxed cursor-pointer">
                      I confirm that I want to burn <span className="text-red-400 font-medium">{amount} {tokenAccounts.find(t => t.mint === tokenAddress)?.symbol || 'Tokens'}</span>. I understand this action cannot be undone and the tokens will be permanently removed from circulation.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={currentStep === 0 ? onClose : handleBack}
                disabled={isSubmitting}
                className="px-4 py-2 text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-all"
              >
                {currentStep === 0 ? 'Cancel' : (
                  <div className="flex items-center">
                    <ChevronLeft size={16} className="mr-1" />
                    Back
                  </div>
                )}
              </button>

              <button
                type={currentStep === STEPS_BURN.length - 1 ? 'submit' : 'button'}
                onClick={currentStep === STEPS_BURN.length - 1 ? undefined : handleNext}
                disabled={
                  isSubmitting || 
                  (currentStep === 0 && !sourceWallet) ||
                  (currentStep === 1 && (!amount || parseFloat(amount) <= 0)) ||
                  (currentStep === STEPS_BURN.length - 1 && !isConfirmed)
                }
                className={`px-4 py-2 rounded-lg transition-all flex items-center
                          ${isSubmitting || 
                            (currentStep === 0 && !sourceWallet) ||
                            (currentStep === 1 && (!amount || parseFloat(amount) <= 0)) ||
                            (currentStep === STEPS_BURN.length - 1 && !isConfirmed)
                              ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed' 
                              : 'bg-red-500 hover:bg-red-600 text-white'}`}
              >
                {currentStep === STEPS_BURN.length - 1 ? (
                  isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Confirm Burn'
                  )
                ) : (
                  <div className="flex items-center">
                    Next
                    <ChevronRight size={16} className="ml-1" />
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const CustomBuyModal: React.FC<CustomBuyModalProps> = ({
  isOpen,
  onClose,
  onCustomBuy,
  handleRefresh,
  tokenAddress,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>({}); // Individual amounts per wallet
  const [useRpc, setUseRpc] = useState<boolean>(false); // Toggle for useRpc
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string } | null>(null);
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const wallets = getWallets();
  const { showToast } = useToast();

  // Filter wallets based on search term
  const filteredWallets = useMemo(() => {
    if (!searchTerm) return wallets;
    return wallets.filter(wallet => 
      wallet.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [wallets, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      fetchTokenInfo();
    }
  }, [isOpen, tokenAddress]);

  // Initialize wallet amounts when wallets are selected/deselected
  useEffect(() => {
    const newWalletAmounts = { ...walletAmounts };
    
    // Add new wallets with default amount
    selectedWallets.forEach(wallet => {
      if (!newWalletAmounts[wallet]) {
        newWalletAmounts[wallet] = '0.1';
      }
    });
    
    // Remove unselected wallets
    Object.keys(newWalletAmounts).forEach(wallet => {
      if (!selectedWallets.includes(wallet)) {
        delete newWalletAmounts[wallet];
      }
    });
    
    setWalletAmounts(newWalletAmounts);
  }, [selectedWallets]);

  // Fetch token info for the provided token address
  const fetchTokenInfo = async () => {
    if (!tokenAddress) return;
    setIsLoadingTokenInfo(true);
    try {
      const savedConfig = loadConfigFromCookies();
      const rpcurl = (savedConfig as any).rpcEndpoint;
      const connection = new web3.Connection(rpcurl);

      // Here you would fetch the token metadata to get symbol
      // Simplified version - in a real app, you'd fetch actual metadata
      setTokenInfo({
        symbol: tokenAddress.slice(0, 4)
      });
    } catch (error) {
      console.error('Error fetching token info:', error);
      showToast('Failed to fetch token info', 'error');
    } finally {
      setIsLoadingTokenInfo(false);
    }
  };

  const handleNext = () => {
    // Step validations
    if (currentStep === 0) {
      if (selectedWallets.length === 0) {
        showToast('Please select at least one wallet', 'error');
        return;
      }
    }
    if (currentStep === 1) {
      // Check if any wallet has an invalid amount
      const hasInvalidAmount = Object.values(walletAmounts).some(
        amount => !amount || parseFloat(amount) <= 0
      );
      
      if (hasInvalidAmount) {
        showToast('Please enter valid amounts for all wallets', 'error');
        return;
      }
    }
    
    setCurrentStep((prev) => Math.min(prev + 1, STEPS_CUSTOMBUY.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCustomBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      
      // Build payload with individual wallet amounts
      const data = {
        tokenAddress: tokenAddress,
        privateKeys: selectedWallets,
        amounts: selectedWallets.map(wallet => parseFloat(walletAmounts[wallet])),
        useRpc: useRpc
      };

      const response = await fetch(`${baseUrl}/customBuy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showToast('Custom buy operation completed successfully', 'success');
      resetForm();
      onClose();
    } catch (error) {
      console.error('Custom buy execution error:', error);
      showToast('Custom buy operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedWallets([]);
    setWalletAmounts({});
    setUseRpc(false);
    setIsConfirmed(false);
    setCurrentStep(0);
    setSearchTerm('');
  };

  // Helper to handle wallet selection
  const toggleWalletSelection = (privateKey: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(privateKey)) {
        return prev.filter(key => key !== privateKey);
      } else {
        return [...prev, privateKey];
      }
    });
  };

  // Helper to update amount for a specific wallet
  const handleWalletAmountChange = (wallet: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWalletAmounts(prev => ({
        ...prev,
        [wallet]: value
      }));
    }
  };

  // Set the same amount for all wallets
  const setAmountForAllWallets = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const newAmounts = { ...walletAmounts };
      
      selectedWallets.forEach(wallet => {
        newAmounts[wallet] = value;
      });
      
      setWalletAmounts(newAmounts);
    }
  };

  // Calculate total buy amount across all wallets
  const calculateTotalBuyAmount = () => {
    return selectedWallets.reduce((total, wallet) => {
      return total + parseFloat(walletAmounts[wallet] || '0');
    }, 0).toFixed(4);
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };
  
  // Get wallet display from private key
  const getWalletDisplayFromKey = (privateKey: string) => {
    const wallet = wallets.find(w => w.privateKey === privateKey);
    return wallet 
      ? formatAddress(wallet.address)
      : privateKey.slice(0, 8);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        // Select Wallets
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10">
                <svg
                  className="w-5 h-5 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M16 10h2M6 14h12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">Select Wallets</h3>
            </div>
            
            {isLoadingTokenInfo ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div>
                <div className="mb-4 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                  <h4 className="text-sm font-medium text-green-500 mb-2">Token Information</h4>
                  <div className="text-sm text-neutral-300">
                    <span className="text-neutral-400">Address: </span>
                    {tokenAddress}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-300">
                      Available Wallets
                    </label>
                    <button 
                      onClick={() => {
                        if (selectedWallets.length === wallets.length) {
                          setSelectedWallets([]);
                        } else {
                          setSelectedWallets(wallets.map(w => w.privateKey));
                        }
                      }}
                      className="text-xs px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-all"
                    >
                      {selectedWallets.length === wallets.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-green-500/70 transition-all"
                      placeholder="Search wallets..."
                    />
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {filteredWallets.length > 0 ? (
                      filteredWallets.map((wallet) => (
                        <div
                          key={wallet.id}
                          onClick={() => toggleWalletSelection(wallet.privateKey)}
                          className={`flex items-center p-2.5 hover:bg-neutral-700/30 cursor-pointer border-b border-neutral-700/30 last:border-b-0 transition-all duration-150
                                    ${selectedWallets.includes(wallet.privateKey) ? 'bg-green-500/10' : ''}`}
                        >
                          <div className={`w-4 h-4 mr-2 rounded-full flex items-center justify-center transition-all duration-200
                                          ${selectedWallets.includes(wallet.privateKey)
                                            ? 'bg-green-500' 
                                            : 'border border-neutral-600'}`}>
                            {selectedWallets.includes(wallet.privateKey) && (
                              <CheckCircle size={12} className="text-neutral-900" />
                            )}
                          </div>
                          <div className="flex-1 flex justify-between items-center">
                            <span className="font-mono text-sm text-white">
                              {formatAddress(wallet.address)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-neutral-400 text-center">
                        No wallets found
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">
                    Selected: <span className="text-green-400 font-medium">{selectedWallets.length}</span> wallets
                  </span>
                </div>
              </div>
            )}
          </div>
        );
        
      case 1:
        // Configure Buy
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10">
                <svg
                  className="w-5 h-5 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v12M6 12h12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">Configure Buy</h3>
            </div>
            
            {/* Bulk amount setter */}
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-neutral-400">
                  Set amount for all wallets (SOL)
                </label>
                <div className="flex items-center">
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="0.1"
                      className="w-24 pl-8 pr-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm"
                      onChange={(e) => setAmountForAllWallets(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="ml-2 bg-green-600 text-xs rounded px-2 py-1.5 hover:bg-green-500 transition-colors"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="0.1"]') as HTMLInputElement;
                      setAmountForAllWallets(input?.value || '0.1');
                    }}
                  >
                    Apply to All
                  </button>
                </div>
              </div>
            </div>
            
            {/* Individual wallet amounts */}
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
              <h4 className="text-sm font-medium text-neutral-300 mb-3">Individual Wallet Amounts</h4>
              <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {selectedWallets.map((privateKey, index) => (
                  <div key={privateKey} className="flex items-center justify-between py-2 border-b border-neutral-700/30 last:border-b-0">
                    <div className="flex items-center">
                      <span className="text-neutral-400 text-xs mr-2 w-6">{index + 1}.</span>
                      <span className="font-mono text-sm text-white">{getWalletDisplayFromKey(privateKey)}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="relative">
                        <DollarSign size={12} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                        <input
                          type="text"
                          value={walletAmounts[privateKey] || '0.1'}
                          onChange={(e) => handleWalletAmountChange(privateKey, e.target.value)}
                          className="w-24 pl-7 pr-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm"
                          placeholder="0.1"
                        />
                      </div>
                      <span className="text-xs text-neutral-400 ml-2">SOL</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Use RPC toggle */}
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
              <div className="flex items-center justify-between">
                <label className="text-sm text-neutral-400">
                  Use RPC
                </label>
                <div 
                  onClick={() => setUseRpc(!useRpc)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    useRpc ? "bg-green-500" : "bg-neutral-600"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      useRpc ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
              <div className="text-xs text-neutral-500 mt-2">
                Toggle to use RPC for this transaction
              </div>
            </div>
            
            {/* Total summary */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-green-400">Total Buy Amount:</span>
                <span className="text-sm font-medium text-green-400">
                  {calculateTotalBuyAmount()} SOL
                </span>
              </div>
            </div>
          </div>
        );
        
      case 2:
        // Review Operation
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10">
                <svg
                  className="w-5 h-5 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">Review Operation</h3>
            </div>
            
            <div className="flex space-x-4">
              {/* Left column - Token and Operation Details */}
              <div className="w-1/2 space-y-4">
                {/* Token Details */}
                <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                  <h4 className="text-sm font-medium text-green-500 mb-3">
                    Token Details
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-neutral-400">
                        Address:
                      </span>
                      <span className="text-sm text-neutral-300 ml-2">
                        {`${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-400">
                        Symbol:
                      </span>
                      <span className="text-sm text-neutral-300 ml-2">
                        {tokenInfo?.symbol || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Operation Summary */}
                <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                  <h4 className="text-sm font-medium text-green-500 mb-3">
                    Operation Details
                  </h4>
                  <div className="space-y-2">
                    <div className="mb-2">
                      <span className="text-sm text-neutral-400">Use RPC: </span>
                      <span className="text-sm text-neutral-300 font-medium">{useRpc ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-neutral-400">Total Wallets: </span>
                      <span className="text-sm text-neutral-300 font-medium">{selectedWallets.length}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-neutral-400">Total Buy Amount: </span>
                      <span className="text-sm text-neutral-300 font-medium">
                        {calculateTotalBuyAmount()} SOL
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Confirmation */}
                <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <input
                        type="checkbox"
                        id="confirm"
                        checked={isConfirmed}
                        onChange={(e) => setIsConfirmed(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 border border-neutral-600 rounded-md peer-checked:bg-green-500 peer-checked:border-0 transition-all"></div>
                      <CheckCircle size={14} className={`absolute top-0 left-0 text-white transition-all ${isConfirmed ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                    <label htmlFor="confirm" className="text-sm text-neutral-400 leading-relaxed">
                      I confirm that I want to buy {tokenInfo?.symbol || 'token'} using the specified amounts
                      across {selectedWallets.length} wallets with useRpc set to {useRpc ? 'enabled' : 'disabled'}. This action cannot be undone.
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Right column - Selected Wallets */}
              <div className="w-1/2">
                <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50 h-full">
                  <h4 className="text-sm font-medium text-green-500 mb-3">
                    Selected Wallets
                  </h4>
                  
                  <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {selectedWallets.map((privateKey, index) => (
                      <div key={privateKey} className="text-xs flex justify-between py-1.5 border-b border-neutral-700/30 last:border-b-0">
                        <div className="flex items-center">
                          <span className="text-neutral-400 mr-2">{index + 1}.</span>
                          <span className="font-mono text-white">{getWalletDisplayFromKey(privateKey)}</span>
                        </div>
                        <span className="text-green-400 font-medium">{walletAmounts[privateKey]} SOL</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-neutral-900 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden transform animate-slide-up">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-neutral-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
              <DollarSign size={16} className="text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              Custom Buy
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full h-1 bg-neutral-800">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(currentStep + 1) / STEPS_CUSTOMBUY.length * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="p-6">
          <form
            onSubmit={
              currentStep === STEPS_CUSTOMBUY.length - 1
                ? handleCustomBuy
                : (e) => e.preventDefault()
            }
          >
            {renderStepContent()}
            
            {/* Action Buttons */}
            <div className="flex justify-between mt-8 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={currentStep === 0 ? onClose : handleBack}
                disabled={isSubmitting}
                className="px-4 py-2 text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-all"
              >
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </button>
              <button
                type={currentStep === STEPS_CUSTOMBUY.length - 1 ? 'submit' : 'button'}
                onClick={currentStep === STEPS_CUSTOMBUY.length - 1 ? undefined : handleNext}
                disabled={
                  isSubmitting ||
                  (currentStep === STEPS_CUSTOMBUY.length - 1 && !isConfirmed)
                }
                className={`px-4 py-2 text-white rounded-lg flex items-center transition-all
                          ${isSubmitting || (currentStep === STEPS_CUSTOMBUY.length - 1 && !isConfirmed)
                            ? 'bg-neutral-700 cursor-not-allowed opacity-50' 
                            : 'bg-green-500 hover:bg-green-600'}`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    {currentStep === STEPS_CUSTOMBUY.length - 1 ? 'Confirm Operation' : (
                      <span className="flex items-center">
                        Next
                        <ChevronRight size={16} className="ml-2" />
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const CleanerTokensModal: React.FC<CleanerTokensModalProps> = ({
  isOpen,
  onClose,
  onCleanerTokens,
  handleRefresh,
  tokenAddress,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sellerWallet, setSellerWallet] = useState<string>('');
  const [buyerKey, setBuyerKey] = useState<string>('');
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const wallets = getWallets();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
    }
  }, [isOpen]);

  const handleNext = () => {
    // Validations based on the current step
    if (currentStep === 0 && !sellerWallet) {
      showToast('Please select seller wallet', 'error');
      return;
    }
    if (currentStep === 1) {
      if (!buyerKey) {
        showToast('Please select a buyer', 'error');
        return;
      }
      if (!buyAmount || parseFloat(buyAmount) <= 0) {
        showToast('Please enter a valid buy amount', 'error');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS_BUYSELL.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleBuySell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      // Build payload using tokenAddress prop and the new buyAmount value
      const data = {
        sellerWallet,
        buyerKey,
        tokenAddress,
        buyAmount: parseFloat(buyAmount),
      };

      const response = await fetch(`${baseUrl}/cleaner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showToast('Buy operation completed successfully', 'success');
      resetForm();
      onClose();
    } catch (error) {
      console.error('Buy operation error:', error);
      showToast('Buy operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSellerWallet('');
    setBuyerKey('');
    setBuyAmount('');
    setIsConfirmed(false);
    setCurrentStep(0);
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform animate-slide-up">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-neutral-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
              <svg
                className="w-4 h-4 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M16 10h2M6 14h12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Token Buy Operation
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full h-1 bg-neutral-800">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS_BUYSELL.length) * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={currentStep === STEPS_BUYSELL.length - 1 ? handleBuySell : (e) => e.preventDefault()}>
            {/* Step 0: Select Seller */}
            {currentStep === 0 && (
              <div className="animate-fade-in">
                <div className="flex items-center space-x-2 mb-4">
                  <svg
                    className="w-5 h-5 text-green-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M16 10h2M6 14h12" />
                  </svg>
                  <h3 className="text-lg font-medium text-white">Select Seller Wallet</h3>
                </div>
                
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {wallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        onClick={() => setSellerWallet(wallet.privateKey)}
                        className={`flex items-center p-2.5 hover:bg-neutral-700/30 cursor-pointer border-b border-neutral-700/30 last:border-b-0 transition-all duration-150
                                  ${sellerWallet === wallet.privateKey ? 'bg-green-500/10' : ''}`}
                      >
                        <div className={`w-4 h-4 mr-2 rounded-full flex items-center justify-center transition-all duration-200
                                        ${sellerWallet === wallet.privateKey
                                          ? 'bg-green-500' 
                                          : 'border border-neutral-600'}`}>
                          {sellerWallet === wallet.privateKey && (
                            <CheckCircle size={12} className="text-neutral-900" />
                          )}
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                          <span className="font-mono text-sm text-white">{formatAddress(wallet.address)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Select Buyer and Enter Amount */}
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <div className="flex items-center space-x-2 mb-4">
                  <svg
                    className="w-5 h-5 text-green-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  <h3 className="text-lg font-medium text-white">
                    Select Buyer &amp; Enter Buy Amount
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Buyer Selection */}
                  <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                    <label className="text-sm font-medium text-neutral-300 block mb-2">
                      Select Buyer Wallet
                    </label>
                    <select
                      value={buyerKey}
                      onChange={(e) => setBuyerKey(e.target.value)}
                      className="w-full bg-neutral-700 border border-neutral-600 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-green-500/70 transition-all"
                    >
                      <option value="">Select a wallet</option>
                      {wallets
                        .filter((wallet) => wallet.privateKey !== sellerWallet)
                        .map((wallet) => (
                          <option key={wallet.id} value={wallet.privateKey}>
                            {formatAddress(wallet.address)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                    <label className="text-sm font-medium text-neutral-300 block mb-2">
                      Buy Back Tokens (Percentage)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="Enter buy percentage"
                        className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-white focus:outline-none focus:border-green-500/70 transition-all"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-sm text-neutral-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Review Operation */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center space-x-2 mb-4">
                  <svg
                    className="w-5 h-5 text-green-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <h3 className="text-lg font-medium text-white">Review Operation</h3>
                </div>

                <div className="flex space-x-4">
                  {/* Left Side - Transaction Summary */}
                  <div className="w-1/2 space-y-4">
                    {/* Seller Details */}
                    <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                      <h4 className="text-sm font-medium text-green-400 mb-3">
                        Seller Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-400">Wallet:</span>
                          <span className="text-sm text-white font-mono">
                            {formatAddress(sellerWallet)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-400">Token:</span>
                          <span className="text-sm text-white font-mono">
                            {formatAddress(tokenAddress)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Buyer Details */}
                    <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50">
                      <h4 className="text-sm font-medium text-green-400 mb-3">
                        Buyer Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-400">Wallet:</span>
                          <span className="text-sm text-white font-mono">
                            {formatAddress(buyerKey)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Amount Details */}
                  <div className="w-1/2">
                    <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700/50 h-full">
                      <h4 className="text-sm font-medium text-green-400 mb-3">
                        Operation Details
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-neutral-400">Buy Amount:</span>
                          <div className="flex items-center bg-neutral-700 px-3 py-1.5 rounded">
                            <span className="text-base font-semibold text-white mr-2">
                              {buyAmount}
                            </span>
                            <span className="text-xs text-neutral-400">SOL</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-neutral-700/50">
                          <div className="flex items-center px-3 py-3 bg-neutral-700/30 rounded-lg">
                            <div className="relative mx-1">
                              <input
                                type="checkbox"
                                id="confirmBuySell"
                                checked={isConfirmed}
                                onChange={(e) => setIsConfirmed(e.target.checked)}
                                className="peer sr-only"
                              />
                              <div className="w-5 h-5 border border-neutral-600 rounded-md peer-checked:bg-green-500 peer-checked:border-0 transition-all"></div>
                              <CheckCircle size={14} className={`absolute top-0.5 left-0.5 text-white transition-all ${isConfirmed ? 'opacity-100' : 'opacity-0'}`} />
                            </div>
                            <label htmlFor="confirmBuySell" className="text-neutral-300 text-sm ml-2 cursor-pointer select-none">
                              I confirm that I want to use {buyAmount} SOL to buy tokens with the selected buyer. This action cannot be undone.
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={currentStep === 0 ? onClose : handleBack}
                className="px-4 py-2 text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-all"
              >
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </button>
              <button
                type={currentStep === STEPS_BUYSELL.length - 1 ? 'submit' : 'button'}
                onClick={currentStep === STEPS_BUYSELL.length - 1 ? undefined : handleNext}
                disabled={
                  isSubmitting ||
                  (currentStep === STEPS_BUYSELL.length - 1 && !isConfirmed)
                }
                className={`px-4 py-2 text-white rounded-lg flex items-center transition-all
                          ${(currentStep === STEPS_BUYSELL.length - 1 && !isConfirmed) || isSubmitting
                            ? 'bg-neutral-700 cursor-not-allowed opacity-50' 
                            : 'bg-green-500 hover:bg-green-600'}`}
              >
                {currentStep === STEPS_BUYSELL.length - 1 ? (
                  isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Operation</span>
                  )
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
  handleRefresh,
  solBalances,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [mintPubkey, setMintPubkey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [tokenData, setTokenData] = useState({
    name: '',
    symbol: '',
    description: '',
    telegram: '',
    twitter: '',
    website: '',
    file: ''
  });
  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const generateMintPubkey = async () => {
    setIsGenerating(true);
    try {
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      const mintResponse = await fetch(`${baseUrl}/generate-mint`);
      const data = await mintResponse.json();
      setMintPubkey(data.pubkey);
      showToast("Mint pubkey generated successfully", "success");
    } catch (error) {
      console.error('Error generating mint pubkey:', error);
      showToast("Failed to generate mint pubkey", "error");
    }
    setIsGenerating(false);
  };

  // Filter wallets that have SOL balance > 0 using the solBalances map
  const wallets = getWallets().filter(wallet => (solBalances.get(wallet.address) || 0) > 0);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
    }
  }, [isOpen]);

  const handleWalletSelection = (privateKey: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(privateKey)) {
        return prev.filter(key => key !== privateKey);
      }
      return [...prev, privateKey];
    });
  };

  const handleAmountChange = (privateKey: string, amount: string) => {
    if (amount === '' || /^\d*\.?\d*$/.test(amount)) {
      setWalletAmounts(prev => ({
        ...prev,
        [privateKey]: amount
      }));
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0:
        if (!tokenData.name || !tokenData.symbol || !tokenData.file || !mintPubkey) {
          showToast("Name, symbol, and logo URL are required", "error");
          return false;
        }
        break;
      case 1:
        if (selectedWallets.length === 0) {
          showToast("Please select at least one wallet", "error");
          return false;
        }
        const hasAllAmounts = selectedWallets.every(wallet => 
          walletAmounts[wallet] && Number(walletAmounts[wallet]) > 0
        );
        if (!hasAllAmounts) {
          showToast("Please enter valid amounts for all selected wallets", "error");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setCurrentStep(prev => Math.min(prev + 1, STEPS_DEPLOY.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || !mintPubkey) return;

    setIsSubmitting(true);
    const data = {
      privateKeys: selectedWallets.join(','),
      solAmounts: selectedWallets.map(key => walletAmounts[key]),
      createTokenMetadata: {
        ...tokenData
      },
      mintPubkey,
      devMode
    };

    try {
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showToast("Token deployment initiated successfully", "success");
      setSelectedWallets([]);
      setWalletAmounts({});
      setMintPubkey('');
      setTokenData({
        name: '',
        symbol: '',
        description: '',
        telegram: '',
        twitter: '',
        website: '',
        file: ''
      });
      setIsConfirmed(false);
      setCurrentStep(0);
      setIsSubmitting(false);
      onClose();
    } catch (error) {
      console.error('Error:', error);
      showToast("Token deployment failed", "error");
      setIsSubmitting(false);
    }
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format SOL balance for display
  const formatSolBalance = (balance: number) => {
    return balance.toFixed(4);
  };

  // Filter wallets based on search term
  const filterWallets = (walletList, search: string) => {
    if (!search) return walletList;
    return walletList.filter(wallet => 
      wallet.address.toLowerCase().includes(search.toLowerCase())
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v8m-4-4h8" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Token Details</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-300">Mint Pubkey * DO NOT SHARE!</label>
                <button
                  type="button"
                  onClick={generateMintPubkey}
                  disabled={isGenerating}
                  className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
                    isGenerating 
                      ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed' 
                      : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                  }`}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={mintPubkey}
                  onChange={(e) => setMintPubkey(e.target.value)}
                  className="w-full pl-4 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="Enter or generate a mint pubkey"
                />
              </div>
            </div>

            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Name *</label>
                    <input
                      type="text"
                      value={tokenData.name}
                      onChange={(e) => setTokenData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Enter token name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Symbol *</label>
                    <input
                      type="text"
                      value={tokenData.symbol}
                      onChange={(e) => setTokenData(prev => ({ ...prev, symbol: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Enter token symbol"
                    />
                  </div>
                </div>
  
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Description</label>
                  <textarea
                    value={tokenData.description}
                    onChange={(e) => setTokenData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all min-h-24"
                    placeholder="Describe your token"
                    rows={3}
                  />
                </div>
  
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Telegram</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.8,5.1c-0.2-0.8-0.9-1.4-1.7-1.6C18.4,3,12,3,12,3S5.6,3,3.9,3.5C3.1,3.7,2.4,4.3,2.2,5.1C1.7,6.8,1.7,10,1.7,10s0,3.2,0.5,4.9c0.2,0.8,0.9,1.4,1.7,1.6C5.6,17,12,17,12,17s6.4,0,8.1-0.5c0.8-0.2,1.5-0.8,1.7-1.6c0.5-1.7,0.5-4.9,0.5-4.9S22.3,6.8,21.8,5.1z M9.9,13.1V6.9l5.4,3.1L9.9,13.1z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={tokenData.telegram}
                        onChange={(e) => setTokenData(prev => ({ ...prev, telegram: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="t.me/yourgroup"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Twitter</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.38-.737S11.977 6.323 12 8v1c-3.245.083-6.135-1.395-8-4 0 0-4.182 7.433 4 11-1.872 1.247-3.739 2.088-6 2 3.308 1.803 6.913 2.423 10.034 1.517 3.58-1.04 6.522-3.723 7.651-7.742a13.84 13.84 0 0 0 .497-3.753C20.18 7.773 21.692 5.25 22 4.009z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={tokenData.twitter}
                        onChange={(e) => setTokenData(prev => ({ ...prev, twitter: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="@yourhandle"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Website</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0zm14-6a9 9 0 0 0-4-2m-6 2a9 9 0 0 0-2 4m2 6a9 9 0 0 0 4 2m6-2a9 9 0 0 0 2-4" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={tokenData.website}
                        onChange={(e) => setTokenData(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="https://yoursite.com"
                      />
                    </div>
                  </div>
                </div>
  
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">Logo URL *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={tokenData.file}
                      onChange={(e) => setTokenData(prev => ({ ...prev, file: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Enter logo URL"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
                  <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Select Wallets & Order</h3>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="dev-mode" className="text-sm font-medium text-neutral-300 cursor-pointer flex items-center">
                    Delay Mode
                    <div className="relative inline-block ml-2" title="Creates only the token and first buy transaction. Use this for testing.">
                      <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </svg>
                    </div>
                  </label>
                  <div 
                    onClick={() => {
                      setDevMode(!devMode);
                      if (!devMode && selectedWallets.length > 1) {
                        setSelectedWallets([selectedWallets[0]]);
                      }
                    }}
                    className={`w-10 h-5 rounded-full cursor-pointer transition-all duration-200 flex items-center ${devMode ? 'bg-green-500' : 'bg-neutral-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transform transition-all duration-200 ${devMode ? 'translate-x-5' : 'translate-x-1'}`}></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedWallets.length === wallets.length) {
                      setSelectedWallets([]);
                    } else {
                      setSelectedWallets(wallets.map(w => w.privateKey));
                    }
                  }}
                  className="text-sm text-green-500 hover:text-green-400 font-medium transition duration-200"
                >
                  {selectedWallets.length === wallets.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
  
            {/* Search Bar */}
            <div className="relative mb-2">
              <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                placeholder="Search wallets..."
              />
            </div>

            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="p-4">
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                  {/* Selected Wallets */}
                  {selectedWallets.length > 0 && (
                    <div className="mb-2">
                      <div className="text-sm font-medium text-neutral-400 mb-2">Selected Wallets</div>
                      {selectedWallets.map((privateKey, index) => {
                        const wallet = wallets.find(w => w.privateKey === privateKey);
                        const solBalance = wallet ? solBalances.get(wallet.address) || 0 : 0;
                        
                        return (
                          <div
                            key={wallet?.id}
                            className="p-3 rounded-lg border border-green-500 bg-green-500/10 mb-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (index > 0) {
                                        const newOrder = [...selectedWallets];
                                        [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                                        setSelectedWallets(newOrder);
                                      }
                                    }}
                                    disabled={index === 0}
                                    className={`p-1 rounded hover:bg-neutral-700 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M5 15l7-7 7 7"/>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (index < selectedWallets.length - 1) {
                                        const newOrder = [...selectedWallets];
                                        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                        setSelectedWallets(newOrder);
                                      }
                                    }}
                                    disabled={index === selectedWallets.length - 1}
                                    className={`p-1 rounded hover:bg-neutral-700 ${index === selectedWallets.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M19 9l-7 7-7-7"/>
                                    </svg>
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-green-500">{index === 0 ? 'Developer' : `#${index + 1}`}</span>
                                    <span className="text-sm font-medium text-white">
                                      {wallet ? formatAddress(wallet.address) : 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-neutral-400">Balance:</span>
                                    <span className="text-sm font-medium text-neutral-300">{formatSolBalance(solBalance)} SOL</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <input
                                    type="text"
                                    value={walletAmounts[privateKey] || ''}
                                    onChange={(e) => handleAmountChange(privateKey, e.target.value)}
                                    placeholder="Amount"
                                    className="w-32 pl-9 pr-2 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleWalletSelection(privateKey)}
                                  className="p-1 rounded hover:bg-neutral-700"
                                >
                                  <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Available Wallets */}
                  <div>
                    <div className="text-sm font-medium text-neutral-400 mb-2">Available Wallets</div>
                    {filterWallets(wallets.filter(w => !selectedWallets.includes(w.privateKey)), searchTerm).map((wallet) => {
                      const solBalance = solBalances.get(wallet.address) || 0;
                      
                      return (
                        <div
                          key={wallet.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-neutral-700 hover:border-green-500/50 hover:bg-neutral-800/50 transition-all duration-200 mb-2"
                        >
                          <div className="flex items-center gap-4">
                            <div 
                              onClick={() => handleWalletSelection(wallet.privateKey)}
                              className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center cursor-pointer hover:border-green-500 transition-all"
                            >
                              <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14"/>
                              </svg>
                            </div>
                            <div className="space-y-1">
                              <span className="text-sm font-medium text-white">
                                {formatAddress(wallet.address)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-400">Balance:</span>
                                <span className="text-sm font-medium text-neutral-300">{formatSolBalance(solBalance)} SOL</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filterWallets(wallets.filter(w => !selectedWallets.includes(w.privateKey)), searchTerm).length === 0 && (
                      <div className="text-center py-4 text-neutral-400">
                        {searchTerm ? "No wallets found matching your search" : "No wallets available"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
  
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Review Deployment</h3>
            </div>
  
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-neutral-400 mb-3">Token Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="text-sm text-neutral-400">Name</div>
                        <div className="text-base font-medium text-white">{tokenData.name}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-neutral-400">Symbol</div>
                        <div className="text-base font-medium text-white">{tokenData.symbol}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-neutral-400">Logo Preview</div>
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-2 w-24 h-24 flex items-center justify-center">
                          {tokenData.file ? (
                            <img 
                              src={tokenData.file}
                              alt="Token Logo"
                              className="max-w-full max-h-full rounded object-contain"
                              onError={(e) => {
                                e.currentTarget.src = '/api/placeholder/96/96';
                                e.currentTarget.alt = 'Failed to load';
                              }}
                            />
                          ) : (
                            <div className="text-sm text-neutral-400">No logo</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
  
                  <div className="h-px bg-neutral-700/50" />
  
                  <div>
                    <h4 className="text-sm font-medium text-neutral-400 mb-3">Selected Wallets</h4>
                    <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                      {selectedWallets.map((key, index) => {
                        const wallet = wallets.find(w => w.privateKey === key);
                        return (
                          <div key={index} className="flex justify-between items-center p-3 bg-neutral-800/50 rounded-lg mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-400 text-xs w-6">{index + 1}.</span>
                              <span className="font-mono text-sm text-white">
                                {wallet ? formatAddress(wallet.address) : 'Unknown'}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-green-500">{walletAmounts[key]} SOL</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div 
                    onClick={() => setIsConfirmed(!isConfirmed)}
                    className="relative w-5 h-5 cursor-pointer"
                  >
                    <div className={`w-5 h-5 border rounded transition-all ${isConfirmed ? 'bg-green-500 border-green-500' : 'border-neutral-600'}`}></div>
                    {isConfirmed && (
                      <svg className="w-5 h-5 absolute top-0 left-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <label 
                    onClick={() => setIsConfirmed(!isConfirmed)}
                    className="text-sm text-neutral-300 leading-relaxed cursor-pointer"
                  >
                    I confirm that I want to deploy this token using {selectedWallets.length} wallet{selectedWallets.length !== 1 ? 's' : ''}.
                    This action cannot be undone.
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-neutral-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden transform animate-slide-up">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-neutral-800">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/10 mr-3">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Deploy Token
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full h-1 bg-neutral-800">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(currentStep + 1) / STEPS_DEPLOY.length * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <form onSubmit={currentStep === STEPS_DEPLOY.length - 1 ? handleDeploy : (e) => e.preventDefault()}>
            <div className="min-h-[300px]">
              {renderStepContent()}
            </div>

            <div className="flex justify-between mt-8 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={currentStep === 0 ? onClose : handleBack}
                disabled={isSubmitting}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-all"
              >
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </button>

              <button
                type={currentStep === STEPS_DEPLOY.length - 1 ? 'submit' : 'button'}
                onClick={currentStep === STEPS_DEPLOY.length - 1 ? undefined : handleNext}
                disabled={currentStep === STEPS_DEPLOY.length - 1 ? (isSubmitting || !isConfirmed) : isSubmitting}
                className={`px-5 py-2 rounded-lg flex items-center transition-all ${
                  currentStep === STEPS_DEPLOY.length - 1 && (isSubmitting || !isConfirmed)
                    ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {currentStep === STEPS_DEPLOY.length - 1 ? (
                  isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Deploying...</span>
                    </>
                  ) : 'Confirm Deploy'
                ) : (
                  <span className="flex items-center">
                    Next
                    <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};