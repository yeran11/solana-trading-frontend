// Server configuration utilities

const STORAGE_KEY = 'tradingServerUrl';
const ENABLED_KEY = 'tradingServerEnabled';

export const saveServerConfig = (url: string) => {
  // Save to localStorage for persistence
  localStorage.setItem(STORAGE_KEY, url);
  localStorage.setItem(ENABLED_KEY, 'true');

  // Also set on window for immediate use (use different property to avoid conflicts with chart servers)
  (window as any).customTradingServerUrl = url;
  (window as any).customTradingServerEnabled = true;

  // Save to cookies as backup
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(url)}; path=/; max-age=31536000`;
  document.cookie = `${ENABLED_KEY}=true; path=/; max-age=31536000`;
};

export const loadServerConfig = (): string | null => {
  // Try localStorage first
  const savedUrl = localStorage.getItem(STORAGE_KEY);
  if (savedUrl) {
    (window as any).customTradingServerUrl = savedUrl;
    (window as any).customTradingServerEnabled = true;
    return savedUrl;
  }

  // Fallback to cookies
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === STORAGE_KEY && value) {
      const url = decodeURIComponent(value);
      (window as any).customTradingServerUrl = url;
      (window as any).customTradingServerEnabled = true;
      return url;
    }
  }

  // Check if already set on window (check custom property first)
  return (window as any).customTradingServerUrl || (window as any).tradingServerUrl || null;
};

export const clearServerConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ENABLED_KEY);
  delete (window as any).customTradingServerUrl;
  delete (window as any).customTradingServerEnabled;
  document.cookie = `${STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
  document.cookie = `${ENABLED_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
};