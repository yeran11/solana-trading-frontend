// Auto-configure backend settings on page load
(function() {
  // Set the trading server configuration
  const serverUrl = 'http://localhost:7777';

  // Save to localStorage
  localStorage.setItem('tradingServerUrl', serverUrl);
  localStorage.setItem('tradingServerEnabled', 'true');

  // Set on window object (use custom properties to avoid conflicts with chart servers)
  window.customTradingServerUrl = serverUrl;
  window.customTradingServerEnabled = true;
  // Also set legacy properties for backward compatibility
  window.tradingServerUrl = serverUrl;
  window.tradingServerEnabled = true;

  // Also set cookies as backup
  document.cookie = `tradingServerUrl=${encodeURIComponent(serverUrl)}; path=/; max-age=31536000`;
  document.cookie = `tradingServerEnabled=true; path=/; max-age=31536000`;

  console.log('✅ Backend auto-configured to:', serverUrl);
  console.log('✅ Trading server enabled:', true);
})();