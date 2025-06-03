import React, { useState, useEffect, useRef, lazy, useCallback } from 'react';
import { X, Plus, Settings, Download, Upload, FileUp, Trash2, Copy } from 'lucide-react';
import { Connection } from '@solana/web3.js';
import ServiceSelector from './Menu.tsx';
import { WalletTooltip, initStyles } from './Styles';
import { 
  createNewWallet,
  importWallet,
  refreshWalletBalance,
  saveWalletsToCookies,
  loadWalletsFromCookies,
  saveConfigToCookies,
  loadConfigFromCookies,
  downloadPrivateKey,
  downloadAllWallets, 
  deleteWallet, 
  WalletType, 
  formatAddress,
  copyToClipboard,
  ConfigType,
  fetchSolBalance,
  fetchTokenBalance,
} from './Utils';
import Split from 'react-split';
import { useToast } from "./Notifications";
import { 
  fetchSolBalances,
  fetchTokenBalances,
  fetchAmmKey,
  handleMarketCapUpdate,
  handleCleanupWallets,
  handleSortWallets,
  handleApiKeyFromUrl
} from './Manager';

// Lazy loaded components
const EnhancedSettingsModal = lazy(() => import('./SettingsModal'));
const EnhancedWalletOverview = lazy(() => import('./WalletOverview'));
const WalletsPage = lazy(() => import('./Wallets').then(module => ({ default: module.WalletsPage })));
const ChartPage = lazy(() => import('./Chart').then(module => ({ default: module.ChartPage })));
const ActionsPage = lazy(() => import('./Actions').then(module => ({ default: module.ActionsPage })));
const MobileLayout = lazy(() => import('./Mobile'));

// Import modal components 
const BurnModal = lazy(() => import('./BurnModal').then(module => ({ default: module.BurnModal })));
const PnlModal = lazy(() => import('./CalculatePNLModal').then(module => ({ default: module.PnlModal })));
const DeployModal = lazy(() => import('./DeployModal').then(module => ({ default: module.DeployModal })));
const CleanerTokensModal = lazy(() => import('./CleanerModal').then(module => ({ default: module.CleanerTokensModal })));
const CustomBuyModal = lazy(() => import('./CustomBuyModal').then(module => ({ default: module.CustomBuyModal })));

