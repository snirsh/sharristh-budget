import { describe, it, expect } from 'vitest';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryTypeSchema,
} from './schemas';

describe('categoryTypeSchema', () => {
  it('should accept valid category types', () => {
    expect(categoryTypeSchema.safeParse('income').success).toBe(true);
    expect(categoryTypeSchema.safeParse('expected').success).toBe(true);
    expect(categoryTypeSchema.safeParse('varying').success).toBe(true);
  });

  it('should reject invalid category types', () => {
    expect(categoryTypeSchema.safeParse('invalid').success).toBe(false);
    expect(categoryTypeSchema.safeParse('expense').success).toBe(false);
    expect(categoryTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('createCategorySchema', () => {
  it('should accept valid category data', () => {
    const result = createCategorySchema.safeParse({
      name: 'Test Category',
      type: 'varying',
    });
    
    expect(result.success).toBe(true);
  });

  it('should accept all optional fields', () => {
    const result = createCategorySchema.safeParse({
      name: 'Test Category',
      type: 'income',
      parentCategoryId: 'parent-123',
      icon: '🏠',
      color: '#ff0000',
      sortOrder: 5,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentCategoryId).toBe('parent-123');
      expect(result.data.icon).toBe('🏠');
      expect(result.data.color).toBe('#ff0000');
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it('should reject empty name', () => {
    const result = createCategorySchema.safeParse({
      name: '',
      type: 'varying',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 50 characters', () => {
    const result = createCategorySchema.safeParse({
      name: 'A'.repeat(51),
      type: 'varying',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject missing type', () => {
    const result = createCategorySchema.safeParse({
      name: 'Test Category',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const result = createCategorySchema.safeParse({
      name: 'Test Category',
      type: 'invalid',
    });
    
    expect(result.success).toBe(false);
  });
});

describe('updateCategorySchema', () => {
  it('should accept partial updates', () => {
    // Only name
    expect(updateCategorySchema.safeParse({ name: 'New Name' }).success).toBe(true);
    
    // Only icon
    expect(updateCategorySchema.safeParse({ icon: '🎉' }).success).toBe(true);
    
    // Only color
    expect(updateCategorySchema.safeParse({ color: '#00ff00' }).success).toBe(true);
    
    // Only type
    expect(updateCategorySchema.safeParse({ type: 'income' }).success).toBe(true);
    
    // Only parentCategoryId
    expect(updateCategorySchema.safeParse({ parentCategoryId: 'parent-123' }).success).toBe(true);
  });

  it('should accept empty object (no updates)', () => {
    const result = updateCategorySchema.safeParse({});
    
    expect(result.success).toBe(true);
  });

  it('should accept type change', () => {
    const result = updateCategorySchema.safeParse({
      type: 'expected',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('expected');
    }
  });

  it('should accept parentCategoryId change', () => {
    const result = updateCategorySchema.safeParse({
      parentCategoryId: 'new-parent-id',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentCategoryId).toBe('new-parent-id');
    }
  });

  it('should accept null parentCategoryId (making root)', () => {
    const result = updateCategorySchema.safeParse({
      parentCategoryId: null,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentCategoryId).toBeNull();
    }
  });

  it('should accept null icon (removing icon)', () => {
    const result = updateCategorySchema.safeParse({
      icon: null,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.icon).toBeNull();
    }
  });

  it('should accept null color (removing color)', () => {
    const result = updateCategorySchema.safeParse({
      color: null,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBeNull();
    }
  });

  it('should reject invalid type', () => {
    const result = updateCategorySchema.safeParse({
      type: 'invalid-type',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject empty name if provided', () => {
    const result = updateCategorySchema.safeParse({
      name: '',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 50 characters', () => {
    const result = updateCategorySchema.safeParse({
      name: 'A'.repeat(51),
    });
    
    expect(result.success).toBe(false);
  });

  it('should accept full update with all fields', () => {
    const result = updateCategorySchema.safeParse({
      name: 'Updated Category',
      type: 'varying',
      parentCategoryId: 'new-parent',
      icon: '🏠',
      color: '#ff0000',
      isActive: true,
      sortOrder: 10,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated Category');
      expect(result.data.type).toBe('varying');
      expect(result.data.parentCategoryId).toBe('new-parent');
      expect(result.data.icon).toBe('🏠');
      expect(result.data.color).toBe('#ff0000');
      expect(result.data.isActive).toBe(true);
      expect(result.data.sortOrder).toBe(10);
    }
  });

  it('should accept isActive toggle', () => {
    expect(updateCategorySchema.safeParse({ isActive: true }).success).toBe(true);
    expect(updateCategorySchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('should accept sortOrder change', () => {
    const result = updateCategorySchema.safeParse({
      sortOrder: 5,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(5);
    }
  });
});

