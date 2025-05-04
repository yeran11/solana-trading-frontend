import { Connection, PublicKey, Keypair, VersionedTransaction, Transaction, TransactionMessage } from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';

// Constants for rate limiting
const MAX_BUNDLES_PER_SECOND = 2;
const MAX_RETRY_ATTEMPTS = 50;
const MAX_CONSECUTIVE_ERRORS = 3;
const BASE_RETRY_DELAY = 200; // milliseconds

// Rate limiting state
const rateLimitState = {
  count: 0,
  lastReset: Date.now(),
  maxBundlesPerSecond: MAX_BUNDLES_PER_SECOND
};

// Interfaces
export interface WalletForBonkCreate {
  address: string;
  privateKey: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  decimals: number;
  supply: string;
  totalSellA: string;
}

export interface TokenCreationConfig {
  mintPubkey: string;
  config: {
    tokenCreation: {
      metadata: {
        name: string;
        symbol: string;
        description: string;
        telegram?: string;
        twitter?: string;
        website?: string;
        file: string;
      };
      defaultSolAmount: number;
    };
  };
}

export interface BuyerWallet {
  publicKey: string;
  amount: number;
}

interface TransactionInfo {
  index: number;
  publicKey: string;
  transaction: string;
}

interface TokenCreationInfo {
  mint: string;
  poolId: string;
  transaction: string;
}

interface TransactionsData {
  success: boolean;
  error?: string;
  tokenCreation: TokenCreationInfo;
  buyerTransactions: TransactionInfo[];
}

interface ApiResponse {
  success: boolean;
  error?: string;
  data?: TransactionsData;
}

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
 * Creates a Solana keypair from a private key
 */
function createKeypairFromPrivateKey(privateKey: string): Keypair {
  try {
    const privateKeyBytes = bs58.decode(privateKey);
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error('Error creating keypair from private key:', error);
    throw error;
  }
}

/**
 * Converts a legacy transaction to a versioned transaction
 */
async function convertToVersionedTransaction(
  serializedTransaction: string, 
  connection: Connection
): Promise<VersionedTransaction> {
  try {
    // Deserialize the legacy transaction
    const transactionBuffer = bs58.decode(serializedTransaction);
    const legacyTransaction = Transaction.from(transactionBuffer);
    
    // Get the blockhash (reuse the one from the legacy transaction)
    const blockhash = legacyTransaction.recentBlockhash;
    if (!blockhash) {
      throw new Error('Transaction is missing a recent blockhash');
    }
    
    // Create a TransactionMessage
    const messageV0 = new TransactionMessage({
      payerKey: legacyTransaction.feePayer as PublicKey,
      recentBlockhash: blockhash,
      instructions: legacyTransaction.instructions
    }).compileToV0Message();
    
    // Create the versioned transaction
    return new VersionedTransaction(messageV0);
  } catch (error) {
    console.error('Error converting to versioned transaction:', error);
    throw error;
  }
}

/**
 * Signs a transaction with the provided wallet, converting to versioned if needed
 */
