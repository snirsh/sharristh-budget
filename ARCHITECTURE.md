# SharristhBudget - Architecture Documentation

## Overview

SharristhBudget is a modern household budget management application built for Israeli families. It features intelligent transaction categorization with AI, budget tracking, recurring transaction management, and dual-mode operation (production and demo).

## Tech Stack

### Core Technologies
- **Framework**: Next.js 15.5.9 (App Router)
- **Language**: TypeScript
- **Monorepo**: Turborepo
- **Database**: SQLite with Prisma 6.19.1 ORM
- **API Layer**: tRPC (type-safe API)
- **Authentication**: NextAuth.js with WebAuthn (passkeys)
- **UI**: Tailwind CSS
- **AI**: Google Gemini (cloud-based, free tier)

### Testing & Tooling
- **E2E Testing**: Playwright
- **Package Manager**: pnpm (workspaces)
- **Node**: v20+

## Project Structure

```
SharristhBudget/
├── apps/
│   └── web/                    # Next.js application
│       ├── src/
│       │   ├── app/           # App router pages
│       │   ├── components/    # React components
│       │   ├── lib/           # Utilities and configs
│       │   └── middleware.ts  # Auth & demo mode routing
│       └── scripts/
│           └── seed-demo.ts   # Demo database seeding
├── packages/
│   ├── api/                   # tRPC API routers
│   │   └── src/routers/       # API endpoints
│   ├── db/                    # Database layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   ├── dev.db         # Production database
│   │   │   └── demo.db        # Demo mode database
│   │   └── scripts/           # Migration scripts
│   └── domain/                # Business logic (framework-agnostic)
│       └── src/
│           ├── categorization.ts      # Rule-based categorization
│           ├── ai-categorization.ts   # AI-powered categorization
│           ├── budgets.ts             # Budget evaluation logic
│           ├── recurring.ts           # Recurring transaction scheduling
│           └── types.ts               # Shared TypeScript types
├── tests/                     # E2E tests (Playwright)
└── AI_CATEGORIZATION.md       # AI setup documentation
```

## Database Schema

### Core Entities

#### User
- Authentication via WebAuthn (passkeys)
- Linked to households

#### Household
- Multi-user support (family accounts)
- All data scoped to household

#### Category
- **Types**: `income`, `expected` (fixed expenses), `varying` (variable expenses)
- **Bilingual**: Format "English (עברית)" for Israeli users
- **Hierarchy**: Optional parent-child relationships
- **System categories**: Cannot be deleted

#### Transaction
- **Direction**: `income`, `expense`, `transfer`
- **Categorization**:
  - `categorizationSource`: `manual`, `rule_merchant`, `rule_keyword`, `rule_regex`, `ai_suggestion`, `fallback`
  - `confidence`: 0.0-1.0 (higher = more confident)
  - `needsReview`: Boolean flag for uncertain categorizations
- **Recurring**: Linked to templates via `recurringTemplateId`

#### Budget
- Per category, per month (format: `YYYY-MM`)
- **Planned amount**: Expected spending
- **Limit amount**: Optional hard/soft cap
- **Limit types**:
  - `soft`: Warning only
  - `hard`: Prevents exceeding (future feature)
- **Alert threshold**: Percentage (0.0-1.0) when to show warnings

#### RecurringTransactionTemplate
- Schedule-based transaction generation
- **Frequencies**: `daily`, `weekly`, `monthly`, `yearly`
- **Scheduling**: RRule-compatible (byMonthDay, byWeekday, interval)
- **Timezone**: Asia/Jerusalem

#### CategoryRule
- Auto-categorization rules
- **Types**:
  - `merchant`: Exact merchant name match
  - `keyword`: Text contains keyword
  - `regex`: Pattern matching
- **Priority**: Higher number = evaluated first

## Key Features

### 1. Intelligent Transaction Categorization

**Priority Order** (highest to lowest confidence):

1. **Manual** (1.0) - User-assigned category
2. **Merchant Rule** (0.95) - Exact merchant match
3. **Keyword Rule** (0.80) - Keyword in description/merchant
4. **Regex Rule** (0.75) - Pattern match
5. **AI Suggestion** (~0.85) - Google Gemini analysis
6. **Fallback** (0.50) - Default category from database

