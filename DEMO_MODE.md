# Demo Mode

Demo mode allows you to run the application with pre-seeded sample data without requiring authentication or affecting your real data.

## Running Demo Mode

From the project root, run:

```bash
pnpm dev:web:demo
```

This command will:
1. Clean up any existing demo database files
2. Copy `.env.demo` to both `apps/web/.env.local` and `packages/db/.env`
3. Push the database schema to create `packages/db/prisma/demo.db`
4. Seed the demo database with sample Israeli household data
5. Start the Next.js development server on port 3000

**Note**: When you're done with demo mode, switch back to production mode:
```bash
cp apps/web/.env.production apps/web/.env.local
```

## Database Safety

**Your real data is completely safe!**

- **Production database**: `packages/db/prisma/dev.db` (your real data)
- **Demo database**: `packages/db/prisma/demo.db` (demo data only)

These are completely separate files and will never interfere with each other.

## Switching Between Modes

**Production Mode** (default):
```bash
# Make sure production env is active
cp apps/web/.env.production apps/web/.env.local
pnpm dev:web
```

**Demo Mode**:
```bash
# The dev:demo script automatically switches to demo mode
pnpm dev:web:demo
```

## What's Included in Demo Mode

The demo environment includes:

- **Mock User**: `demo@example.com` (no login required)
- **Demo Household**: "🎭 Demo Household"
- **3 Accounts**:
  - ארנק (Cash) - ₪2,500
  - חשבון עו"ש (Checking) - ₪15,000
  - כרטיס אשראי (Credit Card) - -₪4,500

- **10 Categories**:
  - Income: משכורת, הכנסה אחרת
  - Expected: שכר דירה, חשמל, ביטוחים
  - Varying: מכולת, מסעדות, תחבורה, קניות, בילויים

- **~40 Transactions** over the past 3 months with realistic Israeli household expenses

- **3 Recurring Transaction Templates**:
  - Monthly salary (משכורת) - ₪18,000
  - Monthly rent (שכר דירה) - ₪5,500
  - **Bimonthly electricity** (חשמל) - ₪350 (demonstrates interval functionality)

- **5 Categorization Rules** for automatic transaction categorization

## Features Tested in Demo Mode

Demo mode demonstrates:
- ✅ Automatic categorizations based on merchant rules
- ✅ Bimonthly recurring expenses (electricity bills)
- ✅ Transaction filtering and searching
- ✅ Budget planning and tracking
- ✅ Category management
- ✅ Rule-based auto-categorization

## Cleaning Demo Data

To reset the demo database:

```bash
rm packages/db/prisma/demo.db packages/db/prisma/demo.db-journal
```

Then run `pnpm dev:web:demo` again to reseed.

## Technical Details

**Environment Variables** (`.env.demo`):
- `DEMO_MODE=true` - Enables demo mode
- `DATABASE_URL="file:./demo.db"` - Points to `packages/db/prisma/demo.db` (relative to packages/db/)

**How It Works**:
1. Middleware skips authentication when `DEMO_MODE=true`
2. Server context uses a mock user (`demo-user`) instead of session
3. Demo household is created/retrieved automatically
4. Seed script populates realistic Israeli household financial data
