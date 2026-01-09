import type { Category, CategoryType } from './types';

/**
 * Validates if moving a category to a new parent would create a circular reference
 * @param categoryId - The category being moved
 * @param newParentId - The proposed new parent category ID
 * @param categories - All categories in the hierarchy
 * @returns true if the move would create a cycle, false otherwise
 */
export function wouldCreateCycle(
  categoryId: string,
  newParentId: string | null,
  categories: Category[]
): boolean {
  // A category can't be its own parent
  if (categoryId === newParentId) {
    return true;
  }

  // If no parent, no cycle possible
  if (!newParentId) {
    return false;
  }

  // Check if newParentId is a descendant of categoryId
  const descendants = getDescendantIds(categoryId, categories);
  return descendants.has(newParentId);
}

/**
 * Gets all descendant IDs of a category (children, grandchildren, etc.)
 */
export function getDescendantIds(categoryId: string, categories: Category[]): Set<string> {
  const descendants = new Set<string>();

  const collectDescendants = (parentId: string) => {
    const children = categories.filter((c) => c.parentCategoryId === parentId);
    for (const child of children) {
      descendants.add(child.id);
      collectDescendants(child.id);
    }
  };

  collectDescendants(categoryId);
  return descendants;
}

/**
 * Gets all ancestor IDs of a category (parent, grandparent, etc.)
 */
export function getAncestorIds(categoryId: string, categories: Category[]): Set<string> {
  const ancestors = new Set<string>();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let current = categoryMap.get(categoryId);
  while (current?.parentCategoryId) {
    ancestors.add(current.parentCategoryId);
    current = categoryMap.get(current.parentCategoryId);
  }

  return ancestors;
}

/**
 * Gets the full path of a category (from root to this category)
 */
export function getCategoryPath(categoryId: string, categories: Category[]): Category[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const path: Category[] = [];

  let current = categoryMap.get(categoryId);
  while (current) {
    path.unshift(current);
    current = current.parentCategoryId ? categoryMap.get(current.parentCategoryId) : undefined;
  }

  return path;
}

/**
 * Builds a tree structure from flat categories
 */
export function buildCategoryTree(categories: Category[]): Category[] {
  const categoryMap = new Map(categories.map((c) => [c.id, { ...c }]));
  const roots: Category[] = [];

  for (const category of categoryMap.values()) {
    if (category.parentCategoryId) {
      const parent = categoryMap.get(category.parentCategoryId);
      if (parent) {
        // Parent exists, but we're working with flat structures
        // This function returns only root categories
      }
    } else {
      roots.push(category);
    }
  }

  return roots.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Gets categories available as potential parents for a given category
 * Excludes the category itself and all its descendants
 */
export function getAvailableParents(
  categoryId: string | null,
  categories: Category[],
  targetType?: CategoryType
): Category[] {
  if (!categoryId) {
    // New category - all root categories are available
    return categories.filter(
      (c) => !c.parentCategoryId && c.isActive && (!targetType || c.type === targetType)
    );
  }

  const excludeIds = new Set([categoryId, ...getDescendantIds(categoryId, categories)]);

  return categories.filter(
    (c) => !excludeIds.has(c.id) && c.isActive && (!targetType || c.type === targetType)
  );
}

/**
 * Validates a category update operation
 */
export interface CategoryUpdateValidation {
  isValid: boolean;
  errors: string[];
}

export function validateCategoryUpdate(
  categoryId: string,
  update: {
    name?: string;
    type?: CategoryType;
    parentCategoryId?: string | null;
  },
  categories: Category[],
  _isSystem?: boolean // Kept for backward compatibility but no longer used
): CategoryUpdateValidation {
  const errors: string[] = [];

  // Validate name
  if (update.name !== undefined) {
    if (update.name.trim().length === 0) {
      errors.push('Category name cannot be empty');
    }
    if (update.name.length > 50) {
      errors.push('Category name cannot exceed 50 characters');
    }
  }

  // Validate parent change
  if (update.parentCategoryId !== undefined) {
    if (wouldCreateCycle(categoryId, update.parentCategoryId, categories)) {
      errors.push('Cannot create circular category hierarchy');
    }

    // Validate parent exists and is active
    if (update.parentCategoryId) {
      const parent = categories.find((c) => c.id === update.parentCategoryId);
      if (!parent) {
        errors.push('Parent category not found');
      } else if (!parent.isActive) {
        errors.push('Cannot move to an inactive parent category');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates the depth of a category in the hierarchy
 */
export function getCategoryDepth(categoryId: string, categories: Category[]): number {
  return getAncestorIds(categoryId, categories).size;
}

/**
 * Checks if a category has any children
 */
export function hasChildren(categoryId: string, categories: Category[]): boolean {
  return categories.some((c) => c.parentCategoryId === categoryId);
}

/**
 * Gets direct children of a category
 */
export function getDirectChildren(categoryId: string, categories: Category[]): Category[] {
  return categories
    .filter((c) => c.parentCategoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Validates a category delete operation
 */
export interface CategoryDeleteValidation {
  canDelete: boolean;
  errors: string[];
  warnings: string[];
  affectedSubcategories: Category[];
}

export function validateCategoryDelete(
  categoryId: string,
  categories: Category[]
): CategoryDeleteValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const category = categories.find((c) => c.id === categoryId);

  if (!category) {
    return {
      canDelete: false,
      errors: ['Category not found'],
      warnings: [],
      affectedSubcategories: [],
    };
  }

  // Get all subcategories that will be deleted
  const descendantIds = getDescendantIds(categoryId, categories);
  const affectedSubcategories = categories.filter((c) => descendantIds.has(c.id));

  // Add warning if there are subcategories
  if (affectedSubcategories.length > 0) {
    warnings.push(
      `This will also delete ${affectedSubcategories.length} subcategor${affectedSubcategories.length === 1 ? 'y' : 'ies'}`
    );
  }

  return {
    canDelete: true,
    errors,
    warnings,
    affectedSubcategories,
  };
}

/**
 * Gets all category IDs that would be deleted (including descendants)
 */
export function getCategoryIdsToDelete(categoryId: string, categories: Category[]): string[] {
  const descendantIds = getDescendantIds(categoryId, categories);
  return [categoryId, ...Array.from(descendantIds)];
}