**AI Categorization** (`packages/domain/src/ai-categorization.ts`):
- **Primary**: Vercel AI Gateway with Claude Sonnet 4 (structured output via Zod schemas)
- **Fallback**: Google Gemini 2.0 Flash (direct API)
- **Cloud-based**: Works on Vercel serverless
- **Timeout**: 10 seconds (graceful fallback)
- **Confidence Cap**: 0.85 (never exceeds rule-based methods)
- **Review Flag**: AI suggestions marked `needsReview: true`
- **Auto-Learning**: Creates rules automatically from high-confidence AI suggestions (≥75%)

**Environment Variables** (choose one):
```bash
# Option 1: Vercel AI Gateway (recommended - unified access to multiple models)
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-api-key

# Option 2: Legacy Google Gemini direct API
GEMINI_API_KEY=your-api-key-from-google-ai-studio
```

**Visual Indicator**:
- Purple sparkle badge (✨) next to AI-categorized transactions
- Shows confidence percentage on hover

### 2. Budget Management

**Features**:
- Create budgets per category per month
- Set planned amount and optional limits (soft/hard)
- Alert thresholds (e.g., warn at 80% usage)
- Real-time evaluation: `ok`, `nearing_limit`, `exceeded_soft`, `exceeded_hard`

**UI Components**:
- `/apps/web/src/components/budget/BudgetContent.tsx` - Main budget page
- `/apps/web/src/components/budget/AddBudgetDialog.tsx` - Create/edit dialog
- Color coding: Green (≤100%), Red (>100%)

**API**:
- `budgets.forMonth` - Get budgets with actual vs planned evaluation
- `budgets.upsert` - Create or update budget
- `budgets.delete` - Remove budget

### 3. Recurring Transactions

**Template-Based Generation**:
- Define templates with frequency and schedule
- Auto-generate instances on schedule (via cron/scheduler)
- Override individual instances (skip or modify)

**Scheduling** (`packages/domain/src/recurring.ts`):
- Generates occurrences based on RRule logic
- Timezone-aware (Asia/Jerusalem)
- Handles edge cases (month-end, leap years)

**Future**: Pattern detection (Phase 4) will suggest templates from transaction history

### 4. Demo Mode

**Purpose**: Publicly accessible demo with sample data, no authentication required

**Configuration**:
- **Environment**: `DEMO_MODE=true` in `.env.demo`
- **Database**: Separate `demo.db` file
- **User**: Auto-authenticated as demo user
- **Middleware**: Bypasses auth checks when demo mode active

**Seed Script** (`apps/web/scripts/seed-demo.ts`):
- Creates demo household, user, accounts
- 10 bilingual categories
- 8 realistic budgets (Israeli household)
- 90 days of sample transactions
- 3 recurring templates (monthly subscriptions)

**Running Demo**:
```bash
cd apps/web
pnpm dev:demo  # Starts on port 3001
```

### 5. Bilingual Category Support

**Format**: "English (עברית)"
- **Example**: "Groceries (מכולת)", "Rent (שכר דירה)"
- **Rationale**: Israeli users comfortable with English UI, Hebrew category names
- **Implementation**: Both seed scripts and default categories use bilingual format

## Data Flow

### Transaction Creation Flow

```
User creates transaction
    ↓
API: transactions.create
    ↓
Get category rules for household
    ↓
Get categories for AI
    ↓
categorizeTransaction() (domain layer)
    ├→ Manual category? → Return (1.0 confidence)
    ├→ Match merchant rule? → Return (0.95)
    ├→ Match keyword rule? → Return (0.80)
    ├→ Match regex rule? → Return (0.75)
    ├→ AI enabled? → suggestCategoryWithAI()
    │   ├→ Build prompt with transaction + categories
    │   ├→ Call Gemini API (10s timeout)
    │   ├→ Parse JSON response
    │   └→ Return (≤0.85 confidence)
    └→ Fallback → Lookup default category from DB (0.50)
    ↓
Create transaction in database
    ├→ categorizationSource
    ├→ confidence
    └→ needsReview (true if AI or fallback)
    ↓
Return to client
```

