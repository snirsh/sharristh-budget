import { describe, expect, it } from 'vitest';
import {
  getAncestorIds,
  getAvailableParents,
  getCategoryDepth,
  getCategoryIdsToDelete,
  getCategoryPath,
  getDescendantIds,
  getDirectChildren,
  hasChildren,
  validateCategoryDelete,
  validateCategoryUpdate,
  wouldCreateCycle,
} from './category';
import type { Category } from './types';

// Mock category hierarchy:
// Income
//   └── Salary
// Expected
//   └── Housing
//       └── Rent
//       └── Utilities
// Varying
//   └── Food
//       └── Groceries
//       └── Restaurants

const mockCategories: Category[] = [
  {
    id: 'cat-income',
    householdId: 'h1',
    name: 'Income',
    type: 'income',
    parentCategoryId: null,
    isActive: true,
    isSystem: true,
    sortOrder: 0,
  },
  {
    id: 'cat-salary',
    householdId: 'h1',
    name: 'Salary',
    type: 'income',
    parentCategoryId: 'cat-income',
    isActive: true,
    isSystem: false,
    sortOrder: 0,
  },
  {
    id: 'cat-expenses',
    householdId: 'h1',
    name: 'Expenses',
    type: 'expense',
    parentCategoryId: null,
    isActive: true,
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: 'cat-housing',
    householdId: 'h1',
    name: 'Housing',
    type: 'expense',
    parentCategoryId: 'cat-expenses',
    isActive: true,
    isSystem: false,
    sortOrder: 0,
  },
  {
    id: 'cat-rent',
    householdId: 'h1',
    name: 'Rent',
    type: 'expense',
    parentCategoryId: 'cat-housing',
    isActive: true,
    isSystem: false,
    sortOrder: 0,
  },
  {
    id: 'cat-utilities',
    householdId: 'h1',
    name: 'Utilities',
    type: 'expense',
    parentCategoryId: 'cat-housing',
    isActive: true,
    isSystem: false,
    sortOrder: 1,
  },
  {
    id: 'cat-food',
    householdId: 'h1',
    name: 'Food',
    type: 'expense',
    parentCategoryId: 'cat-expenses',
    isActive: true,
    isSystem: false,
    sortOrder: 1,
  },
  {
    id: 'cat-groceries',
    householdId: 'h1',
    name: 'Groceries',
    type: 'expense',
    parentCategoryId: 'cat-food',
    isActive: true,
    isSystem: false,
    sortOrder: 0,
  },
  {
    id: 'cat-restaurants',
    householdId: 'h1',
    name: 'Restaurants',
    type: 'expense',
    parentCategoryId: 'cat-food',
    isActive: true,
    isSystem: false,
    sortOrder: 1,
  },
  {
    id: 'cat-inactive',
    householdId: 'h1',
    name: 'Inactive Category',
    type: 'expense',
    parentCategoryId: null,
    isActive: false,
    isSystem: false,
    sortOrder: 3,
  },
];

describe('wouldCreateCycle', () => {
  it('should return true when category is its own parent', () => {
    expect(wouldCreateCycle('cat-food', 'cat-food', mockCategories)).toBe(true);
  });

  it('should return true when new parent is a descendant', () => {
    // Moving Food under Groceries would create: Varying -> Food -> Groceries -> Food (cycle)
    expect(wouldCreateCycle('cat-food', 'cat-groceries', mockCategories)).toBe(true);
    expect(wouldCreateCycle('cat-food', 'cat-restaurants', mockCategories)).toBe(true);
  });

  it('should return false when new parent is not a descendant', () => {
    // Moving Groceries under Housing is valid
    expect(wouldCreateCycle('cat-groceries', 'cat-housing', mockCategories)).toBe(false);
  });

  it('should return false when removing parent (setting to null)', () => {
    expect(wouldCreateCycle('cat-groceries', null, mockCategories)).toBe(false);
  });

  it('should return false when moving to a valid parent', () => {
    // Moving Rent under Food is valid
    expect(wouldCreateCycle('cat-rent', 'cat-food', mockCategories)).toBe(false);
  });
});

