import React, { useState, useEffect } from 'react';
import { BarChart2, CheckCircle, ChevronLeft, ChevronRight, Info, Search, X } from 'lucide-react';
import { getWallets, loadConfigFromCookies } from './Utils';
import PnlCard from './PnlCard.tsx';
import { useToast } from "./Notifications";
import { createPortal } from 'react-dom';

const STEPS_PNL = ['Select Wallets', 'View Results', 'Share Card'];

interface BasePnlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PnlModalProps extends BasePnlModalProps {
  handleRefresh: () => void;
  tokenAddress: string;
}

interface PnlData {
  profit: number;
  timestamp: string;
}

export const PnlModal: React.FC<PnlModalProps> = ({
  isOpen,
  onClose,
  handleRefresh,
  tokenAddress
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [pnlData, setPnlData] = useState<Record<string, PnlData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('address');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showInfoTip, setShowInfoTip] = useState(false);

  const wallets = getWallets();
  const { showToast } = useToast();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      resetForm();
    }
  }, [isOpen]);

  // Reset form state
  const resetForm = () => {
    setCurrentStep(0);
    setSelectedWallets([]);
    setPnlData({});
    setSearchTerm('');
    setSortOption('address');
    setSortDirection('asc');
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedWallets.length === 0) {
      showToast("Please select at least one wallet", "error");
      return;
    }
    
    if (currentStep === 0) {
      fetchPnlData();
    }
    
    setCurrentStep(prev => Math.min(prev + 1, STEPS_PNL.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const fetchPnlData = async () => {
    if (selectedWallets.length === 0) return;
    
    setIsLoading(true);
    try {
      // Get wallet addresses from private keys
      const addresses = selectedWallets.map(privateKey => 
        wallets.find(wallet => wallet.privateKey === privateKey)?.address || ''
      ).filter(address => address !== '').join(',');
      
      const baseUrl = (window as any).tradingServerUrl.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/api/analytics/pnl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses,
          tokenAddress,
          options: {
            includeTimestamp: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setPnlData(result.data);
      } else {
        throw new Error('Failed to calculate PNL');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast("Failed to fetch PNL data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Toggle wallet selection
  const toggleWalletSelection = (privateKey: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(privateKey)) {
        return prev.filter(key => key !== privateKey);
      } else {
        return [...prev, privateKey];
      }
    });
  };

  // Format the timestamp to a readable format
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format profit as a readable string with color class
  const formatProfit = (profit: number) => {
    return {
      text: profit > 0 ? `+${profit.toFixed(4)}` : profit.toFixed(4),
      class: profit > 0 ? 'text-[#02b36d]' : profit < 0 ? 'text-red-400' : 'text-[#7ddfbd]'
    };
  };

  // Filter wallets based on search and sort options
  const filterWallets = (walletList: any[], search: string) => {
    let filtered = walletList;
    
    // Apply search filter
    if (search) {
      filtered = filtered.filter(wallet => 
        wallet.address.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Sort wallets
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

  // Get address from private key
  const getAddressFromPrivateKey = (privateKey: string) => {
    return wallets.find(wallet => wallet.privateKey === privateKey)?.address || '';
  };

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

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .grid-cols-responsive {
        grid-template-columns: 1fr;
      }
      
      .flex-responsive {
        flex-direction: column;
      }
      
      .w-responsive {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(modalStyleElement);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm modal-cyberpunk-container" style={{backgroundColor: 'rgba(5, 10, 14, 0.85)'}}>
      <div className="relative bg-[#050a0e] border border-[#02b36d40] rounded-lg shadow-lg w-full max-w-2xl mx-4 overflow-hidden transform modal-cyberpunk-content modal-glow">
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
              <BarChart2 size={16} className="text-[#02b36d]" />
            </div>
            <h2 className="text-lg font-semibold text-[#e4fbf2] font-mono">
              <span className="text-[#02b36d]">/</span> TOKEN PNL CALCULATOR <span className="text-[#02b36d]">/</span>
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
            style={{ width: `${((currentStep + 1) / STEPS_PNL.length) * 100}%` }}
          ></div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-5 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#02b36d40] scrollbar-track-[#091217]">
          <form onSubmit={(e) => e.preventDefault()}>
            {/* Step 1: Select Wallets */}
            {currentStep === 0 && (
              <div className="animate-[fadeIn_0.3s_ease]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-[#02b36d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <path d="M16 10h2M6 14h12" />
                    </svg>
                    <h3 className="text-lg font-medium text-[#e4fbf2] font-mono">
                      <span className="text-[#02b36d]">&#62;</span> SELECT WALLETS <span className="text-[#02b36d]">&#60;</span>
                    </h3>
                  </div>
                </div>

                {/* Token Information */}
                <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#7ddfbd] font-mono">TOKEN ADDRESS:</span>
                    <div className="flex items-center bg-[#0a1419] px-2 py-1 rounded border border-[#02b36d20]">
                      <span className="text-sm font-mono text-[#e4fbf2] glitch-text">
                        {`${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="mb-2 flex space-x-2">
                  <div className="relative flex-grow">
                    <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7ddfbd]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
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
                  </select>
                  
                  <button
                    type="button"
                    className="p-2 bg-[#091217] border border-[#02b36d30] rounded-lg text-[#7ddfbd] hover:text-[#02b36d] hover:border-[#02b36d] transition-all modal-btn-cyberpunk"
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                {/* Wallet Selection */}
                <div className="bg-[#091217] rounded-lg overflow-hidden border border-[#02b36d20] shadow-inner transition-all duration-200 hover:border-[#02b36d40]">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-[#02b36d40] scrollbar-track-[#091217]">
                    {filterWallets(wallets, searchTerm).length > 0 ? (
                      filterWallets(wallets, searchTerm).map((wallet) => (
                        <div 
                          key={wallet.id}
                          className={`flex items-center p-2.5 hover:bg-[#0a1419] cursor-pointer transition-all duration-200 border-b border-[#02b36d20] last:border-b-0
                                    ${selectedWallets.includes(wallet.privateKey) ? 'bg-[#02b36d10] border-[#02b36d30]' : ''}`}
                          onClick={() => toggleWalletSelection(wallet.privateKey)}
                        >
                          <div className={`w-5 h-5 mr-3 rounded flex items-center justify-center transition-all duration-300
                                          ${selectedWallets.includes(wallet.privateKey)
                                            ? 'bg-[#02b36d] shadow-md shadow-[#02b36d40]' 
                                            : 'border border-[#02b36d30] bg-[#091217]'}`}>
                            {selectedWallets.includes(wallet.privateKey) && (
                              <CheckCircle size={14} className="text-[#050a0e] animate-[fadeIn_0.2s_ease]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-mono text-sm text-[#e4fbf2] glitch-text">{formatAddress(wallet.address)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-[#7ddfbd] text-center font-mono">
                        {searchTerm ? "NO WALLETS FOUND" : "NO WALLETS AVAILABLE"}
                      </div>
                    )}
                  </div>
                </div>

                {selectedWallets.length > 0 && (
                  <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-[#7ddfbd] font-mono">SELECTED WALLETS: {selectedWallets.length}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedWallets([])}
                        className="text-xs px-2 py-0.5 bg-[#0a1419] rounded text-[#e4fbf2] hover:bg-[#02b36d20] hover:text-[#02b36d] transition-all font-mono modal-btn-cyberpunk"
                      >
                        CLEAR ALL
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedWallets.slice(0, 5).map((privateKey) => {
                        const address = getAddressFromPrivateKey(privateKey);
                        return (
                          <div key={privateKey} className="bg-[#0a1419] rounded px-2 py-1 text-xs font-mono text-[#e4fbf2] flex items-center border border-[#02b36d20]">
                            {formatAddress(address)}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWalletSelection(privateKey);
                              }}
                              className="ml-1 text-[#7ddfbd] hover:text-[#02b36d]"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                      {selectedWallets.length > 5 && (
                        <div className="bg-[#0a1419] rounded px-2 py-1 text-xs text-[#e4fbf2] font-mono border border-[#02b36d20]">
                          +{selectedWallets.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: View Results */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-[#02b36d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <h3 className="text-lg font-medium text-[#e4fbf2] font-mono">
                      <span className="text-[#02b36d]">&#62;</span> PNL RESULTS <span className="text-[#02b36d]">&#60;</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center px-3 py-1.5 bg-[#091217] hover:bg-[#0a1419] text-[#e4fbf2] rounded-lg transition-all border border-[#02b36d30] hover:border-[#02b36d] font-mono text-sm modal-btn-cyberpunk"
                  >
                    <svg className="w-4 h-4 mr-1.5 text-[#02b36d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                    </svg>
                    CREATE SHARE CARD
                  </button>
                </div>

                {/* Token Information */}
                <div className="bg-[#091217] rounded-lg p-4 border border-[#02b36d30] mb-4">
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-[#7ddfbd] font-mono">TOKEN ADDRESS:</span>
                    <span className="text-sm font-mono text-[#e4fbf2] glitch-text">
                      {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-[#7ddfbd] font-mono">WALLETS ANALYZED:</span>
                    <span className="text-sm text-[#e4fbf2] font-mono">{selectedWallets.length}</span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-12 w-12 border-4 border-[#02b36d30] border-t-[#02b36d] rounded-full animate-spin mb-4"></div>
                    <p className="text-[#e4fbf2] font-mono">CALCULATING PNL ACROSS WALLETS...</p>
                  </div>
                ) : (
                  <>
                    {/* Results Table */}
                    <div className="bg-[#091217] rounded-lg overflow-hidden border border-[#02b36d30]">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#0a1419]">
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#7ddfbd] uppercase tracking-wider border-b border-[#02b36d30] font-mono">
                                Wallet
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-[#7ddfbd] uppercase tracking-wider border-b border-[#02b36d30] font-mono">
                                PNL
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-[#7ddfbd] uppercase tracking-wider border-b border-[#02b36d30] font-mono">
                                Balance
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-[#7ddfbd] uppercase tracking-wider border-b border-[#02b36d30] font-mono">
                                Last Update
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedWallets.map(privateKey => {
                              const address = getAddressFromPrivateKey(privateKey);
                              const data = pnlData[address];
                              const profit = data ? formatProfit(data.profit) : { text: '0.0000', class: 'text-[#7ddfbd]' };
                              return (
                                <tr key={privateKey} className="border-b border-[#02b36d20] last:border-b-0 hover:bg-[#0a1419]">
                                  <td className="px-4 py-3 text-sm font-mono text-[#e4fbf2] whitespace-nowrap glitch-text">
                                    {formatAddress(address)}
                                  </td>
                                  <td className={`px-4 py-3 text-sm text-right font-semibold whitespace-nowrap font-mono ${profit.class}`}>
                                    {data ? profit.text : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-[#e4fbf2] whitespace-nowrap font-mono">
                                    -
                                  </td>
                                  <td className="px-4 py-3 text-xs text-right text-[#7ddfbd] whitespace-nowrap font-mono">
                                    {data ? formatTimestamp(data.timestamp) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mt-4 grid-cols-responsive">
                      <div className="bg-[#091217] rounded-lg border border-[#02b36d30] p-4">
                        <h4 className="text-base font-semibold text-[#e4fbf2] mb-3 font-mono">
                          <span className="text-[#02b36d]">&lt;</span> PNL SUMMARY <span className="text-[#02b36d]">&gt;</span>
                        </h4>
                        
                        {/* Calculate total profit, best and worst performers */}
                        {(() => {
                          let totalProfit = 0;
                          let bestAddress = '';
                          let bestProfit = -Infinity;
                          let worstAddress = '';
                          let worstProfit = Infinity;
                          
                          selectedWallets.forEach(privateKey => {
                            const address = getAddressFromPrivateKey(privateKey);
                            const data = pnlData[address];
                            if (data) {
                              totalProfit += data.profit;
                              
                              if (data.profit > bestProfit) {
                                bestProfit = data.profit;
                                bestAddress = address;
                              }
                              
                              if (data.profit < worstProfit) {
                                worstProfit = data.profit;
                                worstAddress = address;
                              }
                            }
                          });
                          
                          const hasData = Object.keys(pnlData).length > 0;
                          
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[#7ddfbd] font-mono">TOTAL PNL:</span>
                                <span className={`text-sm font-semibold font-mono ${totalProfit > 0 ? 'text-[#02b36d]' : totalProfit < 0 ? 'text-red-400' : 'text-[#7ddfbd]'}`}>
                                  {hasData ? (totalProfit > 0 ? '+' : '') + totalProfit.toFixed(4) : '-'}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[#7ddfbd] font-mono">BEST PERFORMER:</span>
                                <div className="flex items-center">
                                  {hasData && bestProfit !== -Infinity ? (
                                    <>
                                      <span className="text-sm font-mono text-[#e4fbf2] mr-2 glitch-text">
                                        {formatAddress(bestAddress)}
                                      </span>
                                      <span className="text-sm font-semibold text-[#02b36d] font-mono">
                                        {bestProfit > 0 ? '+' : ''}{bestProfit.toFixed(4)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm text-[#7ddfbd] font-mono">-</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[#7ddfbd] font-mono">WORST PERFORMER:</span>
                                <div className="flex items-center">
                                  {hasData && worstProfit !== Infinity ? (
                                    <>
                                      <span className="text-sm font-mono text-[#e4fbf2] mr-2 glitch-text">
                                        {formatAddress(worstAddress)}
                                      </span>
                                      <span className={`text-sm font-semibold font-mono ${worstProfit < 0 ? 'text-red-400' : 'text-[#02b36d]'}`}>
                                        {worstProfit > 0 ? '+' : ''}{worstProfit.toFixed(4)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm text-[#7ddfbd] font-mono">-</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[#7ddfbd] font-mono">PROFITABLE WALLETS:</span>
                                <span className="text-sm text-[#02b36d] font-mono">
                                  {hasData ? Object.values(pnlData).filter(data => data.profit > 0).length : '-'}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-[#7ddfbd] font-mono">UNPROFITABLE WALLETS:</span>
                                <span className="text-sm text-red-400 font-mono">
                                  {hasData ? Object.values(pnlData).filter(data => data.profit < 0).length : '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      
                      <div className="bg-[#091217] rounded-lg border border-[#02b36d30] p-4">
                        <h4 className="text-base font-semibold text-[#e4fbf2] mb-3 font-mono">
                          <span className="text-[#02b36d]">&lt;</span> DATA INFO <span className="text-[#02b36d]">&gt;</span>
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#7ddfbd] font-mono">DATA UPDATED:</span>
                            <span className="text-sm text-[#e4fbf2] font-mono">
                              {Object.values(pnlData).length > 0 
                                ? new Date(Math.max(...Object.values(pnlData).map(d => new Date(d.timestamp).getTime()))).toLocaleString() 
                                : '-'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#7ddfbd] font-mono">WALLETS WITH DATA:</span>
                            <span className="text-sm text-[#e4fbf2] font-mono">{Object.keys(pnlData).length} / {selectedWallets.length}</span>
                          </div>
                          
                          <div className="text-xs text-[#7ddfbd] mt-2 leading-relaxed font-mono">
                            PNL data shows the calculated profit or loss for each wallet based on buys and sells.
                          </div>
                          
                          {Object.keys(pnlData).length < selectedWallets.length && (
                            <div className="flex items-center mt-2 p-2 bg-[#091217] border border-[#02b36d30] rounded text-xs text-[#e4fbf2] font-mono">
                              <Info size={14} className="mr-1 flex-shrink-0 text-[#02b36d]" />
                              <span>
                                Some selected wallets don't have PNL data available. This may be because they have no history with this token.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Share Card */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-[#02b36d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <h3 className="text-lg font-medium text-[#e4fbf2] font-mono">
                    <span className="text-[#02b36d]">&#62;</span> PNL SHARE CARD <span className="text-[#02b36d]">&#60;</span>
                  </h3>
                </div>
                
                {/* PNL Card */}
                <div className="bg-[#091217] rounded-lg border border-[#02b36d30] p-4">
                  <PnlCard 
                    pnlData={pnlData} 
                    tokenAddress={tokenAddress} 
                    backgroundImageUrl="https://i.ibb.co/tpzsPFdS/imgPnl.jpg"
                  />
                </div>
                
                <div className="mt-2 p-3 bg-[#091217] rounded-lg border border-[#02b36d20]">
                  <p className="text-xs text-[#7ddfbd] font-mono">
                    Download this card to share your PNL results with others. All sensitive wallet information is hidden.
                  </p>
                </div>
              </div>
            )}
  
            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={currentStep === 0 ? onClose : handleBack}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-[#e4fbf2] bg-[#091217] border border-[#02b36d30] hover:bg-[#0a1419] hover:border-[#02b36d] rounded-lg shadow-md font-mono tracking-wider modal-btn-cyberpunk"
              >
                {currentStep === 0 ? 'CANCEL' : (
                  <div className="flex items-center">
                    <ChevronLeft size={16} className="mr-1" />
                    BACK
                  </div>
                )}
              </button>

              {currentStep === 0 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting || selectedWallets.length === 0}
                  className={`px-5 py-2.5 rounded-lg shadow-lg flex items-center font-mono tracking-wider
                            ${isSubmitting || selectedWallets.length === 0
                              ? 'bg-[#02b36d50] text-[#050a0e80] cursor-not-allowed opacity-50' 
                              : 'bg-[#02b36d] text-[#050a0e] hover:bg-[#01a35f] modal-btn-cyberpunk'}`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-[#050a0e80] border-t-transparent mr-2"></div>
                      PROCESSING...
                    </>
                  ) : (
                    <div className="flex items-center">
                      CALCULATE PNL
                      <ChevronRight size={16} className="ml-1" />
                    </div>
                  )}
                </button>
              )}
              
              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 bg-[#02b36d] text-[#050a0e] hover:bg-[#01a35f] rounded-lg font-mono tracking-wider modal-btn-cyberpunk shadow-lg"
                >
                  <div className="flex items-center">
                    CREATE SHARE CARD
                    <ChevronRight size={16} className="ml-1" />
                  </div>
                </button>
              )}
              
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-[#02b36d] text-[#050a0e] hover:bg-[#01a35f] rounded-lg font-mono tracking-wider modal-btn-cyberpunk shadow-lg"
                >
                  CLOSE
                </button>
              )}
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