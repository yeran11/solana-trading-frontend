import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Download, 
  Trash2, 
  Search, 
  Filter,
  RefreshCw,
  CheckSquare,
  Square,
  MoreVertical,
  Wallet,
  Settings,
  X,
  Edit3,
  Check,
  XCircle
} from 'lucide-react';
import { Connection } from '@solana/web3.js';
import { WalletTooltip } from '../styles/Styles';
import { 
  WalletType, 
  formatAddress, 
  copyToClipboard, 
  downloadPrivateKey,
  deleteWallet,
  saveWalletsToCookies,
  getWalletDisplayName
} from '../Utils';
import { handleCleanupWallets, handleSortWallets } from '../Manager';

interface EnhancedWalletOverviewProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: WalletType[];
  setWallets: (wallets: WalletType[]) => void;
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
  tokenAddress: string;
  connection: Connection | null;
  handleRefresh: () => void;
  isRefreshing: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
  onOpenSettings: () => void;
}

type SortField = 'address' | 'solBalance' | 'tokenBalance';
type SortDirection = 'asc' | 'desc';

const EnhancedWalletOverview: React.FC<EnhancedWalletOverviewProps> = ({
  isOpen,
  onClose,
  wallets,
  setWallets,
  solBalances,
  tokenBalances,
  tokenAddress,
  connection,
  handleRefresh,
  isRefreshing,
  showToast,
  onOpenSettings
}) => {
  // All hooks must be called before any conditional returns
  const [sortField, setSortField] = useState<SortField>('address');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWallets, setSelectedWallets] = useState<Set<number>>(new Set());
  const [showPrivateKeys, setShowPrivateKeys] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'withSOL' | 'withTokens' | 'empty'>('all');
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [editLabelValue, setEditLabelValue] = useState<string>('');

  // Filter and sort wallets - useMemo must also be called before conditional return
  const filteredAndSortedWallets = useMemo(() => {
    let filtered = wallets.filter(wallet => {
      // Search filter
      const matchesSearch = wallet.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Type filter
      const solBalance = solBalances.get(wallet.address) || 0;
      const tokenBalance = tokenBalances.get(wallet.address) || 0;

      switch (filterType) {
        case 'withSOL':
          return solBalance > 0;
        case 'withTokens':
          return tokenBalance > 0;
        case 'empty':
          return solBalance === 0 && tokenBalance === 0;
        default:
          return true;
      }
    });

    // Sort filtered results
    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'address':
          aValue = a.address;
          bValue = b.address;
          break;
        case 'solBalance':
          aValue = solBalances.get(a.address) || 0;
          bValue = solBalances.get(b.address) || 0;
          break;
        case 'tokenBalance':
          aValue = tokenBalances.get(a.address) || 0;
          bValue = tokenBalances.get(b.address) || 0;
          break;
        default:
          aValue = a.address;
          bValue = b.address;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [wallets, sortField, sortDirection, searchTerm, filterType, solBalances, tokenBalances]);

  // Now we can have conditional returns after all hooks are called
  if (!isOpen) return null;

  // Sorting function
  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  // Selection functions
  const toggleWalletSelection = (walletId: number) => {
    const newSelected = new Set(selectedWallets);
    if (newSelected.has(walletId)) {
      newSelected.delete(walletId);
    } else {
      newSelected.add(walletId);
    }
    setSelectedWallets(newSelected);
  };

  const selectAllVisible = () => {
    const newSelected = new Set(filteredAndSortedWallets.map(w => w.id));
    setSelectedWallets(newSelected);
  };

  const clearSelection = () => {
    setSelectedWallets(new Set());
  };

  // Label editing functions
  const startEditingLabel = (wallet: WalletType) => {
    setEditingLabel(wallet.id);
    setEditLabelValue(wallet.label || '');
  };

  const saveLabel = (walletId: number) => {
    const updatedWallets = wallets.map(wallet => 
      wallet.id === walletId 
        ? { ...wallet, label: editLabelValue.trim() || undefined }
        : wallet
    );
    saveWalletsToCookies(updatedWallets);
    setWallets(updatedWallets);
    setEditingLabel(null);
    setEditLabelValue('');
    showToast('Label updated', 'success');
  };

  const cancelEditingLabel = () => {
    setEditingLabel(null);
    setEditLabelValue('');
  };

  const handleLabelKeyPress = (e: React.KeyboardEvent, walletId: number) => {
    if (e.key === 'Enter') {
      saveLabel(walletId);
    } else if (e.key === 'Escape') {
      cancelEditingLabel();
    }
  };

  // Bulk operations
  const deleteSelectedWallets = () => {
    if (selectedWallets.size === 0) return;
    
    const newWallets = wallets.filter(w => !selectedWallets.has(w.id));
    saveWalletsToCookies(newWallets);
    setWallets(newWallets);
    
    showToast(`Deleted ${selectedWallets.size} wallet${selectedWallets.size > 1 ? 's' : ''}`, 'success');
    setSelectedWallets(new Set());
  };

  const downloadSelectedWallets = () => {
    if (selectedWallets.size === 0) return;
    
    const selectedWalletData = wallets
      .filter(w => selectedWallets.has(w.id))
      .map(w => w.privateKey)
      .join('\n');
    
    const blob = new Blob([selectedWalletData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_wallets_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Downloaded ${selectedWallets.size} wallet${selectedWallets.size > 1 ? 's' : ''}`, 'success');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-app-primary-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="color-primary" />
      : <ArrowDown size={14} className="color-primary" />;
  };

  const totalSOL = Array.from(solBalances.values()).reduce((sum, balance) => sum + balance, 0);
  const totalTokens = Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);
  const activeWallets = wallets.filter(w => (solBalances.get(w.address) || 0) > 0).length;

  return (
    <div className="fixed inset-0 bg-black-70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-app-tertiary border border-app-primary-40 cyberpunk-border rounded-lg w-[95vw] max-w-7xl h-[90vh] p-6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-app-primary-40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Wallet className="color-primary" size={24} />
              <h2 className="text-xl font-bold text-app-primary font-mono tracking-wider">WALLET MANAGER</h2>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-6 text-sm font-mono">
              <div className="text-center">
                <div className="color-primary font-bold">{filteredAndSortedWallets.length}</div>
                <div className="text-app-secondary">SHOWN</div>
              </div>
              <div className="text-center">
                <div className="color-primary font-bold">{totalSOL.toFixed(4)}</div>
                <div className="text-app-secondary">TOTAL SOL</div>
              </div>
              <div className="text-center">
                <div className="color-primary font-bold">{totalTokens.toLocaleString()}</div>
                <div className="text-app-secondary">TOTAL TOKENS</div>
              </div>
              <div className="text-center">
                <div className="color-primary font-bold">{activeWallets}</div>
                <div className="text-app-secondary">ACTIVE</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <WalletTooltip content="Open System Settings" position="bottom">
              <button 
                onClick={onOpenSettings}
                className="p-2 hover-bg-primary-20 border border-app-primary-40 hover-border-primary rounded transition-all duration-300"
              >
                <Settings size={20} className="color-primary" />
              </button>
            </WalletTooltip>
            
            <button 
              onClick={onClose}
              className="p-2 bg-transparent hover:bg-red-600/20 border border-red-500 hover:border-red-400 rounded transition-all duration-300"
            >
              <X size={20} className="text-red-500" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search size={18} className="absolute left-3 top-3 text-app-primary-40" />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-app-secondary border border-app-primary-40 rounded pl-10 pr-4 py-2 text-sm text-app-primary focus-border-primary focus:outline-none font-mono"
            />
          </div>

          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-app-secondary border border-app-primary-40 rounded px-3 py-2 text-sm text-app-primary focus-border-primary focus:outline-none font-mono"
          >
            <option value="all">All Wallets</option>
            <option value="withSOL">With SOL</option>
            <option value="withTokens">With Tokens</option>
            <option value="empty">Empty</option>
          </select>

          {/* Bulk Actions */}
          {selectedWallets.size > 0 && (
            <div className="flex gap-2">
              <WalletTooltip content="Download Selected" position="bottom">
                <button
                  onClick={downloadSelectedWallets}
                  className="p-2 bg-primary-20 border border-app-primary-40 hover-border-primary rounded transition-all duration-300"
                >
                  <Download size={16} className="color-primary" />
                </button>
              </WalletTooltip>
              
              <WalletTooltip content="Delete Selected" position="bottom">
                <button
                  onClick={deleteSelectedWallets}
                  className="p-2 bg-transparent hover:bg-red-600/20 rounded transition-all duration-300"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </WalletTooltip>
              
              <span className="px-3 py-2 bg-primary-20 rounded text-sm font-mono color-primary">
                {selectedWallets.size} selected
              </span>
            </div>
          )}




        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto border border-app-primary-40 rounded-lg">
            <table className="w-full text-sm font-mono">
              {/* Header */}
              <thead className="sticky top-0 bg-app-secondary border-b border-app-primary-40">
                <tr>
                  <th className="p-3 text-left">
                    <button
                      onClick={selectedWallets.size === filteredAndSortedWallets.length ? clearSelection : selectAllVisible}
                      className="color-primary hover-text-app-primary transition-colors"
                    >
                      {selectedWallets.size === filteredAndSortedWallets.length && filteredAndSortedWallets.length > 0 ? 
                        <CheckSquare size={16} /> : <Square size={16} />
                      }
                    </button>
                  </th>
                  <th className="p-3 text-left text-app-secondary">LABEL</th>
                  <th className="p-3 text-left">
                    <button
                      onClick={() => handleSort('address')}
                      className="flex items-center gap-2 text-app-secondary hover-text-app-primary transition-colors"
                    >
                      ADDRESS
                      <SortIcon field="address" />
                    </button>
                  </th>
                  <th className="p-3 text-left">
                    <button
                      onClick={() => handleSort('solBalance')}
                      className="flex items-center gap-2 text-app-secondary hover-text-app-primary transition-colors"
                    >
                      SOL BALANCE
                      <SortIcon field="solBalance" />
                    </button>
                  </th>
                  {tokenAddress && (
                    <th className="p-3 text-left">
                      <button
                        onClick={() => handleSort('tokenBalance')}
                        className="flex items-center gap-2 text-app-secondary hover-text-app-primary transition-colors"
                      >
                        TOKEN BALANCE
                        <SortIcon field="tokenBalance" />
                      </button>
                    </th>
                  )}
                  <th className="p-3 text-left text-app-secondary">PRIVATE KEY</th>
                  <th className="p-3 text-left text-app-secondary">ACTIONS</th>
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {filteredAndSortedWallets.map((wallet, index) => {
                  const isSelected = selectedWallets.has(wallet.id);
                  const solBalance = solBalances.get(wallet.address) || 0;
                  const tokenBalance = tokenBalances.get(wallet.address) || 0;
                  
                  return (
                    <tr 
                      key={wallet.id}
                      className={`border-b border-app-primary-20 hover-bg-primary-10 transition-colors ${
                        isSelected ? 'bg-primary-20' : ''
                      }`}
                    >
                      <td className="p-3">
                        <button
                          onClick={() => toggleWalletSelection(wallet.id)}
                          className="color-primary hover-text-app-primary transition-colors"
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                      <td className="p-3">
                        {editingLabel === wallet.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editLabelValue}
                              onChange={(e) => setEditLabelValue(e.target.value)}
                              onKeyDown={(e) => handleLabelKeyPress(e, wallet.id)}
                              className="bg-app-secondary border border-app-primary-40 rounded px-2 py-1 text-sm text-app-primary focus-border-primary focus:outline-none font-mono flex-1"
                              placeholder="Enter label..."
                              autoFocus
                            />
                            <button
                              onClick={() => saveLabel(wallet.id)}
                              className="p-1 hover-bg-primary-20 rounded transition-all duration-300"
                            >
                              <Check size={14} className="color-primary" />
                            </button>
                            <button
                              onClick={cancelEditingLabel}
                              className="p-1 bg-transparent hover:bg-red-600/20 border border-red-500 hover:border-red-400 rounded transition-all duration-300"
                            >
                              <XCircle size={14} className="text-red-500" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-app-primary font-mono text-sm">
                              {wallet.label || 'No label'}
                            </span>
                            <button
                              onClick={() => startEditingLabel(wallet)}
                              className="p-1 hover-bg-primary-20 rounded transition-all duration-300 opacity-60 hover:opacity-100"
                            >
                              <Edit3 size={12} className="color-primary" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <WalletTooltip content="Click to copy address" position="top">
                          <button
                            onClick={() => copyToClipboard(wallet.address, showToast)}
                            className="text-app-primary hover:color-primary transition-colors font-mono"
                          >
                            {formatAddress(wallet.address)}
                          </button>
                        </WalletTooltip>
                      </td>
                      <td className="p-3">
                        <span className={`${solBalance > 0 ? 'color-primary' : 'text-app-secondary'} font-bold`}>
                          {solBalance.toFixed(4)}
                        </span>
                      </td>
                      {tokenAddress && (
                        <td className="p-3">
                          <span className={`${tokenBalance > 0 ? 'color-primary' : 'text-app-secondary'} font-bold`}>
                            {tokenBalance.toLocaleString()}
                          </span>
                        </td>
                      )}
                      <td className="p-3">
                        <WalletTooltip content="Click to copy private key" position="top">
                          <button
                            onClick={() => copyToClipboard(wallet.privateKey, showToast)}
                            className="text-app-secondary hover:color-primary transition-colors font-mono text-xs"
                          >
                            {wallet.privateKey.substring(0, 16)}...
                          </button>
                        </WalletTooltip>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">

                          <WalletTooltip content="Download Private Key" position="top">
                            <button
                              onClick={() => downloadPrivateKey(wallet)}
                              className="p-1 hover-bg-primary-20 rounded transition-all duration-300"
                            >
                              <Download size={14} className="color-primary" />
                            </button>
                          </WalletTooltip>
                          
                          <WalletTooltip content="Delete Wallet" position="top">
                            <button
                              onClick={() => {
                                const newWallets = deleteWallet(wallets, wallet.id);
                                saveWalletsToCookies(newWallets);
                                setWallets(newWallets);
                                showToast('Wallet deleted', 'success');
                              }}
                              className="p-1 bg-transparent hover:bg-red-600/20 rounded transition-all duration-300"
                            >
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </WalletTooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty State */}
            {filteredAndSortedWallets.length === 0 && (
              <div className="p-8 text-center text-app-secondary">
                <Wallet size={48} className="mx-auto mb-4 opacity-50" />
                <div className="font-mono">
                  {searchTerm || filterType !== 'all' 
                    ? 'No wallets match your filters' 
                    : 'No wallets found'
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-app-primary-40">
          <div className="flex gap-2">
            <button
              onClick={() => handleCleanupWallets(wallets, solBalances, tokenBalances, setWallets, showToast)}
              className="px-4 py-2 bg-transparent hover:bg-red-600/20 border border-red-500 hover:border-red-400 rounded font-mono text-sm transition-all duration-300 text-red-500"
            >
              CLEANUP EMPTY
            </button>
          </div>
          
          <div className="text-sm font-mono text-app-secondary">
            Showing {filteredAndSortedWallets.length} of {wallets.length} wallets
          </div>
          
          <button
            onClick={onClose}
            className="px-6 py-2 bg-app-primary-color hover-bg-app-primary-dark text-black font-bold rounded cyberpunk-btn font-mono tracking-wider transition-all duration-300"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedWalletOverview;