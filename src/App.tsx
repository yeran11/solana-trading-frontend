import React, { useState, useEffect, useRef, lazy } from 'react';
import { X, Plus, Settings, Download, Upload, FileUp, Trash2, Copy, ArrowUpDown, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { Connection } from '@solana/web3.js';
import ServiceSelector from './Menu.tsx'; // Adjust path as needed
const Config = lazy(() => import('./Config'));
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
import { useToast } from "./Notifications"

const WalletManager: React.FC = () => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importKey, setImportKey] = useState('');
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
  const [importError, setImportError] = useState<string | null>(null);
  const [ammKey, setAmmKey] = useState<string | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  
  // Add state for modals
  const [burnModalOpen, setBurnModalOpen] = useState(false);
  const [calculatePNLModalOpen, setCalculatePNLModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [cleanerTokensModalOpen, setCleanerTokensModalOpen] = useState(false);
  const [customBuyModalOpen, setCustomBuyModalOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Add cyberpunk-themed animations with keyframes
  const styles = `
  /* Background grid animation */
  @keyframes grid-pulse {
    0% { opacity: 0.1; }
    50% { opacity: 0.15; }
    100% { opacity: 0.1; }
  }

  .cyberpunk-bg {
    background-color: #050a0e;
    background-image: 
      linear-gradient(rgba(2, 179, 109, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 179, 109, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-bg::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(rgba(2, 179, 109, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(2, 179, 109, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
    animation: grid-pulse 4s infinite;
    z-index: 0;
  }

  /* Glowing border effect */
  @keyframes border-glow {
    0% { box-shadow: 0 0 5px rgba(2, 179, 109, 0.5), inset 0 0 5px rgba(2, 179, 109, 0.2); }
    50% { box-shadow: 0 0 10px rgba(2, 179, 109, 0.8), inset 0 0 10px rgba(2, 179, 109, 0.3); }
    100% { box-shadow: 0 0 5px rgba(2, 179, 109, 0.5), inset 0 0 5px rgba(2, 179, 109, 0.2); }
  }

  .cyberpunk-border {
    border: 1px solid rgba(2, 179, 109, 0.5);
    border-radius: 4px;
    animation: border-glow 4s infinite;
  }

  /* Button hover animations */
  @keyframes btn-glow {
    0% { box-shadow: 0 0 5px #02b36d; }
    50% { box-shadow: 0 0 15px #02b36d; }
    100% { box-shadow: 0 0 5px #02b36d; }
  }

  .cyberpunk-btn {
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-btn:hover {
    animation: btn-glow 2s infinite;
  }

  .cyberpunk-btn::after {
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

  .cyberpunk-btn:hover::after {
    opacity: 1;
    transform: rotate(45deg) translate(50%, 50%);
  }

  /* Glitch effect for text */
  @keyframes glitch {
    2%, 8% { transform: translate(-2px, 0) skew(0.3deg); }
    4%, 6% { transform: translate(2px, 0) skew(-0.3deg); }
    62%, 68% { transform: translate(0, 0) skew(0.33deg); }
    64%, 66% { transform: translate(0, 0) skew(-0.33deg); }
  }

  .cyberpunk-glitch {
    position: relative;
  }

  .cyberpunk-glitch:hover {
    animation: glitch 2s infinite;
  }

  /* Input focus effect */
  .cyberpunk-input:focus {
    box-shadow: 0 0 0 1px rgba(2, 179, 109, 0.7), 0 0 15px rgba(2, 179, 109, 0.5);
    transition: all 0.3s ease;
  }

  /* Card hover effect */
  .cyberpunk-card {
    transition: all 0.3s ease;
  }

  .cyberpunk-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(2, 179, 109, 0.3);
  }

  /* Scan line effect */
  @keyframes scanline {
    0% { 
      transform: translateY(-100%);
      opacity: 0.7;
    }
    100% { 
      transform: translateY(100%);
      opacity: 0;
    }
  }

  .cyberpunk-scanline {
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-scanline::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 10px;
    background: linear-gradient(to bottom, 
      transparent 0%,
      rgba(2, 179, 109, 0.2) 50%,
      transparent 100%);
    z-index: 10;
    animation: scanline 8s linear infinite;
  }

  /* Split gutter styling */
  .split-custom .gutter {
    background-color: transparent;
    position: relative;
    transition: background-color 0.3s ease;
  }

  .split-custom .gutter-horizontal {
    cursor: col-resize;
  }

  .split-custom .gutter-horizontal:hover {
    background-color: rgba(2, 179, 109, 0.3);
  }

  .split-custom .gutter-horizontal::before,
  .split-custom .gutter-horizontal::after {
    content: "";
    position: absolute;
    width: 1px;
    height: 15px;
    background-color: rgba(2, 179, 109, 0.7);
    left: 50%;
    transform: translateX(-50%);
    transition: all 0.3s ease;
  }

  .split-custom .gutter-horizontal::before {
    top: calc(50% - 10px);
  }

  .split-custom .gutter-horizontal::after {
    top: calc(50% + 10px);
  }

  .split-custom .gutter-horizontal:hover::before,
  .split-custom .gutter-horizontal:hover::after {
    background-color: #02b36d;
    box-shadow: 0 0 10px rgba(2, 179, 109, 0.7);
  }

  /* Neo-futuristic table styling */
  .cyberpunk-table {
    border-collapse: separate;
    border-spacing: 0;
  }

  .cyberpunk-table thead th {
    background-color: rgba(2, 179, 109, 0.1);
    border-bottom: 2px solid rgba(2, 179, 109, 0.5);
  }

  .cyberpunk-table tbody tr {
    transition: all 0.2s ease;
  }

  .cyberpunk-table tbody tr:hover {
    background-color: rgba(2, 179, 109, 0.05);
  }

  /* Neon text effect */
  .neon-text {
    color: #02b36d;
    text-shadow: 0 0 5px rgba(2, 179, 109, 0.7);
  }

  /* Notification animation */
  @keyframes notification-slide {
    0% { transform: translateX(50px); opacity: 0; }
    10% { transform: translateX(0); opacity: 1; }
    90% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(50px); opacity: 0; }
  }

  .notification-anim {
    animation: notification-slide 4s forwards;
  }

  /* Loading animation */
  @keyframes loading-pulse {
    0% { transform: scale(0.85); opacity: 0.7; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.85); opacity: 0.7; }
  }

  .loading-anim {
    animation: loading-pulse 1.5s infinite;
  }

  /* Button click effect */
  .cyberpunk-btn:active {
    transform: scale(0.95);
    box-shadow: 0 0 15px rgba(2, 179, 109, 0.7);
  }

  /* Menu active state */
  .menu-item-active {
    border-left: 3px solid #02b36d;
    background-color: rgba(2, 179, 109, 0.1);
  }

  /* Angle brackets for headings */
  .heading-brackets {
    position: relative;
    display: inline-block;
  }

  .heading-brackets::before,
  .heading-brackets::after {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: #02b36d;
    font-weight: bold;
  }

  .heading-brackets::before {
    content: ">";
    left: -15px;
  }

  .heading-brackets::after {
    content: "<";
    right: -15px;
  }
  `;

  // Tooltip Component with cyberpunk styling
  const Tooltip = ({ 
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

  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);

  // Function to fetch SOL balances for all wallets
  const fetchSolBalances = async () => {
    if (!connection) return new Map<string, number>();
    
    const newBalances = new Map<string, number>();
    
    const promises = wallets.map(async (wallet) => {
      try {
        const balance = await fetchSolBalance(connection, wallet.address);
        newBalances.set(wallet.address, balance);
      } catch (error) {
        console.error(`Error fetching SOL balance for ${wallet.address}:`, error);
        newBalances.set(wallet.address, 0);
      }
    });
    
    await Promise.all(promises);
    setSolBalances(newBalances);
    return newBalances;
  };

  // Function to fetch token balances for all wallets
  const fetchTokenBalances = async () => {
    if (!connection || !tokenAddress) return new Map<string, number>();
    
    const newBalances = new Map<string, number>();
    
    const promises = wallets.map(async (wallet) => {
      try {
        const balance = await fetchTokenBalance(connection, wallet.address, tokenAddress);
        newBalances.set(wallet.address, balance);
      } catch (error) {
        console.error(`Error fetching token balance for ${wallet.address}:`, error);
        newBalances.set(wallet.address, 0);
      }
    });
    
    await Promise.all(promises);
    setTokenBalances(newBalances);
    return newBalances;
  };

  const fetchAmmKey = async (tokenAddress: string) => {
    if (!tokenAddress) return null;
    setIsLoadingChart(true);
    try {
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=100000000&slippageBps=1`
      );
      const data = await response.json();
      if (data.routePlan?.[0]?.swapInfo?.ammKey) {
        setAmmKey(data.routePlan[0].swapInfo.ammKey);
      }
    } catch (error) {
      console.error('Error fetching AMM key:', error);
    }
    setIsLoadingChart(false);
  };

  useEffect(() => {
    // Function to extract API key from URL and clean the URL
    const handleApiKeyFromUrl = () => {
      const url = new URL(window.location.href);
      const apiKey = url.searchParams.get('apikey');
      
      // If API key is in the URL
      if (apiKey) {
        console.log('API key found in URL, saving to config');
        
        // Update config state with the new API key
        setConfig(prev => {
          const newConfig = { ...prev, apiKey };
          // Save to cookies
          saveConfigToCookies(newConfig);
          return newConfig;
        });
        
        // Remove the apikey parameter from URL without reloading the page
        url.searchParams.delete('apikey');
        
        // Replace current URL without reloading the page
        window.history.replaceState({}, document.title, url.toString());
        
        // Optional: Show a toast notification that API key was set
        if (showToast) {
          showToast("API key has been set from URL", "success");
        }
      }
    };
    
    // Call the function when component mounts
    handleApiKeyFromUrl();
  }, []); // Empty dependency array means this runs once on mount
  // Fetch AMM key when token address changes
  useEffect(() => {
    if (tokenAddress) {
      fetchAmmKey(tokenAddress);
    }
  }, [tokenAddress]);
  
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

  // Also add this useEffect to handle wallet changes:
  useEffect(() => {
    if (wallets.length > 0) {
      saveWalletsToCookies(wallets);
    }
  }, [wallets]);

  // Fetch SOL balances when wallets change or connection is established
  useEffect(() => {
    if (connection && wallets.length > 0) {
      fetchSolBalances();
    }
  }, [connection, wallets.length]);

  // Fetch token balances when token address changes or wallets change
  useEffect(() => {
    if (connection && wallets.length > 0 && tokenAddress) {
      fetchTokenBalances();
    }
  }, [connection, wallets.length, tokenAddress]);

  // Updated sort function to use solBalances
  const handleSortWallets = () => {
    setWallets(prev => {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      
      return [...prev].sort((a, b) => {
        const balanceA = solBalances.get(a.address) || 0;
        const balanceB = solBalances.get(b.address) || 0;
        
        if (newDirection === 'asc') {
          return balanceA - balanceB;
        } else {
          return balanceB - balanceA;
        }
      });
    });
  };
  
  // Updated cleanup function to use solBalances and tokenBalances
  const handleCleanupWallets = () => {
    setWallets(prev => {
      // Keep track of seen addresses
      const seenAddresses = new Set<string>();
      // Keep track of removal counts
      let emptyCount = 0;
      let duplicateCount = 0;
      
      // Filter out empty wallets and duplicates
      const cleanedWallets = prev.filter(wallet => {
        // Check for empty balance (no SOL and no tokens)
        const solBalance = solBalances.get(wallet.address) || 0;
        const tokenBalance = tokenBalances.get(wallet.address) || 0;
        
        if (solBalance <= 0 && tokenBalance <= 0) {
          emptyCount++;
          return false;
        }
        
        // Check for duplicates
        if (seenAddresses.has(wallet.address)) {
          duplicateCount++;
          return false;
        }
        
        seenAddresses.add(wallet.address);
        return true;
      });

      // Show appropriate toast message
      if (emptyCount > 0 || duplicateCount > 0) {
        const messages: string[] = [];
        if (emptyCount > 0) {
          messages.push(`${emptyCount} empty wallet${emptyCount === 1 ? '' : 's'}`);
        }
        if (duplicateCount > 0) {
          messages.push(`${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`);
        }
        showToast(`Removed ${messages.join(' and ')}`, "success");
      } else {
        showToast("No empty wallets or duplicates found", "success");
      }
      
      return cleanedWallets;
    });
  };

  // Update connection when RPC endpoint changes
  useEffect(() => {
    try {
      const conn = new Connection(config.rpcEndpoint);
      setConnection(conn);
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  }, [config.rpcEndpoint]);

  // Add effect to refresh balances on load
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

  const handleRefresh = async () => {
    if (!connection) return;
    
    setIsRefreshing(true);
    
    try {
      // Fetch SOL balances
      await fetchSolBalances();
      
      // Fetch token balances if token address is provided
      if (tokenAddress) {
        await fetchTokenBalances();
      }
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      // Set refreshing to false
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    if (!connection) return;
    
    try {
      const newWallet = await createNewWallet();
      setWallets(prev => {
        const newWallets = [...prev, newWallet];
        saveWalletsToCookies(newWallets);
        return newWallets;
      });
      
      // Fetch SOL balance for the new wallet
      const solBalance = await fetchSolBalance(connection, newWallet.address);
      setSolBalances(prev => {
        const newBalances = new Map(prev);
        newBalances.set(newWallet.address, solBalance);
        return newBalances;
      });
      
      // Initialize token balance to 0 for the new wallet
      setTokenBalances(prev => {
        const newBalances = new Map(prev);
        newBalances.set(newWallet.address, 0);
        return newBalances;
      });
      
      showToast("Wallet created successfully", "success");
    } catch (error) {
      console.error('Error creating wallet:', error);
    }
  };

  const handleImportWallet = async () => {
    if (!connection || !importKey.trim()) {
      setImportError('Please enter a private key');
      return;
    }
    
    try {
      const { wallet, error } = await importWallet(importKey.trim());
      
      if (error) {
        setImportError(error);
        return;
      }
      
      if (wallet) {
        // Check if wallet already exists
        const exists = wallets.some(w => w.address === wallet.address);
        if (exists) {
          setImportError('Wallet already exists');
          return;
        }
        
        setWallets(prev => [...prev, wallet]);
        
        // Fetch SOL balance for the imported wallet
        const solBalance = await fetchSolBalance(connection, wallet.address);
        setSolBalances(prev => {
          const newBalances = new Map(prev);
          newBalances.set(wallet.address, solBalance);
          return newBalances;
        });
        
        // Fetch token balance if token address is provided
        if (tokenAddress) {
          const tokenBalance = await fetchTokenBalance(connection, wallet.address, tokenAddress);
          setTokenBalances(prev => {
            const newBalances = new Map(prev);
            newBalances.set(wallet.address, tokenBalance);
            return newBalances;
          });
        } else {
          setTokenBalances(prev => {
            const newBalances = new Map(prev);
            newBalances.set(wallet.address, 0);
            return newBalances;
          });
        }
        
        setImportKey('');
        setImportError(null);
        setIsImporting(false);
      } else {
        setImportError('Failed to import wallet');
      }
    } catch (error) {
      console.error('Error in handleImportWallet:', error);
      setImportError('Failed to import wallet');
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

  // Updated file upload function to handle SOL and token balances separately
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file?.name);
    if (!file || !connection) {
      console.log('No file or connection:', { file: !!file, connection: !!connection });
      return;
    }

    setIsProcessingFile(true);
    setImportError(null);

    try {
      const text = await file.text();
      console.log('File content length:', text.length);
      const lines = text.split(/\r?\n/);
      console.log('Number of lines:', lines.length);
      
      // Base58 pattern for Solana private keys (64+ characters)
      const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
      const foundKeys = lines
        .map(line => line.trim())
        .filter(line => base58Pattern.test(line));
      
      console.log('Found potential private keys:', foundKeys.length);

      if (foundKeys.length === 0) {
        console.log('No valid private keys found');
        setImportError('No valid private keys found in file');
        setIsProcessingFile(false);
        return;
      }

      // Import each key with delay to ensure unique IDs
      const importWalletsSequentially = async () => {
        const importedWallets: WalletType[] = [];
        const newSolBalances = new Map(solBalances);
        const newTokenBalances = new Map(tokenBalances);
        
        for (const key of foundKeys) {
          try {
            console.log('Attempting to import key:', key.substring(0, 4) + '...');
            const { wallet, error } = await importWallet(key);
            
            if (error) {
              console.log('Import error for key:', error);
              continue;
            }
            if (!wallet) {
              console.log('No wallet returned for key');
              continue;
            }
            
            // Check if wallet already exists
            const exists = wallets.some(w => w.address === wallet.address);
            if (exists) {
              console.log('Wallet already exists:', wallet.address);
              continue;
            }
            
            console.log('Successfully imported wallet:', wallet.address);
            importedWallets.push(wallet);
            
            // Fetch and store SOL balance
            const solBalance = await fetchSolBalance(connection, wallet.address);
            newSolBalances.set(wallet.address, solBalance);
            
            // Fetch and store token balance if token address is provided
            if (tokenAddress) {
              const tokenBalance = await fetchTokenBalance(connection, wallet.address, tokenAddress);
              newTokenBalances.set(wallet.address, tokenBalance);
            } else {
              newTokenBalances.set(wallet.address, 0);
            }
            
            // Add delay between imports to ensure unique IDs
            await new Promise(resolve => setTimeout(resolve, 10));
          } catch (error) {
            console.error('Error importing wallet:', error);
          }
        }
        
        // Update balances maps
        setSolBalances(newSolBalances);
        setTokenBalances(newTokenBalances);
        
        return importedWallets;
      };

      const importedWallets = await importWalletsSequentially();
      console.log('Successfully imported wallets:', importedWallets.length);
      
      if (importedWallets.length === 0) {
        console.log('No new wallets could be imported');
        setImportError('No new wallets could be imported');
      } else {
        console.log('Adding wallets to state:', importedWallets);
        setWallets(prev => {
          const newWallets = [...prev, ...importedWallets];
          console.log('New wallet state:', newWallets.length);
          return newWallets;
        });
        showToast(`Successfully imported ${importedWallets.length} wallets`, "success");
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setImportError('Error processing file');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Animation for digital counter
  const [tickEffect, setTickEffect] = useState(false);
  
  useEffect(() => {
    // Trigger tick animation when wallet count changes
    setTickEffect(true);
    const timer = setTimeout(() => setTickEffect(false), 500);
    return () => clearTimeout(timer);
  }, [wallets.length]);

  // Add handlers for the modals
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
      // Additional logic here
    } catch (error) {
      console.error('Error:', error);
      showToast('Token deployment failed', 'error');
    }
  };

  const handleCleaner = async (data) => {
    try {
      console.log('Cleaning', data);
      showToast('Cleaning successfully', 'success');
    } catch (error) {
      showToast('Failed to clean', 'error');
    }
  };

  const handleCustomBuy = async (data) => {
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
          
          <Tooltip content="Paste from clipboard" position="bottom">
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
          </Tooltip>          
          
          <Tooltip content="Open Settings" position="bottom">
            <button 
              className="p-2 border border-[#02b36d40] hover:border-[#02b36d] bg-[#0a1419] rounded cyberpunk-btn"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={20} className="text-[#02b36d]" />
            </button>
          </Tooltip>

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
                  handleSortWallets={handleSortWallets}
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
                // Pass modal control functions
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
                  handleSortWallets={handleSortWallets}
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
                // Pass modal control functions
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
  
      {/* Settings Modal */}
      <Config
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={handleConfigChange}
        onSave={handleSaveSettings}
      />
  
      {/* Wallet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#091217] border border-[#02b36d40] cyberpunk-border rounded-lg w-96 p-6 mx-4 min-h-[50vh] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                
                <Tooltip content="Create New Wallet" position="bottom">
                  <button 
                    className="p-2 hover:bg-[#02b36d20] border border-[#02b36d40] hover:border-[#02b36d] rounded transition-all duration-300 cyberpunk-btn"
                    onClick={handleCreateWallet}
                  >
                    <Plus size={20} className="text-[#02b36d]" />
                  </button>
                </Tooltip>
                
                <Tooltip content="Import Wallet" position="bottom">
                  <button 
                    className="p-2 hover:bg-[#02b36d20] border border-[#02b36d40] hover:border-[#02b36d] rounded transition-all duration-300 cyberpunk-btn"
                    onClick={() => setIsImporting(true)}
                  >
                    <Upload size={20} className="text-[#02b36d]" />
                  </button>
                </Tooltip>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessingFile}
                />
                
                <Tooltip content="Upload Wallets file" position="bottom">
                  <button 
                    className={`p-2 ${isProcessingFile ? 'bg-[#02b36d10]' : 'hover:bg-[#02b36d20]'} border border-[#02b36d40] ${!isProcessingFile && 'hover:border-[#02b36d]'} rounded transition-all duration-300 ${!isProcessingFile && 'cyberpunk-btn'}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                  >
                    <FileUp size={20} className={`${isProcessingFile ? 'text-[#02b36d50]' : 'text-[#02b36d]'} ${isProcessingFile && 'loading-anim'}`} />
                  </button>
                </Tooltip>
                
                <Tooltip content="Download all Wallets" position="bottom">
                  <button 
                    className="p-2 hover:bg-[#02b36d20] border border-[#02b36d40] hover:border-[#02b36d] rounded transition-all duration-300 cyberpunk-btn"
                    onClick={() => downloadAllWallets(wallets)}
                  >
                    <Download size={20} className="text-[#02b36d]" />
                  </button>
                </Tooltip>
                
                <Tooltip content="Remove Empty Wallets" position="bottom">
                  <button 
                    className="p-2 hover:bg-[#02b36d20] border border-[#02b36d40] hover:border-[#02b36d] rounded transition-all duration-300 cyberpunk-btn"
                    onClick={handleCleanupWallets}
                  >
                    <Trash2 size={20} className="text-[#02b36d]" />
                  </button>
                </Tooltip>
                
                <Tooltip content="Close" position="bottom">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-[#ff224420] border border-[#ff224440] hover:border-[#ff2244] rounded transition-all duration-300"
                  >
                    <X size={20} className="text-[#ff2244]" />
                  </button>
                </Tooltip>
              </div>
            </div>

            
            <div className="space-y-4">
              <div className="w-full h-px bg-[#02b36d40]"></div>
  
              {/* Import Wallet Form */}
              {isImporting && (
                <div className="space-y-3 mb-4 p-4 bg-[#0a1419] border border-[#02b36d30] rounded-lg">
                  <div className="text-sm text-[#7ddfbd] font-mono mb-2">IMPORT PRIVATE KEY</div>
                  <input
                    type="text"
                    placeholder="Enter private key (base58)"
                    value={importKey}
                    onChange={(e) => {
                      setImportKey(e.target.value);
                      setImportError(null); // Clear error when input changes
                    }}
                    className={`w-full bg-[#091217] border ${
                      importError ? 'border-[#ff2244]' : 'border-[#02b36d40]'
                    } rounded p-3 text-sm text-[#e4fbf2] focus:border-[#02b36d] focus:outline-none cyberpunk-input font-mono tracking-wider`}
                  />
                  {importError && (
                    <div className="text-[#ff2244] text-sm font-mono mt-1 flex items-center">
                      <span className="mr-1">!</span> {importError}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleImportWallet}
                      className="flex-1 bg-[#02b36d] hover:bg-[#01a35f] text-black font-medium p-2 rounded cyberpunk-btn flex items-center justify-center"
                    >
                      <span className="font-mono tracking-wider">IMPORT</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsImporting(false);
                        setImportKey('');
                        setImportError(null);
                      }}
                      className="flex-1 bg-[#0a1419] hover:bg-[#091217] border border-[#02b36d40] p-2 rounded"
                    >
                      <span className="font-mono tracking-wider">CANCEL</span>
                    </button>
                  </div>
                </div>
              )}
  
              {/* Wallet List */}
              <div className="space-y-3">
                {wallets.map(wallet => (
                  <div 
                    key={wallet.id} 
                    className="flex items-center justify-between p-3 bg-[#091217] border border-[#02b36d20] hover:border-[#02b36d60] rounded-lg cyberpunk-card transition-all duration-300"
                  >
                    <Tooltip content="Click to copy address" position="top">
                      <span 
                        className="text-sm font-mono cursor-pointer hover:text-[#02b36d] transition-colors duration-300 cyberpunk-glitch"
                        onClick={async () => {
                          const success = await copyToClipboard(wallet.address, showToast);
                          if (success) {
                            setCopiedAddress(wallet.address);
                            setTimeout(() => setCopiedAddress(null), 2000);
                          }
                        }}
                      >
                        {formatAddress(wallet.address)}
                        {copiedAddress === wallet.address && (
                          <span className="ml-2 text-xs text-[#02b36d] opacity-0 animate-[fadeIn_0.3s_forwards]">
                            Copied
                          </span>
                        )}
                      </span>
                    </Tooltip>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-mono text-[#e4fbf2]">
                        <span className="text-[#7ddfbd]">{(solBalances.get(wallet.address) || 0).toFixed(4)}</span> SOL
                      </span>
                      {tokenAddress && (
                        <span className="text-sm font-mono text-[#02b36d]">
                          {(tokenBalances.get(wallet.address) || 0).toLocaleString()} Tokens
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Tooltip content="Remove Wallet" position="top">
                        <button 
                          className="p-1 hover:bg-[#ff224420] rounded-full transition-all duration-300"
                          onClick={() => handleDeleteWallet(wallet.id)}
                        >
                          <Trash2 size={16} className="text-[#ff2244]" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Download PrivateKey" position="top">
                        <button 
                          className="p-1 hover:bg-[#02b36d20] rounded-full transition-all duration-300"
                          onClick={() => downloadPrivateKey(wallet)}
                        >
                          <Download size={16} className="text-[#02b36d]" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Copy PrivateKey" position="top">
                        <button
                          className="p-1 hover:bg-[#02b36d20] rounded-full transition-all duration-300"
                          onClick={async () => {
                            await copyToClipboard(wallet.privateKey, showToast);
                          }}
                        >
                          <Copy size={16} className="text-[#02b36d]" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Moved modals to the root level for full page overlay */}
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