'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Edit2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@sharristh/api';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Category = RouterOutputs['categories']['list'][number];

export function CategoriesContent() {
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const utils = trpc.useUtils();

  const { data: categories = [] } = trpc.categories.list.useQuery({
    includeInactive: showInactive,
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      setEditingCategory(null);
    },
  });

  const toggleMutation = trpc.categories.disable.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
  });

  const enableMutation = trpc.categories.enable.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const startEditing = (cat: Category) => {
    setEditingCategory(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '');
  };

  const saveEdit = () => {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory,
      data: {
        name: editName,
        icon: editIcon || undefined,
      },
    });
  };

  const toggleActive = (cat: Category) => {
    if (cat.isActive) {
      toggleMutation.mutate(cat.id);
    } else {
      enableMutation.mutate(cat.id);
    }
  };

  // Group categories by type
  const groupedCategories = {
    income: categories.filter((c) => c.type === 'income' && !c.parentCategoryId),
    expected: categories.filter((c) => c.type === 'expected' && !c.parentCategoryId),
    varying: categories.filter((c) => c.type === 'varying' && !c.parentCategoryId),
  };

  const typeLabels = {
    income: { title: 'Income', description: 'Sources of money coming in' },
    expected: { title: 'Expected Expenses', description: 'Regular, predictable expenses' },
    varying: { title: 'Varying Expenses', description: 'Irregular or unexpected expenses' },
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500">Organize your income and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Category Groups */}
      {(Object.entries(groupedCategories) as [keyof typeof typeLabels, Category[]][]).map(
        ([type, cats]) => (
          <div key={type} className="card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {typeLabels[type].title}
              </h2>
              <p className="text-sm text-gray-500">{typeLabels[type].description}</p>
            </div>

            <div className="space-y-1">
              {cats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  depth={0}
                  isExpanded={expandedCategories.has(cat.id)}
                  isEditing={editingCategory === cat.id}
                  editName={editName}
                  editIcon={editIcon}
                  onToggleExpand={() => toggleExpanded(cat.id)}
                  onStartEdit={() => startEditing(cat)}
                  onEditName={setEditName}
                  onEditIcon={setEditIcon}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingCategory(null)}
                  onToggleActive={() => toggleActive(cat)}
                  allCategories={categories}
                  expandedCategories={expandedCategories}
                  editingCategory={editingCategory}
                  startEditing={startEditing}
                  toggleExpanded={toggleExpanded}
                  toggleActive={toggleActive}
                />
              ))}
              {cats.length === 0 && (
                <p className="py-4 text-center text-gray-400">
                  No categories in this group
                </p>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function CategoryRow({
  category,
  depth,
  isExpanded,
  isEditing,
  editName,
  editIcon,
  onToggleExpand,
  onStartEdit,
  onEditName,
  onEditIcon,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  allCategories,
  expandedCategories,
  editingCategory,
  startEditing,
  toggleExpanded,
  toggleActive,
}: {
  category: Category;
  depth: number;
  isExpanded: boolean;
  isEditing: boolean;
  editName: string;
  editIcon: string;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onEditName: (name: string) => void;
  onEditIcon: (icon: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleActive: () => void;
  allCategories: Category[];
  expandedCategories: Set<string>;
  editingCategory: string | null;
  startEditing: (cat: Category) => void;
  toggleExpanded: (id: string) => void;
  toggleActive: (cat: Category) => void;
}) {
  const children = allCategories.filter((c) => c.parentCategoryId === category.id);
  const hasChildren = children.length > 0;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50',
          !category.isActive && 'opacity-50'
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={onToggleExpand}
          className={cn(
            'p-0.5 rounded hover:bg-gray-200',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Icon */}
        {isEditing ? (
          <input
            type="text"
            value={editIcon}
            onChange={(e) => onEditIcon(e.target.value)}
            className="w-10 text-center input py-1"
            placeholder="📁"
          />
        ) : (
          <span className="text-xl">{category.icon || '📁'}</span>
        )}

        {/* Name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditName(e.target.value)}
            className="flex-1 input py-1"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-gray-900">{category.name}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button onClick={onSaveEdit} className="btn-primary btn-sm">
                Save
              </button>
              <button onClick={onCancelEdit} className="btn-ghost btn-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              {!category.isSystem && (
                <>
                  <button
                    onClick={onStartEdit}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onToggleActive}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    {category.isActive ? (
                      <ToggleRight className="h-5 w-5 text-success-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </>
              )}
              {category.isSystem && (
                <span className="text-xs text-gray-400 px-2">System</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <CategoryRow
            key={child.id}
            category={child}
            depth={depth + 1}
            isExpanded={expandedCategories.has(child.id)}
            isEditing={editingCategory === child.id}
            editName={editName}
            editIcon={editIcon}
            onToggleExpand={() => toggleExpanded(child.id)}
            onStartEdit={() => startEditing(child)}
            onEditName={onEditName}
            onEditIcon={onEditIcon}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onToggleActive={() => toggleActive(child)}
            allCategories={allCategories}
            expandedCategories={expandedCategories}
            editingCategory={editingCategory}
            startEditing={startEditing}
            toggleExpanded={toggleExpanded}
            toggleActive={toggleActive}
          />
        ))}
    </>
  );
}