### Budget Evaluation Flow

```
Request budgets for month (YYYY-MM)
    ↓
API: budgets.forMonth
    ↓
Fetch budgets for household + month
    ↓
For each budget:
    ├→ Sum transactions for category in month
    ├→ Calculate percentUsed (actual / planned)
    ├→ Calculate remaining (planned - actual)
    ├→ Determine status:
    │   ├→ exceeded_hard: Over limit (hard)
    │   ├→ exceeded_soft: Over limit (soft)
    │   ├→ nearing_limit: Above alert threshold
    │   └→ ok: Within budget
    └→ Build BudgetEvaluation object
    ↓
Return evaluations to client
```

## API Layer (tRPC)

### Router Structure

**Root Router** (`packages/api/src/root.ts`):
```typescript
export const appRouter = router({
  transactions: transactionsRouter,
  categories: categoriesRouter,
  budgets: budgetsRouter,
  recurring: recurringRouter,
  accounts: accountsRouter,
  bankConnections: bankConnectionsRouter,
  demo: demoRouter,
});
```

**Protected Procedures**:
- All procedures use `protectedProcedure`
- Automatically injects `ctx.userId`, `ctx.householdId`
- Enforces authentication (except in demo mode)

**Example Endpoint**:
```typescript
list: protectedProcedure
  .input(transactionFiltersSchema)
  .query(async ({ ctx, input }) => {
    // Auto-scoped to ctx.householdId
    const transactions = await ctx.prisma.transaction.findMany({
      where: { householdId: ctx.householdId, ...filters },
    });
    return transactions;
  }),
```

## Authentication

**Strategy**: WebAuthn (Passkeys)
- **Provider**: NextAuth.js with WebAuthn adapter
- **Biometric**: Face ID, Touch ID, Windows Hello
- **Storage**: Credentials stored securely by OS
- **Relying Party**: Configured per environment

**Environment Variables**:
```bash
AUTH_SECRET=<random-secret>
AUTH_WEBAUTHN_RP_ID=localhost  # or yourdomain.com
AUTH_WEBAUTHN_RP_NAME=Sharristh Budget
AUTH_WEBAUTHN_RP_ORIGIN=http://localhost:3000
```

**Middleware** (`apps/web/src/middleware.ts`):
- Protects all routes except public paths
- Demo mode: Bypasses auth, injects demo user session

## Environment Configuration

### Production (`.env.local`)
```bash
# Database
DATABASE_URL="file:./dev.db"

# Auth
AUTH_SECRET=<secret>
AUTH_WEBAUTHN_RP_ID=localhost
AUTH_WEBAUTHN_RP_NAME=Sharristh Budget
AUTH_WEBAUTHN_RP_ORIGIN=http://localhost:3000

# AI (optional - free tier)
GEMINI_API_KEY=your-api-key-from-google-ai-studio
```

### Demo Mode (`.env.demo`)
```bash
DEMO_MODE=true
DATABASE_URL="file:./demo.db"
AUTH_SECRET=demo-secret-key-not-used-in-demo-mode
# GEMINI_API_KEY= # Can be enabled for testing
```

## Domain Layer

**Philosophy**: Framework-agnostic business logic

**Key Modules**:
- `categorization.ts`: Rule + AI categorization logic
- `ai-categorization.ts`: Google Gemini integration
- `budgets.ts`: Budget evaluation algorithms
- `recurring.ts`: Recurring transaction scheduling
- `types.ts`: Shared TypeScript interfaces

**Benefits**:
- Testable without framework overhead
- Reusable across different frontends (mobile app, CLI)
- Clear separation of concerns

**Example**:
```typescript
// Pure function - no framework dependencies
export async function categorizeTransaction(
  tx: TransactionInput,
  rules: CategoryRule[],
  categories?: Category[],
  options?: { enableAI?: boolean; aiApiKey?: string }
): Promise<CategorizationResult> {
  // Business logic only
}
```

## Performance Considerations

