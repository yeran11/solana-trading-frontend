import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { WalletType } from '../Utils';

// Constants
const MAX_BUNDLES_PER_SECOND = 2;

// Rate limiting state
const rateLimitState = {
  count: 0,
  lastReset: Date.now(),
  maxBundlesPerSecond: MAX_BUNDLES_PER_SECOND
};

// Interfaces
interface WalletPumpBuy {
  address: string;
  privateKey: string;
}

interface TokenConfig {
  tokenAddress: string;
  solAmount: number;
}

export interface PumpBuyBundle {
  transactions: string[]; // Base58 encoded transaction data
}

// Define interface for bundle result from sending
interface BundleResult {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Check rate limit and wait if necessary
 */
const checkRateLimit = async (): Promise<void> => {
  const now = Date.now();
  
  if (now - rateLimitState.lastReset >= 1000) {
    rateLimitState.count = 0;
    rateLimitState.lastReset = now;
  }
  
  if (rateLimitState.count >= rateLimitState.maxBundlesPerSecond) {
    const waitTime = 1000 - (now - rateLimitState.lastReset);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimitState.count = 0;
    rateLimitState.lastReset = Date.now();
  }
  
  rateLimitState.count++;
};

/**
 * Send bundle to Jito block engine through our backend proxy
 */
const sendBundle = async (encodedBundle: string[]): Promise<BundleResult> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    
    // Send to our backend proxy instead of directly to Jito
    const response = await fetch(`${baseUrl}/api/transactions/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: encodedBundle
      }),
    });

    const data = await response.json();
    
    return data.result;
  } catch (error) {
    console.error('Error sending bundle:', error);
    throw error;
  }
};

/**
 * Get partially prepared pump buy transactions from backend
 * The backend will create transactions without signing them and group them into bundles
 */
const getPartiallyPreparedTransactions = async (
  walletAddresses: string[], 
  tokenConfig: TokenConfig,
  amounts?: number[]
): Promise<PumpBuyBundle[]> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    
    const response = await fetch(`${baseUrl}/api/tokens/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddresses,
        tokenAddress: tokenConfig.tokenAddress,
        solAmount: tokenConfig.solAmount,
        protocol: "pumpfun",
        amounts: amounts // Optional custom amounts per wallet
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get partially prepared transactions');
    }
    
    // Handle different response formats to ensure compatibility
    if (data.bundles && Array.isArray(data.bundles)) {
      // Wrap any bundle that is a plain array
      return data.bundles.map((bundle: any) =>
        Array.isArray(bundle) ? { transactions: bundle } : bundle
      );
    } else if (data.transactions && Array.isArray(data.transactions)) {
      // If we get a flat array of transactions, create a single bundle
      return [{ transactions: data.transactions }];
    } else if (Array.isArray(data)) {
      // Legacy format where data itself is an array
      return [{ transactions: data }];
    } else {
      throw new Error('No transactions returned from backend');
    }
  } catch (error) {
    console.error('Error getting partially prepared transactions:', error);
    throw error;
  }
};

/**
 * Complete bundle signing
 */
const completeBundleSigning = (
  bundle: PumpBuyBundle, 
  walletKeypairs: Keypair[]
): PumpBuyBundle => {
  // Check if the bundle has a valid transactions array
  if (!bundle.transactions || !Array.isArray(bundle.transactions)) {
    console.error("Invalid bundle format, transactions property is missing or not an array:", bundle);
    return { transactions: [] };
  }

  const signedTransactions = bundle.transactions.map(txBase58 => {
    // Deserialize transaction
    const txBuffer = bs58.decode(txBase58);
    const transaction = VersionedTransaction.deserialize(txBuffer);
    
    // Extract required signers from staticAccountKeys
    const signers: Keypair[] = [];
    for (const accountKey of transaction.message.staticAccountKeys) {
      const pubkeyStr = accountKey.toBase58();
      const matchingKeypair = walletKeypairs.find(
        kp => kp.publicKey.toBase58() === pubkeyStr
      );
      if (matchingKeypair && !signers.includes(matchingKeypair)) {
        signers.push(matchingKeypair);
      }
    }
    
    // Sign the transaction
    transaction.sign(signers);
    
    // Serialize and encode the fully signed transaction
    return bs58.encode(transaction.serialize());
  });
  
  return { transactions: signedTransactions };
};
/**
 * Execute pump buy operation with batching for wallet limitations
 */
