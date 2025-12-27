# Developer Guide

This guide will help you get started developing on the Sharristh Budget application.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd sharristh-budget
pnpm install
```

### 2. Set Up Database

```bash
# Generate Prisma client
pnpm db:generate

# Create and migrate database
pnpm db:migrate

# Seed with sample data
pnpm db:seed
```

### 3. Start Development

```bash
# Start all apps
pnpm dev

# Or start specific apps
pnpm dev:web    # Web app at http://localhost:3000
pnpm dev:mobile # Expo development server
```

## Project Structure

```
apps/
├── web/                    # Next.js web app
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   └── lib/            # Utilities and tRPC client
│   └── ...
└── mobile/                 # Expo React Native app
    ├── app/                # Expo Router screens
    └── ...

packages/
├── api/                    # tRPC API layer
│   └── src/
│       ├── routers/        # Individual routers
│       ├── root.ts         # Main app router
│       └── trpc.ts         # tRPC setup
├── db/                     # Database layer
│   ├── prisma/
│   │   └── schema.prisma   # Prisma schema
│   └── src/
│       ├── client.ts       # Prisma client
│       └── seed.ts         # Seed script
├── domain/                 # Business logic
│   └── src/
│       ├── types.ts        # Type definitions
│       ├── schemas.ts      # Zod schemas
│       ├── categorization.ts
│       ├── budget.ts
│       └── recurring.ts
├── ui/                     # Shared components
│   └── src/
│       └── components/     # React Native components
└── config/                 # Shared configs
    ├── tsconfig/           # TypeScript configs
    ├── eslint/             # ESLint config
    └── tailwind/           # Tailwind tokens
```

## Common Tasks

### Adding a New API Endpoint

1. Create or update router in `packages/api/src/routers/`:

```typescript
// packages/api/src/routers/example.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const exampleRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.example.findMany();
  }),
  
  create: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.example.create({ data: input });
    }),
});
```

2. Add to root router in `packages/api/src/root.ts`:

```typescript
import { exampleRouter } from './routers/example';

export const appRouter = router({
  // ... existing routers
  example: exampleRouter,
});
```

### Adding a New Prisma Model

1. Update schema in `packages/db/prisma/schema.prisma`
2. Run migration:

```bash
pnpm db:migrate
```

3. Add types to `packages/domain/src/types.ts`
4. Add schemas to `packages/domain/src/schemas.ts`

### Adding Domain Logic

1. Add function to appropriate file in `packages/domain/src/`
2. Export from `packages/domain/src/index.ts`
3. Add tests in `packages/domain/src/*.test.ts`
4. Run tests:

```bash
pnpm test
```

### Adding a Web Page

1. Create page file in `apps/web/src/app/`:

```typescript
// apps/web/src/app/example/page.tsx
import { serverTrpc } from '@/lib/trpc/server';

export default async function ExamplePage() {
  const data = await serverTrpc.example.list();
  return <ExampleContent data={data} />;
}
```

2. Create component in `apps/web/src/components/`

### Adding a Mobile Screen

1. Create screen in `apps/mobile/app/`:

```typescript
// apps/mobile/app/(tabs)/example.tsx
export default function ExampleScreen() {
  return (
    <View className="flex-1 p-4">
      <Text>Example Screen</Text>
    </View>
  );
}
```

2. Add to tab navigation in `apps/mobile/app/(tabs)/_layout.tsx`

## Testing

```bash
# Run all tests
pnpm test

# Run tests with watch mode
pnpm test -- --watch

# Run tests with coverage
pnpm test -- --coverage
```

## Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Commit messages follow conventional commits

## Troubleshooting

### Database Issues

```bash
# Reset database
rm packages/db/prisma/dev.db
pnpm db:migrate
pnpm db:seed
```

### Type Errors After Schema Changes

```bash
pnpm db:generate
pnpm turbo build --filter=@sharristh/db
```

### Mobile Metro Bundler Issues

```bash
# Clear Metro cache
cd apps/mobile
npx expo start --clear
```

### Turbo Cache Issues

```bash
# Clear turbo cache
pnpm clean
pnpm install
```

## Environment Variables

### Web App (.env.local)
```
DATABASE_URL="file:../../packages/db/prisma/dev.db"
```

### Database Package (.env)
```
DATABASE_URL="file:./dev.db"
```

## Useful Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build all packages
pnpm build

# View database in browser
pnpm db:studio

# Generate Prisma client after schema changes
pnpm db:generate
```

