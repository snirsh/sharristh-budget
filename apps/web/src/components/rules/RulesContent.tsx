'use client';

import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { AppRouter } from '@sfam/api';
import type { inferRouterOutputs } from '@trpc/server';
import {
  AlertTriangle,
  Check,
  Minus,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Rule = RouterOutputs['rules']['list'][number];

interface Category {
  id: string;
  name: string;
  icon?: string | null;
}

export function RulesContent({ categories }: { categories: Category[] }) {
  const [showInactive, setShowInactive] = useState(false);
  const [newRule, setNewRule] = useState<{
    type: string;
    pattern: string;
    categoryId: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data: rules = [] } = trpc.rules.list.useQuery({
    includeInactive: showInactive,
  });

  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      setNewRule(null);
    },
  });

  const toggleMutation = trpc.rules.toggle.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
  });

  const deleteMutation = trpc.rules.delete.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
  });

  const clearAllMutation = trpc.rules.clearAll.useMutation({
    onSuccess: (data) => {
      utils.rules.list.invalidate();
      alert(`Deleted ${data.deleted} rule(s)`);
    },
  });

  const batchDeleteMutation = trpc.rules.batchDelete.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      setSelectedIds(new Set());
    },
  });

  const batchToggleMutation = trpc.rules.batchToggle.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      setSelectedIds(new Set());
    },
  });

  const { data: brokenRules = [] } = trpc.rules.getBrokenRules.useQuery();

  const handleCreateRule = () => {
    if (!newRule?.type || !newRule?.pattern || !newRule?.categoryId) return;
    createMutation.mutate({
      type: newRule.type as 'merchant' | 'keyword' | 'regex',
      pattern: newRule.pattern,
      categoryId: newRule.categoryId,
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rules.map((rule) => rule.id)));
    }
  };

  const isAllSelected = rules.length > 0 && selectedIds.size === rules.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < rules.length;

  const handleBatchDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.size} rule(s)?`)) {
      batchDeleteMutation.mutate({ ruleIds: Array.from(selectedIds) });
    }
  };

  const handleBatchToggle = (isActive: boolean) => {
    batchToggleMutation.mutate({ ruleIds: Array.from(selectedIds), isActive });
  };

  // Auto-clear selections when inactive toggle changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [showInactive]);

  const rulesByType = {
    merchant: rules.filter((r) => r.type === 'merchant'),
    keyword: rules.filter((r) => r.type === 'keyword'),
    regex: rules.filter((r) => r.type === 'regex'),
  };

  const typeLabels = {
    merchant: {
      title: 'Merchant Rules',
      description: 'Match by merchant name (highest priority)',
      badge: 'badge-success',
    },
    keyword: {
      title: 'Keyword Rules',
      description: 'Match by keywords in description',
      badge: 'badge-primary',
    },
    regex: {
      title: 'Regex Rules',
      description: 'Match by regular expression patterns',
      badge: 'badge-gray',
    },
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categorization Rules</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {rules.length} rules
            {brokenRules.length > 0 && (
              <span className="ml-2 text-warning-600 dark:text-warning-400">
                ({brokenRules.length} broken)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          {brokenRules.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete ${brokenRules.length} broken rule(s)? These rules point to deleted categories.`
                  )
                ) {
                  batchDeleteMutation.mutate({ ruleIds: brokenRules.map((r) => r.id) });
                }
              }}
              className="btn btn-warning"
              title="Delete rules with broken category references"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Fix Broken Rules
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete ALL rules? This cannot be undone.')) {
                clearAllMutation.mutate();
              }
            }}
            disabled={clearAllMutation.isPending || rules.length === 0}
            className="btn btn-danger"
            title="Delete all rules"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Clear All
          </button>
          <button
            onClick={() => setNewRule({ type: 'merchant', pattern: '', categoryId: '' })}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 card p-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-primary-200 dark:bg-primary-700" />
          <button
            onClick={() => handleBatchToggle(true)}
            disabled={batchToggleMutation.isPending}
            className="btn btn-sm bg-success-500 text-white hover:bg-success-600"
          >
            <ToggleRight className="h-4 w-4 mr-1" />
            Activate
          </button>
          <button
            onClick={() => handleBatchToggle(false)}
            disabled={batchToggleMutation.isPending}
            className="btn btn-sm btn-outline"
          >
            <ToggleLeft className="h-4 w-4 mr-1" />
            Deactivate
          </button>
          <div className="flex-1" />
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleteMutation.isPending}
            className="btn btn-sm btn-danger"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn btn-sm btn-ghost text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* New Rule Form */}
      {newRule && (
        <div className="card border-2 border-primary-200 bg-primary-50">
          <h3 className="font-semibold mb-4">Create New Rule</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Type</label>
              <select
                value={newRule.type}
                onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                className="input"
              >
                <option value="merchant">Merchant</option>
                <option value="keyword">Keyword</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <label className="label">Pattern</label>
              <input
                type="text"
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                placeholder={newRule.type === 'regex' ? '^salary.*$' : 'Enter pattern...'}
                className="input"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                value={newRule.categoryId}
                onChange={(e) => setNewRule({ ...newRule, categoryId: e.target.value })}
                className="input"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCreateRule}
                disabled={!newRule.pattern || !newRule.categoryId || createMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setNewRule(null)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All */}
      {rules.length > 0 && (
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400"
          >
            <div
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded border-2 transition-colors',
                isAllSelected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-300 dark:border-gray-600'
              )}
            >
              {isAllSelected ? (
                <Check className="h-3 w-3" />
              ) : isSomeSelected ? (
                <Minus className="h-3 w-3 text-primary-600" />
              ) : null}
            </div>
            {isAllSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      {/* Rules by Type */}
      {(Object.entries(rulesByType) as [keyof typeof typeLabels, Rule[]][]).map(
        ([type, typeRules]) => (
          <div key={type} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{typeLabels[type].title}</h2>
                <p className="text-sm text-gray-500">{typeLabels[type].description}</p>
              </div>
              <span className={cn('badge', typeLabels[type].badge)}>{typeRules.length} rules</span>
            </div>

            <div className="space-y-2">
              {typeRules.map((rule) => {
                const isBroken = !rule.category;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border px-4 py-3',
                      !rule.isActive
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'
                        : isBroken
                          ? 'border-warning-500 bg-warning-50 dark:bg-warning-900/20'
                          : 'border-gray-200 dark:border-gray-700',
                      selectedIds.has(rule.id) && 'ring-2 ring-primary-500'
                    )}
                  >
                    <button
                      onClick={() => toggleSelection(rule.id)}
                      className={cn(
                        'flex items-center justify-center w-5 h-5 rounded border-2 transition-colors',
                        selectedIds.has(rule.id)
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {selectedIds.has(rule.id) && <Check className="h-3 w-3" />}
                    </button>
                    <code className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                      {rule.pattern}
                    </code>
                    <span className="text-gray-500 dark:text-gray-400">→</span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm font-medium',
                        isBroken
                          ? 'text-warning-700 dark:text-warning-400'
                          : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {isBroken ? (
                        <>
                          <AlertTriangle className="h-4 w-4" />
                          <span className="italic">Deleted category</span>
                        </>
                      ) : (
                        <>
                          <span>{rule.category?.icon}</span>
                          {rule.category?.name}
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate(rule.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        {rule.isActive ? (
                          <ToggleRight className="h-5 w-5 text-success-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this rule?')) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {typeRules.length === 0 && (
                <p className="py-4 text-center text-gray-400">No {type} rules defined</p>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
