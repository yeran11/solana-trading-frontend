import { FormattedWallet } from './trading';

// Import the loadConfigFromCookies function
let loadConfigFromCookies: any = null;

// Dynamically import the function to avoid circular dependencies
const initializeConfig = async () => {
  if (!loadConfigFromCookies) {
    try {
      const utilsModule = await import('../Utils');
      loadConfigFromCookies = utilsModule.loadConfigFromCookies;
    } catch (error) {
      console.error('Error importing Utils:', error);
    }
  }
};

// Utility function to get default configuration
const getDefaultConfig = () => {
  try {
    if (loadConfigFromCookies) {
      return loadConfigFromCookies();
    }
    return null;
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
};
export interface LimitOrderConfig {
  inputMint: string;
  outputMint: string;
  maker: string;
  makingAmount: string;
  takingAmount: string;
  slippageBps?: number;
  expiredAt?: number; // Unix timestamp
  base?: 'input' | 'output';
}

export interface CreateLimitOrderRequest {
  inputMint: string;
  outputMint: string;
  maker: string;
  makingAmount: string;
  takingAmount: string;
  slippageBps?: number;
  expiredAt?: number;
  rpcUrl?: string;
  includeTip?: boolean;
  jitoTipLamports?: number;
  affiliateAddress?: string;
  affiliateFee?: number;
  authenticated?: boolean;
}

export interface CreateMultipleLimitOrdersRequest {
  orders: LimitOrderConfig[];
  rpcUrl?: string;
  includeTip?: boolean;
  jitoTipLamports?: number;
  affiliateAddress?: string;
  affiliateFee?: number;
  authenticated?: boolean;
}

export interface CancelOrderRequest {
  maker: string;
  order: string;
  computeUnitPrice?: string;
  rpcUrl?: string;
  includeTip?: boolean;
  jitoTipLamports?: number;
  authenticated?: boolean;
}

export interface LimitOrderResponse {
  success: boolean;
  order?: string;
  requestId?: string;
  orderConfig?: any;
  transaction?: string;
  error?: string;
}

export interface MultipleLimitOrdersResponse {
  success: boolean;
  orders?: Array<{
    order: string;
    requestId: string;
    orderConfig: any;
  }>;
  transactions?: string[];
  errors?: string[];
  error?: string;
}

export interface ActiveOrdersResponse {
  success: boolean;
  orders?: {
    orders: Array<{
      publicKey: string;
      account: {
        maker: string;
        inputMint: string;
        outputMint: string;
        makingAmount: string;
        takingAmount: string;
        expiredAt: number | null;
        base: 'input' | 'output';
      };
    }>;
  };
  error?: string;
}

export interface CancelOrderResponse {
  success: boolean;
  transaction?: string;
  requestId?: string;
  error?: string;
}

// API Base URL - This should be configured based on your backend
const API_BASE_URL = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';

// Create a single limit order
export const createLimitOrder = async (
  config: CreateLimitOrderRequest
): Promise<LimitOrderResponse> => {
  try {
    // Initialize config if not already done
    await initializeConfig();
    const appConfig = getDefaultConfig();
    
    // Apply default values from app config
    const requestConfig: CreateLimitOrderRequest = {
      ...config,
      rpcUrl: config.rpcUrl || appConfig?.rpcEndpoint,
      includeTip: config.includeTip ?? true,
      jitoTipLamports: config.jitoTipLamports ?? (appConfig?.transactionFee ? Math.floor(parseFloat(appConfig.transactionFee) * 1_000_000_000) : 5000000),
      slippageBps: config.slippageBps ?? (appConfig?.slippageBps ? parseInt(appConfig.slippageBps) : 50),
      authenticated: config.authenticated ?? false
    };

    const response = await fetch(`${API_BASE_URL}/limit/create-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestConfig)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Create multiple limit orders
export const createMultipleLimitOrders = async (
  wallets: FormattedWallet[],
  orderConfig: Omit<LimitOrderConfig, 'maker'>,
  options?: {
    rpcUrl?: string;
    includeTip?: boolean;
    jitoTipLamports?: number;
    affiliateAddress?: string;
    affiliateFee?: number;
    authenticated?: boolean;
  }
): Promise<MultipleLimitOrdersResponse> => {
  try {
    // Initialize config if not already done
    await initializeConfig();
    const appConfig = getDefaultConfig();
    
    // Create orders for each wallet
    const orders: LimitOrderConfig[] = wallets.map(wallet => ({
      ...orderConfig,
      maker: wallet.address
    }));

    const requestConfig: CreateMultipleLimitOrdersRequest = {
      orders,
      rpcUrl: options?.rpcUrl || appConfig?.rpcEndpoint,
      includeTip: options?.includeTip ?? true,
      jitoTipLamports: options?.jitoTipLamports ?? (appConfig?.transactionFee ? Math.floor(parseFloat(appConfig.transactionFee) * 1_000_000_000) : 5000000),
      affiliateAddress: options?.affiliateAddress,
      affiliateFee: options?.affiliateFee,
      authenticated: options?.authenticated ?? false
    };

    const response = await fetch(`${API_BASE_URL}/limit/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestConfig)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Get active orders for a user
export const getActiveOrders = async (
  userAddress: string,
  filters?: {
    inputMint?: string;
    outputMint?: string;
  }
): Promise<ActiveOrdersResponse> => {
  try {
    const params = new URLSearchParams({
      userAddress
    });

    if (filters?.inputMint) {
      params.append('inputMint', filters.inputMint);
    }

    if (filters?.outputMint) {
      params.append('outputMint', filters.outputMint);
    }

    const response = await fetch(`${API_BASE_URL}/limit/active?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Cancel a specific order
export const cancelOrder = async (
  config: CancelOrderRequest
): Promise<CancelOrderResponse> => {
  try {
    // Initialize config if not already done
    await initializeConfig();
    const appConfig = getDefaultConfig();
    
    const requestConfig: CancelOrderRequest = {
      ...config,
      computeUnitPrice: config.computeUnitPrice || 'auto',
      rpcUrl: config.rpcUrl || appConfig?.rpcEndpoint,
      includeTip: config.includeTip ?? true,
      jitoTipLamports: config.jitoTipLamports ?? (appConfig?.transactionFee ? Math.floor(parseFloat(appConfig.transactionFee) * 1_000_000_000) : 5000000),
      authenticated: config.authenticated ?? false
    };

    const response = await fetch(`${API_BASE_URL}/limit/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestConfig)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Cancel all orders for a user
export const cancelAllOrders = async (
  userAddress: string,
  options?: {
    rpcUrl?: string;
    includeTip?: boolean;
    jitoTipLamports?: number;
    authenticated?: boolean;
  }
): Promise<{ success: boolean; results: CancelOrderResponse[]; error?: string }> => {
  try {
    // First, get all active orders for the user
    const activeOrdersResponse = await getActiveOrders(userAddress);
    
    if (!activeOrdersResponse.success || !activeOrdersResponse.orders?.orders) {
      return {
        success: false,
        results: [],
        error: activeOrdersResponse.error || 'Failed to fetch active orders'
      };
    }

    const orders = activeOrdersResponse.orders.orders;
    
    if (orders.length === 0) {
      return {
        success: true,
        results: [],
        error: 'No active orders to cancel'
      };
    }

    // Cancel each order
    const cancelPromises = orders.map(order =>
      cancelOrder({
        maker: userAddress,
        order: order.publicKey,
        ...options
      })
    );

    const results = await Promise.all(cancelPromises);
    const hasErrors = results.some(result => !result.success);

    return {
      success: !hasErrors,
      results,
      error: hasErrors ? 'Some orders failed to cancel' : undefined
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Utility function to convert SOL amount to lamports
export const solToLamports = (solAmount: number): string => {
  return Math.floor(solAmount * 1_000_000_000).toString();
};

// Utility function to convert lamports to SOL
export const lamportsToSol = (lamports: string): number => {
  return parseInt(lamports) / 1_000_000_000;
};

// Utility function to format token amount based on decimals
export const formatTokenAmount = (amount: string, decimals: number): string => {
  const factor = Math.pow(10, decimals);
  return Math.floor(parseFloat(amount) * factor).toString();
};

// Utility function to calculate price from making and taking amounts
export const calculatePrice = (makingAmount: string, takingAmount: string): number => {
  const making = parseFloat(makingAmount);
  const taking = parseFloat(takingAmount);
  return taking / making;
};

// Utility function to validate limit order configuration
export const validateLimitOrderConfig = (config: LimitOrderConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.inputMint || config.inputMint.trim() === '') {
    errors.push('Input mint is required');
  }

  if (!config.outputMint || config.outputMint.trim() === '') {
    errors.push('Output mint is required');
  }

  if (!config.maker || config.maker.trim() === '') {
    errors.push('Maker address is required');
  }

  if (!config.makingAmount || parseFloat(config.makingAmount) <= 0) {
    errors.push('Making amount must be greater than 0');
  }

  if (!config.takingAmount || parseFloat(config.takingAmount) <= 0) {
    errors.push('Taking amount must be greater than 0');
  }

  if (config.slippageBps !== undefined && (config.slippageBps < 0 || config.slippageBps > 10000)) {
    errors.push('Slippage must be between 0 and 10000 basis points');
  }

  if (config.expiredAt !== undefined && config.expiredAt <= Date.now() / 1000) {
    errors.push('Expiration time must be in the future');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
