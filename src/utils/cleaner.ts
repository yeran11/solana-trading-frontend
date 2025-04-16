import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Constants
const JITO_ENDPOINT = 'https://mainnet.block-engine.jito.wtf/api/v1/block-engine';
const MAX_BUNDLES_PER_SECOND = 2;

// Rate limiting state
const rateLimitState = {
  count: 0,
  lastReset: Date.now(),
  maxBundlesPerSecond: MAX_BUNDLES_PER_SECOND
};

export interface WalletInfo {
  address: string;
  privateKey: string;
}

interface CleanerTransactionsResponse {
  success: boolean;
  transactions: string[];
  error?: string;
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
 * Get transaction templates from backend
 */
const getTransactionTemplates = async (
  sellerAddress: string,
  buyerAddress: string,
  tokenAddress: string,
  sellPercentage: number,
  buyPercentage: number
): Promise<CleanerTransactionsResponse> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    
    const response = await fetch(`${baseUrl}/api/tokens/cleaner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerAddress,
        buyerAddress,
        tokenAddress,
        sellPercentage,
        buyPercentage
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get transaction templates');
    }
    
    return data;
  } catch (error) {
    console.error('Error getting transaction templates:', error);
    throw error;
  }
};

/**
 * Signs a transaction with the provided keypair
 */
const signTransaction = (txBase58: string, keypair: Keypair): string => {
  try {
    // Deserialize transaction
    const txBuffer = bs58.decode(txBase58);
    const transaction = VersionedTransaction.deserialize(txBuffer);
    
    // Sign transaction
    transaction.sign([keypair]);
    
    // Serialize and encode the signed transaction
    return bs58.encode(transaction.serialize());
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
};

/**
 * Signs a transaction with multiple keypairs
 */
const signTransactionMultiple = (txBase58: string, keypairs: Keypair[]): string => {
  try {
    // Deserialize transaction
    const txBuffer = bs58.decode(txBase58);
    const transaction = VersionedTransaction.deserialize(txBuffer);
    
    // Sign transaction
    transaction.sign(keypairs);
    
    // Serialize and encode the signed transaction
    return bs58.encode(transaction.serialize());
  } catch (error) {
    console.error('Error signing transaction with multiple keypairs:', error);
    throw error;
  }
};

/**
 * Complete transaction signing for all transactions in the bundle
 */
const completeTransactionSigning = (
  transactions: string[],
  sellerKeypair: Keypair,
  buyerKeypair: Keypair
): string[] => {
  try {
    // Sign sell transaction with seller
    const signedSellTx = signTransaction(transactions[0], sellerKeypair);
    
    // Sign toDump transaction with seller
    const signedToDumpTx = signTransaction(transactions[1], sellerKeypair);
    
    // Sign fromDump transaction with seller and buyer
    // This transaction is already partially signed by dump wallets on the backend
    const signedFromDumpTx = signTransactionMultiple(
      transactions[2], 
      [sellerKeypair, buyerKeypair]
    );
    
    // Sign buy transaction with seller (fee payer) and buyer
    const signedBuyTx = signTransactionMultiple(
      transactions[3],
      [sellerKeypair, buyerKeypair]
    );
    
    return [signedSellTx, signedToDumpTx, signedFromDumpTx, signedBuyTx];
  } catch (error) {
    console.error('Error completing transaction signing:', error);
    throw error;
  }
};

/**
 * Execute cleaner operation
 */
export const executeCleanerOperation = async (
  sellerWallet: WalletInfo,
  buyerWallet: WalletInfo,
  tokenAddress: string,
  sellPercentage: number,
  buyPercentage: number
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to run cleaner operation from ${sellerWallet.address} to ${buyerWallet.address} for token ${tokenAddress}`);
    
    // Step 1: Get transaction templates from backend
    const transactionData = await getTransactionTemplates(
      sellerWallet.address,
      buyerWallet.address,
      tokenAddress,
      sellPercentage,
      buyPercentage
    );
    
    console.log(`Received transaction templates from backend`);
    
    // Step 2: Create keypairs from private keys
    const sellerKeypair = Keypair.fromSecretKey(bs58.decode(sellerWallet.privateKey));
    const buyerKeypair = Keypair.fromSecretKey(bs58.decode(buyerWallet.privateKey));
    
    // Step 3: Complete transaction signing (dump wallets are already signed on the backend)
    const fullySignedTransactions = completeTransactionSigning(
      transactionData.transactions,
      sellerKeypair,
      buyerKeypair
    );
    console.log(`Completed signing for ${fullySignedTransactions.length} transactions`);
    
    // Step 4: Send bundle
    console.log("Sending bundle...");
    await checkRateLimit();
    const result = await sendBundle(fullySignedTransactions);
    console.log(`Bundle sent successfully:`, result);
    
    return {
      success: true,
      result: {
        bundleResult: result
      }
    };
  } catch (error) {
    console.error('Cleaner operation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate cleaner operation inputs
 */
export const validateCleanerInputs = (
  sellerWallet: WalletInfo,
  buyerWallet: WalletInfo,
  tokenAddress: string,
  sellPercentage: number,
  buyPercentage: number,
  tokenBalance: number
): { valid: boolean; error?: string } => {
  // Check if seller wallet is valid
  if (!sellerWallet.address || !sellerWallet.privateKey) {
    return { valid: false, error: 'Invalid seller wallet' };
  }
  
  // Check if buyer wallet is valid
  if (!buyerWallet.address || !buyerWallet.privateKey) {
    return { valid: false, error: 'Invalid buyer wallet' };
  }
  
  // Check if token address is valid
  if (!tokenAddress) {
    return { valid: false, error: 'Token address is required' };
  }
  
  // Check if percentage values are valid
  if (isNaN(sellPercentage) || sellPercentage <= 0 || sellPercentage > 100) {
    return { valid: false, error: 'Sell percentage must be between 1 and 100' };
  }
  
  if (isNaN(buyPercentage) || buyPercentage <= 0 || buyPercentage > 100) {
    return { valid: false, error: 'Buy percentage must be between 1 and 100' };
  }
  
  // Check if seller has tokens
  if (!tokenBalance || tokenBalance <= 0) {
    return { valid: false, error: 'Seller has no tokens to sell' };
  }
  
  return { valid: true };
};