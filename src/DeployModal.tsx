import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, Zap, X, Utensils } from 'lucide-react';
import { DeployPumpModal } from './DeployPumpModal';
import { DeployBonkModal } from './DeployBonkModal';
import { useToast } from "./Notifications";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeployModalProps extends BaseModalProps {
  onDeploy: (data: any) => void;
  handleRefresh: () => void;
  solBalances: Map<string, number>;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
  handleRefresh,
  solBalances,
}) => {
  const [selectedDeployType, setSelectedDeployType] = useState<'pump' | 'bonk' | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{backgroundColor: 'rgba(5, 10, 14, 0.95)'}}>
      <div className="relative bg-[#050a0e] border-2 border-[#02b36d40] rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden transform modal-glow">
        {/* Header */}
        <div className="relative z-10 p-5 flex justify-between items-center border-b border-[#02b36d40]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#02b36d20]">
              <Rocket size={20} className="text-[#02b36d]" />
            </div>
            <h2 className="text-xl font-bold text-[#e4fbf2] font-mono">
              <span className="text-[#02b36d]">/</span> SELECT DEPLOY TYPE <span className="text-[#02b36d]">/</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7ddfbd] hover:text-[#02b36d] transition-colors p-1.5 hover:bg-[#02b36d20] rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Deployment Options */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pump Deploy Option */}
          <div 
            onClick={() => setSelectedDeployType('pump')}
            className="group relative cursor-pointer bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 transition-all duration-300 hover:border-[#02b36d] hover:shadow-lg hover:shadow-[#02b36d20]"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Zap size={24} className="text-[#02b36d] group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">PUMP.FUN DEPLOY</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new pump.fun token with customizable parameters. Includes liquidity setup.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>

          {/* Bonk Deploy Option */}
          <div 
            onClick={() => setSelectedDeployType('bonk')}
            className="group relative cursor-pointer bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 transition-all duration-300 hover:border-[#02b36d] hover:shadow-lg hover:shadow-[#02b36d20]"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Rocket size={24} className="text-[#02b36d] group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">LETSBONK.FUN</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new letsbonk.fun token with customizable parameters. Includes liquidity setup.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>

          {/* Cook.Meme Deploy Option */}
          <div 
            onClick={() => showToast("COOK.MEME deployment coming soon!", "error")}
            className="group relative cursor-not-allowed bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 opacity-60"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Utensils size={24} className="text-[#02b36d]" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">COOK.MEME</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new COOK.MEME token. Advanced features including customizable tokenomics and marketing.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent rounded-xl" />
          </div>
          <div 
            onClick={() => showToast("PUMPKIN.FUN deployment coming soon!", "error")}
            className="group relative cursor-not-allowed bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 opacity-60"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Utensils size={24} className="text-[#02b36d]" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">PUMPKIN.FUN</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new PUMPKIN.FUN token. Advanced features including customizable tokenomics and marketing.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent rounded-xl" />
          </div>
          <div 
            onClick={() => showToast("REVSHARE.DEV deployment coming soon!", "error")}
            className="group relative cursor-not-allowed bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 opacity-60"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Utensils size={24} className="text-[#02b36d]" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">REVSHARE.DEV</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new REVSHARE.DEV token. Advanced features including customizable tokenomics and marketing.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent rounded-xl" />
          </div>
          <div 
            onClick={() => showToast("LETSJULIA.FUN deployment coming soon!", "error")}
            className="group relative cursor-not-allowed bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-4 opacity-60"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[#02b36d20] flex items-center justify-center">
                <Utensils size={24} className="text-[#02b36d]" />
              </div>
              <h3 className="text-lg font-bold text-[#e4fbf2] font-mono">LETSJULIA.FUN</h3>
              <p className="text-[#7ddfbd] text-xs leading-relaxed">
                Create a new LETSJULIA.FUN token. Advanced features including customizable tokenomics and marketing.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent rounded-xl" />
          </div>
        </div>

        {/* Render selected modal */}
        {selectedDeployType === 'pump' && (
          <DeployPumpModal
            isOpen={true}
            onClose={() => setSelectedDeployType(null)}
            onDeploy={onDeploy}
            handleRefresh={handleRefresh}
            solBalances={solBalances}
          />
        )}
        
        {/* Render Bonk Deploy Modal when selected */}
        {selectedDeployType === 'bonk' && (
          <DeployBonkModal
            isOpen={true}
            onClose={() => setSelectedDeployType(null)}
            onDeploy={onDeploy}
            handleRefresh={handleRefresh}
            solBalances={solBalances}
          />
        )}
      </div>
    </div>,
    document.body
  );
};