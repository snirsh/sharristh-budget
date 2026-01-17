---
name: Fix Category Changing Feature
overview: Fix the broken category changing feature by addressing optimistic update bugs, improving the UX flow, and ensuring rule creation works correctly.
todos:
  - id: fix-optimistic-update
    content: Fix the optimistic update in recategorizeMutation.onSuccess to include the full category object (name, icon, color, type)
    status: completed
  - id: simplify-category-selector
    content: Simplify CategorySelector and MobileCategorySelector to always save immediately on selection, with Rule checkbox affecting the createRule param
    status: completed
  - id: add-toast-feedback
    content: Replace alert() calls with toast notifications for better UX feedback
    status: completed
  - id: add-loading-state
    content: Add loading/pending state indicator when category is being saved
    status: completed
  - id: add-error-handling
    content: Add error handling with user feedback when mutation fails
    status: completed
  - id: create-playwright-test
    content: Create Playwright E2E test for category changing feature
    status: completed
---

# Fix Category Changing Feature

## Problem Analysis

Based on code review of [`TransactionsContent.tsx`](apps/web/src/components/transactions/TransactionsContent.tsx), [`CategoryCombobox.tsx`](apps/web/src/components/ui/CategoryCombobox.tsx), and [`transactions.ts`](packages/api/src/routers/transactions.ts), I identified these issues:

### Issue 1: Optimistic Update Doesn't Include Category Object

In the `recategorizeMutation.onSuccess` handler (lines 233-266), the optimistic update only sets primitive fields:

```typescript
transactions: page.transactions.map((tx) =>
  tx.id === variables.transactionId
    ? {
        ...tx,
        categoryId: variables.categoryId,
        categorizationSource: 'manual',
        confidence: 1,
        needsReview: false,
        // BUG: Missing category object with name, icon, etc.
      }
    : tx
)
```

**Result**: After selecting a category, the UI still shows the old category name/icon until a full refetch completes.

### Issue 2: Confusing Rule Creation UX

In `CategorySelector` (lines 1310-1414):

- When user checks "Rule" checkbox, they must click a separate checkmark button to save
- The immediate-save behavior only works when "Rule" is unchecked
- No visual feedback that category was saved
- Uses blocking `alert()` for feedback

### Issue 3: Mobile Selector Different Behavior

`MobileCategorySelector` (lines 1416-1585) has different behavior:

- Quick-tap saves immediately only if "Create rule" is unchecked
- When "Create rule" is checked, user must tap selected category then click "Save with Rule" button
- Inconsistent with desktop experience

### Issue 4: Missing Error Handling

No error handling or user feedback when mutation fails - the UI just doesn't update.

## Solution

### Fix 1: Include Full Category Object in Optimistic Update

Update the optimistic update in `recategorizeMutation.onSuccess` to include the full category object by looking it up from the `categories` prop.

### Fix 2: Simplify Category Selection UX

- Remove the two-step "select then confirm" flow when Rule checkbox is checked
- Always save immediately on category selection
- Show rule checkbox as a toggle that affects the `createRule` parameter
- Replace blocking `alert()` with toast notifications

### Fix 3: Improve Feedback

- Add loading state to category button while saving
- Show success toast with rule creation info
- Show error toast on failure

### Fix 4: Add Playwright E2E Test

Create a test to verify:

- Category selection saves immediately
- UI updates optimistically
- Rule creation works when checkbox is checked

## Files to Modify

- [`apps/web/src/components/transactions/TransactionsContent.tsx`](apps/web/src/components/transactions/TransactionsContent.tsx) - Fix optimistic update and UX flow
- [`tests/category-change.spec.ts`](tests/category-change.spec.ts) - New E2E test file