describe('getDescendantIds', () => {
  it('should return all descendants of a category', () => {
    const descendants = getDescendantIds('cat-varying', mockCategories);

    expect(descendants.has('cat-food')).toBe(true);
    expect(descendants.has('cat-groceries')).toBe(true);
    expect(descendants.has('cat-restaurants')).toBe(true);
    expect(descendants.size).toBe(3);
  });

  it('should return empty set for leaf category', () => {
    const descendants = getDescendantIds('cat-groceries', mockCategories);

    expect(descendants.size).toBe(0);
  });

  it('should return direct children and grandchildren', () => {
    const descendants = getDescendantIds('cat-expected', mockCategories);

    expect(descendants.has('cat-housing')).toBe(true);
    expect(descendants.has('cat-rent')).toBe(true);
    expect(descendants.has('cat-utilities')).toBe(true);
    expect(descendants.size).toBe(3);
  });
});

describe('getAncestorIds', () => {
  it('should return all ancestors of a category', () => {
    const ancestors = getAncestorIds('cat-groceries', mockCategories);

    expect(ancestors.has('cat-food')).toBe(true);
    expect(ancestors.has('cat-varying')).toBe(true);
    expect(ancestors.size).toBe(2);
  });

  it('should return empty set for root category', () => {
    const ancestors = getAncestorIds('cat-varying', mockCategories);

    expect(ancestors.size).toBe(0);
  });

  it('should return single parent for direct child', () => {
    const ancestors = getAncestorIds('cat-food', mockCategories);

    expect(ancestors.has('cat-varying')).toBe(true);
    expect(ancestors.size).toBe(1);
  });
});

describe('getCategoryPath', () => {
  it('should return full path from root to category', () => {
    const path = getCategoryPath('cat-groceries', mockCategories);

    expect(path).toHaveLength(3);
    expect(path[0]?.id).toBe('cat-varying');
    expect(path[1]?.id).toBe('cat-food');
    expect(path[2]?.id).toBe('cat-groceries');
  });

  it('should return single element for root category', () => {
    const path = getCategoryPath('cat-varying', mockCategories);

    expect(path).toHaveLength(1);
    expect(path[0]?.id).toBe('cat-varying');
  });

  it('should return empty array for non-existent category', () => {
    const path = getCategoryPath('non-existent', mockCategories);

    expect(path).toHaveLength(0);
  });
});

describe('getAvailableParents', () => {
  it('should exclude category and its descendants when moving', () => {
    const available = getAvailableParents('cat-food', mockCategories);

    // Should not include cat-food, cat-groceries, cat-restaurants
    expect(available.find((c) => c.id === 'cat-food')).toBeUndefined();
    expect(available.find((c) => c.id === 'cat-groceries')).toBeUndefined();
    expect(available.find((c) => c.id === 'cat-restaurants')).toBeUndefined();
  });

  it('should exclude inactive categories', () => {
    const available = getAvailableParents('cat-food', mockCategories);

    expect(available.find((c) => c.id === 'cat-inactive')).toBeUndefined();
  });

  it('should filter by type when specified', () => {
    const available = getAvailableParents('cat-rent', mockCategories, 'expense');

    // Should only include active expense categories (excluding cat-rent and descendants)
    for (const cat of available) {
      expect(cat.type).toBe('expense');
    }
  });

  it('should return all root categories for new category', () => {
    const available = getAvailableParents(null, mockCategories);

    // Should include all active root categories
    expect(available.some((c) => c.id === 'cat-income')).toBe(true);
    expect(available.some((c) => c.id === 'cat-expenses')).toBe(true);
    // Should not include inactive
    expect(available.some((c) => c.id === 'cat-inactive')).toBe(false);
  });
});

