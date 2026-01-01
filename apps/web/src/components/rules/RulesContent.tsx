'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@sfam/api';

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

  const handleCreateRule = () => {
    if (!newRule?.type || !newRule?.pattern || !newRule?.categoryId) return;
    createMutation.mutate({
      type: newRule.type as 'merchant' | 'keyword' | 'regex',
      pattern: newRule.pattern,
      categoryId: newRule.categoryId,
    });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categorization Rules</h1>
          <p className="text-gray-500 dark:text-gray-400">Automatically categorize transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          <button
            onClick={() =>
              setNewRule({ type: 'merchant', pattern: '', categoryId: '' })
            }
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </button>
        </div>
      </div>

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
                onChange={(e) =>
                  setNewRule({ ...newRule, pattern: e.target.value })
                }
                placeholder={
                  newRule.type === 'regex' ? '^salary.*$' : 'Enter pattern...'
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                value={newRule.categoryId}
                onChange={(e) =>
                  setNewRule({ ...newRule, categoryId: e.target.value })
                }
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
                disabled={
                  !newRule.pattern || !newRule.categoryId || createMutation.isPending
                }
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

      {/* Rules by Type */}
      {(Object.entries(rulesByType) as [keyof typeof typeLabels, Rule[]][]).map(
        ([type, typeRules]) => (
          <div key={type} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {typeLabels[type].title}
                </h2>
                <p className="text-sm text-gray-500">
                  {typeLabels[type].description}
                </p>
              </div>
              <span className={cn('badge', typeLabels[type].badge)}>
                {typeRules.length} rules
              </span>
            </div>

            <div className="space-y-2">
              {typeRules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border px-4 py-3',
                    !rule.isActive
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <code className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                    {rule.pattern}
                  </code>
                  <span className="text-gray-500 dark:text-gray-400">→</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white">
                    <span>{rule.category?.icon}</span>
                    {rule.category?.name}
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
              ))}
              {typeRules.length === 0 && (
                <p className="py-4 text-center text-gray-400">
                  No {type} rules defined
                </p>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