async function signTransaction(
  serializedTransaction: string, 
  wallet: Keypair, 
  connection: Connection
): Promise<string> {
  try {
    // Convert to versioned transaction
    const versionedTx = await convertToVersionedTransaction(serializedTransaction, connection);
    
    // Sign the transaction
    versionedTx.sign([wallet]);
    
    // Serialize and return the signed transaction
    const signedBuffer = versionedTx.serialize();
    return bs58.encode(signedBuffer);
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
}

/**
 * Signs a versioned transaction with the provided wallet
 */
function signVersionedTransaction(base64Transaction: string, wallet: Keypair): string {
  try {
    // Deserialize the transaction
    const transactionBuffer = Buffer.from(base64Transaction, 'base64');
    const versionedTx = VersionedTransaction.deserialize(transactionBuffer);
    
    // Sign the transaction
    versionedTx.sign([wallet]);
    
    // Serialize and return the signed transaction
    const signedBuffer = versionedTx.serialize();
    return bs58.encode(signedBuffer);
  } catch (error) {
    console.error('Error signing versioned transaction:', error);
    throw error;
  }
}

/**
 * Send bundle to Fury API
 */
const sendBundle = async (encodedTransactions: string[]): Promise<any> => {
  try {
    const url = 'https://solana.fury.bot/api/transactions/send';
    const headers = {
      'accept': 'application/json',
      'content-type': 'application/json',
    };
    
    // Prepare the request body
    const data = {
      transactions: encodedTransactions,
      useRpc: false
    };
    
    console.log(`Sending ${encodedTransactions.length} transactions to Fury API`);
    const response = await axios.post(url, data, { headers });
    
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending bundle:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Exponential backoff delay with jitter
 */
const getRetryDelay = (attempt: number): number => {
  // Base delay with exponential increase and random jitter (±15%)
  const jitter = 0.85 + (Math.random() * 0.3);
  return Math.floor(BASE_RETRY_DELAY * Math.pow(1.5, attempt) * jitter);
};

/**
 * Fetch launch transactions from the letsbonk API
 */
async function fetchLaunchTransactions(
  tokenCreationConfig: TokenCreationConfig,
  ownerPublicKey: string,
  buyerWallets: BuyerWallet[],
  imageBuffer: Buffer
): Promise<TransactionsData> {
  try {
    // Convert token metadata from our format to letsbonk format
    const tokenMetadata: TokenMetadata = {
      name: tokenCreationConfig.config.tokenCreation.metadata.name,
      symbol: tokenCreationConfig.config.tokenCreation.metadata.symbol,
      description: tokenCreationConfig.config.tokenCreation.metadata.description || "",
      decimals: 6, // Default for letsbonk
      supply: "1000000000000000", // Default large supply for meme tokens
      totalSellA: "793100000000000" // Default sell allocation
    };
    
    // API endpoint for getting launch transactions
    const apiUrl = 'https://solana.fury.bot/letsbonk/create';
    
    // Create FormData object for multipart request
    const formData = new FormData();
    formData.append('tokenMetadata', JSON.stringify(tokenMetadata));
    formData.append('ownerPublicKey', ownerPublicKey);
    formData.append('buyerWallets', JSON.stringify(buyerWallets));
    formData.append('initialBuyAmount', buyerWallets[0].amount.toString());
    
    // Fetch image from the URL and convert to Buffer
    let imageData: Buffer;
    try {
      // Check if the image is a URL or already a Buffer
      if (typeof tokenCreationConfig.config.tokenCreation.metadata.file === 'string' && 
          tokenCreationConfig.config.tokenCreation.metadata.file.startsWith('http')) {
        const response = await axios.get(tokenCreationConfig.config.tokenCreation.metadata.file, { responseType: 'arraybuffer' });
        imageData = Buffer.from(response.data);
      } else {
        imageData = imageBuffer; // Use provided image buffer
      }
      
      formData.append('image', new Blob([imageData]), 'image.png');
    } catch (error) {
      console.error('Error fetching or processing image:', error);
      throw new Error('Failed to process token image');
    }
    
    console.log("Fetching launch transactions from API...");
    const response = await axios.post(apiUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    const result = response.data as ApiResponse;
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch launch transactions');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching launch transactions:', error);
    throw error;
  }
}

/**
 * Send first bundle with extensive retry logic - this is critical for success
 */
const sendFirstBundle = async (transactions: string[]): Promise<{success: boolean, result?: any, error?: string}> => {
  console.log(`Sending first bundle with ${transactions.length} transactions (critical)...`);
  
  let attempt = 0;
  let consecutiveErrors = 0;
  
  while (attempt < MAX_RETRY_ATTEMPTS && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
    try {
      // Apply rate limiting
      await checkRateLimit();
      
      // Send the bundle
      const result = await sendBundle(transactions);
      
      // Success!
      console.log(`First bundle sent successfully on attempt ${attempt + 1}`);
      return { success: true, result };
    } catch (error) {
      consecutiveErrors++;
      
      // Determine wait time with exponential backoff
      const waitTime = getRetryDelay(attempt);
      
      console.warn(`First bundle attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`, error);
      
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    attempt++;
  }
  
  return { 
    success: false, 
    error: `Failed to send first bundle after ${attempt} attempts` 
  };
};

/**
 * Prepare and execute bonk token creation
 */
export const executeBonkCreate = async (
  wallets: WalletForBonkCreate[],
  tokenCreationConfig: TokenCreationConfig,
  customAmounts?: number[],
  imageBlob?: Blob
): Promise<{ success: boolean; mintAddress?: string; poolId?: string; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to create token using ${wallets.length} wallets`);
    
    if (wallets.length < 1) {
      throw new Error('At least one wallet is required for token creation');
    }
    
    // Set up Solana connection
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Create keypairs from private keys
    const walletKeypairs = wallets.map(wallet => 
      createKeypairFromPrivateKey(wallet.privateKey)
    );
    
    // Owner wallet is the first wallet
    const ownerWallet = walletKeypairs[0];
    const ownerPublicKey = ownerWallet.publicKey.toString();
    
    // Format buyer wallets (all wallets except the first one)
    const buyerWallets: BuyerWallet[] = wallets.slice(1).map((wallet, index) => {
      const amount = customAmounts && customAmounts[index + 1] 
        ? customAmounts[index + 1] * 1e9 // Convert SOL to lamports
        : tokenCreationConfig.config.tokenCreation.defaultSolAmount * 1e9;
      
      return {
        publicKey: wallet.address,
        amount: amount
      };
    });
    
    // If we have an image blob, convert it to buffer
    let imageBuffer: Buffer;
    if (imageBlob) {
      const arrayBuffer = await imageBlob.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      // Otherwise fetch the image from URL
      const response = await axios.get(tokenCreationConfig.config.tokenCreation.metadata.file, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    }
    
    // Fetch token launch transactions from the API (unsigned)
    const transactionsData = await fetchLaunchTransactions(
      tokenCreationConfig,
      ownerPublicKey,
      buyerWallets,
      imageBuffer
    );
    
    console.log("Token creation and buyer transactions prepared successfully");
    console.log(`Mint Address: ${transactionsData.tokenCreation.mint}`);
    console.log(`Pool ID: ${transactionsData.tokenCreation.poolId}`);
    
    // Sign the token creation transaction (already versioned)
    const signedTokenCreationTx = signVersionedTransaction(
      transactionsData.tokenCreation.transaction,
      ownerWallet
    );
    
    console.log("Token creation transaction signed successfully");
    
    // Sign buyer transactions (convert to versioned transactions first)
    const signedBuyerTransactions: string[] = [];
    
    for (const txInfo of transactionsData.buyerTransactions) {
      // Skip if the index is out of bounds
      if (txInfo.index >= walletKeypairs.length - 1) {
        console.warn(`No wallet found for index ${txInfo.index}, skipping transaction`);
        continue;
      }
      
      // Get the buyer wallet (index + 1 because the first wallet is the owner)
      const buyerWallet = walletKeypairs[txInfo.index + 1];
      
      // Verify the public key matches
      if (buyerWallet.publicKey.toString() !== txInfo.publicKey) {
        console.warn(`Public key mismatch for transaction ${txInfo.index}, skipping...`);
        continue;
      }
      
      // Convert to versioned transaction and sign
      const signedTx = await signTransaction(txInfo.transaction, buyerWallet, connection);
      signedBuyerTransactions.push(signedTx);
      
      console.log(`Converted and signed buyer transaction for wallet: ${txInfo.publicKey}`);
    }
    
    // Combine all transactions in the correct order
    const allTransactions = [signedTokenCreationTx, ...signedBuyerTransactions];
    
    // Send the first bundle (which is all transactions in letsbonk case)
    const bundleResult = await sendFirstBundle(allTransactions);
    
    if (bundleResult.success) {
      console.log("Transaction bundle submitted successfully");
      return {
        success: true,
        mintAddress: transactionsData.tokenCreation.mint,
        poolId: transactionsData.tokenCreation.poolId,
        result: bundleResult.result
      };
    } else {
      return {
        success: false,
        error: bundleResult.error || "Failed to send transactions"
      };
    }
  } catch (error) {
    console.error('Bonk create error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};