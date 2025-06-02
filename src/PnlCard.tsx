import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';

// Define proper types
interface PnlDataItem {
  profit: number;
  timestamp: string;
}

interface PnlCardProps {
  pnlData: Record<string, PnlDataItem | undefined>;
  tokenAddress: string;
  backgroundImageUrl?: string;
}

const PnlCard: React.FC<PnlCardProps> = ({ 
  pnlData, 
  tokenAddress,
  backgroundImageUrl = '/api/placeholder/400/320' // Default placeholder
}) => {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Calculate summary statistics from PNL data
  const calculateSummary = () => {
    if (!pnlData || Object.keys(pnlData).length === 0) {
      return {
        totalProfit: 0,
        profitableWallets: 0,
        unprofitableWallets: 0,
        totalWallets: 0,
        bestProfit: 0,
        worstProfit: 0
      };
    }

    let totalProfit = 0;
    let bestProfit = -Infinity;
    let worstProfit = Infinity;

    Object.values(pnlData).forEach(data => {
      if (data && typeof data.profit === 'number') {
        totalProfit += data.profit;
        
        if (data.profit > bestProfit) {
          bestProfit = data.profit;
        }
        
        if (data.profit < worstProfit) {
          worstProfit = data.profit;
        }
      }
    });

    return {
      totalProfit,
      profitableWallets: Object.values(pnlData).filter(data => data && typeof data.profit === 'number' && data.profit > 0).length,
      unprofitableWallets: Object.values(pnlData).filter(data => data && typeof data.profit === 'number' && data.profit < 0).length,
      totalWallets: Object.keys(pnlData).length,
      bestProfit: bestProfit !== -Infinity ? bestProfit : 0,
      worstProfit: worstProfit !== Infinity ? worstProfit : 0
    };
  };

  const summary = calculateSummary();

  // Format currency
  const formatAmount = (amount) => {
    if (amount > 0) return `+${amount.toFixed(5)}`;
    return amount.toFixed(5);
  };
  
  // Format shortened address
  const formatAddress = (address) => {
    if (!address) return "Unknown";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get the date the PNL was calculated
  const getPnlDate = () => {
    if (!pnlData || Object.keys(pnlData).length === 0) {
      return new Date().toLocaleDateString();
    }
    
    const timestamps = Object.values(pnlData)
      .filter((data): data is PnlDataItem => !!data && typeof data.timestamp === 'string')
      .map(data => new Date(data.timestamp).getTime());
    
    if (timestamps.length === 0) return new Date().toLocaleDateString();
    
    return new Date(Math.max(...timestamps)).toLocaleDateString();
  };

  // Handle image load
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Download the card as image
  const downloadAsImage = async () => {
    setIsDownloading(true);
    
    try {
      // Dynamically import html2canvas - not included by default but shows the concept
      const html2canvas = (await import('html2canvas')).default;
      
      if (cardRef.current) {
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          backgroundColor: "#000000",
          logging: false,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 15000
        });
        
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `pnl.png`;
        link.click();
      }
    } catch (error) {
      console.error("Failed to download image:", error);
      alert("To download this card as an image, html2canvas library would need to be installed.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center max-w-sm mx-auto">
      {/* Card */}
      <div 
        ref={cardRef}
        className="w-full rounded-lg overflow-hidden shadow-lg border border-green-500 relative"
        style={{
          boxShadow: "0 0 15px rgba(16, 185, 129, 0.3)",
        }}
      >
        {/* Background Image */}
        <img 
          src={backgroundImageUrl} 
          onLoad={handleImageLoad}
          alt="Card background" 
          className="absolute inset-0 w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-80"></div>
        
        {/* Card Content */}
        <div className="p-5 relative z-10">
          {/* Header with Logo and Profit Display in the same row */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <div className="text-green-500 mr-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 18L14 18V15C14 11.6863 11.3137 9 8 9V9C4.68629 9 2 11.6863 2 15V20H14" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M20 18L14 18V15C14 11.6863 16.6863 9 20 9V9C20 9 22 11.6863 22 15V20H14" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="8" cy="6" r="2" stroke="#10B981" strokeWidth="2"/>
                  <circle cx="16" cy="6" r="2" stroke="#10B981" strokeWidth="2"/>
                </svg>
              </div>
              <h2 className="text-white font-bold text-xl">Raze.BOT</h2>
            </div>
            
            {/* Profit Display moved to top right */}
            <div className="flex items-center">
              <span className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatAmount(summary.totalProfit)}
              </span>
            </div>
          </div>
          
          {/* Tagline */}
          <p className="text-green-500 text-sm mb-4">Unleash your full potential.</p>
          
          {/* Stats Grid */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Wallets</span>
              <span className="text-white">{summary.totalWallets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Profitable Wallets</span>
              <span className="text-green-500">{summary.profitableWallets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Profit</span>
              <span className={`font-bold ${summary.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {summary.totalProfit.toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* Bottom CTA */}
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-800">
            <div className="text-green-500 font-bold">IT'S TIME TO CHANGE</div>
            <div className="text-white font-bold">Raze.BOT</div>
          </div>
        </div>
      </div>
      
      {/* Download Button */}
      <button
        onClick={downloadAsImage}
        disabled={isDownloading}
        className="mt-4 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-all duration-200 shadow-lg disabled:opacity-50 w-full max-w-sm"
      >
        {isDownloading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <Download size={16} className="mr-2" />
            Download PNL Card
          </>
        )}
      </button>
    </div>
  );
};

export default PnlCard;