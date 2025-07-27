import { Connection } from "@solana/web3.js";
import { WalletType } from "./Utils";

/**
 * Extract API key from URL and clean the URL
 */
export const handleApiKeyFromUrl = (
  setConfig: Function,
  saveConfigToCookies: Function,
  showToast: Function
) => {
  const url = new URL(window.location.href);
  const apiKey = url.searchParams.get('apikey');
  
  // If API key is in the URL
  if (apiKey) {
    console.log('API key found in URL, saving to config');
    
    // Update config state with the new API key
    setConfig((prev: any) => {
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

/**
 * Handle market cap updates
 */
export const handleMarketCapUpdate = (
  marketcap: number | null,
  setCurrentMarketCap: Function
) => {
  setCurrentMarketCap(marketcap);
  console.log("Main component received marketcap update:", marketcap);
};