describe('validateCategoryUpdate', () => {
  it('should reject empty name', () => {
    const result = validateCategoryUpdate('cat-food', { name: '' }, mockCategories, false);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Category name cannot be empty');
  });

  it('should reject name exceeding 50 characters', () => {
    const result = validateCategoryUpdate(
      'cat-food',
      { name: 'A'.repeat(51) },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Category name cannot exceed 50 characters');
  });

  it('should allow type change for any category including system', () => {
    const result = validateCategoryUpdate('cat-income', { type: 'expense' }, mockCategories, true);

    expect(result.isValid).toBe(true);
  });

  it('should reject circular parent reference', () => {
    const result = validateCategoryUpdate(
      'cat-food',
      { parentCategoryId: 'cat-groceries' },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Cannot create circular category hierarchy');
  });

  it('should reject moving to non-existent parent', () => {
    const result = validateCategoryUpdate(
      'cat-food',
      { parentCategoryId: 'non-existent' },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Parent category not found');
  });

  it('should reject moving to inactive parent', () => {
    const result = validateCategoryUpdate(
      'cat-food',
      { parentCategoryId: 'cat-inactive' },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Cannot move to an inactive parent category');
  });

  it('should accept valid update', () => {
    const result = validateCategoryUpdate(
      'cat-food',
      { name: 'Food & Dining', parentCategoryId: 'cat-expected' },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept removing parent (making root)', () => {
    const result = validateCategoryUpdate(
      'cat-groceries',
      { parentCategoryId: null },
      mockCategories,
      false
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('getCategoryDepth', () => {
  it('should return 0 for root category', () => {
    expect(getCategoryDepth('cat-varying', mockCategories)).toBe(0);
  });

  it('should return 1 for direct child of root', () => {
    expect(getCategoryDepth('cat-food', mockCategories)).toBe(1);
  });

  it('should return 2 for grandchild', () => {
    expect(getCategoryDepth('cat-groceries', mockCategories)).toBe(2);
  });
});

describe('hasChildren', () => {
  it('should return true for category with children', () => {
    expect(hasChildren('cat-food', mockCategories)).toBe(true);
  });

  it('should return false for leaf category', () => {
    expect(hasChildren('cat-groceries', mockCategories)).toBe(false);
  });

  it('should return true for root with children', () => {
    expect(hasChildren('cat-varying', mockCategories)).toBe(true);
  });
});

describe('getDirectChildren', () => {
  it('should return direct children sorted by sortOrder', () => {
    const children = getDirectChildren('cat-food', mockCategories);

    expect(children).toHaveLength(2);
    expect(children[0]?.id).toBe('cat-groceries');
    expect(children[1]?.id).toBe('cat-restaurants');
  });

  it('should return empty array for leaf category', () => {
    const children = getDirectChildren('cat-groceries', mockCategories);

    expect(children).toHaveLength(0);
  });

  it('should return all direct children of root', () => {
    const children = getDirectChildren('cat-housing', mockCategories);

    expect(children).toHaveLength(2);
    expect(children[0]?.id).toBe('cat-rent');
    expect(children[1]?.id).toBe('cat-utilities');
  });
});

describe('validateCategoryDelete', () => {
  it('should allow deletion of any category including system', () => {
    const result = validateCategoryDelete('cat-income', mockCategories);

    expect(result.canDelete).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should allow deletion of regular categories', () => {
    const result = validateCategoryDelete('cat-groceries', mockCategories);

    expect(result.canDelete).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error for non-existent category', () => {
    const result = validateCategoryDelete('non-existent', mockCategories);

    expect(result.canDelete).toBe(false);
    expect(result.errors).toContain('Category not found');
  });

  it('should warn about affected subcategories', () => {
    const result = validateCategoryDelete('cat-food', mockCategories);

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('2 subcategories');
    expect(result.affectedSubcategories).toHaveLength(2);
    expect(result.affectedSubcategories.map((c) => c.id)).toContain('cat-groceries');
    expect(result.affectedSubcategories.map((c) => c.id)).toContain('cat-restaurants');
  });

  it('should not warn if no subcategories', () => {
    const result = validateCategoryDelete('cat-groceries', mockCategories);

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.affectedSubcategories).toHaveLength(0);
  });

  it('should include deep hierarchy in affected subcategories', () => {
    const result = validateCategoryDelete('cat-housing', mockCategories);

    expect(result.canDelete).toBe(true);
    expect(result.affectedSubcategories).toHaveLength(2);
    expect(result.affectedSubcategories.map((c) => c.id)).toContain('cat-rent');
    expect(result.affectedSubcategories.map((c) => c.id)).toContain('cat-utilities');
  });
});

describe('getCategoryIdsToDelete', () => {
  it('should return category id and all descendant ids', () => {
    const ids = getCategoryIdsToDelete('cat-food', mockCategories);

    expect(ids).toHaveLength(3);
    expect(ids).toContain('cat-food');
    expect(ids).toContain('cat-groceries');
    expect(ids).toContain('cat-restaurants');
  });

  it('should return only category id for leaf category', () => {
    const ids = getCategoryIdsToDelete('cat-groceries', mockCategories);

    expect(ids).toHaveLength(1);
    expect(ids).toContain('cat-groceries');
  });

  it('should include all nested descendants', () => {
    const ids = getCategoryIdsToDelete('cat-expected', mockCategories);

    expect(ids).toHaveLength(4);
    expect(ids).toContain('cat-expected');
    expect(ids).toContain('cat-housing');
    expect(ids).toContain('cat-rent');
    expect(ids).toContain('cat-utilities');
  });
});
