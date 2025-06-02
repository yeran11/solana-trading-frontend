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

interface WalletJupSwap {
  address: string;
  privateKey: string;
}

interface SwapConfig {
  inputMint: string;  // Usually SOL = So11111111111111111111111111111111111111112
  outputMint: string; // Target token to buy
  solAmount: number;  // Amount of SOL to use per wallet
  slippageBps: number; // Slippage tolerance in basis points (e.g., 100 = 1%)
}

interface JupSwapBundle {
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
 * Fetch Jupiter quote from the public Jupiter API.
 * This quote will later be sent to the backend.
 */
const getJupiterQuoteFromAPI = async (swapConfig: SwapConfig, solAmount: number): Promise<any> => {
  try {
    // Convert SOL amount to lamports
    const amountLamports = Math.floor(solAmount * 1e9).toString();
    // You can choose your preferred Jupiter endpoint here.
    const baseEndpoint = 'https://api.jup.ag/swap/v1';
    const endpoint = `${baseEndpoint}/quote?inputMint=${swapConfig.inputMint}&outputMint=${swapConfig.outputMint}&amount=${amountLamports}&slippageBps=${swapConfig.slippageBps}`;
    console.log("Fetching Jupiter quote from:", endpoint);
    const response = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch Jupiter quote: ${response.status}`);
    }
    const quoteResponse = await response.json();
    return quoteResponse;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    throw error;
  }
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
 * Get partially prepared Jupiter swap transactions from backend.
 * In this updated version, the frontend fetches a Jupiter quote and
 * includes it in the payload sent to the backend.
 */
const getPartiallyPreparedSwapTransactions = async (
  walletAddresses: string[], 
  swapConfig: SwapConfig,
  customAmounts?: number[]
): Promise<string[]> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    
    const config = loadConfigFromCookies();
    // Get fee in SOL (string) with default if not found
    const feeInSol = config?.transactionFee || '0.005';
    const feeInLamports = Math.floor(parseFloat(feeInSol) * 1_000_000_000);
    const response = await fetch(`${baseUrl}/api/tokens/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config?.apiKey || '' 
      },
      body: JSON.stringify({
        walletAddresses,
        tokenAddress: swapConfig.outputMint,
        solAmount: swapConfig.solAmount,
        protocol: "jupiter",
        amounts: customAmounts, // Optional custom amounts per wallet
        jitoTipLamports: feeInLamports  // Now a number in lamports
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get partially prepared swap transactions');
    }
    
    return data.transactions; // Array of base58 encoded partially prepared transactions
  } catch (error) {
    console.error('Error getting partially prepared transactions:', error);
    throw error;
  }
};

/**
 * Complete transaction signing with wallets - improved with error handling
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

/**
 * Enhanced check for duplicate transactions in a bundle
 */
const checkForDuplicateInstructions = (transactions: VersionedTransaction[]): { hasDuplicates: boolean, duplicates: string[] } => {
  try {
    // Create a set of serialized instructions to check for duplicates
    const instructionSet = new Set<string>();
    const duplicates: string[] = [];
    
    for (const tx of transactions) {
      // Get all instructions from the transaction
      const instructions = tx.message.compiledInstructions;
      
      for (const instruction of instructions) {
        // Create a more comprehensive signature for this instruction
        // Use programIndex, accounts, and data to identify an instruction
        const programIndex = instruction.programIdIndex;
        const programId = tx.message.staticAccountKeys[programIndex].toBase58();
        const accountStr = instruction.accountKeyIndexes.map(idx => 
          tx.message.staticAccountKeys[idx].toBase58().slice(0, 8)
        ).join('-');
        
        const instructionKey = `${programId.slice(0, 8)}-${accountStr}-${instruction.data.slice(0, 10)}`;
        
        if (instructionSet.has(instructionKey)) {
          console.warn('Duplicate instruction detected:', instructionKey);
          duplicates.push(programId);
        }
        
        instructionSet.add(instructionKey);
      }
    }
    
    return { 
      hasDuplicates: duplicates.length > 0,
      duplicates
    };
  } catch (error) {
    console.error('Error checking for duplicate instructions:', error);
    return { hasDuplicates: false, duplicates: [] };
  }
};

/**
 * Prepare Jupiter swap bundles with improved duplicate instruction checking
 */
const prepareJupSwapBundles = (signedTransactions: string[]): JupSwapBundle[] => {
  const MAX_TXS_PER_BUNDLE = 5; // Jito typically allows up to 5 transactions per bundle
  const bundles: JupSwapBundle[] = [];
  
  // Deserialize transactions to check for duplicates
  const deserializedTransactions = signedTransactions
    .filter(txBase58 => txBase58) // Filter out any null/undefined transactions
    .map(txBase58 => VersionedTransaction.deserialize(bs58.decode(txBase58)));
  
  // Enhanced duplicate checking
  const { hasDuplicates, duplicates } = checkForDuplicateInstructions(deserializedTransactions);
  
  if (hasDuplicates) {
    console.warn('Duplicate instructions found in transactions:');
    duplicates.forEach(dup => console.warn(`- Program: ${dup}`));
    
    // Check if the duplicates are in the Associated Token Program (common issue with Jupiter)
    const hasATokenDuplicates = duplicates.some(dup => 
      dup.includes('AToken') || dup === 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
    );
    
    if (hasATokenDuplicates) {
      console.warn('⚠️ Associated Token Program duplicates detected. This is a known issue with Jupiter swaps.');
      console.warn('These duplicates might be rejected by Jito. Consider reducing bundle size or trying again.');
    }
  }
  
  // Group transactions into bundles with MAX_TXS_PER_BUNDLE
  const validTransactions = signedTransactions.filter(tx => tx); // Filter out null/undefined
  
  for (let i = 0; i < validTransactions.length; i += MAX_TXS_PER_BUNDLE) {
    const bundleTransactions = validTransactions.slice(i, i + MAX_TXS_PER_BUNDLE);
    
    if (bundleTransactions.length > 0) {
      bundles.push({
        transactions: bundleTransactions
      });
    }
  }
  
  return bundles;
};

/**
 * Execute Jupiter swap operation with multi-bundle support.
 * This function processes multiple wallet batches to handle more than 5 wallets.
 */
export const executeJupSwap = async (
  wallets: WalletJupSwap[],
  swapConfig: SwapConfig,
  customAmounts?: number[]
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to swap ${swapConfig.inputMint} for ${swapConfig.outputMint} using ${wallets.length} wallets`);
    
    // Constants for batching
    const MAX_WALLETS_PER_REQUEST = 5; // Process wallets in batches
    
    // Create wallet keypairs map for quick lookup
    const walletKeypairsMap = new Map<string, Keypair>();
    wallets.forEach(wallet => {
      walletKeypairsMap.set(
        wallet.address, 
        Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
      );
    });
    
    // Process wallets in batches
    const allResults: BundleResult[] = [];
    let successfulBundles = 0;
    let failedBundles = 0;
    let processedWalletCount = 0;
    
    // Divide wallets into batches for processing
    for (let batchIndex = 0; processedWalletCount < wallets.length; batchIndex++) {
      // Select the next batch of wallets
      const walletBatch = wallets.slice(
        processedWalletCount, 
        processedWalletCount + MAX_WALLETS_PER_REQUEST
      );
      
      if (walletBatch.length === 0) break;
      
      console.log(`Processing batch ${batchIndex + 1} with ${walletBatch.length} wallets`);
      
      // Extract wallet addresses for this batch
      const walletAddresses = walletBatch.map(wallet => wallet.address);
      
      try {
        // Get amounts for this batch if custom amounts are provided
        const batchCustomAmounts = customAmounts ? 
          customAmounts.slice(
            processedWalletCount, 
            processedWalletCount + MAX_WALLETS_PER_REQUEST
          ) : undefined;
        
        // Get partially prepared transactions from backend for this batch
        const partiallyPreparedTransactions = await getPartiallyPreparedSwapTransactions(
          walletAddresses,
          swapConfig,
          batchCustomAmounts
        );
        
        console.log(`Received ${partiallyPreparedTransactions.length} prepared transactions from backend for batch ${batchIndex + 1}`);
        
        if (partiallyPreparedTransactions.length > 0) {
          // Create a subset of keypairs just for this batch
          const batchKeypairs = walletBatch
            .map(wallet => walletKeypairsMap.get(wallet.address))
            .filter(keypair => keypair !== undefined) as Keypair[];
          
          // Sign the transactions for this batch
          const signedTransactions = completeTransactionSigning(
            partiallyPreparedTransactions,
            batchKeypairs
          );
          
          if (signedTransactions.length > 0) {
            // Prepare bundles from the signed transactions
            const jupSwapBundles = prepareJupSwapBundles(signedTransactions);
            console.log(`Prepared ${jupSwapBundles.length} bundles from batch ${batchIndex + 1}`);
            
            // Send each bundle
            for (let bundleIndex = 0; bundleIndex < jupSwapBundles.length; bundleIndex++) {
              const bundle = jupSwapBundles[bundleIndex];
              
              console.log(`Sending bundle ${bundleIndex + 1}/${jupSwapBundles.length} from batch ${batchIndex + 1} with ${bundle.transactions.length} transactions`);
              
              // Check rate limit before sending
              await checkRateLimit();
              
              try {
                const result = await sendBundle(bundle.transactions);
                allResults.push(result);
                successfulBundles++;
                console.log(`Bundle ${bundleIndex + 1} from batch ${batchIndex + 1} sent successfully`);
              } catch (error) {
                console.error(`Error sending bundle ${bundleIndex + 1} from batch ${batchIndex + 1}:`, error);
                failedBundles++;
                
                // Specific error handling for duplicate instructions
                if (error.message?.includes('duplicate instruction') || 
                    error.message?.includes('-32602') ||
                    error.message?.includes('identical instructions')) {
                  console.error('Bundle has duplicate instructions. This is not allowed by Jito.');
                }
              }
              
              // Add delay between bundles
              if (jupSwapBundles.length > 1 && bundleIndex < jupSwapBundles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
              }
            }
          } else {
            console.log(`No transactions were successfully signed in batch ${batchIndex + 1}`);
          }
        } else {
          console.log(`No transactions returned for batch ${batchIndex + 1}.`);
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
      }
      
      // Update processed wallet count
      processedWalletCount += walletBatch.length;
      
      // Add delay between batches if there are more to process
      if (processedWalletCount < wallets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
      }
    }
    
    // Return result based on success/failure count
    if (successfulBundles > 0) {
      if (failedBundles > 0) {
        return {
          success: true,
          result: allResults,
          error: `${failedBundles} bundles failed, but ${successfulBundles} succeeded. Some transactions may have duplicate instructions.`
        };
      } else {
        return {
          success: true,
          result: allResults
        };
      }
    } else if (failedBundles > 0) {
      return {
        success: false,
        error: `All ${failedBundles} bundles failed. Check for duplicate instructions or other issues.`
      };
    } else {
      return {
        success: false,
        error: 'No transactions were created or sent.'
      };
    }
  } catch (error) {
    console.error('Jupiter swap error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error executing Jupiter swap'
    };
  }
};

/**
 * Validate Jupiter swap inputs
 */
export const validateJupSwapInputs = (
  wallets: WalletJupSwap[],
  swapConfig: SwapConfig,
  walletBalances: Map<string, number>
): { valid: boolean; error?: string } => {
  // Check if swap config is valid
  if (!swapConfig.inputMint || !swapConfig.outputMint) {
    return { valid: false, error: 'Invalid token addresses' };
  }
  
  if (isNaN(swapConfig.solAmount) || swapConfig.solAmount <= 0) {
    return { valid: false, error: 'Invalid SOL amount' };
  }
  
  if (isNaN(swapConfig.slippageBps) || swapConfig.slippageBps < 0) {
    return { valid: false, error: 'Invalid slippage value' };
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
    if (balance < swapConfig.solAmount) {
      return { valid: false, error: `Wallet ${wallet.address.substring(0, 6)}... has insufficient balance` };
    }
  }
  
  return { valid: true };
};
