'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
}

interface CategoryComboboxProps {
  categories: CategoryOption[];
  value?: string;
  placeholder?: string;
  transactionDirection?: 'income' | 'expense';
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (categoryId: string) => void;
  onCancel?: () => void;
}

export const CategoryCombobox = ({
  categories,
  value,
  placeholder = 'Search categories...',
  transactionDirection,
  autoFocus = false,
  disabled = false,
  className,
  onSelect,
  onCancel,
}: CategoryComboboxProps) => {
  const [isOpen, setIsOpen] = useState(autoFocus);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter categories based on direction and search query
  const filteredCategories = useMemo(() => {
    let filtered = categories;

    // Filter by transaction direction
    if (transactionDirection) {
      filtered = filtered.filter((cat) => {
        if (transactionDirection === 'income') {
          return cat.type === 'income';
        }
        return cat.type !== 'income';
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (cat) =>
          cat.name.toLowerCase().includes(query) ||
          (cat.icon && cat.icon.includes(query))
      );
    }

    return filtered;
  }, [categories, transactionDirection, searchQuery]);

  // Get selected category
  const selectedCategory = categories.find((c) => c.id === value);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredCategories.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCategories[highlightedIndex]) {
            handleSelect(filteredCategories[highlightedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          onCancel?.();
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredCategories, highlightedIndex, onCancel]
  );

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-open on mount if autoFocus
  useEffect(() => {
    if (autoFocus) {
      setIsOpen(true);
    }
  }, [autoFocus]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button / Input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          !selectedCategory && 'text-gray-400 dark:text-gray-500'
        )}
      >
        {selectedCategory ? (
          <>
            <span className="text-lg">{selectedCategory.icon || '📁'}</span>
            <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
              {selectedCategory.name}
            </span>
          </>
        ) : (
          <span className="flex-1">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Category List */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
          >
            {filteredCategories.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No categories found
              </li>
            ) : (
              filteredCategories.map((category, index) => (
                <li
                  key={category.id}
                  role="option"
                  aria-selected={category.id === value}
                  onClick={() => handleSelect(category.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                    index === highlightedIndex &&
                      'bg-primary-50 dark:bg-primary-900/30',
                    category.id === value &&
                      'bg-primary-100 dark:bg-primary-900/50'
                  )}
                >
                  <span className="text-lg">{category.icon || '📁'}</span>
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      category.id === value
                        ? 'font-medium text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-200'
                    )}
                  >
                    {category.name}
                  </span>
                  {category.id === value && (
                    <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  )}
                </li>
              ))
            )}
          </ul>

          {/* Cancel button */}
          {onCancel && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                  onCancel();
                }}
                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryCombobox;
