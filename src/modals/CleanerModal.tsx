import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, ChevronRight, X, DollarSign, Info, Search, Settings, ArrowDown, Trash2, Plus, PlusCircle } from 'lucide-react';
import { getWallets, loadConfigFromCookies } from '../Utils';
import { useToast } from "../Notifications";
// Import the cleaner operation functions at the top of the file
import { executeCleanerOperation, validateCleanerInputs, WalletInfo } from '../utils/cleaner';


const STEPS_BUYSELL = ['Configure Sellers', 'Configure Buyers', 'Review'];

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CleanerTokensModalProps extends BaseModalProps {
  onCleanerTokens: (data: any) => void;
  handleRefresh: () => void;
  tokenAddress: string; // Automatically used token address
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
}

// Updated interfaces for handling multiple sellers and buyers with direct SOL amounts
interface SellerConfig {
  privateKey: string;
  sellPercentage: string;
  estimatedSolValue: number; // New field to store estimated SOL value
  buyers: BuyerConfig[];
}

interface BuyerConfig {
  privateKey: string;
  buyAmount: string; // Changed from buyPercentage to buyAmount (direct SOL amount)
}

export const CleanerTokensModal: React.FC<CleanerTokensModalProps> = ({
  isOpen,
  onClose,
  onCleanerTokens,
  handleRefresh,
  tokenAddress,
  solBalances,
  tokenBalances
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sellers, setSellers] = useState<SellerConfig[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // State for wallet selection interface
  const [sellerSearchTerm, setSellerSearchTerm] = useState('');
  const [buyerSearchTerm, setBuyerSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('address');
  const [sortDirection, setSortDirection] = useState('asc');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [showInfoTip, setShowInfoTip] = useState(false);
  const [showSellInfoTip, setShowSellInfoTip] = useState(false);
  
  // Current selection state
  const [currentSellerIndex, setCurrentSellerIndex] = useState(0);

  const wallets = getWallets();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      resetForm();
    }
  }, [isOpen]);

  // Enhanced utility functions
  
  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format SOL balance for display
  const formatSolBalance = (balance: number) => {
    return balance.toFixed(4);
  };

  // Format token balance for display
  const formatTokenBalance = (balance: number) => {
    return balance.toFixed(6);
  };

  // Get wallet SOL balance by address
  const getWalletBalance = (address: string) => {
    return solBalances.has(address) ? solBalances.get(address) : 0;
  };

  // Get wallet token balance by address
  const getWalletTokenBalance = (address: string) => {
    return tokenBalances.has(address) ? tokenBalances.get(address) : 0;
  };

  // Function to check for insufficient SOL balance
  const hasInsufficientSOL = (address: string) => {
    const solBalance = getWalletBalance(address) || 0;
    return solBalance < 0.01; // Threshold for "insufficient" SOL
  };

  // New function to estimate SOL value from selling tokens
  const fetchEstimatedSellAmount = async (tokenAddress: string, tokenAmount: number): Promise<number> => {
    try {
      if (!tokenAddress || !tokenAmount || tokenAmount <= 0) {
        return 0;
      }
        
      const savedConfig = loadConfigFromCookies();
      const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
      const response = await fetch(`${baseUrl}/api/tokens/route`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "sell",
          tokenMintAddress: tokenAddress,
          amount: Math.floor(tokenAmount * 1e9).toString(),
          rpcUrl: savedConfig?.rpcEndpoint || "https://api.mainnet-beta.solana.com"
        })
      });
      
      if (!response.ok) {
        console.error(`Sell estimation API error: ${response.status}`);
        return 0;
      }
      
      const data = await response.json();
      
      if (data.success && data.outputAmount) {
        const solAmount = parseFloat(data.outputAmount) / 1e9;
        return isNaN(solAmount) ? 0 : solAmount;
      }
      
      return 0;
    } catch (error) {
      console.error("Error fetching sell estimate:", error);
      return 0;
    }
  };

  // Function to update estimated SOL value for a seller
  const updateSellerEstimatedValue = async (index: number) => {
    const seller = sellers[index];
    const sellerWallet = getWalletByPrivateKey(seller.privateKey);
    if (!sellerWallet) return;

    const tokenBalance = getWalletTokenBalance(sellerWallet.address) || 0;
    const sellPercentage = parseFloat(seller.sellPercentage) || 0;
    const tokenAmountToSell = tokenBalance * (sellPercentage / 100);
    
    if (tokenAmountToSell > 0) {
      const estimatedSol = await fetchEstimatedSellAmount(tokenAddress, tokenAmountToSell);
      const updatedSellers = [...sellers];
      updatedSellers[index].estimatedSolValue = estimatedSol;
      setSellers(updatedSellers);
    }
  };

  // Get available wallets for seller selection (excluding already selected sellers and only with token balance > 0)
  const getAvailableSellerWallets = () => {
    const selectedSellerKeys = sellers.map(seller => seller.privateKey);
    return wallets.filter(wallet => 
      !selectedSellerKeys.includes(wallet.privateKey) && 
      (getWalletTokenBalance(wallet.address) || 0) > 0
    );
  };

  // Get available wallets for buyer selection (excluding the current seller)
  const getAvailableBuyerWallets = (sellerPrivateKey: string) => {
    return wallets.filter(wallet => wallet.privateKey !== sellerPrivateKey);
  };

  // Get wallet by private key
  const getWalletByPrivateKey = (privateKey: string) => {
    return wallets.find(wallet => wallet.privateKey === privateKey);
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
    
    // Then apply balance filter
    if (balanceFilter !== 'all') {
      if (balanceFilter === 'nonZero') {
        filtered = filtered.filter(wallet => (getWalletBalance(wallet.address) || 0) > 0);
      } else if (balanceFilter === 'highBalance') {
        filtered = filtered.filter(wallet => (getWalletBalance(wallet.address) || 0) >= 0.1);
      } else if (balanceFilter === 'lowBalance') {
        filtered = filtered.filter(wallet => (getWalletBalance(wallet.address) || 0) < 0.1 && (getWalletBalance(wallet.address) || 0) > 0);
      } else if (balanceFilter === 'hasTokens') {
        filtered = filtered.filter(wallet => (getWalletTokenBalance(wallet.address) || 0) > 0);
      }
    }
    
    // Finally, sort the wallets
    return filtered.sort((a, b) => {
      if (sortOption === 'address') {
        return sortDirection === 'asc' 
          ? a.address.localeCompare(b.address)
          : b.address.localeCompare(a.address);
      } else if (sortOption === 'balance') {
        const balanceA = getWalletBalance(a.address) || 0;
        const balanceB = getWalletBalance(b.address) || 0;
        return sortDirection === 'asc' ? balanceA - balanceB : balanceB - balanceA;
      } else if (sortOption === 'tokenBalance') {
        const tokenBalanceA = getWalletTokenBalance(a.address) || 0;
        const tokenBalanceB = getWalletTokenBalance(b.address) || 0;
        return sortDirection === 'asc' ? tokenBalanceA - tokenBalanceB : tokenBalanceB - tokenBalanceA;
      }
      return 0;
    });
  };

  // Add a new seller to the list
  const addSeller = async (privateKey: string) => {
    const newSeller: SellerConfig = {
      privateKey,
      sellPercentage: '100', // Default to 100%
      estimatedSolValue: 0, // Will be calculated
      buyers: [] // No buyers initially
    };
    
    const newSellers = [...sellers, newSeller];
    setSellers(newSellers);
    
    // Calculate estimated SOL value for the new seller
    const sellerWallet = getWalletByPrivateKey(privateKey);
    if (sellerWallet) {
      const tokenBalance = getWalletTokenBalance(sellerWallet.address) || 0;
      if (tokenBalance > 0) {
        const estimatedSol = await fetchEstimatedSellAmount(tokenAddress, tokenBalance);
        newSellers[newSellers.length - 1].estimatedSolValue = estimatedSol;
        setSellers([...newSellers]);
      }
    }
  };

  // Update a seller's sell percentage and recalculate estimated SOL value
  const updateSellerPercentage = async (index: number, percentage: string) => {
    const updatedSellers = [...sellers];
    updatedSellers[index].sellPercentage = percentage;
    setSellers(updatedSellers);
    
    // Recalculate estimated SOL value
    await updateSellerEstimatedValue(index);
  };

  // Remove a seller from the list
  const removeSeller = (index: number) => {
    const updatedSellers = [...sellers];
    updatedSellers.splice(index, 1);
    setSellers(updatedSellers);
  };

  // Add a buyer to a specific seller
  const addBuyer = (sellerIndex: number, buyerPrivateKey: string) => {
    const updatedSellers = [...sellers];
    updatedSellers[sellerIndex].buyers.push({
      privateKey: buyerPrivateKey,
      buyAmount: '0.1' // Default to 0.1 SOL
    });
    setSellers(updatedSellers);
  };

  // Update a buyer's buy amount
  const updateBuyerAmount = (sellerIndex: number, buyerIndex: number, amount: string) => {
    const updatedSellers = [...sellers];
    updatedSellers[sellerIndex].buyers[buyerIndex].buyAmount = amount;
    setSellers(updatedSellers);
  };

  // Remove a buyer from a specific seller
  const removeBuyer = (sellerIndex: number, buyerIndex: number) => {
    const updatedSellers = [...sellers];
    updatedSellers[sellerIndex].buyers.splice(buyerIndex, 1);
    setSellers(updatedSellers);
  };

  const handleNext = () => {
    // Validations based on the current step
    if (currentStep === 0) {
      if (sellers.length === 0) {
        showToast('Please add at least one seller', 'error');
        return;
      }
      
      // Validate each seller has a valid percentage
      const invalidSeller = sellers.find(
        seller => !seller.sellPercentage || 
                  parseFloat(seller.sellPercentage) <= 0 || 
                  parseFloat(seller.sellPercentage) > 100
      );
      
      if (invalidSeller) {
        showToast('Please enter valid sell percentages (1-100) for all sellers', 'error');
        return;
      }
      
      // Check for insufficient SOL balance
      const lowSOLSeller = sellers.find(
        seller => hasInsufficientSOL(getWalletByPrivateKey(seller.privateKey)?.address || '')
      );

      if (lowSOLSeller) {
        showToast('One or more sellers have insufficient SOL balance', 'error');
        return;
      }
    }
    
    if (currentStep === 1) {
      // Check if all sellers have at least one buyer
      const sellerWithoutBuyers = sellers.findIndex(seller => seller.buyers.length === 0);
      if (sellerWithoutBuyers !== -1) {
        showToast(`Please add at least one buyer for seller ${sellerWithoutBuyers + 1}`, 'error');
        return;
      }
      
      // Validate each buyer has a valid SOL amount
      for (let i = 0; i < sellers.length; i++) {
        const invalidBuyer = sellers[i].buyers.find(
          buyer => !buyer.buyAmount || 
                   parseFloat(buyer.buyAmount) <= 0 || 
                   parseFloat(buyer.buyAmount) > 100 // Max 100 SOL per buy
        );
        
        if (invalidBuyer) {
          showToast(`Please enter valid buy amounts (0.001-100 SOL) for all buyers of seller ${i + 1}`, 'error');
          return;
        }
      }
    }
    
    setCurrentStep((prev) => Math.min(prev + 1, STEPS_BUYSELL.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Helper function to create a delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Updated handleBuySell function to work with direct SOL amounts
  const handleBuySell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    
    // Check for insufficient SOL balance before submitting
    const lowSOLSeller = sellers.find(
      seller => hasInsufficientSOL(getWalletByPrivateKey(seller.privateKey)?.address || '')
    );

    if (lowSOLSeller) {
      showToast('Cannot proceed: One or more sellers have insufficient SOL balance', 'error');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      // Track which sellers have already sold their tokens
      const sellersProcessed = new Set<string>();
      
      // Process each seller-buyer pair
      for (const seller of sellers) {
        const sellerPercentage = parseFloat(seller.sellPercentage);
        
        // Get seller wallet info
        const sellerWallet = getWalletByPrivateKey(seller.privateKey);
        if (!sellerWallet) {
          console.error('Seller wallet not found');
          failCount++;
          continue;
        }
        
        // Get seller's token balance
        const tokenBalance = getWalletTokenBalance(sellerWallet.address) || 0;
        
        // Check if this seller has already sold their tokens
        const isFirstBuyerForSeller = !sellersProcessed.has(seller.privateKey);
        
        // For each buyer of this seller
        for (const buyer of seller.buyers) {
          // Get buyer wallet info
          const buyerWallet = getWalletByPrivateKey(buyer.privateKey);
          if (!buyerWallet) {
            console.error('Buyer wallet not found');
            failCount++;
            continue;
          }
          
          const buyAmount = parseFloat(buyer.buyAmount);
          
          // Create wallet info objects
          const sellerWalletInfo: WalletInfo = {
            address: sellerWallet.address,
            privateKey: seller.privateKey
          };
          
          const buyerWalletInfo: WalletInfo = {
            address: buyerWallet.address,
            privateKey: buyer.privateKey
          };
          
          // Validate inputs - Note: we're now validating with direct buy amount
          const validation = validateCleanerInputs(
            sellerWalletInfo,
            buyerWalletInfo,
            tokenAddress,
            sellerPercentage,
            buyAmount, // Direct SOL amount instead of percentage
            tokenBalance
          );
          
          if (!validation.valid) {
            console.error(`Validation error: ${validation.error}`);
            failCount++;
            continue;
          }
          
          try {
            // Add 1-second delay between operations
            if (successCount > 0 || failCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Execute the cleaner operation with direct buy amount
            // Only include sell percentage for the first buyer of each seller
            const result = await executeCleanerOperation(
              sellerWalletInfo,
              buyerWalletInfo,
              tokenAddress,
              isFirstBuyerForSeller ? sellerPercentage : 0, // Only sell on first buyer
              buyAmount, // Direct SOL amount
              tokenBalance,
              0.05 // Extra distribution SOL
            );
            
            if (result.success) {
              successCount++;
              console.log(`Operation ${successCount} successful:`, result.result);
              
              // Mark this seller as processed after first successful operation
              if (isFirstBuyerForSeller) {
                sellersProcessed.add(seller.privateKey);
              }
            } else {
              console.error('Operation failed:', result.error);
              failCount++;
            }
          } catch (error) {
            console.error('Operation execution error:', error);
            failCount++;
          }
        }
      }
      
      // Show appropriate toast message based on the results
      if (failCount === 0) {
        showToast(`All ${successCount} operations completed successfully`, 'success');
      } else if (successCount === 0) {
        showToast(`All ${failCount} operations failed`, 'error');
      } else {
        showToast(`${successCount} operations succeeded, ${failCount} failed`, 'error');
      }
      
      // Refresh balances after operations
      handleRefresh();
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Operation error:', error);
      showToast('Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSellers([]);
    setIsConfirmed(false);
    setCurrentStep(0);
    setSellerSearchTerm('');
    setBuyerSearchTerm('');
    setSortOption('address');
    setSortDirection('asc');
    setBalanceFilter('all');
    setCurrentSellerIndex(0);
  };

  // Count total number of operations that will be executed
  const getTotalOperationsCount = () => {
    return sellers.reduce((count, seller) => count + seller.buyers.length, 0);
  };

  // Calculate total distribution amount for a seller
  const getTotalDistributionAmount = (seller: SellerConfig) => {
    const totalBuyAmount = seller.buyers.reduce((sum, buyer) => sum + parseFloat(buyer.buyAmount || '0'), 0);
    return totalBuyAmount + 0.05; // Add 0.05 SOL extra for distribution
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  // Animation keyframes for cyberpunk elements
  const modalStyleElement = document.createElement('style');
  modalStyleElement.textContent = `
    @keyframes modal-pulse {
      0% { box-shadow: 0 0 5px rgba(2, 179, 109, 0.5), 0 0 15px rgba(2, 179, 109, 0.2); }
      50% { box-shadow: 0 0 15px rgba(2, 179, 109, 0.8), 0 0 25px rgba(2, 179, 109, 0.4); }
      100% { box-shadow: 0 0 5px rgba(2, 179, 109, 0.5), 0 0 15px rgba(2, 179, 109, 0.2); }
    }
    
    @keyframes modal-fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    
    @keyframes modal-slide-up {
      0% { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes modal-scan-line {
      0% { transform: translateY(-100%); opacity: 0.3; }
      100% { transform: translateY(100%); opacity: 0; }
    }
    
    .modal-cyberpunk-container {
      animation: modal-fade-in 0.3s ease;
    }
    
    .modal-cyberpunk-content {
      animation: modal-slide-up 0.4s ease;
      position: relative;
    }
    
    .modal-cyberpunk-content::before {
      content: "";
      position: absolute;
      width: 100%;
      height: 5px;
      background: linear-gradient(to bottom, 
        transparent 0%,
        rgba(2, 179, 109, 0.2) 50%,
        transparent 100%);
      z-index: 10;
      animation: modal-scan-line 8s linear infinite;
      pointer-events: none;
    }
    
    .modal-glow {
      animation: modal-pulse 4s infinite;
    }
    
    .modal-input-cyberpunk:focus {
      box-shadow: 0 0 0 1px rgba(2, 179, 109, 0.7), 0 0 15px rgba(2, 179, 109, 0.5);
      transition: all 0.3s ease;
    }
    
    .modal-btn-cyberpunk {
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .modal-btn-cyberpunk::after {
      content: "";
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        to bottom right,
        rgba(2, 179, 109, 0) 0%,
        rgba(2, 179, 109, 0.3) 50%,
        rgba(2, 179, 109, 0) 100%
      );
      transform: rotate(45deg);
      transition: all 0.5s ease;
      opacity: 0;
    }
    
    .modal-btn-cyberpunk:hover::after {
      opacity: 1;
      transform: rotate(45deg) translate(50%, 50%);
    }
    
    .modal-btn-cyberpunk:active {
      transform: scale(0.95);
    }
    
    .progress-bar-cyberpunk {
      position: relative;
      overflow: hidden;
    }
    
    .progress-bar-cyberpunk::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(2, 179, 109, 0.7) 50%,
        transparent 100%
      );
      width: 100%;
      height: 100%;
      transform: translateX(-100%);
      animation: progress-shine 3s infinite;
    }
    
    @keyframes progress-shine {
      0% { transform: translateX(-100%); }
      20% { transform: translateX(100%); }
      100% { transform: translateX(100%); }
    }
    
    .glitch-text:hover {
      text-shadow: 0 0 2px #02b36d, 0 0 4px #02b36d;
      animation: glitch 2s infinite;
    }
    
    @keyframes glitch {
      2%, 8% { transform: translate(-2px, 0) skew(0.3deg); }
      4%, 6% { transform: translate(2px, 0) skew(-0.3deg); }
      62%, 68% { transform: translate(0, 0) skew(0.33deg); }
      64%, 66% { transform: translate(0, 0) skew(-0.33deg); }
    }

    /* For tabs */
    .cyberpunk-tab {
      position: relative;
      transition: all 0.3s ease;
    }
    
    .cyberpunk-tab-active::before {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 2px;
      background: #02b36d;
      box-shadow: 0 0 10px #02b36d, 0 0 20px #02b36d;
    }
    
    /* Cyberpunk scrollbar */
    .cyberpunk-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    
    .cyberpunk-scrollbar::-webkit-scrollbar-track {
      background: #091217;
      border-radius: 3px;
    }
    
    .cyberpunk-scrollbar::-webkit-scrollbar-thumb {
      background: #02b36d50;
      border-radius: 3px;
    }
    
    .cyberpunk-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #02b36d;
    }
    
    /* Responsive styles */
    @media (max-width: 768px) {
      .modal-cyberpunk-content {
        width: 95% !important;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .cyberpunk-two-columns {
        flex-direction: column !important;
      }
      
      .cyberpunk-column {
        width: 100% !important;
        margin-bottom: 1rem;
      }
    }
  `;
  document.head.appendChild(modalStyleElement);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm modal-cyberpunk-container" style={{backgroundColor: 'rgba(5, 10, 14, 0.85)'}}>
      <div className="relative bg-[#050a0e] border border-[#02b36d40] rounded-lg shadow-lg w-full max-w-6xl overflow-hidden transform modal-cyberpunk-content modal-glow">
        {/* Ambient grid background */}
        <div className="absolute inset-0 z-0 opacity-10"
             style={{
               backgroundImage: 'linear-gradient(rgba(2, 179, 109, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(2, 179, 109, 0.2) 1px, transparent 1px)',
               backgroundSize: '20px 20px',
               backgroundPosition: 'center center',
             }}>
        </div>

        {/* Header */}
        <div className="relative z-10 p-4 flex justify-between items-center border-b border-[#02b36d40]">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#02b36d20] mr-3">
              <ArrowDown size={16} className="text-[#02b36d]" />
            </div>
            <h2 className="text-lg font-semibold text-[#e4fbf2] font-mono">
              <span className="text-[#02b36d]">/</span> MULTI-WALLET TOKEN OPERATIONS <span className="text-[#02b36d]">/</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7ddfbd] hover:text-[#02b36d] transition-colors p-1 hover:bg-[#02b36d20] rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="relative w-full h-1 bg-[#091217] progress-bar-cyberpunk">
          <div 
            className="h-full bg-[#02b36d] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS_BUYSELL.length) * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-4 md:p-6 overflow-y-auto cyberpunk-scrollbar" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <form onSubmit={currentStep === STEPS_BUYSELL.length - 1 ? handleBuySell : (e) => e.preventDefault()}>
            {/* Step 0: Configure Sellers */}
            {currentStep === 0 && (
              <div className="animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#02b36d20]">
                    <svg
                      className="w-4 h-4 text-[#02b36d]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <path d="M16 10h2M6 14h12" />
                    </svg>
                  </div>
                  <h3 className="text-base md:text-lg font-medium text-[#e4fbf2] font-mono tracking-wide">
                    CONFIGURE SELLERS
                  </h3>
                </div>
                
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 cyberpunk-two-columns">
                  {/* Left Side - Seller Selection */}
                  <div className="w-full md:w-1/2 cyberpunk-column">
                    {/* Seller Search and Filters */}
                    <div className="mb-2 flex flex-wrap gap-2">
                      <div className="relative flex-grow">
                        <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7ddfbd]" />
                        <input
                          type="text"
                          value={sellerSearchTerm}
                          onChange={(e) => setSellerSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-[#091217] border border-[#02b36d30] rounded-lg text-sm text-[#e4fbf2] focus:outline-none focus:border-[#02b36d] transition-all modal-input-cyberpunk font-mono"
                          placeholder="SEARCH WALLETS..."
                        />
                      </div>
                      
                      <select 
                        className="bg-[#091217] border border-[#02b36d30] rounded-lg px-2 text-sm text-[#e4fbf2] focus:outline-none focus:border-[#02b36d] modal-input-cyberpunk font-mono"
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                      >
                        <option value="address">ADDRESS</option>
                        <option value="balance">SOL</option>
                        <option value="tokenBalance">TOKENS</option>
                      </select>
                      
                      <button
                        type="button"
                        className="p-2 bg-[#091217] border border-[#02b36d30] rounded-lg text-[#7ddfbd] hover:text-[#02b36d] hover:border-[#02b36d] transition-all modal-btn-cyberpunk"
                        onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                      >
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </button>
                      
                      <select 
                        className="bg-[#091217] border border-[#02b36d30] rounded-lg px-2 text-sm text-[#e4fbf2] focus:outline-none focus:border-[#02b36d] modal-input-cyberpunk font-mono"
                        value={balanceFilter}
                        onChange={(e) => setBalanceFilter(e.target.value)}
                      >
                        <option value="all">ALL</option>
                        <option value="nonZero">NON-ZERO SOL</option>
                        <option value="highBalance">HIGH SOL</option>
                        <option value="lowBalance">LOW SOL</option>
                        <option value="hasTokens">HAS TOKENS</option>
                      </select>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto border border-[#02b36d20] rounded-lg shadow-inner bg-[#091217] transition-all duration-200 hover:border-[#02b36d40] cyberpunk-scrollbar">
                      {filterWallets(getAvailableSellerWallets(), sellerSearchTerm).length > 0 ? (
                        filterWallets(getAvailableSellerWallets(), sellerSearchTerm).map((wallet) => (
                          <div
                            key={wallet.id}
                            onClick={() => addSeller(wallet.privateKey)}
                            className="flex items-center p-2.5 hover:bg-[#0a1419] cursor-pointer border-b border-[#02b36d20] last:border-b-0 transition-all duration-150"
                          >
                            <div className="w-5 h-5 rounded flex items-center justify-center border border-[#02b36d30] bg-[#091217] mr-2">
                              <Plus size={10} className="text-[#02b36d]" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-sm text-[#e4fbf2] glitch-text">{formatAddress(wallet.address)}</span>
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs ${hasInsufficientSOL(wallet.address) ? 'text-red-400' : 'text-[#7ddfbd]'} font-mono`}>
                                    {formatSolBalance(getWalletBalance(wallet.address) || 0)} SOL
                                    {hasInsufficientSOL(wallet.address) && (
                                      <span className="ml-1">⚠️</span>
                                    )}
                                  </span>
                                  <span className="text-xs text-[#02b36d] font-mono">{formatTokenBalance(getWalletTokenBalance(wallet.address) || 0)} TOKENS</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-[#7ddfbd] text-center font-mono">
                          {sellerSearchTerm ? "NO WALLETS FOUND MATCHING FILTERS" : "NO WALLETS AVAILABLE WITH TOKEN BALANCE"}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Right Side - Selected Sellers */}
                  <div className="w-full md:w-1/2 cyberpunk-column">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#7ddfbd] font-mono tracking-wider">
                        <span className="text-[#02b36d]">&#62;</span> SELECTED SELLERS <span className="text-[#02b36d]">&#60;</span>
                      </h4>
                      <span className="text-xs text-[#7ddfbd] font-mono">{sellers.length} SELLER(S) SELECTED</span>
                    </div>
                    
                    {/* List of selected sellers */}
                    <div className="max-h-60 overflow-y-auto border border-[#02b36d20] rounded-lg shadow-inner bg-[#091217] transition-all duration-200 hover:border-[#02b36d40] cyberpunk-scrollbar">
                      {sellers.length > 0 ? (
                        sellers.map((seller, index) => {
                          const sellerAddress = getWalletByPrivateKey(seller.privateKey)?.address || '';
                          const lowSOL = hasInsufficientSOL(sellerAddress);
                          
                          return (
                            <div key={index} className={`p-3 border-b border-[#02b36d20] last:border-b-0 ${lowSOL ? 'bg-[#5f020230]' : ''}`}>
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center">
                                  <div className={`w-5 h-5 rounded-full ${lowSOL ? 'bg-[#5f0202]' : 'bg-[#02b36d20]'} flex items-center justify-center mr-2`}>
                                    {lowSOL ? (
                                      <Info size={12} className="text-red-400" />
                                    ) : (
                                      <CheckCircle size={12} className="text-[#02b36d]" />
                                    )}
                                  </div>
                                  <span className="font-mono text-sm text-[#e4fbf2] glitch-text">
                                    {formatAddress(sellerAddress)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-xs ${lowSOL ? 'text-red-400' : 'text-[#7ddfbd]'} font-mono`}>
                                      {formatSolBalance(getWalletBalance(sellerAddress) || 0)} SOL
                                      {lowSOL && <span className="ml-1">⚠️</span>}
                                    </span>
                                    <span className="text-xs text-[#02b36d] font-mono">
                                      {formatTokenBalance(getWalletTokenBalance(sellerAddress) || 0)} TOKENS
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeSeller(index)}
                                    className="text-[#7ddfbd50] hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Sell percentage input */}
                              <div className="flex items-center mt-2">
                                <div className="text-xs text-[#7ddfbd] mr-2 w-24 font-mono">SELL PERCENTAGE:</div>
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={seller.sellPercentage}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || /^\d*\.?\d*$/.test(value) && parseFloat(value) <= 100) {
                                        updateSellerPercentage(index, value);
                                      }
                                    }}
                                    className="w-full pl-2 pr-8 py-1 bg-[#091217] border border-[#02b36d30] rounded text-[#e4fbf2] text-sm focus:outline-none focus:border-[#02b36d] modal-input-cyberpunk font-mono"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <span className="text-xs text-[#7ddfbd] font-mono">%</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Estimated SOL value display */}
                              {seller.estimatedSolValue > 0 && (
                                <div className="mt-2 p-1.5 bg-[#02b36d20] border border-[#02b36d30] rounded text-xs text-[#02b36d] font-mono">
                                  <div className="flex items-center justify-between">
                                    <span>ESTIMATED SOL VALUE:</span>
                                    <span className="font-bold">{seller.estimatedSolValue.toFixed(6)} SOL</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Warning for low SOL */}
                              {lowSOL && (
                                <div className="mt-2 p-1.5 bg-[#5f020230] border border-[#5f020250] rounded text-xs text-red-400 font-mono">
                                  <div className="flex items-center">
                                    <Info size={10} className="mr-1" />
                                    <span>INSUFFICIENT SOL BALANCE FOR TRANSACTION</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-[#7ddfbd] text-center font-mono">
                          NO SELLERS SELECTED. CLICK ON A WALLET FROM THE LEFT TO ADD IT AS A SELLER.
                        </div>
                      )}
                    </div>
                    
                    {/* Token info */}
                    <div className="mt-4 p-3 bg-[#091217] rounded-lg border border-[#02b36d30]">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#7ddfbd] font-mono">TOKEN ADDRESS:</span>
                        <span className="text-sm font-mono text-[#e4fbf2] glitch-text">{formatAddress(tokenAddress)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Configure Buyers */}
            {currentStep === 1 && (
              <div className="animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#02b36d20]">
                    <svg
                      className="w-4 h-4 text-[#02b36d]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h3 className="text-base md:text-lg font-medium text-[#e4fbf2] font-mono tracking-wide">
                    CONFIGURE BUYERS
                  </h3>
                </div>

                {/* Seller tabs */}
                <div className="mb-4 border-b border-[#02b36d30] overflow-x-auto cyberpunk-scrollbar">
                  <div className="flex pb-1 min-w-max">
                    {sellers.map((seller, index) => {
                      const sellerAddress = getWalletByPrivateKey(seller.privateKey)?.address || '';
                      const lowSOL = hasInsufficientSOL(sellerAddress);
                      
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setCurrentSellerIndex(index)}
                          className={`px-3 py-2 rounded-t-lg text-sm whitespace-nowrap cyberpunk-tab font-mono ${
                            currentSellerIndex === index 
                              ? 'bg-[#091217] text-[#e4fbf2] border-t border-l border-r border-[#02b36d40] cyberpunk-tab-active' 
                              : 'text-[#7ddfbd] hover:text-[#e4fbf2]'
                          } ${lowSOL ? 'text-red-400' : ''}`}
                        >
                          SELLER {index + 1}: {formatAddress(sellerAddress)}
                          {lowSOL && <span className="ml-1">⚠️</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sellers.length > 0 && (
                  <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 cyberpunk-two-columns">
                    {/* Left Side - Buyer Selection */}
                    <div className="w-full md:w-1/2 cyberpunk-column">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-[#7ddfbd] font-mono tracking-wider">
                          <span className="text-[#02b36d]">&#62;</span> SELECT BUYERS FOR SELLER {currentSellerIndex + 1} <span className="text-[#02b36d]">&#60;</span>
                        </h4>
                        <span className="text-xs text-[#7ddfbd] font-mono">
                          {sellers[currentSellerIndex].buyers.length} BUYER(S)
                        </span>
                      </div>
                      
                      {/* Buyer Search */}
                      <div className="mb-2 relative">
                        <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7ddfbd]" />
                        <input
                          type="text"
                          value={buyerSearchTerm}
                          onChange={(e) => setBuyerSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-[#091217] border border-[#02b36d30] rounded-lg text-sm text-[#e4fbf2] focus:outline-none focus:border-[#02b36d] transition-all modal-input-cyberpunk font-mono"
                          placeholder="SEARCH BUYER WALLETS..."
                        />
                      </div>
                      
                      {/* Buyer list */}
                      <div className="max-h-60 overflow-y-auto border border-[#02b36d20] rounded-lg shadow-inner bg-[#091217] transition-all duration-200 hover:border-[#02b36d40] cyberpunk-scrollbar">
                        {filterWallets(
                          getAvailableBuyerWallets(sellers[currentSellerIndex].privateKey), 
                          buyerSearchTerm
                        ).length > 0 ? (
                          filterWallets(
                            getAvailableBuyerWallets(sellers[currentSellerIndex].privateKey), 
                            buyerSearchTerm
                          ).map((wallet) => (
                            <div
                              key={wallet.id}
                              onClick={() => addBuyer(currentSellerIndex, wallet.privateKey)}
                              className="flex items-center p-2.5 hover:bg-[#0a1419] cursor-pointer border-b border-[#02b36d20] last:border-b-0 transition-all duration-150"
                            >
                              <div className="w-5 h-5 rounded flex items-center justify-center border border-[#02b36d30] bg-[#091217] mr-2">
                                <Plus size={10} className="text-[#02b36d]" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-mono text-sm text-[#e4fbf2] glitch-text">{formatAddress(wallet.address)}</span>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-[#7ddfbd] font-mono">{formatSolBalance(getWalletBalance(wallet.address) || 0)} SOL</span>
                                    {(getWalletTokenBalance(wallet.address) || 0) > 0 && (
                                      <span className="text-xs text-[#02b36d] font-mono">{formatTokenBalance(getWalletTokenBalance(wallet.address) || 0)} TOKENS</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-sm text-[#7ddfbd] text-center font-mono">
                            {buyerSearchTerm ? "NO WALLETS FOUND MATCHING FILTERS" : "NO WALLETS AVAILABLE"}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Right Side - Selected Buyers */}
                    <div className="w-full md:w-1/2 cyberpunk-column">
                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-[#7ddfbd] font-mono tracking-wider">
                          <span className="text-[#02b36d]">&#62;</span> SELECTED BUYERS <span className="text-[#02b36d]">&#60;</span>
                        </h4>
                      </div>
                      
                      {/* Current seller info */}
                      <div className="mb-3 p-3 bg-[#091217] rounded-lg border border-[#02b36d30]">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-[#7ddfbd] font-mono">SELLER:</span>
                          <span className="text-sm font-mono text-[#e4fbf2] glitch-text">
                            {formatAddress(getWalletByPrivateKey(sellers[currentSellerIndex].privateKey)?.address || '')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-[#7ddfbd] font-mono">SELL PERCENTAGE:</span>
                          <span className="text-sm text-[#02b36d] font-mono">{sellers[currentSellerIndex].sellPercentage}%</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-[#7ddfbd] font-mono">ESTIMATED SOL VALUE:</span>
                          <span className="text-sm text-[#02b36d] font-mono font-bold">
                            {sellers[currentSellerIndex].estimatedSolValue.toFixed(6)} SOL
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-[#7ddfbd] font-mono">TOKEN BALANCE:</span>
                          <span className="text-sm text-[#02b36d] font-mono">
                            {formatTokenBalance(getWalletTokenBalance(getWalletByPrivateKey(sellers[currentSellerIndex].privateKey)?.address || '') || 0)} TOKENS
                          </span>
                        </div>
                        {hasInsufficientSOL(getWalletByPrivateKey(sellers[currentSellerIndex].privateKey)?.address || '') && (
                          <div className="mt-2 p-1.5 bg-[#5f020230] border border-[#5f020250] rounded text-xs text-red-400 font-mono">
                            <div className="flex items-center">
                              <Info size={10} className="mr-1" />
                              <span>INSUFFICIENT SOL BALANCE</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* List of selected buyers */}
                      <div className="max-h-60 overflow-y-auto border border-[#02b36d20] rounded-lg shadow-inner bg-[#091217] transition-all duration-200 hover:border-[#02b36d40] cyberpunk-scrollbar">
                        {sellers[currentSellerIndex].buyers.length > 0 ? (
                          sellers[currentSellerIndex].buyers.map((buyer, buyerIndex) => (
                            <div key={buyerIndex} className="p-3 border-b border-[#02b36d20] last:border-b-0">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center">
                                  <div className="w-5 h-5 rounded-full bg-[#02b36d20] flex items-center justify-center mr-2">
                                    <CheckCircle size={12} className="text-[#02b36d]" />
                                  </div>
                                  <span className="font-mono text-sm text-[#e4fbf2] glitch-text">
                                    {formatAddress(getWalletByPrivateKey(buyer.privateKey)?.address || '')}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-[#7ddfbd] font-mono">
                                      {formatSolBalance(getWalletBalance(getWalletByPrivateKey(buyer.privateKey)?.address || '') || 0)} SOL
                                    </span>
                                    <span className="text-xs text-[#02b36d] font-mono">
                                      {formatTokenBalance(getWalletTokenBalance(getWalletByPrivateKey(buyer.privateKey)?.address || '') || 0)} TOKENS
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeBuyer(currentSellerIndex, buyerIndex)}
                                    className="text-[#7ddfbd50] hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Buy amount input - Changed from percentage to direct SOL amount */}
                              <div className="flex items-center mt-2">
                                <div className="text-xs text-[#7ddfbd] mr-2 w-24 font-mono">BUY AMOUNT:</div>
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={buyer.buyAmount}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || /^\d*\.?\d*$/.test(value) && parseFloat(value) <= 100) {
                                        updateBuyerAmount(currentSellerIndex, buyerIndex, value);
                                      }
                                    }}
                                    className="w-full pl-2 pr-8 py-1 bg-[#091217] border border-[#02b36d30] rounded text-[#e4fbf2] text-sm focus:outline-none focus:border-[#02b36d] modal-input-cyberpunk font-mono"
                                    placeholder="0.1"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <span className="text-xs text-[#7ddfbd] font-mono">SOL</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-[#7ddfbd] text-center font-mono">
                            NO BUYERS SELECTED. CLICK ON A WALLET FROM THE LEFT TO ADD IT AS A BUYER.
                          </div>
                        )}
                      </div>
                      
                      {/* Distribution info */}
                      {sellers[currentSellerIndex].buyers.length > 0 && (
                        <div className="mt-3 p-3 bg-[#091217] rounded-lg border border-[#02b36d30]">
                          <div className="text-xs text-[#7ddfbd] mb-2 font-mono">
                            DISTRIBUTION CALCULATION
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-[#7ddfbd] font-mono">TOTAL BUY AMOUNT:</span>
                              <span className="text-[#e4fbf2] font-mono">
                                {sellers[currentSellerIndex].buyers.reduce((sum, buyer) => sum + parseFloat(buyer.buyAmount || '0'), 0).toFixed(3)} SOL
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-[#7ddfbd] font-mono">EXTRA DISTRIBUTION:</span>
                              <span className="text-[#e4fbf2] font-mono">0.050 SOL</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t border-[#02b36d30] pt-1">
                              <span className="text-[#02b36d] font-mono font-bold">TOTAL DISTRIBUTION:</span>
                              <span className="text-[#02b36d] font-mono font-bold">
                                {getTotalDistributionAmount(sellers[currentSellerIndex]).toFixed(3)} SOL
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Review Operation */}
            {currentStep === 2 && (
              <div className="space-y-4 md:space-y-6 animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#02b36d20]">
                    <svg
                      className="w-4 h-4 text-[#02b36d]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-base md:text-lg font-medium text-[#e4fbf2] font-mono tracking-wide">
                    REVIEW OPERATIONS
                  </h3>
                </div>

                {/* Warning banner for insufficient SOL */}
                {sellers.some(seller => 
                  hasInsufficientSOL(getWalletByPrivateKey(seller.privateKey)?.address || '')
                ) && (
                  <div className="p-3 bg-[#5f020230] border border-[#5f020250] rounded-lg mb-4">
                    <div className="flex items-center">
                      <Info size={16} className="text-red-400 mr-2 flex-shrink-0" />
                      <span className="text-sm text-red-400 font-mono">
                        WARNING: ONE OR MORE SELLERS HAVE INSUFFICIENT SOL BALANCE.
                        THESE OPERATIONS WILL BE BLOCKED UNTIL SUFFICIENT SOL IS AVAILABLE.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {/* Operations summary */}
                  <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] modal-glow">
                    <h4 className="text-base font-medium text-[#02b36d] mb-3 font-mono tracking-wider">OPERATION SUMMARY</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-[#7ddfbd] font-mono">TOTAL SELLERS:</span>
                        <span className="text-sm text-[#e4fbf2] font-medium font-mono">{sellers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#7ddfbd] font-mono">TOTAL BUYERS:</span>
                        <span className="text-sm text-[#e4fbf2] font-medium font-mono">
                          {sellers.reduce((total, seller) => total + seller.buyers.length, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#7ddfbd] font-mono">TOTAL OPERATIONS:</span>
                        <span className="text-sm text-[#e4fbf2] font-medium font-mono">{getTotalOperationsCount()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[#7ddfbd] font-mono">TOKEN ADDRESS:</span>
                        <span className="text-sm text-[#e4fbf2] font-mono glitch-text">{formatAddress(tokenAddress)}</span>
                      </div>
                    </div>
                    
                    {/* Batch structure explanation */}
                    <div className="mt-4 p-3 bg-[#0a1419] rounded border border-[#02b36d20]">
                      <div className="text-xs text-[#7ddfbd] mb-1 font-mono font-bold">BATCH STRUCTURE:</div>
                      <div className="text-xs text-[#7ddfbd] font-mono">
                        • Each seller's FIRST buyer gets: SELL + DISTRIBUTION + BUY transactions
                      </div>
                      <div className="text-xs text-[#7ddfbd] font-mono">
                        • Each seller's SUBSEQUENT buyers get: DISTRIBUTION + BUY transactions only
                      </div>
                      <div className="text-xs text-[#02b36d] font-mono mt-1">
                        This ensures each seller only sells their tokens once.
                      </div>
                    </div>
                  </div>
                  
                  {/* Detailed breakdown */}
                  <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] modal-glow">
                    <h4 className="text-base font-medium text-[#02b36d] mb-3 font-mono tracking-wider">OPERATION DETAILS</h4>
                    
                    <div className="space-y-4 max-h-60 overflow-y-auto cyberpunk-scrollbar">
                      {sellers.map((seller, sellerIndex) => {
                        const sellerAddress = getWalletByPrivateKey(seller.privateKey)?.address || '';
                        const lowSOL = hasInsufficientSOL(sellerAddress);
                        
                        return (
                          <div key={sellerIndex} className={`border-t border-[#02b36d30] pt-3 first:border-t-0 first:pt-0 ${lowSOL ? 'bg-[#5f020220] p-2 rounded-lg -mt-2 first:mt-0' : ''}`}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-[#7ddfbd] mr-2 font-mono">SELLER {sellerIndex + 1}:</span>
                                <span className="text-sm font-mono text-[#e4fbf2] glitch-text">
                                  {formatAddress(sellerAddress)}
                                </span>
                                {lowSOL && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-[#5f020240] rounded text-xs text-red-400 font-mono">
                                    LOW SOL
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col items-start sm:items-end">
                                <span className="text-xs text-[#02b36d] font-mono">SELLING {seller.sellPercentage}%</span>
                                <span className="text-xs text-[#7ddfbd] font-mono">
                                  {formatTokenBalance(getWalletTokenBalance(sellerAddress) || 0)} TOKENS
                                </span>
                                <span className="text-xs text-[#02b36d] font-mono font-bold">
                                  EST: {seller.estimatedSolValue.toFixed(6)} SOL
                                </span>
                              </div>
                            </div>
                            
                            <div className="ml-0 sm:ml-4 space-y-2">
                              {seller.buyers.length > 0 ? (
                                seller.buyers.map((buyer, buyerIndex) => {
                                  const isFirstBuyer = buyerIndex === 0;
                                  return (
                                    <div key={buyerIndex} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-[#0a1419] p-2 rounded border border-[#02b36d20]">
                                      <div className="flex items-center">
                                        <span className="text-xs text-[#7ddfbd] mr-2 font-mono">
                                          {isFirstBuyer ? 'BUYER #1 (WITH SELL):' : `BUYER #${buyerIndex + 1}:`}
                                        </span>
                                        <span className="text-xs font-mono text-[#e4fbf2] glitch-text">
                                          {formatAddress(getWalletByPrivateKey(buyer.privateKey)?.address || '')}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs text-[#7ddfbd] font-mono">
                                            {formatSolBalance(getWalletBalance(getWalletByPrivateKey(buyer.privateKey)?.address || '') || 0)} SOL
                                          </span>
                                          <span className="text-xs text-[#02b36d] font-mono">
                                            {formatTokenBalance(getWalletTokenBalance(getWalletByPrivateKey(buyer.privateKey)?.address || '') || 0)} TOKENS
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {isFirstBuyer && (
                                            <span className="text-xs px-1.5 py-0.5 bg-[#5f020240] rounded text-red-300 font-mono">
                                              SELL: {seller.sellPercentage}%
                                            </span>
                                          )}
                                          <span className="text-xs px-1.5 py-0.5 bg-[#02b36d20] rounded text-[#02b36d] font-mono">
                                            BUY: {buyer.buyAmount} SOL
                                          </span>
                                          <span className="text-xs px-1.5 py-0.5 bg-[#091217] rounded text-[#e4fbf2] font-mono">
                                            DIST: {(parseFloat(buyer.buyAmount) + 0.05).toFixed(3)} SOL
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-[#7ddfbd] italic font-mono">NO BUYERS CONFIGURED</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Confirmation checkbox */}
                  <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] modal-glow">
                    <div className="flex items-center px-3 py-3 bg-[#0a1419] rounded-lg border border-[#02b36d20]">
                      <div className="relative mx-1">
                        <input
                          type="checkbox"
                          id="confirmBuySell"
                          checked={isConfirmed}
                          onChange={(e) => setIsConfirmed(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border border-[#02b36d40] rounded peer-checked:bg-[#02b36d] peer-checked:border-0 transition-all"></div>
                        <CheckCircle size={14} className={`absolute top-0.5 left-0.5 text-[#050a0e] transition-all ${isConfirmed ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                      <label htmlFor="confirmBuySell" className="text-[#e4fbf2] text-sm ml-2 cursor-pointer select-none font-mono">
                        I CONFIRM THAT I WANT TO EXECUTE {getTotalOperationsCount()} OPERATIONS AS DETAILED ABOVE. THIS ACTION CANNOT BE UNDONE.
                      </label>
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
                className="px-5 py-2.5 text-[#e4fbf2] bg-[#091217] border border-[#02b36d30] hover:bg-[#0a1419] hover:border-[#02b36d] rounded-lg transition-all duration-200 shadow-md font-mono tracking-wider modal-btn-cyberpunk"
              >
                {currentStep === 0 ? 'CANCEL' : 'BACK'}
              </button>
              <button
                type={currentStep === STEPS_BUYSELL.length - 1 ? 'submit' : 'button'}
                onClick={currentStep === STEPS_BUYSELL.length - 1 ? undefined : handleNext}
                disabled={
                  isSubmitting ||
                  (currentStep === 0 && sellers.length === 0) ||
                  (currentStep === 1 && sellers.some(seller => seller.buyers.length === 0)) ||
                  (currentStep === STEPS_BUYSELL.length - 1 && !isConfirmed) ||
                  sellers.some(seller => hasInsufficientSOL(getWalletByPrivateKey(seller.privateKey)?.address || ''))
                }
                className={`px-5 py-2.5 rounded-lg shadow-lg flex items-center transition-all duration-300 font-mono tracking-wider 
                          ${(currentStep === 0 && sellers.length === 0) || 
                            (currentStep === 1 && sellers.some(seller => seller.buyers.length === 0)) ||
                            (currentStep === STEPS_BUYSELL.length - 1 && !isConfirmed) || 
                            sellers.some(seller => hasInsufficientSOL(getWalletByPrivateKey(seller.privateKey)?.address || '')) ||
                            isSubmitting
                            ? 'bg-[#02b36d50] text-[#050a0e80] cursor-not-allowed opacity-50' 
                            : 'bg-[#02b36d] text-[#050a0e] hover:bg-[#01a35f] transform hover:-translate-y-0.5 modal-btn-cyberpunk'}`}
              >
                {currentStep === STEPS_BUYSELL.length - 1 ? (
                  isSubmitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-[#050a0e80] border-t-transparent animate-spin mr-2"></div>
                      PROCESSING...
                    </>
                  ) : (
                    "CONFIRM ALL OPERATIONS"
                  )
                ) : (
                  <>
                    <span>NEXT</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Cyberpunk decorative corner elements */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#02b36d] opacity-70"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#02b36d] opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#02b36d] opacity-70"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#02b36d] opacity-70"></div>
      </div>
    </div>,
    document.body
  );
};