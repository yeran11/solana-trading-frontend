import React, { useEffect, useState, createContext, useContext } from "react"
import { AlertCircle, X, ZapIcon } from "lucide-react"

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastProviderProps {
  children: React.ReactNode
}

// Custom cyberpunk styled toast animations
const cyberpunkAnimations = `
  @keyframes cyberpunk-slide-in {
    0% {
      transform: translateX(100%);
      opacity: 0;
    }
    10% {
      transform: translateX(-10px);
      opacity: 0.8;
    }
    15% {
      transform: translateX(5px);
    }
    20% {
      transform: translateX(0);
      opacity: 1;
    }
    90% {
      transform: translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  @keyframes cyberpunk-glow {
    0% {
      box-shadow: 0 0 5px rgba(2, 179, 109, 0.7);
    }
    50% {
      box-shadow: 0 0 15px rgba(2, 179, 109, 0.9), 0 0 30px rgba(2, 179, 109, 0.5);
    }
    100% {
      box-shadow: 0 0 5px rgba(2, 179, 109, 0.7);
    }
  }

  @keyframes cyberpunk-error-glow {
    0% {
      box-shadow: 0 0 5px rgba(255, 48, 92, 0.7);
    }
    50% {
      box-shadow: 0 0 15px rgba(255, 48, 92, 0.9), 0 0 30px rgba(255, 48, 92, 0.5);
    }
    100% {
      box-shadow: 0 0 5px rgba(255, 48, 92, 0.7);
    }
  }
  
  @keyframes cyberpunk-scanline {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 0 100%;
    }
  }

  @keyframes cyberpunk-text-glitch {
    0% {
      text-shadow: 0 0 0 rgba(125, 223, 189, 0.9);
    }
    5% {
      text-shadow: -2px 0 0 rgba(255, 0, 128, 0.8), 2px 0 0 rgba(0, 255, 255, 0.8);
    }
    10% {
      text-shadow: 0 0 0 rgba(125, 223, 189, 0.9);
    }
    15% {
      text-shadow: -2px 0 0 rgba(255, 0, 128, 0.8), 2px 0 0 rgba(0, 255, 255, 0.8);
    }
    20% {
      text-shadow: 0 0 0 rgba(125, 223, 189, 0.9);
    }
    100% {
      text-shadow: 0 0 0 rgba(125, 223, 189, 0.9);
    }
  }
`

// CSS classes for cyberpunk styling
const cyberpunkClasses = {
  successToast: "relative bg-[#050a0e] border border-[#02b36d] text-[#e4fbf2] animate-[cyberpunk-glow_2s_infinite]",
  errorToast: "relative bg-[#050a0e] border border-[#ff305c] text-[#e4fbf2] animate-[cyberpunk-error-glow_2s_infinite]",
  scanline: "absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(2,179,109,0)_50%,rgba(2,179,109,0.1)_50%)] bg-[size:100%_4px] animate-[cyberpunk-scanline_4s_linear_infinite] opacity-40",
  errorScanline: "absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,48,92,0)_50%,rgba(255,48,92,0.1)_50%)] bg-[size:100%_4px] animate-[cyberpunk-scanline_4s_linear_infinite] opacity-40",
  icon: "h-5 w-5 text-[#02b36d]",
  errorIcon: "h-5 w-5 text-[#ff305c]",
  message: "font-mono tracking-wider animate-[cyberpunk-text-glitch_3s_infinite]",
  closeButton: "ml-2 rounded-full p-1 hover:bg-[#02b36d40] text-[#7ddfbd]",
  errorCloseButton: "ml-2 rounded-full p-1 hover:bg-[#ff305c40] text-[#ff8fa7]"
}

export const ToastContext = createContext<{
  showToast: (message: string, type: 'success' | 'error') => void
}>({
  showToast: () => {},
})

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const closeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1))
      }, 2000) // Increased duration to 5 seconds to enjoy the cyberpunk effects
      return () => clearTimeout(timer)
    }
  }, [toasts])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Add the custom animations to the DOM */}
      <style>{cyberpunkAnimations}</style>
      
      <div className="fixed bottom-4 right-4 z-[999999999999999999999999999999999] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{ animationDuration: '5s' }}
            className={`animate-[cyberpunk-slide-in_5s_ease-in-out_forwards] flex items-center gap-2 rounded px-4 py-3 shadow-lg backdrop-blur-sm ${
              toast.type === 'success' ? cyberpunkClasses.successToast : cyberpunkClasses.errorToast
            }`}
          >
            {/* Scanline effect */}
            <div className={toast.type === 'success' ? cyberpunkClasses.scanline : cyberpunkClasses.errorScanline}></div>
            
            {/* Corner accents for cyberpunk border effect */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#02b36d]"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#02b36d]"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#02b36d]"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#02b36d]"></div>
            
            {/* Icon and content */}
            {toast.type === 'success' ? (
              <ZapIcon className={cyberpunkClasses.icon} />
            ) : (
              <AlertCircle className={cyberpunkClasses.errorIcon} />
            )}
            <p className={cyberpunkClasses.message}>{toast.message}</p>
            <button
              onClick={() => closeToast(toast.id)}
              className={toast.type === 'success' ? cyberpunkClasses.closeButton : cyberpunkClasses.errorCloseButton}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  return useContext(ToastContext)
}

export default ToastProvider