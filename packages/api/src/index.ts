// tRPC setup
export { router, publicProcedure, protectedProcedure, middleware, createCallerFactory } from './trpc';
export type { Context, SessionUser } from './trpc';

// Root router
export { appRouter } from './root';
export type { AppRouter } from './root';

// Individual routers (for testing/direct use)
export * from './routers';

