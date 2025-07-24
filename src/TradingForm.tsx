import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2, Move, Edit3, Check, ClipboardList, X, RefreshCw } from 'lucide-react';
import { 
  createMultipleLimitOrders, 
  getActiveOrders, 
  cancelOrder, 
  cancelAllOrders,
  solToLamports,
  lamportsToSol,
  validateLimitOrderConfig,
  calculatePrice,
  type LimitOrderConfig,
  type ActiveOrdersResponse
} from './utils/limitorders';

// Helper function to format numbers with k, M, B suffixes
const formatNumber = (num) => {
  const number = parseFloat(num);
  if (isNaN(number) || number === 0) return "0";
  
  const absNum = Math.abs(number);
  
  if (absNum >= 1000000000) {
    return (number / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  } else if (absNum >= 1000000) {
    return (number / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  } else if (absNum >= 1000) {
    return (number / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k';
  } else if (absNum >= 1) {
    return number.toFixed(2).replace(/\.?0+$/, '');
  } else {
    return number.toFixed(6).replace(/\.?0+$/, '');
  }
};

// Preset Button component
const PresetButton = ({ 
  value, 
  onExecute, 
  onChange,
  isLoading, 
  variant = 'buy',
  isEditMode,
  index 
}) => {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      (inputRef.current as HTMLInputElement)?.focus();
    }
  }, [isEditMode]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue > 0) {
        onChange(newValue.toString());
      }
    } else if (e.key === 'Escape') {
      setEditValue(value);
    }
  };

  const handleBlur = () => {
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue) && newValue > 0) {
      onChange(newValue.toString());
    } else {
      setEditValue(value);
    }
  };

  if (isEditMode) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-8 px-2 text-xs font-mono rounded border text-center
                   bg-app-primary text-app-primary border-app-primary-color
                   focus:outline-none focus:ring-1 focus:ring-app-primary-40"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => onExecute(value)}
      disabled={isLoading}
      className={`relative group px-2 py-1.5 text-xs font-mono rounded border transition-all duration-200
                min-w-[48px] h-8 flex items-center justify-center
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variant === 'buy' 
                  ? 'bg-app-primary-60 border-app-primary-40 color-primary hover-bg-primary-20 hover-border-primary' 
                  : 'bg-app-primary-60 border-error-alt-40 text-error-alt hover-bg-error-30 hover-border-error-alt'
                }`}
    >
      {isLoading ? (
        <div className="flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" />
          <span>{value}</span>
        </div>
      ) : (
        value
      )}
    </button>
  );
};

