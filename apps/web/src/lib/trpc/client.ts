'use client';

import type { AppRouter } from '@sfam/api';
import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query';

export const trpc: CreateTRPCReact<AppRouter, unknown, null> = createTRPCReact<AppRouter>();
