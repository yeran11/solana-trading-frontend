// Utility functions for generating IDs
export const generateStrategyId = (): string => {
  return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateConditionId = (): string => {
  return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateActionId = (): string => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};