'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@sfam/api';

export const trpc = createTRPCReact<AppRouter>();

