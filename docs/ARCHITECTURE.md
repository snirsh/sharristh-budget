# Architecture Overview

This document describes the architecture of the Sharristh Family Budget application, a production-grade monorepo for household budget tracking.

## Monorepo Structure

```
sharristh-family-budget/
├── apps/
│   ├── web/          # Next.js web application
│   └── mobile/       # Expo React Native application
├── packages/
│   ├── api/          # tRPC routers and API layer
│   ├── db/           # Prisma schema, client, and migrations
│   ├── domain/       # Business logic, types, and schemas
│   ├── ui/           # Shared UI components (React Native + NativeWind)
│   └── config/       # Shared configurations (TypeScript, ESLint, Tailwind)
└── docs/             # Documentation
```

## Technology Stack

### Core Technologies
- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript (strict mode)
- **Database**: Prisma + SQLite (local dev)

### Web Application
- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS with shared design tokens
- **API Client**: tRPC + TanStack Query

### Mobile Application
- **Framework**: Expo (React Native)
- **Styling**: NativeWind (Tailwind for React Native)
- **Navigation**: Expo Router

### Shared Packages
- **API Layer**: tRPC for end-to-end type safety
- **State Management**: TanStack Query
- **Forms**: react-hook-form + zod validation
- **Testing**: Vitest for domain logic

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Apps                              │
│  ┌─────────────────────┐         ┌─────────────────────┐        │
│  │     Web (Next.js)   │         │  Mobile (Expo)      │        │
│  │  - TanStack Query   │         │  - TanStack Query   │        │
│  │  - tRPC Client      │         │  - (Mock data)      │        │
│  └──────────┬──────────┘         └─────────────────────┘        │
└─────────────┼───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (tRPC)                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  /packages/api                                               ││
│  │  - transactions router                                       ││
│  │  - categories router                                         ││
│  │  - budgets router                                            ││
│  │  - recurring router                                          ││
│  │  - rules router                                              ││
│  │  - dashboard router                                          ││
│  └──────────┬──────────────────────────────────────────────────┘│
└─────────────┼───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Domain Logic Layer                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  /packages/domain                                            ││
│  │  - categorizeTransaction()                                   ││
│  │  - evaluateBudgetStatus()                                    ││
│  │  - expandRecurringToMonth()                                  ││
│  │  - Zod schemas for validation                                ││
│  └──────────┬──────────────────────────────────────────────────┘│
└─────────────┼───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Access Layer                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  /packages/db                                                ││
│  │  - Prisma Client                                             ││
│  │  - SQLite Database                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Core Domain Concepts

### Household Model
- Each household has two partners (users)
- All data is scoped to a household
- Single household stub auth for local development

### Transaction Flow
1. Transaction created (manually or from recurring template)
2. Auto-categorization runs using rules
3. Transaction stored with category, confidence, and source
4. If low confidence, marked for review
5. Dashboard and budgets update accordingly

### Categorization Pipeline
1. **Manual**: User-assigned category (confidence: 1.0)
2. **Merchant Rule**: Match by merchant name (confidence: 0.95)
3. **Keyword Rule**: Match by keyword in description (confidence: 0.80)
4. **Regex Rule**: Match by pattern (confidence: 0.75)
5. **Fallback**: Varying expenses / Other income (confidence: 0.50)

### Budget Evaluation
- Each category can have monthly budget with:
  - `plannedAmount`: Expected spending
  - `limitAmount`: Maximum allowed (optional)
  - `limitType`: soft (warning) or hard (block)
  - `alertThresholdPct`: When to start alerting (default 80%)

- Status outcomes:
  - `ok`: Under threshold
  - `nearing_limit`: Above threshold, under limit
  - `exceeded_soft`: Over soft limit
  - `exceeded_hard`: Over hard limit

### Recurring Transactions
- Templates define schedule (daily/weekly/monthly/yearly)
- Occurrences generated on-demand
- Instance key prevents duplicates
- Overrides allow skipping or modifying single occurrences

## Extensibility Points

### Adding New Features
1. **New Entity**: Add Prisma model → Domain types → API router → UI
2. **New Screen**: Add page in app → Create component → Connect to API
3. **New Rule Type**: Extend categorization logic → Add UI for rule creation

### Integration Points
- **Banking APIs**: Add import job → Parse transactions → Run categorization
- **Notifications**: Subscribe to budget events → Send alerts
- **Reports**: Add report queries → Generate PDF/CSV exports

### Future Considerations
- Multi-household support
- OAuth authentication
- Cloud database (PostgreSQL)
- Real-time sync across devices
- Bank account aggregation
- Receipt scanning and OCR

