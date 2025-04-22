import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadConfigFromCookies } from '../Utils';

// Constants
const JITO_ENDPOINT = 'https://mainnet.block-engine.jito.wtf/api/v1/block-engine';
const MAX_BUNDLES_PER_SECOND = 2;

// Rate limiting state
const rateLimitState = {
  count: 0,
  lastReset: Date.now(),
  maxBundlesPerSecond: MAX_BUNDLES_PER_SECOND
};

interface WalletJupSell {
  address: string;
  privateKey: string;
}

interface SellConfig {
  inputMint: string;  // Token to sell
  outputMint: string; // Usually SOL = So11111111111111111111111111111111111111112
  sellPercent: number; // Percentage of token balance to sell (1-100)
  slippageBps: number; // Slippage tolerance in basis points (e.g., 100 = 1%)
}

interface JupSellBundle {
  transactions: string[]; // Base58 encoded transaction data
}

// Define interface for bundle result
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
 * Get partially prepared Jupiter sell transactions from backend
 * The backend will create transactions without signing them
 */
const getPartiallyPreparedSellTransactions = async (
  walletAddresses: string[], 
  sellConfig: SellConfig
): Promise<string[]> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    
    const config = loadConfigFromCookies();
    // Get fee in SOL (string) with default if not found
    const feeInSol = config?.transactionFee || '0.005';
    
    // Convert fee from SOL (string) to lamports (number)
    // 1 SOL = 1,000,000,000 lamports
    const feeInLamports = Math.floor(parseFloat(feeInSol) * 1_000_000_000);
    
    const response = await fetch(`${baseUrl}/api/tokens/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddresses,
        tokenAddress: sellConfig.inputMint,
        protocol: "jupiter",
        percentage: sellConfig.sellPercent,
        jitoTipLamports: feeInLamports  // Now a number in lamports
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get partially prepared sell transactions');
    }
    
    return data.transactions; // Array of base58 encoded partially prepared transactions
  } catch (error) {
    console.error('Error getting partially prepared transactions:', error);
    throw error;
  }
};

/**
 * Complete transaction signing with wallets
 */
const completeTransactionSigning = (
  partiallyPreparedTransactionsBase58: string[], 
  walletKeypairs: Keypair[]
): string[] => {
  try {
    return partiallyPreparedTransactionsBase58.map((txBase58, index) => {
      // Handle case where a transaction couldn't be prepared
      if (!txBase58) {
        console.warn(`Transaction at index ${index} is null or undefined`);
        return null;
      }

      try {
        // Deserialize transaction
        const txBuffer = bs58.decode(txBase58);
        const transaction = VersionedTransaction.deserialize(txBuffer);
        
        // Extract transaction message to determine required signers
        const message = transaction.message;
        const signers: Keypair[] = [];
        
        // Find the required signers for this transaction
        for (const accountKey of message.staticAccountKeys) {
          const pubkeyStr = accountKey.toBase58();
          const matchingKeypair = walletKeypairs.find(
            keypair => keypair.publicKey.toBase58() === pubkeyStr
          );
          
          if (matchingKeypair && !signers.includes(matchingKeypair)) {
            signers.push(matchingKeypair);
          }
        }
        
        if (signers.length === 0) {
          console.warn(`No matching signers found for transaction ${index}`);
          return null;
        }
        
        // Sign the transaction
        transaction.sign(signers);
        
        // Serialize and encode the fully signed transaction
        return bs58.encode(transaction.serialize());
      } catch (error) {
        console.error(`Error signing transaction at index ${index}:`, error);
        return null;
      }
    }).filter(tx => tx !== null); // Filter out any null transactions
  } catch (error) {
    console.error('Error completing transaction signing:', error);
    throw error;
  }
};

// Check for duplicate transactions in a bundle
const checkForDuplicateInstructions = (transactions: VersionedTransaction[]): boolean => {
  try {
    // Create a set of serialized instructions to check for duplicates
    const instructionSet = new Set<string>();
    
    for (const tx of transactions) {
      // Get all instructions from the transaction
      const instructions = tx.message.compiledInstructions;
      
      for (const instruction of instructions) {
        // Create a unique string representing this instruction
        // We use programIndex, accounts, and data to identify an instruction
        const instructionKey = `${instruction.programIdIndex}-${instruction.accountKeyIndexes.join('-')}-${instruction.data}`;
        
        if (instructionSet.has(instructionKey)) {
          console.warn('Duplicate instruction detected:', instructionKey);
          return true;
        }
        
        instructionSet.add(instructionKey);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking for duplicate instructions:', error);
    return false;
  }
};

/**
 * Enhanced prepareJupSellBundles function with clear documentation
 * The backend now returns ALL transactions for wallets with tokens
 * This function organizes them into appropriate-sized bundles for Jito
 */
const prepareJupSellBundles = (signedTransactions: string[]): JupSellBundle[] => {
  // Maximum transactions per bundle for Jito
  const MAX_TXS_PER_BUNDLE = 5;
  const bundles: JupSellBundle[] = [];
  
  console.log(`Preparing bundles from ${signedTransactions.length} transactions`);
  
  // Filter out any null/undefined transactions first
  const validTransactions = signedTransactions.filter(tx => tx);

  // Group transactions into bundles of MAX_TXS_PER_BUNDLE
  for (let i = 0; i < validTransactions.length; i += MAX_TXS_PER_BUNDLE) {
    const bundleTransactions = validTransactions.slice(i, i + MAX_TXS_PER_BUNDLE);
    bundles.push({
      transactions: bundleTransactions
    });
  }
  
  console.log(`Created ${bundles.length} bundles with maximum ${MAX_TXS_PER_BUNDLE} transactions per bundle`);
  return bundles;
};

/**
 * Execute Jupiter sell operation
 * The backend now returns transactions for ALL wallets with tokens
 * This function:
 * 1. Gets transactions from backend for all wallets
 * 2. Signs them client-side
 * 3. Organizes them into MAX_TXS_PER_BUNDLE-sized bundles
 * 4. Sends bundles to Jito through the backend
 */
export const executeJupSell = async (
  wallets: WalletJupSell[],
  sellConfig: SellConfig
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to sell ${sellConfig.inputMint} for ${sellConfig.outputMint} using ${wallets.length} wallets`);
    
    // Extract wallet addresses
    const walletAddresses = wallets.map(wallet => wallet.address);
    
    // Step 1: Get partially prepared transactions from backend
    // The backend will filter wallets that have no balance and return transactions for ALL wallets with tokens
    const partiallyPreparedTransactions = await getPartiallyPreparedSellTransactions(
      walletAddresses,
      sellConfig
    );
    console.log(`Received ${partiallyPreparedTransactions.length} partially prepared transactions from backend`);
    
    if (partiallyPreparedTransactions.length === 0) {
      return {
        success: false,
        error: 'No transactions generated. Wallets might not have sufficient token balance.'
      };
    }
    
    // Step 2: Create keypairs from private keys
    const walletKeypairs = wallets.map(wallet => 
      Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
    );
    
    // Step 3: Complete transaction signing with wallet keys
    const fullySignedTransactions = completeTransactionSigning(
      partiallyPreparedTransactions,
      walletKeypairs
    );
    console.log(`Completed signing for ${fullySignedTransactions.length} transactions`);
    
    if (fullySignedTransactions.length === 0) {
      return {
        success: false,
        error: 'Failed to sign any transactions'
      };
    }
    
    // Step 4: Prepare Jupiter sell bundles - this organizes the transactions into Jito-compatible bundles
    const jupSellBundles = prepareJupSellBundles(fullySignedTransactions);
    console.log(`Prepared ${jupSellBundles.length} Jupiter sell bundles`);
    
    // Step 5: Send bundles in sequence with rate limiting
    let results: BundleResult[] = [];
    let hasSuccessfulBundles = false;
    let failedBundles = 0;
    
    for (let i = 0; i < jupSellBundles.length; i++) {
      const bundle = jupSellBundles[i];
      console.log(`Sending bundle ${i+1}/${jupSellBundles.length} with ${bundle.transactions.length} transactions`);
      
      await checkRateLimit();
      
      try {
        const result = await sendBundle(bundle.transactions);
        results.push(result);
        hasSuccessfulBundles = true;
        
        console.log(`Bundle ${i+1} sent successfully`);
      } catch (error) {
        console.error(`Error sending bundle ${i+1}:`, error);
        failedBundles++;
        
        // Specific handling for duplicate instruction errors
        if (error.message?.includes('duplicate instruction') || 
            error.message?.includes('-32602') ||
            error.message?.includes('identical instructions')) {
          console.error('Bundle has duplicate instructions. This is not allowed by Jito.');
        }
      }
      
      // Add delay between bundles (except after the last one)
      if (i < jupSellBundles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }
    
    // Return appropriate success status and information
    if (hasSuccessfulBundles) {
      if (failedBundles > 0) {
        return {
          success: true,
          result: results,
          error: `${failedBundles} bundles failed, but some succeeded. Possible duplicate instruction issues.`
        };
      } else {
        return {
          success: true,
          result: results
        };
      }
    } else {
      return {
        success: false,
        error: 'All bundles failed to send. Check for duplicate instructions or other issues.'
      };
    }
  } catch (error) {
    console.error('Jupiter sell error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error executing Jupiter sell'
    };
  }
};
/**
 * Validate Jupiter sell inputs
 */
