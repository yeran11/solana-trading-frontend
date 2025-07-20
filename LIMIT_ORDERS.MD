# Trigger Orders API Documentation

This document describes the API endpoints for managing Jupiter trigger orders (limit orders) on Solana.

## Overview

The trigger orders API provides functionality to:
- Create single or multiple limit orders
- Retrieve active orders for users
- Cancel existing orders
- Execute signed transactions

All endpoints support custom fees, Jito tips, and affiliate fees.

## Endpoints


### 2. Create Multiple Limit Orders

**Endpoint:** `POST /limit/create`

**Description:** Creates multiple limit orders in batch with shared configuration.

**Request Body:**
```json
{
  "orders": [
    {
      "inputMint": "So11111111111111111111111111111111111111112",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "maker": "Wallet1PublicKey",
      "makingAmount": "1000000000",
      "takingAmount": "1000000"
    },
    {
      "inputMint": "So11111111111111111111111111111111111111112",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "maker": "Wallet2PublicKey",
      "makingAmount": "2000000000",
      "takingAmount": "2000000"
    }
  ],
  "rpcUrl": "https://your-rpc-endpoint.com",
  "includeTip": true,
  "jitoTipLamports": 5000000,
  "affiliateAddress": "AffiliateWalletPublicKey",
  "affiliateFee": 1.0,
  "authenticated": false
}
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "order": "Order1PublicKey",
      "requestId": "request-id-1",
      "orderConfig": {...}
    }
  ],
  "transactions": [
    "Base58EncodedTransaction1",
    "Base58EncodedTransaction2"
  ],
  "errors": []
}
```

### 3. Get Active Orders

**Endpoint:** `GET /limit/active`

**Description:** Retrieves active orders for a specific user with optional filtering.

**Query Parameters:**
- `userAddress` (required): User's wallet public key
- `inputMint` (optional): Filter by input token mint
- `outputMint` (optional): Filter by output token mint

**Example Request:**
```
GET /getActiveOrders?userAddress=YourWalletPublicKey&inputMint=So11111111111111111111111111111111111111112
```

**Response:**
```json
{
  "success": true,
  "orders": {
    "orders": [
      {
        "publicKey": "OrderPublicKey",
        "account": {
          "maker": "YourWalletPublicKey",
          "inputMint": "So11111111111111111111111111111111111111112",
          "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "makingAmount": "1000000000",
          "takingAmount": "1000000",
          "expiredAt": null,
          "base": "input"
        }
      }
    ]
  }
}
```

### 4. Cancel Single Order

**Endpoint:** `POST /limit/cancel`

**Description:** Cancels a specific limit order.

**Request Body:**
```json
{
  "maker": "YourWalletPublicKey",
  "order": "OrderPublicKeyToCancel",
  "computeUnitPrice": "auto",
  "rpcUrl": "https://your-rpc-endpoint.com",
  "includeTip": true,
  "jitoTipLamports": 5000000,
  "authenticated": false
}
```

**Required Parameters:**
- `maker` (string): Wallet public key that created the order
- `order` (string): Public key of the order to cancel

**Response:**
```json
{
  "success": true,
  "transaction": "Base58EncodedCancelTransaction",
  "requestId": "cancel-request-id"
}
```


## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400`: Bad Request - Invalid parameters
- `500`: Internal Server Error - Server-side error

## Usage Examples

### Creating a Simple Limit Order

```javascript
const response = await fetch('/createLimitOrder', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    maker: 'YourWalletPublicKey',
    makingAmount: '1000000000', // 1 SOL
    takingAmount: '100000000', // 100 USDC
    slippageBps: 50 // 0.5% slippage
  })
});

const data = await response.json();
if (data.success) {
  console.log('Order created:', data.order);
  console.log('Transaction to sign:', data.transaction);
}
```

### Getting Active Orders

```javascript
const response = await fetch('/getActiveOrders?userAddress=YourWalletPublicKey');
const data = await response.json();

if (data.success) {
  console.log('Active orders:', data.orders.orders);
}
```

### Canceling an Order

```javascript
const response = await fetch('/cancelOrder', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    maker: 'YourWalletPublicKey',
    order: 'OrderPublicKeyToCancel'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Cancel transaction:', data.transaction);
}
```

## Notes

- All amounts should be provided in the smallest unit of the token (e.g., lamports for SOL)
- Transactions returned by the API are unsigned and need to be signed by the client
- The API automatically adds custom fees, burn instructions, and Jito tips as configured
- Use the `executeTransaction` endpoint to submit signed transactions through Jupiter
- Orders can have expiration times set via the `expiredAt` parameter (Unix timestamp)
- The API supports both authenticated and non-authenticated fee structures