export const executePumpBuy = async (
  wallets: WalletPumpBuy[],
  tokenConfig: TokenConfig,
  customAmounts?: number[]
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to pump buy ${tokenConfig.tokenAddress} using ${wallets.length} wallets`);
    
    // Handle batching in chunks of 5 wallets
    const BATCH_SIZE = 5;
    const walletBatches: WalletPumpBuy[][] = [];
    
    // Split wallets into batches of 5
    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      walletBatches.push(wallets.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Split wallets into ${walletBatches.length} batches of max ${BATCH_SIZE} wallets each`);
    
    const allResults: BundleResult[] = [];
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < walletBatches.length; batchIndex++) {
      const walletBatch = walletBatches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${walletBatches.length} with ${walletBatch.length} wallets`);
      
      // Extract wallet addresses for this batch
      const batchWalletAddresses = walletBatch.map(wallet => wallet.address);
      
      // Extract custom amounts for this batch if provided
      let batchCustomAmounts: number[] | undefined;
      if (customAmounts) {
        const startIndex = batchIndex * BATCH_SIZE;
        batchCustomAmounts = customAmounts.slice(startIndex, startIndex + BATCH_SIZE);
      }
      
      // Step 1: Get partially prepared bundles from backend for this batch
      const partiallyPreparedBundles = await getPartiallyPreparedTransactions(
        batchWalletAddresses,
        tokenConfig,
        batchCustomAmounts
      );
      console.log(`Received ${partiallyPreparedBundles.length} bundles from backend for batch ${batchIndex + 1}`);
      
      // Step 2: Create keypairs from private keys for this batch
      const batchWalletKeypairs = walletBatch.map(wallet => 
        Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
      );
      
      // Step 3: Complete transaction signing for each bundle in this batch
      const signedBundles = partiallyPreparedBundles.map(bundle =>
        completeBundleSigning(bundle, batchWalletKeypairs)
      );
      console.log(`Completed signing for ${signedBundles.length} bundles in batch ${batchIndex + 1}`);
      
      // Step 4: Send each bundle with rate limiting and delay between bundles
      for (let i = 0; i < signedBundles.length; i++) {
        const bundle = signedBundles[i];
        console.log(`Sending bundle ${i + 1}/${signedBundles.length} from batch ${batchIndex + 1} with ${bundle.transactions.length} transactions`);
        
        await checkRateLimit();
        const result = await sendBundle(bundle.transactions);
        allResults.push(result);
        
        // Add delay between bundles (except after the last one)
        if (i < signedBundles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }
      }
      
      // Add delay between batches (except after the last one)
      if (batchIndex < walletBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
      }
    }
    
    return {
      success: true,
      result: allResults
    };
  } catch (error) {
    console.error('Pump buy error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
/**
 * Validate pump buy inputs
 */
export const validatePumpBuyInputs = (
  wallets: WalletPumpBuy[],
  tokenConfig: TokenConfig,
  walletBalances: Map<string, number>
): { valid: boolean; error?: string } => {
  // Check if token config is valid
  if (!tokenConfig.tokenAddress) {
    return { valid: false, error: 'Invalid token address' };
  }
  
  if (isNaN(tokenConfig.solAmount) || tokenConfig.solAmount <= 0) {
    return { valid: false, error: 'Invalid SOL amount' };
  }
  
  // Check if wallets are valid
  if (!wallets.length) {
    return { valid: false, error: 'No wallets provided' };
  }
  
  for (const wallet of wallets) {
    if (!wallet.address || !wallet.privateKey) {
      return { valid: false, error: 'Invalid wallet data' };
    }
    
    const balance = walletBalances.get(wallet.address) || 0;
    if (balance < tokenConfig.solAmount) {
      return { valid: false, error: `Wallet ${wallet.address.substring(0, 6)}... has insufficient balance` };
    }
  }
  
  return { valid: true };
};