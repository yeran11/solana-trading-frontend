import React, { useState, useEffect, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
// Separate import for createPortal
import { createPortal } from 'react-dom';
import Cookies from 'js-cookie';
import { Buffer } from 'buffer';
window.Buffer = Buffer;
import './styles/globals.css';
import { ToastProvider } from "./Notifications";
import ServerConfig from './ServerConfig';
import IntroModal from './IntroModal';
const App = lazy(() => import('./App'));

declare global {
  interface Window {
    tradingServerUrl: string;
    Buffer: typeof Buffer;
  }
}

const SERVER_URL_COOKIE = 'trading_server_url';
const INTRO_COMPLETED_COOKIE = 'intro_completed';
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

/**
 * Custom Modal Container Component
 * This directly creates a backdrop for the IntroModal
 */
interface ModalPortalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const ModalPortal: React.FC<ModalPortalProps> = ({ isOpen, onComplete, onSkip }) => {
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    // Create or get the modal root element when component mounts
    let rootElement = document.getElementById('modal-root');
    
    if (!rootElement && isOpen) {
      rootElement = document.createElement('div');
      rootElement.id = 'modal-root';
      document.body.appendChild(rootElement);
    }
    
    setModalRoot(rootElement);
    
    // Clean up function
    return () => {
      // Only remove if we created it
      if (rootElement && rootElement.parentNode && !isOpen) {
        document.body.removeChild(rootElement);
      }
    };
  }, [isOpen]);
  
  // Apply styles only when modal is open
  useEffect(() => {
    if (!modalRoot) return;
    
    if (isOpen) {
      modalRoot.style.position = 'fixed';
      modalRoot.style.top = '0';
      modalRoot.style.left = '0';
      modalRoot.style.width = '100vw';
      modalRoot.style.height = '100vh';
      modalRoot.style.zIndex = '99999';
      modalRoot.style.pointerEvents = 'auto';
    } else {
      // When closed, disable pointer events
      if (modalRoot) {
        modalRoot.style.pointerEvents = 'none';
      }
    }
  }, [isOpen, modalRoot]);

  if (!isOpen || !modalRoot) return null;
  
  // Create our portal
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center"
         style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="relative z-[99999]">
        <IntroModal 
          isOpen={true} 
          onClose={onComplete}  
        />
      </div>
    </div>,
    modalRoot
  );
};

const Root = () => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIntroModal, setShowIntroModal] = useState(false);
  
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

  // Handler for completing the intro
  const handleIntroComplete = () => {
    console.log("Intro completed");
    Cookies.set(INTRO_COMPLETED_COOKIE, 'true', { expires: 365 });
    setShowIntroModal(false);
    
    // Ensure any modal-related elements are properly cleaned up
    cleanupModalElements();
  };

  // Handler for skipping the intro
  const handleIntroSkip = () => {
    console.log("Intro skipped");
    Cookies.set(INTRO_COMPLETED_COOKIE, 'true', { expires: 365 });
    setShowIntroModal(false);
    
    // Ensure any modal-related elements are properly cleaned up
    cleanupModalElements();
  };
  
  // Function to clean up any modal-related elements
  const cleanupModalElements = () => {
    // Force pointer-events to be enabled on the body and html
    document.body.style.pointerEvents = 'auto';
    document.documentElement.style.pointerEvents = 'auto';
    
    // Remove any lingering modal-related elements or styles
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
      modalRoot.style.pointerEvents = 'none';
      
      // Optional: remove the element completely
      // if (modalRoot.parentNode) {
      //   modalRoot.parentNode.removeChild(modalRoot);
      // }
    }
  };

  // Forcefully show the modal after a short delay
  const forceShowIntroModal = () => {
    // Make sure intro hasn't been completed
    const introCompleted = Cookies.get(INTRO_COMPLETED_COOKIE);
    if (!introCompleted) {
      console.log('Forcing intro modal to show...');
      setTimeout(() => {
        setShowIntroModal(true);
      }, 800); // Longer delay to ensure everything has loaded
    }
  };

  // Initialize server connection
  useEffect(() => {
    const initializeServer = async () => {
      const savedUrl = Cookies.get(SERVER_URL_COOKIE);
      
      if (savedUrl) {
        const isConnected = await checkServerConnection(savedUrl);
        if (isConnected) {
          setServerUrl(savedUrl);
          window.tradingServerUrl = savedUrl; 
          setIsChecking(false);
          forceShowIntroModal();
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
          forceShowIntroModal();
          return;
        }
      }
      
      setError('No server connection found. Please enter your server URL.');
      setIsChecking(false);
    };

    initializeServer();
  }, []);

  // Force modal to appear with keyboard shortcut for debugging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + M to toggle modal for debugging
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setShowIntroModal(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isChecking) {
    return <ServerCheckLoading />;
  }

  return (
    <ToastProvider>
      {serverUrl ? (
        <>
          {/* The App component without blur effect */}
          <div className={showIntroModal ? 'filter blur-sm' : ''} 
               style={{ pointerEvents: showIntroModal ? 'none' : 'auto' }}>
            <Suspense fallback={<ServerCheckLoading />}>
              <App />
            </Suspense>
          </div>
          
          {/* Our custom modal portal implementation */}
          <ModalPortal
            isOpen={showIntroModal}
            onComplete={handleIntroComplete}
            onSkip={handleIntroSkip}
          />
        </>
      ) : (
        <ServerConfig onSubmit={handleServerUrlSubmit} />
      )}
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);