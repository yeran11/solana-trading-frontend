import React, { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { TradingStrategy, TradingCondition, TradingAction } from './types';
import { generateStrategyId, generateConditionId, generateActionId } from './utils';
import ConditionBuilder from './ConditionBuilder';
import ActionBuilder from './ActionBuilder';

interface StrategyBuilderProps {
  strategy?: TradingStrategy | null;
  onSave: (strategy: TradingStrategy) => void;
  onCancel: () => void;
}

const StrategyBuilder: React.FC<StrategyBuilderProps> = ({ strategy, onSave, onCancel }) => {
  const [name, setName] = useState(strategy?.name || '');
  const [description, setDescription] = useState(strategy?.description || '');
  const [conditions, setConditions] = useState<TradingCondition[]>(strategy?.conditions || []);
  const [actions, setActions] = useState<TradingAction[]>(strategy?.actions || []);
  const [cooldown, setCooldown] = useState(strategy?.cooldown || 5);
  const [maxExecutions, setMaxExecutions] = useState(strategy?.maxExecutions || undefined);
  const [isActive, setIsActive] = useState(strategy?.isActive || false);

  const addCondition = () => {
    const newCondition: TradingCondition = {
      id: generateConditionId(),
      type: 'marketCap',
      operator: 'greater',
      value: 1000000,
      timeframe: 5
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<TradingCondition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const addAction = () => {
    const newAction: TradingAction = {
      id: generateActionId(),
      type: 'buy',
      amount: 10,
      amountType: 'percentage',
      volumeType: 'buyVolume',
      volumeMultiplier: 0.1,
      slippage: 5,
      priority: 'medium'
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, updates: Partial<TradingAction>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const handleSave = () => {
    if (!name.trim() || conditions.length === 0 || actions.length === 0) {
      alert('Please provide a name, at least one condition, and at least one action.');
      return;
    }

    const newStrategy: TradingStrategy = {
      id: strategy?.id || generateStrategyId(),
      name: name.trim(),
      description: description.trim(),
      conditions,
      conditionLogic: 'and',
      actions,
      isActive,
      cooldown,
      maxExecutions,
      executionCount: strategy?.executionCount || 0,
      lastExecuted: strategy?.lastExecuted,
      createdAt: strategy?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    onSave(newStrategy);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-mono color-primary mb-2">Strategy Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-app-accent border border-app-primary-40 rounded font-mono text-sm color-primary focus:outline-none focus:border-app-primary"
            placeholder="e.g., Buy on High Volume"
          />
        </div>
        <div>
          <label className="block text-sm font-mono color-primary mb-2">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-app-accent border border-app-primary-40 rounded font-mono text-sm color-primary focus:outline-none focus:border-app-primary"
            placeholder="Brief description of the strategy"
          />
        </div>
      </div>

      {/* Strategy Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-mono color-primary mb-2">Cooldown (minutes)</label>
          <input
            type="number"
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            min="1"
            className="w-full px-3 py-2 bg-app-accent border border-app-primary-40 rounded font-mono text-sm color-primary focus:outline-none focus:border-app-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-mono color-primary mb-2">Max Executions (optional)</label>
          <input
            type="number"
            value={maxExecutions || ''}
            onChange={(e) => setMaxExecutions(e.target.value ? Number(e.target.value) : undefined)}
            min="1"
            className="w-full px-3 py-2 bg-app-accent border border-app-primary-40 rounded font-mono text-sm color-primary focus:outline-none focus:border-app-primary"
            placeholder="Unlimited"
          />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 font-mono text-sm color-primary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Start Active
          </label>
        </div>
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-mono font-semibold color-primary">Conditions</h4>
          <button
            onClick={addCondition}
            className="px-3 py-1.5 bg-app-accent border border-app-primary-40 rounded color-primary font-mono text-sm hover:bg-app-primary hover:border-app-primary transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>
        
        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <ConditionBuilder
              key={condition.id}
              condition={condition}
              index={index}
              onUpdate={(updates) => updateCondition(condition.id, updates)}
              onRemove={() => removeCondition(condition.id)}
            />
          ))}
          
          {conditions.length === 0 && (
            <div className="text-center py-4 text-app-secondary-60 font-mono text-sm">
              No conditions added. Click "Add Condition" to create your first rule.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-mono font-semibold color-primary">Actions</h4>
          <button
            onClick={addAction}
            className="px-3 py-1.5 bg-app-accent border border-app-primary-40 rounded color-primary font-mono text-sm hover:bg-app-primary hover:border-app-primary transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Action
          </button>
        </div>
        
        <div className="space-y-3">
          {actions.map((action, index) => (
            <ActionBuilder
              key={action.id}
              action={action}
              index={index}
              onUpdate={(updates) => updateAction(action.id, updates)}
              onRemove={() => removeAction(action.id)}
            />
          ))}
          
          {actions.length === 0 && (
            <div className="text-center py-4 text-app-secondary-60 font-mono text-sm">
              No actions added. Click "Add Action" to define what should happen.
            </div>
          )}
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-app-primary-40">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-app-primary-40 rounded font-mono text-sm text-app-secondary-60 hover:bg-app-primary-60 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-app-accent border border-app-primary-40 rounded color-primary font-mono text-sm hover:bg-app-primary hover:border-app-primary transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {strategy ? 'Update Strategy' : 'Create Strategy'}
        </button>
       </div>
     </div>
   );
 };

export default StrategyBuilder;