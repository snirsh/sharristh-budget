'use client';

import { useState, useCallback, Fragment } from 'react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import {
  Edit2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Palette,
  FolderTree,
} from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@sfam/api';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Category = RouterOutputs['categories']['list'][number];
type CategoryType = 'income' | 'expected' | 'varying';

interface EditingState {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  parentCategoryId: string | null;
  isNew: boolean;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#6b7280',
];

const TYPE_OPTIONS: { value: CategoryType; label: string; description: string }[] = [
  { value: 'income', label: 'Income', description: 'Sources of money coming in' },
  { value: 'expected', label: 'Expected', description: 'Regular, predictable expenses' },
  { value: 'varying', label: 'Varying', description: 'Irregular or variable expenses' },
];

export function CategoriesContent() {
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showModal, setShowModal] = useState(false);

  const utils = trpc.useUtils();

  const { data: categories = [] } = trpc.categories.list.useQuery({
    includeInactive: showInactive,
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      closeModal();
    },
  });

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      closeModal();
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

  const openEditModal = useCallback((cat: Category) => {
    setEditing({
      id: cat.id,
      name: cat.name,
      icon: cat.icon || '',
      color: cat.color || '',
      type: cat.type as CategoryType,
      parentCategoryId: cat.parentCategoryId,
      isNew: false,
    });
    setShowModal(true);
  }, []);

  const openCreateModal = useCallback((type: CategoryType, parentId?: string) => {
    setEditing({
      id: null,
      name: '',
      icon: '',
      color: '',
      type,
      parentCategoryId: parentId || null,
      isNew: true,
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditing(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!editing) return;

    if (editing.isNew) {
      createMutation.mutate({
        name: editing.name,
        type: editing.type,
        parentCategoryId: editing.parentCategoryId || undefined,
        icon: editing.icon || undefined,
        color: editing.color || undefined,
      });
    } else if (editing.id) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          name: editing.name,
          type: editing.type,
          parentCategoryId: editing.parentCategoryId,
          icon: editing.icon || null,
          color: editing.color || null,
        },
      });
    }
  }, [editing, createMutation, updateMutation]);

  const toggleActive = (cat: Category) => {
    if (cat.isActive) {
      toggleMutation.mutate(cat.id);
    } else {
      enableMutation.mutate(cat.id);
    }
  };

  // Get available parent categories (exclude self and descendants)
  const getAvailableParents = useCallback((excludeId?: string | null): Category[] => {
    if (!excludeId) {
      return categories.filter((c) => !c.parentCategoryId);
    }

    const getDescendantIds = (catId: string): Set<string> => {
      const descendants = new Set<string>([catId]);
      const children = categories.filter((c) => c.parentCategoryId === catId);
      children.forEach((child) => {
        const childDescendants = getDescendantIds(child.id);
        childDescendants.forEach((id) => descendants.add(id));
      });
      return descendants;
    };

    const excludeIds = getDescendantIds(excludeId);
    return categories.filter(
      (c) => !excludeIds.has(c.id) && !c.parentCategoryId
    );
  }, [categories]);

  // Group categories by type
  const groupedCategories = {
    income: categories.filter((c) => c.type === 'income' && !c.parentCategoryId),
    expected: categories.filter((c) => c.type === 'expected' && !c.parentCategoryId),
    varying: categories.filter((c) => c.type === 'varying' && !c.parentCategoryId),
  };

  const typeLabels = {
    income: { title: 'Income', description: 'Sources of money coming in', color: 'bg-emerald-50 border-emerald-200' },
    expected: { title: 'Expected Expenses', description: 'Regular, predictable expenses', color: 'bg-blue-50 border-blue-200' },
    varying: { title: 'Varying Expenses', description: 'Irregular or unexpected expenses', color: 'bg-amber-50 border-amber-200' },
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
          <div key={type} className={cn('card border', typeLabels[type].color)}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {typeLabels[type].title}
                </h2>
                <p className="text-sm text-gray-500">{typeLabels[type].description}</p>
              </div>
              <button
                onClick={() => openCreateModal(type)}
                className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>

            <div className="space-y-1">
              {cats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  depth={0}
                  isExpanded={expandedCategories.has(cat.id)}
                  onToggleExpand={() => toggleExpanded(cat.id)}
                  onStartEdit={() => openEditModal(cat)}
                  onToggleActive={() => toggleActive(cat)}
                  onAddChild={() => openCreateModal(type, cat.id)}
                  allCategories={categories}
                  expandedCategories={expandedCategories}
                  openEditModal={openEditModal}
                  toggleExpanded={toggleExpanded}
                  toggleActive={toggleActive}
                  openCreateModal={openCreateModal}
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

      {/* Edit/Create Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editing.isNew ? 'Create Category' : 'Edit Category'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="input w-full"
                  placeholder="Category name"
                  autoFocus
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Icon (emoji)
                </label>
                <input
                  type="text"
                  value={editing.icon}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className="input w-20 text-center text-xl"
                  placeholder="📁"
                  maxLength={2}
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Palette className="inline h-4 w-4 mr-1" />
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditing({ ...editing, color })}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                        editing.color === color
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    onClick={() => setEditing({ ...editing, color: '' })}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 bg-gray-100 flex items-center justify-center text-gray-400 text-xs',
                      !editing.color ? 'border-gray-900' : 'border-transparent'
                    )}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setEditing({ ...editing, type: option.value })}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                        editing.type === option.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parent Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <FolderTree className="inline h-4 w-4 mr-1" />
                  Parent Category
                </label>
                <select
                  value={editing.parentCategoryId || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, parentCategoryId: e.target.value || null })
                  }
                  className="input w-full"
                >
                  <option value="">None (top-level)</option>
                  {getAvailableParents(editing.id).map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.icon} {parent.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Move under another category to create a hierarchy
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeModal} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editing.name.trim() || updateMutation.isPending || createMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending || createMutation.isPending
                  ? 'Saving...'
                  : editing.isNew
                  ? 'Create'
                  : 'Save Changes'}
              </button>
            </div>

            {/* Error Display */}
            {(updateMutation.error || createMutation.error) && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {updateMutation.error?.message || createMutation.error?.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onToggleActive: () => void;
  onAddChild: () => void;
  allCategories: Category[];
  expandedCategories: Set<string>;
  openEditModal: (cat: Category) => void;
  toggleExpanded: (id: string) => void;
  toggleActive: (cat: Category) => void;
  openCreateModal: (type: CategoryType, parentId?: string) => void;
}

function CategoryRow({
  category,
  depth,
  isExpanded,
  onToggleExpand,
  onStartEdit,
  onToggleActive,
  onAddChild,
  allCategories,
  expandedCategories,
  openEditModal,
  toggleExpanded,
  toggleActive,
  openCreateModal,
}: CategoryRowProps) {
  const children = allCategories.filter((c) => c.parentCategoryId === category.id);
  const hasChildren = children.length > 0;

  return (
    <Fragment>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/60 transition-colors',
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

        {/* Color indicator & Icon */}
        <div className="flex items-center gap-2">
          {category.color && (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
          )}
          <span className="text-xl">{category.icon || '📁'}</span>
        </div>

        {/* Name */}
        <span className="flex-1 text-gray-900 font-medium">{category.name}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!category.isSystem && (
            <>
              <button
                onClick={onAddChild}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Add subcategory"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={onStartEdit}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Edit category"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={onToggleActive}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title={category.isActive ? 'Disable category' : 'Enable category'}
              >
                {category.isActive ? (
                  <ToggleRight className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
            </>
          )}
          {category.isSystem && (
            <span className="text-xs text-gray-400 px-2">System</span>
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
            onToggleExpand={() => toggleExpanded(child.id)}
            onStartEdit={() => openEditModal(child)}
            onToggleActive={() => toggleActive(child)}
            onAddChild={() => openCreateModal(child.type as CategoryType, child.id)}
            allCategories={allCategories}
            expandedCategories={expandedCategories}
            openEditModal={openEditModal}
            toggleExpanded={toggleExpanded}
            toggleActive={toggleActive}
            openCreateModal={openCreateModal}
          />
        ))}
    </Fragment>
  );
}
