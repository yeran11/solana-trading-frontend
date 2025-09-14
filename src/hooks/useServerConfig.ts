import { useEffect } from 'react';

/**
 * Hook to load and apply saved server configuration on app startup
 */
export const useServerConfig = () => {
  useEffect(() => {
    // Load saved server URL from localStorage on mount
    const savedUrl = localStorage.getItem('tradingServerUrl');
    const savedEnabled = localStorage.getItem('tradingServerEnabled');

    if (savedUrl) {
      // Set on window for immediate use
      (window as any).tradingServerUrl = savedUrl;
      (window as any).tradingServerEnabled = savedEnabled === 'true';

      console.log('[ServerConfig] Loaded saved server URL:', savedUrl);
    }

    // Also check cookies as fallback
    if (!savedUrl) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === 'tradingServerUrl' && value) {
          const url = decodeURIComponent(value);
          (window as any).tradingServerUrl = url;
          (window as any).tradingServerEnabled = true;

          // Save to localStorage for next time
          localStorage.setItem('tradingServerUrl', url);
          localStorage.setItem('tradingServerEnabled', 'true');

          console.log('[ServerConfig] Loaded server URL from cookies:', url);
          break;
        }
      }
    }
  }, []);

  const setServerUrl = (url: string) => {
    // Save to localStorage
    localStorage.setItem('tradingServerUrl', url);
    localStorage.setItem('tradingServerEnabled', 'true');

    // Set on window
    (window as any).tradingServerUrl = url;
    (window as any).tradingServerEnabled = true;

    // Save to cookies as backup
    document.cookie = `tradingServerUrl=${encodeURIComponent(url)}; path=/; max-age=31536000`;
    document.cookie = `tradingServerEnabled=true; path=/; max-age=31536000`;

    console.log('[ServerConfig] Server URL updated:', url);
  };

  const getServerUrl = (): string | null => {
    return (window as any).tradingServerUrl || localStorage.getItem('tradingServerUrl') || null;
  };

  return { setServerUrl, getServerUrl };
};