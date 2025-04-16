import React, { useState } from 'react';
import { ArrowUpDown, ArrowDown, ArrowsUpFromLine, DollarSign, Share2, Network, Send, HandCoins } from 'lucide-react';
import { Connection } from '@solana/web3.js';
import { WalletType } from './Utils';
import { DistributeModal } from './DistributeModal';
import { ConsolidateModal } from './ConsolidateModal';
import { TransferModal } from './TransferModal';
import { DepositModal } from './DepositModal';
import { Tooltip } from './Wallets'; // Import Tooltip component

interface WalletOperationsButtonsProps {
  wallets: WalletType[];
  solBalances: Map<string, number>;
  connection: Connection;
}

type OperationTab = 'distribute' | 'consolidate' | 'transfer' | 'deposit';

export const WalletOperationsButtons: React.FC<WalletOperationsButtonsProps> = ({
  wallets,
  solBalances,
  connection
}) => {
  // State for active modal
  const [activeModal, setActiveModal] = useState<OperationTab | null>(null);

  // Function to open a specific modal
  const openModal = (modal: OperationTab) => {
    setActiveModal(modal);
  };

  // Function to close the active modal
  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <>
      {/* Modals */}
      <DistributeModal 
        isOpen={activeModal === 'distribute'} 
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
      
      <ConsolidateModal 
        isOpen={activeModal === 'consolidate'} 
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
      
      <TransferModal 
        isOpen={activeModal === 'transfer'} 
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />
      
      <DepositModal 
        isOpen={activeModal === 'deposit'} 
        onClose={closeModal}
        wallets={wallets}
        solBalances={solBalances}
        connection={connection}
      />

      {/* Operation Buttons */}
      <div className="flex gap-1">
        <Tooltip content="Distribute SOL" position="bottom">
          <button
            onClick={() => openModal('distribute')}
            className="text-[#02b36d] hover:text-[#7ddfbd] disabled:opacity-50 border border-[#02b36d30] hover:border-[#02b36d60] rounded transition-all duration-300 cyberpunk-btn"
            >
            <Share2 size={14} />
          </button>
        </Tooltip>

        <Tooltip content="Consolidate SOL" position="bottom">
          <button
            onClick={() => openModal('consolidate')}
            className="text-[#02b36d] hover:text-[#7ddfbd] disabled:opacity-50 border border-[#02b36d30] hover:border-[#02b36d60] rounded transition-all duration-300 cyberpunk-btn"
            >
            <Network size={14} />
          </button>
        </Tooltip>

        <Tooltip content="Transfer Assets" position="bottom">
          <button
            onClick={() => openModal('transfer')}
            className="text-[#02b36d] hover:text-[#7ddfbd] disabled:opacity-50 border border-[#02b36d30] hover:border-[#02b36d60] rounded transition-all duration-300 cyberpunk-btn"
            >
            <Send size={14} />
          </button>
        </Tooltip>

        <Tooltip content="Deposit SOL" position="bottom">
          <button
            onClick={() => openModal('deposit')}
            className="text-[#02b36d] hover:text-[#7ddfbd] disabled:opacity-50 border border-[#02b36d30] hover:border-[#02b36d60] rounded transition-all duration-300 cyberpunk-btn"
            >
            <HandCoins size={14} />
          </button>
        </Tooltip>
      </div>
    </>
  );
};