const WalletManager: React.FC = () => {
  // Apply styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = initStyles();
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // State declarations
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'network' | 'wallets' | 'advanced'>('network');
  const [config, setConfig] = useState<ConfigType>({
    rpcEndpoint: 'https://smart-special-thunder.solana-mainnet.quiknode.pro/1366b058465380d24920f9d348f85325455d398d/',
    transactionFee: '0.000005',
    apiKey: ''
  });
  const [currentPage, setCurrentPage] = useState<'wallets' | 'chart' | 'actions'>('wallets');
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [solBalances, setSolBalances] = useState<Map<string, number>>(new Map());
  const [tokenBalances, setTokenBalances] = useState<Map<string, number>>(new Map());
  const [ammKey, setAmmKey] = useState<string | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [currentMarketCap, setCurrentMarketCap] = useState<number | null>(null);
  const { showToast } = useToast();
  
  // Modal states
  const [burnModalOpen, setBurnModalOpen] = useState(false);
  const [calculatePNLModalOpen, setCalculatePNLModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [cleanerTokensModalOpen, setCleanerTokensModalOpen] = useState(false);
  const [customBuyModalOpen, setCustomBuyModalOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tickEffect, setTickEffect] = useState(false);
  
  // Status notification state
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isStatusVisible, setIsStatusVisible] = useState(false);

  // Fetch status from API
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
        
        // Send to our backend proxy instead of directly to Jito
        const response = await fetch(`${baseUrl}/status`);
        const data = await response.json(); // Parse as JSON instead of text
        const statusText = data.status || ''; // Extract the status field
        const trimmedText = statusText.trim();
        
        if (trimmedText && trimmedText !== statusMessage) {
          setStatusMessage(trimmedText);
          setIsStatusVisible(true);
        } else if (!trimmedText && isStatusVisible) {
          setIsStatusVisible(false);
          setStatusMessage('');
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    // Fetch immediately
    fetchStatus();
    
    // Set up interval to check every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    
    return () => clearInterval(interval);
  }, [statusMessage, isStatusVisible]);

  // Extract API key from URL
  useEffect(() => {
    handleApiKeyFromUrl(setConfig, saveConfigToCookies, showToast);
  }, []);

  // Read tokenAddress from URL parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('tokenAddress');
    if (tokenFromUrl) {
      setTokenAddress(tokenFromUrl);
    }
  }, []);

  // Update URL when tokenAddress changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tokenAddress) {
      url.searchParams.set('tokenAddress', tokenAddress);
    } else {
      url.searchParams.delete('tokenAddress');
    }
    window.history.replaceState({}, '', url.toString());
  }, [tokenAddress]);

  // Fetch AMM key when token address changes
  useEffect(() => {
    if (tokenAddress) {
      fetchAmmKey(tokenAddress, setAmmKey, setIsLoadingChart);
    }
  }, [tokenAddress]);
  
  // Initialize app on mount
  useEffect(() => {
    const initializeApp = () => {
      // Load saved config
      const savedConfig = loadConfigFromCookies();
      if (savedConfig) {
        setConfig(savedConfig);
        
        // Create connection after loading config
        try {
          const conn = new Connection(savedConfig.rpcEndpoint);
          setConnection(conn);
        } catch (error) {
          console.error('Error creating connection:', error);
        }
      }
      
      // Load saved wallets
      const savedWallets = loadWalletsFromCookies();
      if (savedWallets && savedWallets.length > 0) {
        setWallets(savedWallets);
      }
    };

    initializeApp();
  }, []);

  // Save wallets when they change
  useEffect(() => {
    if (wallets.length > 0) {
      saveWalletsToCookies(wallets);
    }
  }, [wallets]);

  // Fetch SOL balances when wallets change or connection is established
  useEffect(() => {
    if (connection && wallets.length > 0) {
      fetchSolBalances(connection, wallets, setSolBalances);
    }
  }, [connection, wallets.length]);

  // Fetch token balances when token address changes or wallets change
  useEffect(() => {
    if (connection && wallets.length > 0 && tokenAddress) {
      fetchTokenBalances(connection, wallets, tokenAddress, setTokenBalances);
    }
  }, [connection, wallets.length, tokenAddress]);

  // Update connection when RPC endpoint changes
  useEffect(() => {
    try {
      const conn = new Connection(config.rpcEndpoint);
      setConnection(conn);
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  }, [config.rpcEndpoint]);

  // Refresh balances on load
  useEffect(() => {
    if (connection && wallets.length > 0) {
      handleRefresh();
    }
  }, [connection]);

  // Add effect to refresh balances when token address changes
  useEffect(() => {
    if (connection && wallets.length > 0 && tokenAddress) {
      handleRefresh();
    }
  }, [tokenAddress]);

  // Trigger tick animation when wallet count changes
  useEffect(() => {
    setTickEffect(true);
    const timer = setTimeout(() => setTickEffect(false), 500);
    return () => clearTimeout(timer);
  }, [wallets.length]);

  // Helper functions
  const handleRefresh = async () => {
    if (!connection) return;
    
    setIsRefreshing(true);
    
    try {
      // Fetch SOL balances
      await fetchSolBalances(connection, wallets, setSolBalances);
      
      // Fetch token balances if token address is provided
      if (tokenAddress) {
        await fetchTokenBalances(connection, wallets, tokenAddress, setTokenBalances);
      }
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      // Set refreshing to false
      setIsRefreshing(false);
    }
  };

  const handleConfigChange = (key: keyof ConfigType, value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      saveConfigToCookies(newConfig);
      return newConfig;
    });
  };

  const handleSaveSettings = () => {
    saveConfigToCookies(config);
    setIsSettingsOpen(false);
  };

  const handleDeleteWallet = (id: number) => {
    const walletToDelete = wallets.find(w => w.id === id);
    if (walletToDelete) {
      // Remove from balances maps
      setSolBalances(prev => {
        const newBalances = new Map(prev);
        newBalances.delete(walletToDelete.address);
        return newBalances;
      });
      
      setTokenBalances(prev => {
        const newBalances = new Map(prev);
        newBalances.delete(walletToDelete.address);
        return newBalances;
      });
    }
    
    setWallets(prev => deleteWallet(prev, id));
  };

  // Modal action handlers
  const handleBurn = async (amount: string) => {
    try {
      console.log('burn', amount, 'SOL to');
      showToast('Burn successful', 'success');
    } catch (error) {
      showToast('Burn failed', 'error');
    }
  };

  const handleDeploy = async (data: any) => {
    try {
      console.log('Deploy executed:', data);
      showToast('Token deployment initiated successfully', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Token deployment failed', 'error');
    }
  };

  const handleCleaner = async (data: any) => {
    try {
      console.log('Cleaning', data);
      showToast('Cleaning successfully', 'success');
    } catch (error) {
      showToast('Failed to clean', 'error');
    }
  };

  const handleCustomBuy = async (data: any) => {
    try {
      console.log('Custom buy executed:', data);
      showToast('Custom buy completed successfully', 'success');
    } catch (error) {
      showToast('Custom buy failed', 'error');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#050a0e] text-[#b3f0d7] cyberpunk-bg">
      {/* Cyberpunk scanline effect */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-10"></div>
      
      {/* Status Notification Banner */}
      {isStatusVisible && statusMessage && (
        <div className="relative bg-gradient-to-r from-red-900/90 to-red-800/90 border-b border-red-500/50 p-3 backdrop-blur-sm z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span className="text-red-100 font-mono text-sm font-medium">
                ⚠️ SYSTEM ALERT: {statusMessage}
              </span>
            </div>
            <button
              onClick={() => setIsStatusVisible(false)}
              className="text-red-300 hover:text-red-100 transition-colors p-1"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      
      {/* Top Navigation */}
      <nav className="relative border-b border-[#02b36d70] p-4 backdrop-blur-sm bg-[#050a0e99] z-20">
        <div className="flex items-center gap-4">

        <ServiceSelector />
          
          <div className="relative flex-1 mx-4">
            <input
              type="text"
              placeholder="TOKEN ADDRESS"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="w-full bg-[#0a1419] border border-[#02b36d40] rounded p-3 text-sm text-[#e4fbf2] focus:border-[#02b36d] focus:outline-none cyberpunk-input font-mono tracking-wider"
            />
            <div className="absolute right-3 top-3 text-[#02b36d40] text-xs font-mono">SOL</div>
          </div>
          
          <WalletTooltip content="Paste from clipboard" position="bottom">
            <button
              className="p-2 border border-[#02b36d40] hover:border-[#02b36d] bg-[#0a1419] rounded cyberpunk-btn"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    setTokenAddress(text);
                    showToast("Token address pasted from clipboard", "success");
                  }
                } catch (err) {
                  showToast("Failed to read from clipboard", "error");
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#02b36d]">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </button>
          </WalletTooltip>          
          
          <WalletTooltip content="Open Settings" position="bottom">
            <button 
              className="p-2 border border-[#02b36d40] hover:border-[#02b36d] bg-[#0a1419] rounded cyberpunk-btn"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={20} className="text-[#02b36d]" />
            </button>
          </WalletTooltip>

          <div className="flex items-center ml-4">
            <div className="flex flex-col items-start">
              <div className="text-xs text-[#7ddfbd] font-mono uppercase tracking-wider">WALLETS</div>
              <div className={`font-bold text-[#02b36d] font-mono ${tickEffect ? 'scale-110 transition-transform' : 'transition-transform'}`}>
                {wallets.length}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-8rem)]">
        {/* Desktop Layout */}
        <div className="hidden md:block w-full h-full">
          <Split
            className="flex w-full h-full split-custom"
            sizes={[20, 60, 20]}
            minSize={[250, 250, 350]}
            gutterSize={8}
            gutterAlign="center"
            direction="horizontal"
            dragInterval={1}
            gutter={(index, direction) => {
              const gutter = document.createElement('div');
              gutter.className = `gutter gutter-${direction}`;
              return gutter;
            }}
          >
            {/* Left Column */}
            <div className="backdrop-blur-sm bg-[#050a0e99] border-r border-[#02b36d40] overflow-y-auto">
              {connection && (
                <WalletsPage
                  wallets={wallets}
                  setWallets={setWallets}
                  handleRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  setIsModalOpen={setIsModalOpen}
                  tokenAddress={tokenAddress}
                  sortDirection={sortDirection}
                  handleSortWallets={() => handleSortWallets(wallets, sortDirection, setSortDirection, solBalances, setWallets)}
                  connection={connection}
                  solBalances={solBalances}
                  tokenBalances={tokenBalances}
                />
              )}
            </div>

            {/* Middle Column */}
            <div className="backdrop-blur-sm bg-[#050a0e99] border-r border-[#02b36d40] overflow-y-auto">
              <ChartPage
                isLoadingChart={isLoadingChart}
                tokenAddress={tokenAddress}
                ammKey={ammKey}
                walletAddresses={wallets.map(w => w.address)}
              />
            </div>

            {/* Right Column */}
            <div className="backdrop-blur-sm bg-[#050a0e99] overflow-y-auto">
              <ActionsPage
                tokenAddress={tokenAddress}
                transactionFee={config.transactionFee}
                handleRefresh={handleRefresh}
                wallets={wallets}
                ammKey={ammKey}
                solBalances={solBalances}
                tokenBalances={tokenBalances}
                currentMarketCap={currentMarketCap}
                setBurnModalOpen={setBurnModalOpen}
                setCalculatePNLModalOpen={setCalculatePNLModalOpen}
                setDeployModalOpen={setDeployModalOpen}
                setCleanerTokensModalOpen={setCleanerTokensModalOpen}
                setCustomBuyModalOpen={setCustomBuyModalOpen}
              />
            </div>
          </Split>
        </div>

        {/* Mobile Layout */}
        <MobileLayout
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          children={{
            WalletsPage: (
              connection ? (
                <WalletsPage
                  wallets={wallets}
                  setWallets={setWallets}
                  handleRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  setIsModalOpen={setIsModalOpen}
                  tokenAddress={tokenAddress}
                  sortDirection={sortDirection}
                  handleSortWallets={() => handleSortWallets(wallets, sortDirection, setSortDirection, solBalances, setWallets)}
                  connection={connection}
                  solBalances={solBalances}
                  tokenBalances={tokenBalances}
                />
              ) : (
                <div className="p-4 text-center text-[#7ddfbd]">
                  <div className="loading-anim inline-block">
                    <div className="h-4 w-4 rounded-full bg-[#02b36d] mx-auto"></div>
                  </div>
                  <p className="mt-2 font-mono">CONNECTING TO NETWORK...</p>
                </div>
              )
            ),
            ChartPage: (
              <ChartPage
                isLoadingChart={isLoadingChart}
                tokenAddress={tokenAddress}
                ammKey={ammKey}
                walletAddresses={wallets.map(w => w.address)}
              />
            ),
            ActionsPage: (
              <ActionsPage
                tokenAddress={tokenAddress}
                transactionFee={config.transactionFee}
                handleRefresh={handleRefresh}
                wallets={wallets}
                ammKey={ammKey}
                solBalances={solBalances}
                tokenBalances={tokenBalances}
                currentMarketCap={currentMarketCap}
                setBurnModalOpen={setBurnModalOpen}
                setCalculatePNLModalOpen={setCalculatePNLModalOpen}
                setDeployModalOpen={setDeployModalOpen}
                setCleanerTokensModalOpen={setCleanerTokensModalOpen}
                setCustomBuyModalOpen={setCustomBuyModalOpen}
              />
            )
          }}
        />
      </div>
  
      {/* Enhanced Settings Modal */}
      <EnhancedSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={handleConfigChange}
        onSave={handleSaveSettings}
        wallets={wallets}
        setWallets={setWallets}
        connection={connection}
        solBalances={solBalances}
        setSolBalances={setSolBalances}
        tokenBalances={tokenBalances}
        setTokenBalances={setTokenBalances}
        tokenAddress={tokenAddress}
        showToast={showToast}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
  
      {/* Enhanced Wallet Overview */}
      <EnhancedWalletOverview
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        wallets={wallets}
        setWallets={setWallets}
        solBalances={solBalances}
        tokenBalances={tokenBalances}
        tokenAddress={tokenAddress}
        connection={connection}
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showToast={showToast}
        onOpenSettings={() => {
          setIsModalOpen(false); // Close wallet overview first
          setActiveTab('wallets');
          setIsSettingsOpen(true);
        }}
      />

      {/* Modals */}
      <BurnModal
        isOpen={burnModalOpen}
        onBurn={handleBurn}
        onClose={() => setBurnModalOpen(false)}
        handleRefresh={handleRefresh}
        tokenAddress={tokenAddress}
        solBalances={solBalances} 
        tokenBalances={tokenBalances}
      />

      <PnlModal
        isOpen={calculatePNLModalOpen}
        onClose={() => setCalculatePNLModalOpen(false)}
        handleRefresh={handleRefresh}    
        tokenAddress={tokenAddress}
      />
      
      <DeployModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        handleRefresh={handleRefresh} 
        solBalances={solBalances} 
        onDeploy={handleDeploy}    
      />
      
      <CleanerTokensModal
        isOpen={cleanerTokensModalOpen}
        onClose={() => setCleanerTokensModalOpen(false)}
        onCleanerTokens={handleCleaner}
        handleRefresh={handleRefresh}
        tokenAddress={tokenAddress}
        solBalances={solBalances} 
        tokenBalances={tokenBalances}
      />
      
      <CustomBuyModal
        isOpen={customBuyModalOpen}
        onClose={() => setCustomBuyModalOpen(false)}
        onCustomBuy={handleCustomBuy}
        handleRefresh={handleRefresh}
        tokenAddress={tokenAddress}
        solBalances={solBalances} 
        tokenBalances={tokenBalances}
      />
    </div>
  );
};

export default WalletManager;