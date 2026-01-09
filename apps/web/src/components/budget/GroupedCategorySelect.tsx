'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  type: string;
  parentCategoryId?: string | null;
  children?: Category[];
}

interface GroupedCategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  error?: boolean;
  filterType?: 'expense' | 'income' | 'all';
}

export function GroupedCategorySelect({
  categories,
  value,
  onChange,
  placeholder = 'Select category...',
  error = false,
  filterType = 'expense',
}: GroupedCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter categories by type
  const filteredByType = useMemo(() => {
    if (filterType === 'all') return categories;
    return categories.filter((cat) => cat.type === filterType);
  }, [categories, filterType]);

  // Group categories by parent
  const groupedCategories = useMemo(() => {
    const parents = filteredByType.filter((cat) => !cat.parentCategoryId);
    const childrenByParent = new Map<string, Category[]>();

    filteredByType.forEach((cat) => {
      if (cat.parentCategoryId) {
        const children = childrenByParent.get(cat.parentCategoryId) || [];
        children.push(cat);
        childrenByParent.set(cat.parentCategoryId, children);
      }
    });

    return parents.map((parent) => ({
      ...parent,
      children: childrenByParent.get(parent.id) || [],
    }));
  }, [filteredByType]);

  // Filter by search
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return groupedCategories;

    const searchLower = search.toLowerCase();

    return groupedCategories
      .map((parent) => {
        const parentMatches = parent.name.toLowerCase().includes(searchLower);
        const matchingChildren = parent.children.filter((child) =>
          child.name.toLowerCase().includes(searchLower)
        );

        if (parentMatches || matchingChildren.length > 0) {
          return {
            ...parent,
            children: parentMatches ? parent.children : matchingChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof groupedCategories;
  }, [groupedCategories, search]);

  // Get selected category info
  const selectedCategory = useMemo(() => {
    return filteredByType.find((cat) => cat.id === value);
  }, [filteredByType, value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'input w-full text-left flex items-center justify-between',
          error && 'border-danger-500 focus:ring-danger-500',
          !selectedCategory && 'text-gray-400 dark:text-gray-500'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedCategory ? (
            <>
              <span className="text-lg">{selectedCategory.icon || '📁'}</span>
              <span className="text-gray-900 dark:text-white">{selectedCategory.name}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="input w-full pl-9 py-2 text-sm"
              />
            </div>
          </div>

          {/* Category List */}
          <div className="max-h-60 overflow-y-auto p-2">
            {searchFiltered.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No categories found
              </p>
            ) : (
              searchFiltered.map((parent) => (
                <div key={parent.id} className="mb-2 last:mb-0">
                  {/* Parent Category (only if it has no children or we're showing it as selectable) */}
                  {parent.children.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSelect(parent.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        value === parent.id && 'bg-primary-50 dark:bg-primary-900/30'
                      )}
                    >
                      <span className="text-lg">{parent.icon || '📁'}</span>
                      <span className="flex-1 text-gray-900 dark:text-white font-medium">
                        {parent.name}
                      </span>
                      {value === parent.id && (
                        <Check className="h-4 w-4 text-primary-600" />
                      )}
                    </button>
                  ) : (
                    <>
                      {/* Parent Header */}
                      <div className="px-3 py-1.5 flex items-center gap-2">
                        <span className="text-lg">{parent.icon || '📁'}</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {parent.name}
                        </span>
                      </div>

                      {/* Children */}
                      <div className="ml-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                        {parent.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => handleSelect(child.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left',
                              'hover:bg-gray-100 dark:hover:bg-gray-700',
                              value === child.id && 'bg-primary-50 dark:bg-primary-900/30'
                            )}
                          >
                            <span className="text-base">{child.icon || '📁'}</span>
                            <span className="flex-1 text-gray-700 dark:text-gray-200">
                              {child.name}
                            </span>
                            {value === child.id && (
                              <Check className="h-4 w-4 text-primary-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
