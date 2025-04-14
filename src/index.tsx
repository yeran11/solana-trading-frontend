import React, { useState, useEffect, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer as NodeBuffer } from 'buffer';
import Cookies from 'js-cookie';
import { Buffer } from 'buffer';
window.Buffer = Buffer;
import './globals.css';
import { ToastProvider } from "./Notifications";
import ServerConfig from './ServerConfig';
const App = lazy(() => import('./App'));

declare global {
  interface Window {
    tradingServerUrl: string;
    Buffer: typeof NodeBuffer;
  }
}
const SERVER_URL_COOKIE = 'trading_server_url';
const DEFAULT_LOCAL_URLS = [
  'https://solana.fury.bot/'
];
const ServerCheckLoading = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-green-500"></div>
    </div>
  );
};

const Root = () => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const checkServerConnection = async (url: string): Promise<boolean> => {
    try {
      const baseUrl = url.replace(/\/+$/, '');
      const healthEndpoint = '/health';
      const checkUrl = `${baseUrl}${healthEndpoint}`;
      
      console.log('Checking connection to:', checkUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(checkUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log('Server response not OK:', response.status);
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('Connection check error:', error);
      return false;
    }
  };

  const handleServerUrlSubmit = async (url: string) => {
    setIsChecking(true);
    setError(null);
    
    try {
      const isConnected = await checkServerConnection(url);
      if (isConnected) {
        Cookies.set(SERVER_URL_COOKIE, url, { expires: 30 });
        setServerUrl(url);
        window.tradingServerUrl = url; // Set the global server URL
      } else {
        setError('Could not connect to server. Please check the address and try again.');
        setServerUrl(null);
      }
    } catch (err) {
      setError('Connection error. Please verify the server is running and try again.');
      setServerUrl(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const initializeServer = async () => {
      const savedUrl = Cookies.get(SERVER_URL_COOKIE);
      
      if (savedUrl) {
        const isConnected = await checkServerConnection(savedUrl);
        if (isConnected) {
          setServerUrl(savedUrl);
          window.tradingServerUrl = savedUrl; 
          setIsChecking(false);
          return;
        }
      }

      for (const localUrl of DEFAULT_LOCAL_URLS) {
        const isLocalConnected = await checkServerConnection(localUrl);
        if (isLocalConnected) {
          setServerUrl(localUrl);
          window.tradingServerUrl = localUrl; 
          Cookies.set(SERVER_URL_COOKIE, localUrl, { expires: 30 });
          setIsChecking(false);
          return;
        }
      }
      
      setError('No server connection found. Please enter your server URL.');
      setIsChecking(false);
    };

    initializeServer();
  }, []);

  if (isChecking) {
    return <ServerCheckLoading />;
  }

  return (
    <ToastProvider>
      {serverUrl ? (
        <Suspense >
          <App />
        </Suspense>
      ) : (
        <ServerConfig onSubmit={handleServerUrlSubmit} />
      )}
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);