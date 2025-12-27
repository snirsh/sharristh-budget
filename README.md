# Sharristh Budget

A production-grade budget tracker for two-partner households, built as a monorepo with web and mobile applications.

## Features

- 📊 **Dashboard** - Monthly KPIs, budget alerts, category breakdowns
- 💳 **Transactions** - View, search, and recategorize transactions
- 📈 **Budgets** - Set planned amounts and limits per category
- 📁 **Categories** - Hierarchical income/expense categories
- ⚡ **Auto-Categorization** - Rule-based with merchant, keyword, and regex matching
- 🔄 **Recurring Transactions** - Templates for salaries, rent, bills

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 15, TailwindCSS, tRPC
- **Mobile**: Expo, NativeWind
- **Database**: Prisma + SQLite
- **Testing**: Vitest

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development
pnpm dev:web     # Web at http://localhost:3000
pnpm dev:mobile  # Expo dev server
```

## Project Structure

```
apps/
├── web/          # Next.js web application
└── mobile/       # Expo React Native application

packages/
├── api/          # tRPC API layer
├── db/           # Prisma schema and client
├── domain/       # Business logic and types
├── ui/           # Shared UI components
└── config/       # Shared configurations

docs/
├── ARCHITECTURE.md
└── DEV_GUIDE.md
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all applications |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:mobile` | Start mobile app only |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm typecheck` | Type check all packages |

## Seed Data

After seeding, you'll have:

- 1 Household ("The Sharristh Family")
- 2 Users (Alex & Jordan)
- 3 Accounts (Checking, Savings, Credit Card)
- 13 Categories (Income, Expected, Varying)
- 15 Categorization Rules
- 5 Recurring Templates (Salaries, Rent, Bills)
- Sample transactions for current month

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Developer Guide](./docs/DEV_GUIDE.md)

## License

MIT

