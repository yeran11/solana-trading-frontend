import React, { useEffect } from 'react';
import { Wallet, LineChart, Cog, LucideIcon } from 'lucide-react';

interface MobileLayoutProps {
  currentPage: 'wallets' | 'chart' | 'actions';
  setCurrentPage: (page: 'wallets' | 'chart' | 'actions') => void;
  children: {
    WalletsPage: React.ReactNode;
    ChartPage: React.ReactNode;
    ActionsPage: React.ReactNode;
  };
}

interface NavItem {
  id: 'wallets' | 'chart' | 'actions';
  label: string;
  Icon: LucideIcon;
  component: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  currentPage, 
  setCurrentPage,
  children: {
    WalletsPage,
    ChartPage,
    ActionsPage
  }
}) => {
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }

    const style = document.createElement('style');
    style.textContent = `
      * {
        touch-action: pan-x pan-y;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
      input, textarea {
        touch-action: auto;
        user-select: text;
        -webkit-user-select: text;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (viewportMeta) {
        viewportMeta.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0'
        );
      }
      document.head.removeChild(style);
    };
  }, []);

  const navItems: NavItem[] = [
    { id: 'wallets', label: 'Wallets', Icon: Wallet, component: WalletsPage },
    { id: 'chart', label: 'Chart', Icon: LineChart, component: ChartPage },
    { id: 'actions', label: 'Actions', Icon: Cog, component: ActionsPage }
  ];

  return (
    <div className="md:hidden flex flex-col h-full max-h-screen select-none">
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0">
          <div className="h-full overflow-y-auto overscroll-contain pb-16 touch-pan-y">
            {navItems.map(({ id, component }) => (
              currentPage === id && (
                <div 
                  key={id}
                  className="min-h-full w-full"
                >
                  {component}
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800">
        <div className="flex justify-around items-center h-16 px-4 max-w-md mx-auto">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              className="flex flex-col items-center justify-center w-20 py-1 
                rounded-lg transition-colors hover:bg-neutral-800 active:bg-neutral-700
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              <Icon 
                size={20} 
                className={`transition-colors ${
                  currentPage === id ? 'text-green-500' : 'text-neutral-400'
                }`} 
              />
              <span 
                className={`text-xs mt-1 transition-colors ${
                  currentPage === id ? 'text-green-500' : 'text-neutral-400'
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;