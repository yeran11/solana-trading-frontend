// Server URL persistence script - runs before app loads
// This ensures server URL persists across page refreshes

(function() {
  console.log('[ServerPersist] Initializing server URL persistence...');

  const DEFAULT_SERVER = 'http://localhost:7777';

  // First, load any saved server URL (or use default)
  const savedUrl = localStorage.getItem('tradingServerUrl') || DEFAULT_SERVER;
  const savedEnabled = localStorage.getItem('tradingServerEnabled') || 'true';

  // Always set the server config (use custom properties to avoid conflicts with chart servers)
  window.customTradingServerUrl = savedUrl;
  window.customTradingServerEnabled = savedEnabled === 'true';
  // Also set legacy property for backward compatibility
  window.tradingServerUrl = savedUrl;
  window.tradingServerEnabled = savedEnabled === 'true';

  // Auto-save default if nothing was saved
  if (!localStorage.getItem('tradingServerUrl')) {
    localStorage.setItem('tradingServerUrl', DEFAULT_SERVER);
    localStorage.setItem('tradingServerEnabled', 'true');
    console.log('[ServerPersist] Auto-configured server to:', DEFAULT_SERVER);
  } else {
    console.log('[ServerPersist] Restored server URL from localStorage:', savedUrl);
  }

  // Intercept any changes to tradingServerUrl and save them
  let _tradingServerUrl = savedUrl;
  let _tradingServerEnabled = true; // Always enabled for our custom backend

  // Define custom property that won't conflict with chart servers
  Object.defineProperty(window, 'customTradingServerUrl', {
    get: function() {
      return _tradingServerUrl;
    },
    set: function(value) {
      console.log('[ServerPersist] Setting server URL to:', value);
      _tradingServerUrl = value;
      if (value) {
        localStorage.setItem('tradingServerUrl', value);
        localStorage.setItem('tradingServerEnabled', 'true');
        // Also set cookies as backup
        document.cookie = `tradingServerUrl=${encodeURIComponent(value)}; path=/; max-age=31536000`;
        document.cookie = `tradingServerEnabled=true; path=/; max-age=31536000`;
        console.log('[ServerPersist] Saved server URL to localStorage and cookies');
      } else {
        localStorage.removeItem('tradingServerUrl');
        localStorage.removeItem('tradingServerEnabled');
      }
    },
    configurable: true,
    enumerable: true
  });

  Object.defineProperty(window, 'customTradingServerEnabled', {
    get: function() {
      return _tradingServerEnabled;
    },
    set: function(value) {
      _tradingServerEnabled = value;
      localStorage.setItem('tradingServerEnabled', String(value));
    },
    configurable: true,
    enumerable: true
  });

  // Also check cookies if localStorage is empty
  if (!savedUrl) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === 'tradingServerUrl' && value) {
        const url = decodeURIComponent(value);
        window.customTradingServerUrl = url;
        window.customTradingServerEnabled = true;
        console.log('[ServerPersist] Restored server URL from cookies:', url);
        break;
      }
    }
  }

  console.log('[ServerPersist] Server persistence initialized. Current URL:', window.customTradingServerUrl);
})();