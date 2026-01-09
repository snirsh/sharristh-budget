import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from './root';

// tRPC setup
export {
  router,
  publicProcedure,
  protectedProcedure,
  middleware,
  createCallerFactory,
} from './trpc';
export type { Context, SessionUser } from './trpc';

// Root router
export { appRouter } from './root';
export type { AppRouter } from './root';

// Type helpers for inferring router types
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;

// Individual routers (for testing/direct use)
export * from './routers';
