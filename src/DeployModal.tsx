import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, Zap, X } from 'lucide-react';
import { DeployPumpModal } from './DeployPumpModal';
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
  const [selectedDeployType, setSelectedDeployType] = useState<'pump' | 'launch' | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{backgroundColor: 'rgba(5, 10, 14, 0.95)'}}>
      <div className="relative bg-[#050a0e] border-2 border-[#02b36d40] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform modal-glow">
        {/* Header */}
        <div className="relative z-10 p-6 flex justify-between items-center border-b border-[#02b36d40]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#02b36d20]">
              <Rocket size={24} className="text-[#02b36d]" />
            </div>
            <h2 className="text-2xl font-bold text-[#e4fbf2] font-mono">
              <span className="text-[#02b36d]">/</span> SELECT DEPLOY TYPE <span className="text-[#02b36d]">/</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#7ddfbd] hover:text-[#02b36d] transition-colors p-2 hover:bg-[#02b36d20] rounded-xl"
          >
            <X size={24} />
          </button>
        </div>

        {/* Deployment Options */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pump Deploy Option */}
          <div 
            onClick={() => setSelectedDeployType('pump')}
            className="group relative cursor-pointer bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-6 transition-all duration-300 hover:border-[#02b36d] hover:shadow-2xl hover:shadow-[#02b36d20]"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#02b36d20] flex items-center justify-center">
                <Zap size={28} className="text-[#02b36d] group-hover:animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-[#e4fbf2] font-mono">PUMP DEPLOY</h3>
              <p className="text-[#7ddfbd] text-sm leading-relaxed">
                Create a new pump.fun token with customizable parameters. Includes liquidity setup and initial market making.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Launch Deploy Option */}
          <div 
            onClick={() => showToast("Launch deployment coming soon!", "error")}
            className="group relative cursor-not-allowed bg-[#091217] border-2 border-[#02b36d30] rounded-xl p-6 opacity-50"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-[#02b36d20] flex items-center justify-center">
                <Rocket size={28} className="text-[#02b36d]" />
              </div>
              <h3 className="text-xl font-bold text-[#e4fbf2] font-mono">BONK DEPLOY</h3>
              <p className="text-[#7ddfbd] text-sm leading-relaxed">
              Create a new letsbonk.fun token with customizable parameters. Includes liquidity setup and initial market making.              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#02b36d10] to-transparent" />
          </div>
        </div>

        {/* Render Pump Deploy Modal when selected */}
        {selectedDeployType === 'pump' && (
          <DeployPumpModal
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