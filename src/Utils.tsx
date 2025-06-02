import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import Cookies from 'js-cookie';

export interface WalletType {
  id: number;
  address: string;
  privateKey: string;
  isActive: boolean;
  tokenBalance?: number;
}

export interface ConfigType {
  rpcEndpoint: string;
  transactionFee: string;
  apiKey: string;
}

export const toggleWallet = (wallets: WalletType[], id: number): WalletType[] => {
  return wallets.map(wallet => 
    wallet.id === id ? { ...wallet, isActive: !wallet.isActive } : wallet
  );
};

export const deleteWallet = (wallets: WalletType[], id: number): WalletType[] => {
  return wallets.filter(wallet => wallet.id !== id);
};

// Database setup
const DB_NAME = 'WalletDB';
const DB_VERSION = 1;
const WALLET_STORE = 'wallets';

// Initialize database immediately
let db: IDBDatabase | null = null;
const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onerror = () => {
  console.error('Error opening database:', request.error);
};

request.onsuccess = (event: Event) => {
  db = request.result;
};

request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
  db = request.result;
  if (!db.objectStoreNames.contains(WALLET_STORE)) {
    db.createObjectStore(WALLET_STORE, { keyPath: 'id' });
  }
};
const WALLET_COOKIE_KEY = 'wallets';
const CONFIG_COOKIE_KEY = 'config';

export const createNewWallet = async (): Promise<WalletType> => {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toString();
  const privateKey = bs58.encode(keypair.secretKey);
  
  return {
    id: Date.now(),
    address,
    privateKey,
    isActive: false
  };
};

export const importWallet = async (
  privateKeyString: string
): Promise<{ wallet: WalletType | null; error?: string }> => {
  try {
    // Basic validation
    if (!privateKeyString.trim()) {
      return { wallet: null, error: 'Private key cannot be empty' };
    }

    // Try to decode the private key
    let privateKeyBytes;
    try {
      privateKeyBytes = bs58.decode(privateKeyString);
      
      // Validate key length (Solana private keys are 64 bytes)
      if (privateKeyBytes.length !== 64) {
        return { wallet: null, error: 'Invalid private key length' };
      }
    } catch (e) {
      return { wallet: null, error: 'Invalid private key format' };
    }

    // Create keypair and get address
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const address = keypair.publicKey.toString();
    
    const wallet: WalletType = {
      id: Date.now(),
      address,
      privateKey: privateKeyString,
      isActive: false
    };
    
    return { wallet };
  } catch (error) {
    console.error('Error importing wallet:', error);
    return { wallet: null, error: 'Failed to import wallet' };
  }
};

export const formatAddress = (address: string) => {
  if (address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const copyToClipboard = async (text: string, showToast: (message: string, type: 'success' | 'error') => void): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied successfully", "success")

    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
};
export const getActiveWalletPrivateKeys = (): string => {
  try {
    const activeWallets = getActiveWallets()
    return activeWallets
      .map(wallet => wallet.privateKey)
      .join(',');
  } catch (error) {
    console.error('Error getting private keys:', error);
    return '';
  }
};
export const getWallets = (): WalletType[] => {

  try {
    // First try to get from localStorage
    const savedWallets = localStorage.getItem('wallets');
    if (savedWallets) {
      const parsedWallets = JSON.parse(savedWallets);
      return parsedWallets;
    }
    return [];
  } catch (error) {
    console.error('Error loading wallets:', error);
    return [];
  }
};
export const getActiveWallets = (): WalletType[] => {
  try {
    const savedWallets = Cookies.get(WALLET_COOKIE_KEY);
    if (!savedWallets) return [];
    const parsedWallets = JSON.parse(savedWallets);
    return parsedWallets.filter((wallet: WalletType) => wallet.isActive);
  } catch (error) {
    console.error('Error loading active wallets from cookies:', error);
    return [];
  }
};
export const fetchTokenBalance = async (
  connection: Connection,
  walletAddress: string,
  tokenMint: string
): Promise<number> => {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMint);

    // Find token account
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      {
        mint: tokenMintPublicKey
      }, 
      "processed"
    );

    // If no token account found, return 0
    if (tokenAccounts.value.length === 0) return 0;

    // Get balance from the first token account
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0;
  }
};

export const fetchSolBalance = async (
  connection: Connection,
  walletAddress: string
): Promise<number> => {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey, "processed");
    return balance / 1e9;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
};

export const refreshWalletBalance = async (
  wallet: WalletType,
  connection: Connection,
  tokenAddress?: string
): Promise<WalletType> => {
  try {
    if (!tokenAddress) return wallet;
    
    const tokenBalance = await fetchTokenBalance(connection, wallet.address, tokenAddress);
    
    return {
      ...wallet,
      tokenBalance: tokenBalance
    };
  } catch (error) {
    console.error('Error refreshing wallet balance:', error);
    return wallet;
  }
};


export const saveWalletsToCookies = (wallets: WalletType[]): void => {
  try {
    if (!db) {
      // Fallback to localStorage if DB is not ready
      localStorage.setItem('wallets', JSON.stringify(wallets));
      return;
    }

    const transaction = db.transaction(WALLET_STORE, 'readwrite');
    const store = transaction.objectStore(WALLET_STORE);
    
    store.clear();
    wallets.forEach(wallet => store.add(wallet));
    
    // Also save to localStorage as backup
    localStorage.setItem('wallets', JSON.stringify(wallets));
  } catch (error) {
    console.error('Error saving wallets:', error);
    // Fallback to localStorage
    localStorage.setItem('wallets', JSON.stringify(wallets));
  }
};

export const loadWalletsFromCookies = (): WalletType[] => {
  try {
    // First try to get from localStorage
    const savedWallets = localStorage.getItem('wallets');
    if (savedWallets) {
      const parsedWallets = JSON.parse(savedWallets);
      return parsedWallets;
    }
    return [];
  } catch (error) {
    console.error('Error loading wallets:', error);
    return [];
  }
};

export const saveConfigToCookies = (config: ConfigType) => {
  Cookies.set(CONFIG_COOKIE_KEY, JSON.stringify(config), { expires: 30 });
};

export const loadConfigFromCookies = (): ConfigType | null => {
  const savedConfig = Cookies.get(CONFIG_COOKIE_KEY);
  if (savedConfig) {
    try {
      return JSON.parse(savedConfig);
    } catch (error) {
      console.error('Error parsing saved config:', error);
      return null;
    }
  }
  return null;
};
export const formatTokenBalance = (balance: number | undefined): string => {
  if (balance === undefined) return '0.00';
  if (balance < 1000) return balance.toFixed(2);
  
  if (balance < 1_000_000) {
    return `${(balance / 1000).toFixed(1)}K`;
  }
  if (balance < 1_000_000_000) {
    return `${(balance / 1_000_000).toFixed(1)}M`;
  }
  return `${(balance / 1_000_000_000).toFixed(1)}B`;
};
export const downloadPrivateKey = (wallet: WalletType) => {
  const blob = new Blob([wallet.privateKey], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-${wallet.address.slice(0, 8)}.key`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
export const downloadAllWallets = (wallets: WalletType[]) => {
  const formattedText = wallets.map(wallet => (
    `${wallet.address}\n` +
    `${wallet.privateKey}\n\n`
  )).join('');

  const blob = new Blob([formattedText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wallets.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};