// Tab Button component
const TabButton = ({ label, isActive, onClick, onEdit, isEditMode }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      (inputRef.current as HTMLInputElement).focus();
      (inputRef.current as HTMLInputElement).select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (isEditMode) {
      setIsEditing(true);
      setEditValue(label);
    } else {
      onClick();
    }
  };

  const handleSave = () => {
    if (editValue.trim()) {
      onEdit(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-full px-2 py-1 text-xs font-mono rounded
                   bg-app-primary text-app-primary border border-app-primary-color
                   focus:outline-none focus:ring-1 focus:ring-app-primary-40"
        />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex-1 px-3 py-1.5 text-xs font-mono rounded transition-all duration-200
                ${isActive 
                  ? 'bg-primary-20 border border-app-primary-80 color-primary' 
                  : 'bg-app-primary-60 border border-app-primary-40 text-app-secondary-60 hover-border-primary-40 hover-text-app-secondary'
                }
                ${isEditMode ? 'cursor-text' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );
};

const TradingCard = ({ 
  tokenAddress, 
  wallets,
  selectedDex,
  setSelectedDex,
  isDropdownOpen,
  setIsDropdownOpen,
  buyAmount,
  setBuyAmount,
  sellAmount,
  setSellAmount,
  handleTradeSubmit,
  isLoading,
  dexOptions,
  getScriptName,
  countActiveWallets,
  currentMarketCap,
  tokenBalances,
  onOpenFloating,
  isFloatingCardOpen
}) => {
  const [activeMainTab, setActiveMainTab] = useState('trading'); // 'orders' or 'trading'
  const [activeTradeType, setActiveTradeType] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [isEditMode, setIsEditMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Limit order state
  const [limitOrderSolAmount, setLimitOrderSolAmount] = useState('');
  const [limitOrderTokenAmount, setLimitOrderTokenAmount] = useState('');
  const [limitOrderPrice, setLimitOrderPrice] = useState('');
  const [limitOrderExpiry, setLimitOrderExpiry] = useState('');
  const [isCreatingLimitOrder, setIsCreatingLimitOrder] = useState(false);
  const [activeOrders, setActiveOrders] = useState<ActiveOrdersResponse | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderErrors, setOrderErrors] = useState<string[]>([]);
  
  // Default preset tabs
  const defaultPresetTabs = [
    {
      id: 'degen',
      label: 'DEGEN',
      buyPresets: ['0.01', '0.05', '0.1', '0.5'],
      sellPresets: ['25', '50', '75', '100']
    },
    {
      id: 'diamond',
      label: 'DIAMOND',
      buyPresets: ['0.001', '0.01', '0.05', '0.1'],
      sellPresets: ['10', '25', '50', '75']
    },
    {
      id: 'yolo',
      label: 'YOLO',
      buyPresets: ['0.1', '0.5', '1', '5'],
      sellPresets: ['50', '75', '90', '100']
    }
  ];

  // Load presets from cookies
  const loadPresetsFromCookies = () => {
    try {
      const savedPresets = document.cookie
        .split('; ')
        .find(row => row.startsWith('tradingPresets='))
        ?.split('=')[1];
      
      if (savedPresets) {
        const decoded = decodeURIComponent(savedPresets);
        const parsed = JSON.parse(decoded);
        return {
          tabs: Array.isArray(parsed.tabs) ? parsed.tabs : defaultPresetTabs,
          activeTabId: parsed.activeTabId || 'degen'
        };
      }
    } catch (error) {
      console.error('Error loading presets from cookies:', error);
    }
    return {
      tabs: defaultPresetTabs,
      activeTabId: 'degen'
    };
  };

  // Save presets to cookies
  const savePresetsToCookies = (tabs, activeTabId) => {
    try {
      const presetsData = {
        tabs,
        activeTabId
      };
      const encoded = encodeURIComponent(JSON.stringify(presetsData));
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
      document.cookie = `tradingPresets=${encoded}; expires=${expires.toUTCString()}; path=/`;
    } catch (error) {
      console.error('Error saving presets to cookies:', error);
    }
  };

  // Initialize presets from cookies
  const initialPresets = loadPresetsFromCookies();
  const [presetTabs, setPresetTabs] = useState(initialPresets.tabs);
  const [activeTabId, setActiveTabId] = useState(initialPresets.activeTabId);
  const activeTab = presetTabs.find(tab => tab.id === activeTabId) || presetTabs[0];
  
  // Save presets to cookies whenever they change
  useEffect(() => {
    savePresetsToCookies(presetTabs, activeTabId);
  }, [presetTabs, activeTabId]);
  
  // Handle tab switching with cookie save
  const handleTabSwitch = (tabId) => {
    setActiveTabId(tabId);
  };
  
  // Edit preset handlers
  const handleEditBuyPreset = (index, newValue) => {
    setPresetTabs(tabs => tabs.map(tab => 
      tab.id === activeTabId 
        ? {
            ...tab,
            buyPresets: tab.buyPresets.map((preset, i) => i === index ? newValue : preset)
          }
        : tab
    ));
  };
  
  const handleEditSellPreset = (index, newValue) => {
    setPresetTabs(tabs => tabs.map(tab => 
      tab.id === activeTabId 
        ? {
            ...tab,
            sellPresets: tab.sellPresets.map((preset, i) => i === index ? newValue : preset)
          }
        : tab
    ));
  };
  
  // Edit tab label
  const handleEditTabLabel = (tabId, newLabel) => {
    setPresetTabs(tabs => tabs.map(tab => 
      tab.id === tabId ? { ...tab, label: newLabel } : tab
    ));
  };
  
  // Handle trade execution
  const handleTradeExecution = (amount, isBuy) => {
    if (isBuy) {
      setBuyAmount(amount);
      handleTradeSubmit(wallets, isBuy, selectedDex, amount, undefined);
    } else {
      setSellAmount(amount);
      handleTradeSubmit(wallets, isBuy, selectedDex, undefined, amount);
    }
  };
  
  // Custom DEX select component
  const CustomSelect = () => {
    const handleDexSelect = (dexValue, e) => {
      e.stopPropagation();
      setSelectedDex(dexValue);
      setIsDropdownOpen(false);
    };
    
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className={`flex items-center justify-between px-1.5 py-0.5 rounded
                   bg-app-primary-60 text-app-tertiary border border-app-primary-40
                   hover-bg-primary-20 hover-border-primary-80
                   transition-all duration-300 text-[10px] font-mono min-w-[60px]
                   ${isDropdownOpen ? 'shadow-glow-primary' : ''}`}
        >
          <span className="truncate flex items-center">
            {selectedDex === 'auto' ? (
              <span className="flex items-center gap-1">
                <span className="text-yellow-400 animate-pulse text-xs">⭐</span>
                <span>AUTO</span>
              </span>
            ) : (
              dexOptions.find(d => d.value === selectedDex)?.label?.toUpperCase() || 'SELECT DEX'
            )}
          </span>
          <div className={`transform transition-transform duration-300 ml-0.5 ${isDropdownOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={10} className="color-primary" />
          </div>
        </button>

        {isDropdownOpen && (
          <div 
            className="fixed z-[9999] w-32 mt-1 rounded-md bg-app-primary
                      border border-app-primary-40 shadow-lg shadow-black-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-0.5">
              {dexOptions.filter(dex => dex.value !== selectedDex).map((dex) => (
                <button
                  key={dex.value}
                  className="w-full px-2 py-1 text-left text-app-tertiary text-[10px] font-mono
                         hover-bg-primary-20 transition-colors duration-200 flex items-center gap-1"
                  onClick={(e) => handleDexSelect(dex.value, e)}
                >
                  {dex.value === 'auto' ? (
                    <>
                      <span className="text-yellow-400 animate-pulse text-xs">⭐</span>
                      <span>AUTO</span>
                    </>
                  ) : (
                    dex.label.toUpperCase()
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Handle amount change
  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    if (activeTradeType === 'buy') {
      setBuyAmount(value);
    } else {
      setSellAmount(value);
    }
  };

  // Handle preset click
  const handlePresetClick = (preset) => {
    if (activeTradeType === 'buy') {
      setBuyAmount(preset);
      handleTradeSubmit(wallets, true, selectedDex, preset, undefined);
    } else {
      setSellAmount(preset);
      handleTradeSubmit(wallets, false, selectedDex, undefined, preset);
    }
  };

  // Limit Order Handlers
  const loadActiveOrders = async () => {
    if (!wallets || wallets.length === 0) return;
    
    setIsLoadingOrders(true);
    try {
      // Get orders for all active wallets
      const activeWallets = wallets.filter(w => w.isActive);
      if (activeWallets.length === 0) {
        setActiveOrders(null);
        return;
      }

      // For now, load orders for the first active wallet
      // In a real implementation, you might want to load for all wallets
      const firstWallet = activeWallets[0];
      const response = await getActiveOrders(firstWallet.address, {
        inputMint: tokenAddress || undefined
      });

      if (response.success) {
        setActiveOrders(response);
      } else {
        console.error('Failed to load active orders:', response.error);
        setActiveOrders(null);
      }
    } catch (error) {
      console.error('Error loading active orders:', error);
      setActiveOrders(null);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleCreateLimitOrder = async () => {
    if (!tokenAddress || !limitOrderSolAmount || !limitOrderTokenAmount) {
      setOrderErrors(['Please fill in all required fields']);
      return;
    }

    const activeWallets = wallets.filter(w => w.isActive);
    if (activeWallets.length === 0) {
      setOrderErrors(['No active wallets selected']);
      return;
    }

    setIsCreatingLimitOrder(true);
    setOrderErrors([]);

    try {
      // Convert amounts to proper format
      const solAmountLamports = solToLamports(parseFloat(limitOrderSolAmount));
      const tokenAmountRaw = (parseFloat(limitOrderTokenAmount) * Math.pow(10, 6)).toString(); // Assuming 6 decimals for most tokens

      // Create order configuration
      const orderConfig: Omit<LimitOrderConfig, 'maker'> = {
        inputMint: 'So11111111111111111111111111111111111111112', // SOL mint
        outputMint: tokenAddress,
        makingAmount: solAmountLamports,
        takingAmount: tokenAmountRaw,
        slippageBps: 50, // 0.5% slippage
        expiredAt: limitOrderExpiry ? Math.floor(new Date(limitOrderExpiry).getTime() / 1000) : undefined
      };

      // Validate the configuration
      const validation = validateLimitOrderConfig({
        ...orderConfig,
        maker: activeWallets[0].address // Use first wallet for validation
      });

      if (!validation.valid) {
        setOrderErrors(validation.errors);
        return;
      }

      // Create orders for all active wallets
      const response = await createMultipleLimitOrders(activeWallets, orderConfig);

      if (response.success) {
        // Clear form
        setLimitOrderSolAmount('');
        setLimitOrderTokenAmount('');
        setLimitOrderPrice('');
        setLimitOrderExpiry('');
        
        // Reload active orders
        await loadActiveOrders();
        
        // Show success message (you might want to use a toast notification here)
        console.log('Limit orders created successfully:', response.orders);
      } else {
        setOrderErrors([response.error || 'Failed to create limit orders']);
      }
    } catch (error) {
      setOrderErrors([error instanceof Error ? error.message : 'Unknown error occurred']);
    } finally {
      setIsCreatingLimitOrder(false);
    }
  };

  const handleCancelOrder = async (orderPublicKey: string, makerAddress: string) => {
    try {
      const response = await cancelOrder({
        maker: makerAddress,
        order: orderPublicKey
      });

      if (response.success) {
        // Reload active orders
        await loadActiveOrders();
        console.log('Order canceled successfully');
      } else {
        console.error('Failed to cancel order:', response.error);
      }
    } catch (error) {
      console.error('Error canceling order:', error);
    }
  };

  const handleCancelAllOrders = async () => {
    const activeWallets = wallets.filter(w => w.isActive);
    if (activeWallets.length === 0) return;

    try {
      // Cancel orders for all active wallets
      for (const wallet of activeWallets) {
        await cancelAllOrders(wallet.address);
      }
      
      // Reload active orders
      await loadActiveOrders();
      console.log('All orders canceled successfully');
    } catch (error) {
      console.error('Error canceling all orders:', error);
    }
  };

  // Calculate price when amounts change
  useEffect(() => {
    if (limitOrderSolAmount && limitOrderTokenAmount) {
      const price = calculatePrice(
        solToLamports(parseFloat(limitOrderSolAmount)),
        (parseFloat(limitOrderTokenAmount) * Math.pow(10, 6)).toString()
      );
      setLimitOrderPrice(price.toFixed(8));
    } else {
      setLimitOrderPrice('');
    }
  }, [limitOrderSolAmount, limitOrderTokenAmount]);

  // Load active orders when switching to orders tab
  useEffect(() => {
    if (activeMainTab === 'orders') {
      loadActiveOrders();
    }
  }, [activeMainTab, tokenAddress]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div 
      className="relative overflow-hidden rounded-xl shadow-xl"

    >
      {/* Cyberpunk corner accents */}
      <div className="absolute top-0 left-0 w-24 h-24 pointer-events-none">
        <div className="absolute top-0 left-0 w-px h-8 bg-gradient-to-b from-app-primary-color to-transparent"></div>
        <div className="absolute top-0 left-0 w-8 h-px bg-gradient-to-r from-app-primary-color to-transparent"></div>
      </div>
      <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none">
        <div className="absolute top-0 right-0 w-px h-8 bg-gradient-to-b from-app-primary-color to-transparent"></div>
        <div className="absolute top-0 right-0 w-8 h-px bg-gradient-to-l from-app-primary-color to-transparent"></div>
      </div>
      <div className="absolute bottom-0 left-0 w-24 h-24 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-px h-8 bg-gradient-to-t from-app-primary-color to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-8 h-px bg-gradient-to-r from-app-primary-color to-transparent"></div>
      </div>
      <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-px h-8 bg-gradient-to-t from-app-primary-color to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-8 h-px bg-gradient-to-l from-app-primary-color to-transparent"></div>
      </div>

      {/* Main Tabs - Orders and Trading */}
      {!isFloatingCardOpen && (
        <div className="flex bg-app-primary-60 border-b border-app-primary-20">
          {/* Orders Tab - Smaller */}
          <button
            onClick={() => setActiveMainTab('orders')}
            className={`px-3 py-2 text-xs font-mono tracking-wider transition-all duration-200 ${
              activeMainTab === 'orders'
                ? 'bg-app-primary-40 color-primary border-r border-app-primary-60'
                : 'bg-transparent text-app-secondary-40 hover:text-app-secondary-60 border-r border-app-primary-20'
            }`}
          >
            <ClipboardList size={14} />
          </button>
          
          {/* Buy/Sell Toggle - Takes remaining space */}
          <div className="flex flex-1">
            <button
              onClick={() => {
                setActiveMainTab('trading');
                setActiveTradeType('buy');
              }}
              className={`flex-1 py-3 px-4 text-sm font-mono tracking-wider transition-all duration-200 ${
                activeMainTab === 'trading' && activeTradeType === 'buy'
                  ? 'bg-app-primary-color text-black font-medium'
                  : 'bg-transparent text-app-secondary-60 hover-text-app-secondary'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => {
                setActiveMainTab('trading');
                setActiveTradeType('sell');
              }}
              className={`flex-1 py-3 px-4 text-sm font-mono tracking-wider transition-all duration-200 ${
                activeMainTab === 'trading' && activeTradeType === 'sell'
                  ? 'bg-error-alt text-white font-medium'
                  : 'bg-transparent text-warning-60 hover:text-error-alt'
              }`}
            >
              SELL
            </button>
          </div>
          
          {/* Wallet Counter */}
          <div className="flex items-center px-3 py-2 border-l border-app-primary-20">
            <div className="flex items-center gap-1 text-xs font-mono text-app-secondary-60">
              <span className="color-primary">{countActiveWallets(wallets)}</span>
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="color-primary"
              >
                <path 
                  d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2h18zM3 10v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H3zm13 4h2v2h-2v-2z" 
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Order Type Tabs - Only show for trading tab */}
      {!isFloatingCardOpen && activeMainTab === 'trading' && (
        <div className="flex items-center justify-between px-4 py-2 bg-app-primary-40 border-b border-app-primary-10">
          <div className="flex gap-4">
            <button
              onClick={() => setOrderType('market')}
              className={`text-xs font-mono tracking-wider transition-all duration-200 ${
                orderType === 'market'
                  ? 'color-primary border-b-2 border-app-primary-color pb-1'
                  : 'text-app-secondary-60 hover-text-app-secondary pb-1'
              }`}
            >
              MARKET
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={`text-xs font-mono tracking-wider transition-all duration-200 ${
                orderType === 'limit'
                  ? 'color-primary border-b-2 border-app-primary-color pb-1'
                  : 'text-app-secondary-60 hover-text-app-secondary pb-1'
              }`}
            >
              LIMIT
            </button>
          </div>
          
          {/* Action Icons - Hidden for limit orders */}
          {orderType !== 'limit' && (
            <div className="flex items-center gap-2">
              <CustomSelect />
              <button
                onClick={onOpenFloating}
                className="p-1.5 rounded hover-bg-primary-20 text-app-secondary-60 hover:color-primary transition-all duration-200"
                title="Detach"
              >
                <Move size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {!isFloatingCardOpen ? (
        <div className="p-3 space-y-2">
          {activeMainTab === 'orders' ? (
            /* Orders Content */
            <div className="space-y-3">
              {/* Orders Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono tracking-wider text-app-secondary uppercase">
                    ACTIVE ORDERS
                  </span>
                  {isLoadingOrders && (
                    <Loader2 size={12} className="animate-spin color-primary" />
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={loadActiveOrders}
                    disabled={isLoadingOrders}
                    className="p-1 bg-app-primary-60 border border-app-primary-40 color-primary hover-bg-primary-20 rounded transition-all duration-200 disabled:opacity-50"
                    title="Refresh orders"
                  >
                    <RefreshCw size={12} />
                  </button>
                  {activeOrders && activeOrders.orders && activeOrders.orders.orders.length > 0 && (
                     <button
                       onClick={handleCancelAllOrders}
                       className="px-2 py-1 text-xs font-mono bg-error-20 border border-error-alt-40 text-error-alt hover-bg-error-30 rounded transition-all duration-200"
                       title="Cancel all orders"
                     >
                       CANCEL ALL
                     </button>
                   )}
                </div>
              </div>

              {/* Orders List */}
              {isLoadingOrders ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 size={16} className="animate-spin color-primary" />
                    <span className="text-app-secondary-60 text-sm font-mono">Loading orders...</span>
                  </div>
                </div>
              ) : activeOrders && activeOrders.orders && activeOrders.orders.orders.length > 0 ? (
                 <div className="space-y-2">
                   {activeOrders.orders.orders.map((order, index) => (
                    <div key={order.publicKey} className="bg-app-primary-60 border border-app-primary-20 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono color-primary bg-primary-20 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-mono text-app-secondary-60">
                            {order.account.maker.slice(0, 8)}...{order.account.maker.slice(-4)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCancelOrder(order.publicKey, order.account.maker)}
                          className="p-1 bg-error-20 border border-error-alt-40 text-error-alt hover-bg-error-30 rounded transition-all duration-200"
                          title="Cancel order"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-app-secondary-60">Making: </span>
                          <span className="text-app-primary">
                            {lamportsToSol(order.account.makingAmount).toFixed(4)} SOL
                          </span>
                        </div>
                        <div>
                          <span className="text-app-secondary-60">Taking: </span>
                          <span className="text-app-primary">
                            {(parseInt(order.account.takingAmount) / Math.pow(10, 6)).toFixed(2)} tokens
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-app-secondary-60">Price: </span>
                          <span className="color-primary">
                            {calculatePrice(order.account.makingAmount, order.account.takingAmount).toFixed(8)} tokens/SOL
                          </span>
                        </div>
                        {order.account.expiredAt && (
                          <div className="col-span-2">
                            <span className="text-app-secondary-60">Expires: </span>
                            <span className="text-app-primary">
                              {new Date(order.account.expiredAt * 1000).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-app-secondary-60 text-sm font-mono mb-2">No active orders</div>
                  <div className="text-app-secondary-40 text-xs font-mono">
                    {tokenAddress ? 'Create limit orders in the trading tab' : 'Select a token to view orders'}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Trading Content */
            <>
              {/* Amount Input and Submit Button Row - Hidden for limit orders */}
          {orderType !== 'limit' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono tracking-wider text-app-secondary uppercase">
                  AMOUNT
                </label>
                <span className="text-xs text-app-secondary-60 font-mono">
                  {activeTradeType === 'buy' ? 'SOL/WALLET' : '% TOKENS'}
                </span>
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={activeTradeType === 'buy' ? buyAmount : sellAmount}
                    onChange={handleAmountChange}
                    placeholder="0.0"
                    disabled={!tokenAddress || isLoading}
                    className="w-full px-2 py-2 bg-app-primary-80-alpha border border-app-primary-40 rounded-lg 
                             text-app-primary placeholder-app-secondary-60 font-mono text-sm 
                             focus:outline-none focus-border-primary focus:ring-1 focus:ring-app-primary-40 
                             transition-all duration-300 shadow-inner-black-80
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin color-primary" />
                    </div>
                  )}
                </div>
                
                {/* Submit Button */}
                <button
                  onClick={() => handleTradeSubmit(wallets, activeTradeType === 'buy', selectedDex, activeTradeType === 'buy' ? buyAmount : undefined, activeTradeType === 'sell' ? sellAmount : undefined)}
                  disabled={!selectedDex || (!buyAmount && !sellAmount) || isLoading || !tokenAddress}
                  className={`px-4 py-2 text-sm font-mono tracking-wider rounded-lg 
                           transition-all duration-300 relative overflow-hidden whitespace-nowrap
                           disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTradeType === 'buy'
                      ? 'bg-gradient-to-r from-app-primary-color to-app-primary-dark hover-from-app-primary-dark hover-to-app-primary-darker text-black font-medium shadow-md shadow-app-primary-40 hover-shadow-app-primary-60 disabled:from-app-primary-40 disabled:to-app-primary-40 disabled:shadow-none'
                      : 'bg-gradient-to-r from-[#ff3232] to-[#e62929] hover:from-[#e62929] hover:to-[#cc2020] text-white font-medium shadow-md shadow-[#ff323240] hover:shadow-[#ff323260] disabled:from-[#ff323240] disabled:to-[#ff323240] disabled:shadow-none'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      PROCESSING...
                    </span>
                  ) : (
                    `${activeTradeType === 'buy' ? 'BUY' : 'SELL'}`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Preset tabs - Hidden for limit orders */}
          {orderType !== 'limit' && (
            <div className="flex gap-1 mb-2">
              {presetTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  label={tab.label}
                  isActive={tab.id === activeTabId}
                  isEditMode={isEditMode}
                  onClick={() => handleTabSwitch(tab.id)}
                  onEdit={(newLabel) => handleEditTabLabel(tab.id, newLabel)}
                />
              ))}
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  isEditMode 
                    ? 'bg-app-primary-color hover:bg-app-primary-dark text-black' 
                    : 'bg-app-primary-60 border border-app-primary-40 color-primary hover-bg-primary-20'
                }`}
                title={isEditMode ? 'Save changes' : 'Edit presets'}
              >
                {isEditMode ? <Check size={12} /> : <Edit3 size={12} />}
              </button>
            </div>
          )}

          {/* Preset Buttons - Hidden for limit orders */}
          {orderType !== 'limit' && (
            <div className="grid grid-cols-4 gap-1">
              {(activeTradeType === 'buy' ? activeTab.buyPresets : activeTab.sellPresets).map((preset, index) => (
                <PresetButton
                  key={`${activeTradeType}-${index}`}
                  value={preset}
                  onExecute={() => handlePresetClick(preset)}
                  onChange={(newValue) => {
                    if (activeTradeType === 'buy') {
                      handleEditBuyPreset(index, newValue);
                    } else {
                      handleEditSellPreset(index, newValue);
                    }
                  }}
                  isLoading={isLoading}
                  variant={activeTradeType}
                  isEditMode={isEditMode}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Limit Order Inputs - Fully Functional */}
          {orderType === 'limit' && (
            <div className="space-y-3">
              {/* Error Display */}
              {orderErrors.length > 0 && (
                <div className="bg-error-20 border border-error-alt-40 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <X size={12} className="text-error-alt" />
                    <span className="text-xs font-mono tracking-wider text-error-alt uppercase font-medium">
                      ERRORS
                    </span>
                  </div>
                  {orderErrors.map((error, index) => (
                    <p key={index} className="text-xs font-mono text-error-alt-80 leading-relaxed">
                      {error}
                    </p>
                  ))}
                </div>
              )}
              
              {/* SOL Amount Input */}
              <div className="space-y-1">
                <label className="text-xs font-mono tracking-wider text-app-secondary uppercase">
                  SOL AMOUNT
                </label>
                <input
                  type="text"
                  value={limitOrderSolAmount}
                  onChange={(e) => setLimitOrderSolAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.0"
                  disabled={!tokenAddress || isCreatingLimitOrder}
                  className="w-full px-2 py-2 bg-app-primary-80-alpha border border-app-primary-40 rounded-lg 
                           text-app-primary placeholder-app-secondary-60 font-mono text-sm 
                           focus:outline-none focus-border-primary focus:ring-1 focus:ring-app-primary-40 
                           transition-all duration-300 shadow-inner-black-80
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Token Amount Input */}
              <div className="space-y-1">
                <label className="text-xs font-mono tracking-wider text-app-secondary uppercase">
                  TOKEN AMOUNT
                </label>
                <input
                  type="text"
                  value={limitOrderTokenAmount}
                  onChange={(e) => setLimitOrderTokenAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.0"
                  disabled={!tokenAddress || isCreatingLimitOrder}
                  className="w-full px-2 py-2 bg-app-primary-80-alpha border border-app-primary-40 rounded-lg 
                           text-app-primary placeholder-app-secondary-60 font-mono text-sm 
                           focus:outline-none focus-border-primary focus:ring-1 focus:ring-app-primary-40 
                           transition-all duration-300 shadow-inner-black-80
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Price Display */}
              {limitOrderPrice && (
                <div className="bg-primary-10 border border-app-primary-20 rounded-lg p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-app-secondary-60 uppercase">Price:</span>
                    <span className="text-xs font-mono color-primary">{limitOrderPrice} tokens/SOL</span>
                  </div>
                </div>
              )}

              {/* Expiry Input (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-mono tracking-wider text-app-secondary-60 uppercase">
                  EXPIRY (OPTIONAL)
                </label>
                <input
                  type="datetime-local"
                  value={limitOrderExpiry}
                  onChange={(e) => setLimitOrderExpiry(e.target.value)}
                  disabled={!tokenAddress || isCreatingLimitOrder}
                  className="w-full px-2 py-2 bg-app-primary-80-alpha border border-app-primary-40 rounded-lg 
                           text-app-primary placeholder-app-secondary-60 font-mono text-sm 
                           focus:outline-none focus-border-primary focus:ring-1 focus:ring-app-primary-40 
                           transition-all duration-300 shadow-inner-black-80
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              
              {/* Create Order Button */}
              <button
                onClick={handleCreateLimitOrder}
                disabled={!tokenAddress || !limitOrderSolAmount || !limitOrderTokenAmount || isCreatingLimitOrder || wallets.filter(w => w.isActive).length === 0}
                className="w-full px-4 py-2 text-sm font-mono tracking-wider rounded-lg 
                         bg-gradient-to-r from-app-primary-color to-app-primary-dark hover-from-app-primary-dark hover-to-app-primary-darker 
                         text-black font-medium shadow-md shadow-app-primary-40 hover-shadow-app-primary-60
                         transition-all duration-300 relative overflow-hidden
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:from-app-primary-40 disabled:to-app-primary-40 disabled:shadow-none"
              >
                {isCreatingLimitOrder ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    CREATING ORDER...
                  </span>
                ) : (
                  `CREATE LIMIT ORDER (${wallets.filter(w => w.isActive).length} WALLETS)`
                )}
              </button>
            </div>
          )}
            </>
          )}
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-app-secondary-60 text-sm font-mono tracking-wider">
            TRADING INTERFACE IS OPEN IN FLOATING MODE
          </p>
        </div>
      )}
    </div>
  );
};

export default TradingCard;