### AI Categorization
- **Response Time**: 500-1500ms per transaction
- **Timeout**: 10 seconds (graceful fallback to next method)
- **Free Tier**: 15 req/min, 1M tokens/month on Google Gemini
- **Batching**: Currently sequential (can be parallelized in future)

### Database
- **SQLite**: Suitable for single-household use
- **Indexes**: On `householdId`, `date`, `categoryId`, `month`
- **Queries**: All scoped to household (prevents N+1)

### Future Optimizations
- Batch AI categorization for bulk imports
- Redis cache for budget evaluations
- PostgreSQL for multi-tenant SaaS

## Testing Strategy

### E2E Tests (Playwright)

**Location**: `/tests/`

**Coverage**:
- Demo mode: All pages accessible without auth
- Bank connections: Scraper integration flow
- Categories: CRUD operations
- Budgets: Creation, editing, deletion
- Transactions: Categorization, recategorization

**Running Tests**:
```bash
pnpm playwright test               # All tests
pnpm playwright test --ui          # Interactive UI
pnpm playwright test demo          # Demo mode tests only
```

### Unit Tests (Future)
- Domain layer functions (categorization, budgets, recurring)
- tRPC router logic
- React component tests (Vitest + Testing Library)

## Deployment

### Prerequisites
- Node.js 20+
- pnpm
- SQLite3
- (Optional) Google Gemini API key for AI features

### Build
```bash
pnpm install
pnpm build
```

### Run Production
```bash
cd apps/web
pnpm start  # Runs on port 3000
```

### Database Migrations
```bash
cd packages/db
pnpm prisma migrate deploy  # Apply migrations
pnpm prisma db seed         # Seed default categories
```

### Demo Mode (Separate Instance)
```bash
cd apps/web
cp .env.demo .env.local
pnpm dev:demo  # Port 3001
```

## Security Considerations

### Data Privacy
- **AI Processing**: Minimal data sent to Gemini API (only description, merchant, amount)
- **Household Isolation**: All queries scoped to `householdId`
- **Demo Mode**: Completely separate database

### Authentication
- **WebAuthn**: Industry-standard, phishing-resistant
- **Session Management**: NextAuth.js with secure cookies
- **CSRF Protection**: Built into NextAuth.js

### Input Validation
- **tRPC Schemas**: Zod validation on all inputs
- **Prisma**: Type-safe database queries
- **XSS Protection**: React automatically escapes output

### Environment Variables
- Never commit `.env.local` or `.env.demo`
- Use strong `AUTH_SECRET` (min 32 characters)
- Rotate secrets periodically

## Future Features (Roadmap)

### Phase 4: Recurring Pattern Detection (Planned)
- Analyze transaction history for subscription patterns
- Detect recurring amounts and dates
- Suggest creating templates automatically
- Algorithm: Group by merchant, check amount consistency (85%), detect intervals

### Phase 5: Advanced Analytics
- Spending trends over time
- Category comparison (month-over-month)
- Savings goals tracking
- Export to CSV/PDF

### Phase 6: Bank Integration
- Israeli bank scrapers (already implemented in `/packages/scraper/`)
- Auto-import transactions
- Balance synchronization

### Phase 7: Multi-User Enhancements
- Role-based access (admin, viewer, contributor)
- Activity log (audit trail)
- Shared budgets with individual tracking

## Contributing

### Development Workflow
1. Create feature branch from `master`
2. Make changes, test locally
3. Run E2E tests: `pnpm playwright test`
4. Commit with descriptive messages
5. Create pull request

### Code Style
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Functional programming preferred in domain layer
- React Server Components where possible (Next.js App Router)

### Commit Convention
```
feat: Add AI categorization badge to transactions
fix: Resolve foreign key constraint on fallback categories
docs: Update architecture with AI categorization flow
test: Add E2E test for budget deletion
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Google Gemini Documentation](https://ai.google.dev/docs)
- [AI Categorization Setup](./AI_CATEGORIZATION.md)
- [Demo Mode Documentation](./DEMO_MODE.md)

## License

(Add your license here)

## Contact

(Add contact information here)
