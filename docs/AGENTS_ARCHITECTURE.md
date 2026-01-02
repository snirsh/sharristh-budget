# Agents Architecture

## Overview

This document describes the technical architecture for implementing autonomous agents in Sharristh Budget. It covers system design, database schemas, execution lifecycle, integration points, and performance considerations.

## Table of Contents

- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [Agent Execution Lifecycle](#agent-execution-lifecycle)
- [Agent Registry](#agent-registry)
- [Scheduler Architecture](#scheduler-architecture)
- [Event-Driven Triggers](#event-driven-triggers)
- [Notification System](#notification-system)
- [Performance & Scalability](#performance--scalability)
- [Security Architecture](#security-architecture)
- [Monitoring & Observability](#monitoring--observability)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Web    │  │  Mobile  │  │   API    │  │  Email   │       │
│  │   App    │  │   App    │  │ Clients  │  │ Notifs   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼────────────┼─────────────┼─────────────┼──────────────┘
        │            │             │             │
        │            │             │             │
┌───────┼────────────┼─────────────┼─────────────┼──────────────┐
│       ▼            ▼             ▼             ▼               │
│                     tRPC API Layer                             │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Routers: transactions, budgets, agents, etc.        │     │
│  └────────────────────────┬─────────────────────────────┘     │
└───────────────────────────┼────────────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────────────┐
│                           ▼                                     │
│                    Domain Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Categorization│  │   Budget     │  │   Pattern    │        │
│  │    Engine     │  │ Evaluation   │  │  Detection   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Agent Framework                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │
│  │  │  BaseAgent │  │   Agent    │  │   Agent    │        │  │
│  │  │   Class    │  │  Registry  │  │  Executor  │        │  │
│  │  └────────────┘  └────────────┘  └────────────┘        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               Concrete Agents                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │    Budget    │  │     Smart    │  │   Insight    │  │  │
│  │  │  Monitoring  │  │Categorization│  │  Generation  │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │     Data     │  │  Recurring   │  │   Partner    │  │  │
│  │  │   Cleanup    │  │  Validation  │  │  Invitation  │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────────────┐
│                           ▼                                     │
│                  Infrastructure Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Scheduler  │  │   Event Bus  │  │ Notification │        │
│  │   (cron)     │  │  (EventEmitter)  Service      │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                  │
│  ┌──────┴─────────────────┴─────────────────┴───────┐         │
│  │              Agent Execution Queue                │         │
│  │          (Future: Bull/BullMQ for jobs)           │         │
│  └────────────────────────┬──────────────────────────┘         │
└───────────────────────────┼────────────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────────────┐
│                           ▼                                     │
│                    Data Layer                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Prisma ORM                            │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  SQLite Database                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │  │AgentConfig│  │AgentExec │  │AgentAction│             │  │
│  │  └──────────┘  └──────────┘  └──────────┘             │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

External Services:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Google     │  │    Bank      │  │    Email     │
│   Gemini     │  │   Scrapers   │  │   Service    │
│     AI       │  │  (Israeli)   │  │  (SendGrid)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Architecture Principles

1. **Domain-Driven Design**: Agents live in the domain layer, framework-agnostic
2. **Type Safety**: Full TypeScript with strict mode
3. **Separation of Concerns**: Agents, schedulers, and executors are decoupled
4. **Event-Driven**: Agents can trigger on events or schedules
5. **Extensibility**: Easy to add new agents via base class

---

## Database Schema

### Core Agent Tables

```prisma
// packages/db/prisma/schema.prisma

// Agent configuration per household
model AgentConfig {
  id                String   @id @default(cuid())
  householdId       String
  agentType         String   // e.g., "BudgetMonitoring"
  enabled           Boolean  @default(true)
  notificationLevel String   @default("all") // "all" | "important" | "none"
  autoApprove       Boolean  @default(false) // Auto-execute vs ask user
  schedule          String?  // Cron expression (if scheduled)
  metadata          Json?    // Agent-specific settings
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  household         Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  executions        AgentExecution[]
  actions           AgentAction[]

  @@unique([householdId, agentType])
  @@index([householdId])
  @@index([enabled])
}

// Tracks each agent execution
model AgentExecution {
  id              String   @id @default(cuid())
  agentConfigId   String
  householdId     String
  agentType       String
  status          String   // "running" | "completed" | "failed" | "cancelled"
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  durationMs      Int?     // Execution time in milliseconds
  actionsCount    Int      @default(0) // Number of actions taken
  successCount    Int      @default(0) // Number of successful actions
  failureCount    Int      @default(0) // Number of failed actions
  logs            Json[]   @default([]) // Array of log messages
  error           String?  // Error message if failed
  metadata        Json?    // Execution-specific data

  agentConfig     AgentConfig @relation(fields: [agentConfigId], references: [id], onDelete: Cascade)
  household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  actions         AgentAction[]

  @@index([householdId, agentType])
  @@index([status])
  @@index([startedAt])
  @@index([agentConfigId])
}

// Individual actions taken by agents (for audit & rollback)
model AgentAction {
  id              String   @id @default(cuid())
  executionId     String
  agentConfigId   String
  householdId     String
  actionType      String   // "create" | "update" | "delete" | "notify"
  resourceType    String   // "Transaction" | "Rule" | "Budget" | etc.
  resourceId      String?  // ID of affected resource
  previousState   Json?    // State before action (for rollback)
  newState        Json?    // State after action
  confidence      Float    // Confidence score (0-1)
  reasoning       String[] @default([]) // Why this action was taken
  userFeedback    String?  // "approved" | "rejected" | "modified" | null
  createdAt       DateTime @default(now())
  rolledBackAt    DateTime? // When action was undone
  metadata        Json?

  execution       AgentExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  agentConfig     AgentConfig @relation(fields: [agentConfigId], references: [id], onDelete: Cascade)
  household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([householdId])
  @@index([executionId])
  @@index([resourceType, resourceId])
  @@index([actionType])
  @@index([createdAt])
}

// Agent notifications/alerts to users
model AgentNotification {
  id              String   @id @default(cuid())
  householdId     String
  agentType       String
  actionId        String?  // Optional link to AgentAction
  title           String
  message         String
  level           String   // "info" | "warning" | "error" | "success"
  read            Boolean  @default(false)
  actionRequired  Boolean  @default(false) // Requires user response
  actionUrl       String?  // Link to take action
  createdAt       DateTime @default(now())
  readAt          DateTime?
  metadata        Json?

  household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([householdId, read])
  @@index([createdAt])
  @@index([actionRequired])
}

// Update Household model to include agent relations
model Household {
  // ... existing fields ...

  agentConfigs      AgentConfig[]
  agentExecutions   AgentExecution[]
  agentActions      AgentAction[]
  agentNotifications AgentNotification[]
}
```

### Migration Strategy

```typescript
// packages/db/scripts/create-agent-tables.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating agent tables...');

  // Create default agent configs for existing households
  const households = await prisma.household.findMany();

  for (const household of households) {
    // Create default configs for all agents
    await prisma.agentConfig.createMany({
      data: [
        {
          householdId: household.id,
          agentType: 'BudgetMonitoring',
          enabled: true,
          notificationLevel: 'important',
          autoApprove: false,
          schedule: '0 8 * * *', // Daily at 8 AM
        },
        {
          householdId: household.id,
          agentType: 'SmartCategorization',
          enabled: true,
          notificationLevel: 'none',
          autoApprove: true, // Auto-create rules
        },
        {
          householdId: household.id,
          agentType: 'InsightGeneration',
          enabled: true,
          notificationLevel: 'all',
          autoApprove: false,
          schedule: '0 0 1 * *', // Monthly on 1st
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log('Agent tables created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Agent Execution Lifecycle

### Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Agent Lifecycle                           │
└─────────────────────────────────────────────────────────────────┘

1. TRIGGER
   ├─ Schedule (cron) ──────────┐
   ├─ Event (transaction created)│
   └─ Manual (user request) ─────┤
                                 │
                                 ▼
2. PRE-EXECUTION CHECKS
   ├─ Is agent enabled? ─────────┐
   ├─ Has required permissions? ─┤
   ├─ Rate limit check ──────────┤
   └─ Resource availability ─────┤
                                 │
                   NO ◄──────────┤
                   │             │ YES
                   ▼             ▼
               [SKIP]      3. INITIALIZE
                           ├─ Create AgentExecution record
                           ├─ Load configuration
                           ├─ Set up logging
                           └─ Mark status = "running"
                                 │
                                 ▼
                           4. EXECUTE
                           ├─ Run agent logic
                           ├─ Make decisions (confidence scoring)
                           ├─ Create AgentAction records
                           └─ Log progress
                                 │
                      ┌──────────┴──────────┐
                      │                     │
                   SUCCESS               FAILURE
                      │                     │
                      ▼                     ▼
              5a. POST-EXECUTION     5b. ERROR HANDLING
              ├─ Update execution    ├─ Log error
              │  status = "completed"│  Update status = "failed"
              ├─ Record metrics      ├─ Increment failure count
              ├─ Send notifications  ├─ Check failure threshold
              └─ Clean up resources  └─ Disable if needed
                      │                     │
                      └──────────┬──────────┘
                                 │
                                 ▼
                           6. FINALIZE
                           ├─ Set completedAt timestamp
                           ├─ Calculate durationMs
                           ├─ Persist execution log
                           └─ Trigger post-execution hooks
                                 │
                                 ▼
                           7. NOTIFICATION
                           ├─ Send user notifications
                           ├─ Update dashboards
                           └─ Log to analytics
```

### Detailed Execution Code

```typescript
// packages/domain/src/agents/agent-executor.ts

import { BaseAgent } from './base-agent';
import { PrismaClient } from '@acme/db';

export class AgentExecutor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async execute(agent: BaseAgent): Promise<AgentExecutionResult> {
    // 1. Pre-execution checks
    const config = await this.getAgentConfig(agent.householdId, agent.type);

    if (!config.enabled) {
      return { success: false, skipped: true, reason: 'Agent disabled' };
    }

    if (!await this.checkRateLimit(agent)) {
      return { success: false, skipped: true, reason: 'Rate limit exceeded' };
    }

    // 2. Initialize execution
    const execution = await this.prisma.agentExecution.create({
      data: {
        agentConfigId: config.id,
        householdId: agent.householdId,
        agentType: agent.type,
        status: 'running',
        startedAt: new Date(),
      }
    });

    const executionContext = {
      executionId: execution.id,
      startTime: Date.now(),
      logs: [] as string[],
      actions: [] as AgentAction[],
    };

    try {
      // 3. Execute agent logic
      const result = await agent.run(executionContext);

      // 4. Post-execution success
      await this.handleSuccess(execution.id, result, executionContext);

      return { success: true, ...result };
    } catch (error) {
      // 5. Error handling
      await this.handleError(execution.id, error as Error, config);

      return {
        success: false,
        error: (error as Error).message,
        actionsCount: 0,
      };
    }
  }

  private async handleSuccess(
    executionId: string,
    result: AgentRunResult,
    context: ExecutionContext
  ): Promise<void> {
    const durationMs = Date.now() - context.startTime;

    // Update execution record
    await this.prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        actionsCount: result.actionsCount,
        successCount: result.successCount || result.actionsCount,
        failureCount: result.failureCount || 0,
        logs: context.logs,
      }
    });

    // Send notifications if configured
    if (result.notifications && result.notifications.length > 0) {
      await this.sendNotifications(result.notifications);
    }
  }

  private async handleError(
    executionId: string,
    error: Error,
    config: AgentConfig
  ): Promise<void> {
    await this.prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error.message,
        logs: [error.stack || error.message],
      }
    });

    // Check failure rate
    const recentFailures = await this.getRecentFailures(config.id);

    // Disable agent if 5+ failures in last hour
    if (recentFailures >= 5) {
      await this.prisma.agentConfig.update({
        where: { id: config.id },
        data: { enabled: false }
      });

      // Notify admin
      await this.notifyAdmin({
        subject: `Agent ${config.agentType} disabled due to failures`,
        body: `Agent has failed ${recentFailures} times in the last hour. Last error: ${error.message}`,
      });
    }
  }

  private async checkRateLimit(agent: BaseAgent): Promise<boolean> {
    const oneMinuteAgo = new Date(Date.now() - 60_000);

    const recentExecutions = await this.prisma.agentExecution.count({
      where: {
        agentType: agent.type,
        householdId: agent.householdId,
        startedAt: { gte: oneMinuteAgo },
      }
    });

    // Limit: 10 executions per minute per agent type
    return recentExecutions < 10;
  }

  private async getRecentFailures(configId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 3600_000);

    return await this.prisma.agentExecution.count({
      where: {
        agentConfigId: configId,
        status: 'failed',
        startedAt: { gte: oneHourAgo },
      }
    });
  }
}
```

---

## Agent Registry

The registry manages available agents and their metadata.

```typescript
// packages/domain/src/agents/agent-registry.ts

import { BaseAgent, AgentConfig } from './base-agent';
import { BudgetMonitoringAgent } from './budget-monitoring-agent';
import { SmartCategorizationAgent } from './smart-categorization-agent';
import { InsightGenerationAgent } from './insight-generation-agent';
import { DataCleanupAgent } from './data-cleanup-agent';
import { RecurringValidationAgent } from './recurring-validation-agent';

export interface AgentMetadata {
  type: string;
  name: string;
  description: string;
  category: 'monitoring' | 'automation' | 'insights' | 'maintenance';
  defaultSchedule?: string; // Cron expression
  defaultConfig: Partial<AgentConfig>;
  permissions: string[]; // Required permissions
  constructor: new (householdId: string, config: AgentConfig) => BaseAgent;
}

export class AgentRegistry {
  private static agents = new Map<string, AgentMetadata>();

  static {
    // Register all available agents
    this.register({
      type: 'BudgetMonitoring',
      name: 'Budget Monitoring',
      description: 'Monitor spending against budgets and alert on thresholds',
      category: 'monitoring',
      defaultSchedule: '0 8 * * *', // Daily at 8 AM
      defaultConfig: {
        enabled: true,
        notificationLevel: 'important',
        autoApprove: false,
        metadata: {
          thresholds: [0.8, 0.9, 1.0], // Alert at 80%, 90%, 100%
        }
      },
      permissions: ['read:budgets', 'read:transactions'],
      constructor: BudgetMonitoringAgent,
    });

    this.register({
      type: 'SmartCategorization',
      name: 'Smart Categorization Learning',
      description: 'Learn from corrections and auto-create categorization rules',
      category: 'automation',
      defaultConfig: {
        enabled: true,
        notificationLevel: 'none',
        autoApprove: true, // Auto-create rules
        metadata: {
          minCorrections: 3, // Need 3+ corrections to create rule
          minConfidence: 0.75,
        }
      },
      permissions: ['read:transactions', 'write:rules'],
      constructor: SmartCategorizationAgent,
    });

    this.register({
      type: 'InsightGeneration',
      name: 'Insight Generation',
      description: 'Generate monthly spending insights and recommendations',
      category: 'insights',
      defaultSchedule: '0 0 1 * *', // Monthly on 1st
      defaultConfig: {
        enabled: true,
        notificationLevel: 'all',
        autoApprove: false,
      },
      permissions: ['read:transactions', 'read:budgets', 'read:categories'],
      constructor: InsightGenerationAgent,
    });

    this.register({
      type: 'DataCleanup',
      name: 'Data Cleanup',
      description: 'Identify duplicate merchants and data inconsistencies',
      category: 'maintenance',
      defaultSchedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
      defaultConfig: {
        enabled: false, // Disabled by default
        notificationLevel: 'important',
        autoApprove: false,
        metadata: {
          similarityThreshold: 0.85, // 85% similarity = duplicate
        }
      },
      permissions: ['read:transactions', 'write:transactions'],
      constructor: DataCleanupAgent,
    });

    this.register({
      type: 'RecurringValidation',
      name: 'Recurring Transaction Validation',
      description: 'Validate recurring transactions and detect anomalies',
      category: 'monitoring',
      defaultSchedule: '0 9 * * *', // Daily at 9 AM
      defaultConfig: {
        enabled: true,
        notificationLevel: 'important',
        autoApprove: false,
        metadata: {
          daysTolerance: 3, // Alert if recurring tx is 3+ days late
        }
      },
      permissions: ['read:recurring', 'read:transactions'],
      constructor: RecurringValidationAgent,
    });
  }

  static register(metadata: AgentMetadata): void {
    this.agents.set(metadata.type, metadata);
  }

  static get(type: string): AgentMetadata | undefined {
    return this.agents.get(type);
  }

  static getAll(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  static getByCategory(category: AgentMetadata['category']): AgentMetadata[] {
    return this.getAll().filter(agent => agent.category === category);
  }

  static createAgent(
    type: string,
    householdId: string,
    config: AgentConfig
  ): BaseAgent | null {
    const metadata = this.get(type);
    if (!metadata) return null;

    return new metadata.constructor(householdId, config);
  }
}
```

### Using the Registry

```typescript
// Example: Get all monitoring agents
const monitoringAgents = AgentRegistry.getByCategory('monitoring');

// Example: Create an agent instance
const metadata = AgentRegistry.get('BudgetMonitoring');
const agent = new metadata.constructor(householdId, config);

// Or use helper
const agent = AgentRegistry.createAgent('BudgetMonitoring', householdId, config);
```

---

## Scheduler Architecture

### Scheduler Implementation

```typescript
// packages/web/src/lib/agent-scheduler.ts

import cron from 'node-cron';
import { PrismaClient } from '@acme/db';
import { AgentRegistry } from '@acme/domain/agents/agent-registry';
import { AgentExecutor } from '@acme/domain/agents/agent-executor';

export class AgentScheduler {
  private prisma: PrismaClient;
  private executor: AgentExecutor;
  private scheduledJobs = new Map<string, cron.ScheduledTask>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.executor = new AgentExecutor(prisma);
  }

  /**
   * Initialize scheduler and register all agent schedules
   */
  async init(): Promise<void> {
    console.log('[AgentScheduler] Initializing...');

    // Get all enabled agent configs with schedules
    const configs = await this.prisma.agentConfig.findMany({
      where: {
        enabled: true,
        schedule: { not: null },
      },
      include: {
        household: true,
      }
    });

    console.log(`[AgentScheduler] Found ${configs.length} scheduled agents`);

    // Register each agent schedule
    for (const config of configs) {
      this.scheduleAgent(config);
    }

    // Health check job - runs every 5 minutes
    this.scheduleHealthCheck();
  }

  /**
   * Schedule a specific agent
   */
  private scheduleAgent(config: AgentConfig & { household: Household }): void {
    if (!config.schedule) return;

    const jobKey = `${config.householdId}:${config.agentType}`;

    // Cancel existing job if any
    this.cancelJob(jobKey);

    // Create cron job
    const job = cron.schedule(config.schedule, async () => {
      console.log(`[AgentScheduler] Executing ${config.agentType} for household ${config.householdId}`);

      const agent = AgentRegistry.createAgent(
        config.agentType,
        config.householdId,
        config
      );

      if (agent) {
        await this.executor.execute(agent);
      }
    }, {
      timezone: 'Asia/Jerusalem',
    });

    this.scheduledJobs.set(jobKey, job);
    console.log(`[AgentScheduler] Scheduled ${jobKey} with cron: ${config.schedule}`);
  }

  /**
   * Cancel a scheduled job
   */
  private cancelJob(jobKey: string): void {
    const existingJob = this.scheduledJobs.get(jobKey);
    if (existingJob) {
      existingJob.stop();
      this.scheduledJobs.delete(jobKey);
    }
  }

  /**
   * Update agent schedule (call when config changes)
   */
  async updateSchedule(householdId: string, agentType: string): Promise<void> {
    const config = await this.prisma.agentConfig.findUnique({
      where: {
        householdId_agentType: { householdId, agentType }
      },
      include: { household: true }
    });

    if (config && config.enabled && config.schedule) {
      this.scheduleAgent(config);
    } else {
      this.cancelJob(`${householdId}:${agentType}`);
    }
  }

  /**
   * Health check job
   */
  private scheduleHealthCheck(): void {
    cron.schedule('*/5 * * * *', async () => {
      const now = new Date();
      const activeCount = this.scheduledJobs.size;

      console.log(`[AgentScheduler] Health check: ${activeCount} active jobs at ${now.toISOString()}`);

      // Check for stuck executions (running > 30 minutes)
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const stuckExecutions = await this.prisma.agentExecution.findMany({
        where: {
          status: 'running',
          startedAt: { lt: thirtyMinutesAgo },
        }
      });

      if (stuckExecutions.length > 0) {
        console.warn(`[AgentScheduler] Found ${stuckExecutions.length} stuck executions`);

        // Mark as failed
        await this.prisma.agentExecution.updateMany({
          where: {
            id: { in: stuckExecutions.map(e => e.id) }
          },
          data: {
            status: 'failed',
            error: 'Execution timeout (>30 minutes)',
            completedAt: now,
          }
        });
      }
    });
  }

  /**
   * Shutdown scheduler
   */
  shutdown(): void {
    console.log('[AgentScheduler] Shutting down...');
    for (const [jobKey, job] of this.scheduledJobs.entries()) {
      job.stop();
      console.log(`[AgentScheduler] Stopped job: ${jobKey}`);
    }
    this.scheduledJobs.clear();
  }
}

// Singleton instance
let schedulerInstance: AgentScheduler | null = null;

export function initAgentScheduler(prisma: PrismaClient): void {
  if (schedulerInstance) {
    console.warn('[AgentScheduler] Already initialized');
    return;
  }

  schedulerInstance = new AgentScheduler(prisma);
  schedulerInstance.init();

  // Graceful shutdown
  process.on('SIGINT', () => {
    schedulerInstance?.shutdown();
    process.exit(0);
  });
}

export function getAgentScheduler(): AgentScheduler | null {
  return schedulerInstance;
}
```

### Integration with Existing Scheduler

```typescript
// packages/web/src/lib/scheduler.ts (update existing file)

import { initAgentScheduler } from './agent-scheduler';

export function initScheduler() {
  console.log('[Scheduler] Initializing...');

  // Existing bank sync jobs
  cron.schedule('0 6,18 * * *', syncAllConnections, {
    timezone: 'Asia/Jerusalem'
  });

  // NEW: Initialize agent scheduler
  initAgentScheduler(prisma);

  console.log('[Scheduler] All jobs initialized');
}
```

---

## Event-Driven Triggers

Some agents should trigger on events rather than schedules.

### Event Emitter Setup

```typescript
// packages/domain/src/agents/event-bus.ts

import { EventEmitter } from 'events';

export type AgentEvent =
  | { type: 'transaction.created'; payload: { transactionId: string; householdId: string } }
  | { type: 'transaction.categorized'; payload: { transactionId: string; categoryId: string; manual: boolean } }
  | { type: 'budget.exceeded'; payload: { budgetId: string; householdId: string } }
  | { type: 'pattern.detected'; payload: { patternId: string; householdId: string } }
  | { type: 'sync.completed'; payload: { syncJobId: string; householdId: string } };

class AgentEventBus extends EventEmitter {
  emit<T extends AgentEvent>(event: T['type'], payload: T['payload']): boolean {
    console.log(`[AgentEventBus] Event: ${event}`, payload);
    return super.emit(event, payload);
  }

  on<T extends AgentEvent>(
    event: T['type'],
    listener: (payload: T['payload']) => void | Promise<void>
  ): this {
    return super.on(event, listener);
  }
}

export const agentEventBus = new AgentEventBus();
```

### Event-Triggered Agent

```typescript
// packages/domain/src/agents/smart-categorization-agent.ts

import { BaseAgent, AgentExecutionResult } from './base-agent';
import { agentEventBus } from './event-bus';

export class SmartCategorizationAgent extends BaseAgent {
  get type() {
    return 'SmartCategorization';
  }

  /**
   * Called by scheduler (if scheduled) or by event listener
   */
  async run(): Promise<AgentExecutionResult> {
    // Check for recent manual categorizations
    const recentCorrections = await this.getRecentCorrections();

    const logs: string[] = [];
    let actionsCount = 0;

    // Analyze patterns in corrections
    const patterns = this.analyzeCorrections(recentCorrections);

    for (const pattern of patterns) {
      if (pattern.confidence >= 0.75 && pattern.count >= 3) {
        // Create categorization rule
        await this.createRule(pattern);
        actionsCount++;
        logs.push(`Created rule: ${pattern.merchantName} → ${pattern.categoryName}`);

        // Notify user
        await this.notify(
          `Auto-created categorization rule for "${pattern.merchantName}"`,
          'info'
        );
      }
    }

    return { success: true, actionsCount, logs };
  }

  /**
   * Listen for transaction categorization events
   */
  static initializeEventListener(prisma: PrismaClient): void {
    agentEventBus.on('transaction.categorized', async (payload) => {
      if (!payload.manual) return; // Only care about manual categorizations

      // Get household's agent config
      const transaction = await prisma.transaction.findUnique({
        where: { id: payload.transactionId },
        include: { household: true }
      });

      if (!transaction) return;

      const config = await prisma.agentConfig.findUnique({
        where: {
          householdId_agentType: {
            householdId: transaction.householdId,
            agentType: 'SmartCategorization'
          }
        }
      });

      if (!config?.enabled) return;

      // Execute agent
      const agent = new SmartCategorizationAgent(transaction.householdId, config);
      const executor = new AgentExecutor(prisma);
      await executor.execute(agent);
    });
  }
}
```

### Emitting Events from tRPC Mutations

```typescript
// packages/api/src/routers/transactions.ts

import { agentEventBus } from '@acme/domain/agents/event-bus';

export const transactionsRouter = createTRPCRouter({
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.string(),
      categoryId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.transaction.update({
        where: { id: input.id },
        data: { categoryId: input.categoryId }
      });

      // Emit event for agents
      agentEventBus.emit('transaction.categorized', {
        transactionId: updated.id,
        categoryId: updated.categoryId,
        manual: true, // User manually categorized
      });

      return updated;
    }),
});
```

---

## Notification System

### Multi-Channel Notifications

```typescript
// packages/domain/src/agents/notification-service.ts

export interface Notification {
  householdId: string;
  agentType: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  actionRequired?: boolean;
  actionUrl?: string;
  channels: ('in-app' | 'email' | 'push')[];
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async send(notification: Notification): Promise<void> {
    // 1. Create in-app notification (always)
    await this.prisma.agentNotification.create({
      data: {
        householdId: notification.householdId,
        agentType: notification.agentType,
        title: notification.title,
        message: notification.message,
        level: notification.level,
        actionRequired: notification.actionRequired || false,
        actionUrl: notification.actionUrl,
      }
    });

    // 2. Send email if requested
    if (notification.channels.includes('email')) {
      await this.sendEmail(notification);
    }

    // 3. Send push notification if requested
    if (notification.channels.includes('push')) {
      await this.sendPush(notification);
    }
  }

  private async sendEmail(notification: Notification): Promise<void> {
    // Get household users
    const household = await this.prisma.household.findUnique({
      where: { id: notification.householdId },
      include: {
        owner: true,
        partner: true,
      }
    });

    if (!household) return;

    const recipients = [household.owner.email];
    if (household.partner?.email) {
      recipients.push(household.partner.email);
    }

    // Send via email service (SendGrid, etc.)
    // await sendEmail({
    //   to: recipients,
    //   subject: `[Sharristh Budget] ${notification.title}`,
    //   body: notification.message,
    // });
  }

  private async sendPush(notification: Notification): Promise<void> {
    // Send push notification to mobile app
    // Implementation depends on push service (Firebase, OneSignal, etc.)
  }
}
```

---

## Performance & Scalability

### Performance Considerations

1. **Batch Processing**: Process multiple items in batches
2. **Database Indexing**: Ensure indexes on frequently queried fields
3. **Caching**: Cache agent configs and execution results
4. **Async Execution**: Run agents asynchronously to avoid blocking
5. **Resource Limits**: Set timeouts and memory limits

### Optimization Strategies

```typescript
// Example: Batch processing with rate limiting

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: {
    batchSize: number;
    delayMs: number;
  }
): Promise<void> {
  const batches = chunk(items, options.batchSize);

  for (const batch of batches) {
    await Promise.all(batch.map(processor));
    await sleep(options.delayMs);
  }
}

// Usage in agent
async run(): Promise<AgentExecutionResult> {
  const transactions = await this.getTransactions();

  await processBatch(
    transactions,
    async (tx) => await this.categorize(tx),
    { batchSize: 50, delayMs: 100 } // 50 at a time, 100ms delay
  );
}
```

### Database Query Optimization

```typescript
// BAD: N+1 query problem
for (const budget of budgets) {
  const transactions = await prisma.transaction.findMany({
    where: { categoryId: budget.categoryId }
  });
  // Process transactions
}

// GOOD: Batch query with includes
const budgets = await prisma.budget.findMany({
  where: { month: currentMonth },
  include: {
    category: {
      include: {
        transactions: {
          where: { date: { gte: startOfMonth, lte: endOfMonth } }
        }
      }
    }
  }
});

// Process all at once
for (const budget of budgets) {
  const transactions = budget.category.transactions;
  // Process transactions
}
```

### Future: Job Queue Integration

For production scale, consider using a job queue:

```typescript
// packages/domain/src/agents/job-queue.ts (future)

import { Queue, Worker } from 'bullmq';

const agentQueue = new Queue('agents', {
  connection: {
    host: process.env.REDIS_HOST,
    port: 6379,
  }
});

// Add job to queue
export async function scheduleAgentExecution(
  agentType: string,
  householdId: string,
  config: AgentConfig
): Promise<void> {
  await agentQueue.add('execute', {
    agentType,
    householdId,
    config,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

// Worker processes jobs
const worker = new Worker('agents', async (job) => {
  const { agentType, householdId, config } = job.data;

  const agent = AgentRegistry.createAgent(agentType, householdId, config);
  const executor = new AgentExecutor(prisma);

  return await executor.execute(agent);
});
```

---

## Security Architecture

### Principle of Least Privilege

```typescript
export interface AgentPermission {
  resource: string; // 'transactions' | 'budgets' | 'rules' | etc.
  action: 'read' | 'write' | 'delete';
}

export class PermissionChecker {
  static async check(
    agent: BaseAgent,
    permission: AgentPermission
  ): Promise<boolean> {
    const metadata = AgentRegistry.get(agent.type);
    if (!metadata) return false;

    const requiredPermission = `${permission.action}:${permission.resource}`;
    return metadata.permissions.includes(requiredPermission);
  }

  static async enforce(
    agent: BaseAgent,
    permission: AgentPermission
  ): Promise<void> {
    const hasPermission = await this.check(agent, permission);

    if (!hasPermission) {
      throw new Error(
        `Agent ${agent.type} lacks permission: ${permission.action}:${permission.resource}`
      );
    }
  }
}

// Usage in agent
async createRule(pattern: Pattern): Promise<void> {
  await PermissionChecker.enforce(this, {
    resource: 'rules',
    action: 'write'
  });

  // Now safe to create rule
  await this.prisma.categorizationRule.create({ /* ... */ });
}
```

### Data Isolation

```typescript
// Ensure agents can only access their household's data

class BaseAgent {
  protected async getTransactions(): Promise<Transaction[]> {
    return await this.prisma.transaction.findMany({
      where: {
        householdId: this.householdId, // ALWAYS filter by household
      }
    });
  }

  protected async getBudgets(): Promise<Budget[]> {
    return await this.prisma.budget.findMany({
      where: {
        householdId: this.householdId,
      }
    });
  }
}
```

---

## Monitoring & Observability

### Metrics Dashboard

Track key agent metrics:

```typescript
// packages/api/src/routers/agents.ts

export const agentsRouter = createTRPCRouter({
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all agent types for household
    const configs = await ctx.db.agentConfig.findMany({
      where: { householdId: ctx.household.id }
    });

    const metrics = await Promise.all(
      configs.map(async (config) => {
        const [total, succeeded, failed, last24h, avgDuration] = await Promise.all([
          // Total executions (last 7 days)
          ctx.db.agentExecution.count({
            where: {
              agentConfigId: config.id,
              startedAt: { gte: last7Days }
            }
          }),

          // Successful executions
          ctx.db.agentExecution.count({
            where: {
              agentConfigId: config.id,
              status: 'completed',
              startedAt: { gte: last7Days }
            }
          }),

          // Failed executions
          ctx.db.agentExecution.count({
            where: {
              agentConfigId: config.id,
              status: 'failed',
              startedAt: { gte: last7Days }
            }
          }),

          // Last 24h count
          ctx.db.agentExecution.count({
            where: {
              agentConfigId: config.id,
              startedAt: { gte: last24Hours }
            }
          }),

          // Average duration
          ctx.db.agentExecution.aggregate({
            where: {
              agentConfigId: config.id,
              durationMs: { not: null },
              startedAt: { gte: last7Days }
            },
            _avg: { durationMs: true }
          }),
        ]);

        return {
          agentType: config.agentType,
          enabled: config.enabled,
          total,
          succeeded,
          failed,
          successRate: total > 0 ? succeeded / total : 0,
          last24h,
          avgDurationMs: avgDuration._avg.durationMs || 0,
        };
      })
    );

    return metrics;
  }),
});
```

### Logging Best Practices

```typescript
class BaseAgent {
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.type}] ${message}`;

    console.log(logMessage);

    // Also add to execution context for persistence
    if (this.executionContext) {
      this.executionContext.logs.push(logMessage);
    }
  }

  async run(context: ExecutionContext): Promise<AgentExecutionResult> {
    this.executionContext = context;

    this.log('Agent execution started');

    try {
      // Agent logic
      this.log('Processing 150 transactions');
      // ...

      this.log('Agent execution completed successfully');
    } catch (error) {
      this.log(`Agent execution failed: ${error.message}`, 'error');
      throw error;
    }
  }
}
```

---

## Conclusion

This architecture provides a robust foundation for building autonomous agents in Sharristh Budget:

- **Extensible**: Easy to add new agents via `BaseAgent` class
- **Observable**: Full execution tracking and metrics
- **Secure**: Permission-based access control and data isolation
- **Scalable**: Batch processing, rate limiting, and queue support
- **Reliable**: Error handling, health checks, and auto-disable on failures

**Implementation Roadmap**:

1. ✅ Add database schema (Prisma migrations)
2. ✅ Implement base agent framework
3. ✅ Set up scheduler and event bus
4. ✅ Create agent registry
5. Build concrete agents (start with BudgetMonitoring)
6. Add UI for agent configuration
7. Implement notification system
8. Set up monitoring dashboard
9. Add tests (unit + integration)
10. Deploy and gather user feedback

For user-facing documentation, see [AGENTS.md](./AGENTS.md).
