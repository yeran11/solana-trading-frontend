import React, { useEffect, useState, createContext, useContext } from "react"
import { AlertCircle, CheckCircle2, X } from "lucide-react"

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastProviderProps {
  children: React.ReactNode
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
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toasts])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`animate-slide-in-right flex items-center gap-2 rounded-lg px-4 py-3 text-white shadow-lg ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <p>{toast.message}</p>
            <button
              onClick={() => closeToast(toast.id)}
              className="ml-2 rounded-full p-1 hover:bg-white/20"
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