import React from 'react';
import { X } from 'lucide-react';
import { ConfigType } from './Utils';

interface ConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfigType;
  onConfigChange: (key: keyof ConfigType, value: string) => void;
  onSave: () => void;
}

const Config: React.FC<ConfigProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-96 p-6 mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Endpoint RPC URL</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded"
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={config.rpcEndpoint}
              onChange={(e) => onConfigChange('rpcEndpoint', e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm focus:border-green-500 focus:outline-none"
              placeholder="Enter RPC endpoint URL"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-neutral-400">Transaction Fee (SOL)</label>
            <input
              type="number"
              value={config.transactionFee}
              onChange={(e) => onConfigChange('transactionFee', e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm focus:border-green-500 focus:outline-none"
              step="0.000001"
              min="0"
              placeholder="Enter transaction fee"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={onSave}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-medium p-2 rounded"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Config;