export const validateJupSellInputs = (
  wallets: WalletJupSell[],
  sellConfig: SellConfig,
  tokenBalances: Map<string, bigint>
): { valid: boolean; error?: string } => {
  // Check if sell config is valid
  if (!sellConfig.inputMint || !sellConfig.outputMint) {
    return { valid: false, error: 'Invalid token addresses' };
  }
  
  if (isNaN(sellConfig.sellPercent) || sellConfig.sellPercent <= 0 || sellConfig.sellPercent > 100) {
    return { valid: false, error: 'Invalid sell percentage (must be between 1-100)' };
  }
  
  if (isNaN(sellConfig.slippageBps) || sellConfig.slippageBps < 0) {
    return { valid: false, error: 'Invalid slippage value' };
  }
  
  // Check if wallets are valid
  if (!wallets.length) {
    return { valid: false, error: 'No wallets provided' };
  }
  
  // Check if any wallets have token balance
  let hasTokens = false;
  for (const wallet of wallets) {
    if (!wallet.address || !wallet.privateKey) {
      return { valid: false, error: 'Invalid wallet data' };
    }
    
    const balance = tokenBalances.get(wallet.address) || BigInt(0);
    if (balance > BigInt(0)) {
      hasTokens = true;
      break;
    }
  }
  
  if (!hasTokens) {
    return { valid: false, error: 'None of the wallets have any balance of the specified token' };
  }
  
  return { valid: true };
};