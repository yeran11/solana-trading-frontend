import { Connection, PublicKey, Keypair, VersionedTransaction, Transaction, TransactionMessage } from '@solana/web3.js';
import bs58 from 'bs58';

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
  tokenInfo?: {
    vaultA: string;
    vaultB: string;
    metadata: {
      name: string;
      symbol: string;
      decimals: number;
    };
  };
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

    if (!legacyTransaction.feePayer) {
      throw new Error('Transaction is missing a fee payer');
    }

    // Create a TransactionMessage
    const messageV0 = new TransactionMessage({
      payerKey: legacyTransaction.feePayer,
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
 * Send bundle to Fury API using fetch
 */
const sendBundle = async (encodedTransactions: string[]): Promise<any> => {
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

  console.log(`Sending ${encodedTransactions.length} transactions to Fury API via fetch`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      // Try to get error details from the response body
      let errorBody = 'Could not read error body';
      try {
        errorBody = await response.text();
      } catch (e) {
        // Ignore error reading body
      }
      throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }

    // Parse the JSON response
    const responseData = await response.json();
    return responseData;

  } catch (error) {
    console.error('Error sending bundle via fetch:', error);
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
 * Fetch launch transactions from the new endpoint
 */
async function fetchLaunchTransactionsFromNewEndpoint(
  tokenMetadata: TokenMetadata,
  ownerPublicKey: string,
  buyerWallets: BuyerWallet[],
  initialBuyAmount: number
): Promise<TransactionsData> {
  try {
    // API endpoint for getting launch transactions
    const apiUrl = 'https://solana.fury.bot/api/getBonkCreateTransactions';

    console.log("Fetching launch transactions from new API endpoint...");
    console.log(`Owner: ${ownerPublicKey}, Initial Buy Amount: ${initialBuyAmount}`);
    console.log(`Token: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
    console.log(`Buyer wallets: ${buyerWallets.length}`);

    const requestData = {
      tokenMetadata,
      ownerPublicKey,
      buyerWallets,
      initialBuyAmount
    };

    // Create FormData for multipart request (since the endpoint expects image file)
    const formData = new FormData();
    
    // Add all the JSON data
    formData.append('tokenMetadata', JSON.stringify(tokenMetadata));
    formData.append('ownerPublicKey', ownerPublicKey);
    formData.append('buyerWallets', JSON.stringify(buyerWallets));
    formData.append('initialBuyAmount', initialBuyAmount.toString());
    
    // Add a placeholder image - we still need to provide an image even with the new endpoint
    // This creates a small transparent PNG as a placeholder
    const placeholderImageBlob = new Blob([
      new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ])
    ], { type: 'image/png' });
    
    formData.append('image', placeholderImageBlob, 'placeholder.png');

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorBody = 'Could not read error body';
      try {
        errorBody = await response.text();
      } catch (e) { /* ignore */ }
      throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch launch transactions (API indicated failure)');
    }

    return result;
  } catch (error) {
    console.error('Error fetching launch transactions via new endpoint:', error);
    throw error;
  }
}

/**
 * Send first bundle with extensive retry logic
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

      // Log the error
      console.warn(`First bundle attempt ${attempt + 1} failed. Retrying in ${waitTime}ms... Error:`, error instanceof Error ? error.message : error);

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
 * Prepare and execute bonk token creation using the new endpoint
 */
export const executeBonkCreate = async (
  wallets: WalletForBonkCreate[],
  tokenCreationConfig: TokenCreationConfig,
  customAmounts?: number[],
  imageBlob?: Blob
): Promise<{ success: boolean; mintAddress?: string; poolId?: string; result?: any; error?: string }> => {
  try {
    console.log(`Preparing to create token using ${wallets.length} wallets with new endpoint`);

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
      // Index for customAmounts needs to align with the original wallets array (index + 1)
      const amount = customAmounts && customAmounts[index + 1] !== undefined
        ? customAmounts[index + 1] * 1e9 // Convert SOL to lamports
        : tokenCreationConfig.config.tokenCreation.defaultSolAmount * 1e9;

      return {
        publicKey: wallet.address,
        amount: amount
      };
    });

    // Convert token metadata from our format to API format
    const tokenMetadata: TokenMetadata = {
      name: tokenCreationConfig.config.tokenCreation.metadata.name,
      symbol: tokenCreationConfig.config.tokenCreation.metadata.symbol,
      description: tokenCreationConfig.config.tokenCreation.metadata.description || "A new token on Solana",
      decimals: 6, // Default for letsbonk
      supply: "1000000000000000", // Default large supply for meme tokens
      totalSellA: "793100000000000" // Default sell allocation
    };

    // Get the initial buy amount from the first buyer wallet, or use default
    const initialBuyAmount = buyerWallets.length > 0
      ? buyerWallets[0].amount / 1e9 // Convert lamports to SOL
      : tokenCreationConfig.config.tokenCreation.defaultSolAmount;

    // Fetch token launch transactions from the new API endpoint
    const transactionsData = await fetchLaunchTransactionsFromNewEndpoint(
      tokenMetadata,
      ownerPublicKey,
      buyerWallets,
      initialBuyAmount
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
        // Find the correct buyer wallet keypair. Buyer wallets start at index 1 of walletKeypairs.
        const buyerWalletIndex = walletKeypairs.findIndex((kp, idx) => idx > 0 && kp.publicKey.toString() === txInfo.publicKey);

        if (buyerWalletIndex === -1) {
             console.warn(`No matching keypair found for buyer public key ${txInfo.publicKey} provided by API, skipping transaction index ${txInfo.index}`);
            continue;
        }

        const buyerWallet = walletKeypairs[buyerWalletIndex];

        // Convert to versioned transaction and sign
        const signedTx = await signTransaction(txInfo.transaction, buyerWallet, connection);
        signedBuyerTransactions.push(signedTx);

        console.log(`Converted and signed buyer transaction for wallet: ${txInfo.publicKey}`);
    }

    // Combine all transactions in the correct order
    const allTransactions = [signedTokenCreationTx, ...signedBuyerTransactions];

    // Send the first bundle (which is all transactions in this case)
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
      error: error instanceof Error ? error.message : String(error)
    };
  }
};