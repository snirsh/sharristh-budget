# Agents Documentation

## Overview

This document describes the autonomous agent architecture for Sharristh Budget, a household budget tracking application. Agents are background processes that autonomously perform tasks, make decisions, and improve the user experience without constant user intervention.

## Table of Contents

- [What Are Agents?](#what-are-agents)
- [Existing Agent Patterns](#existing-agent-patterns)
- [Proposed Future Agents](#proposed-future-agents)
- [Agent Design Principles](#agent-design-principles)
- [Implementation Guide](#implementation-guide)
- [Testing Agents](#testing-agents)

---

## What Are Agents?

In Sharristh Budget, **agents** are autonomous services that:

1. **Run in the background** - Execute without direct user interaction
2. **Make decisions** - Use confidence scoring and rules to determine actions
3. **Learn patterns** - Analyze historical data to improve accuracy
4. **Provide insights** - Surface actionable information to users
5. **Maintain state** - Track progress and results of their work

### Agent vs. Service

| Aspect | Service | Agent |
|--------|---------|-------|
| **Trigger** | User-initiated | Schedule or event-based |
| **Decision-making** | Deterministic | Autonomous with confidence scoring |
| **Persistence** | Stateless | Tracks execution history |
| **User interaction** | Synchronous | Asynchronous with notifications |

---

## Existing Agent Patterns

The codebase already contains several agent-like implementations:

### 1. **Bank Sync Agent**

**Location**: `packages/web/src/lib/scheduler.ts`

**Behavior**:
- Runs twice daily (6 AM & 6 PM Israel time)
- Syncs transactions from all active bank connections
- Creates `SyncJob` records to track execution
- Handles stale connections on startup

**Key Code**:
```typescript
export function initScheduler() {
  // Sync all connections twice daily
  cron.schedule('0 6,18 * * *', syncAllConnections, {
    timezone: 'Asia/Jerusalem'
  });
}
```

**Agent Characteristics**:
- ✅ Autonomous scheduling
- ✅ State tracking (SyncJob)
- ✅ Error handling and retries
- ✅ Multi-connection orchestration

### 2. **AI Categorization Agent**

**Location**: `packages/domain/src/ai-categorization.ts`

**Behavior**:
- Uses Google Gemini 2.0 to categorize transactions
- Returns confidence scores (0-100)
- Auto-creates categorization rules when confidence ≥75%
- Graceful fallback on AI errors

**Key Code**:
```typescript
export async function suggestCategoryWithAI(
  transaction: Transaction,
  categories: Category[]
): Promise<AISuggestion> {
  // Gemini API call with timeout
  // Returns { categoryId, confidence, reasoning }
}
```

**Agent Characteristics**:
- ✅ ML-powered decision making
- ✅ Confidence-based actions
- ✅ Self-improving (creates rules)
- ✅ Timeout handling

### 3. **Pattern Detection Agent**

**Location**: `packages/domain/src/pattern-detection.ts`

**Behavior**:
- Analyzes transaction history to detect recurring patterns
- Identifies subscriptions, bills, salaries
- Suggests creating recurring transaction templates
- Uses confidence scoring for reliability

**Key Code**:
```typescript
export function detectRecurringPatterns(
  transactions: Transaction[]
): TransactionPattern[] {
  // Groups by merchant, analyzes frequency
  // Returns patterns with confidence scores
}
```

**Agent Characteristics**:
- ✅ Historical data analysis
- ✅ Pattern recognition
- ✅ Proactive suggestions
- ✅ Confidence scoring

### 4. **Rule-Based Categorization Engine**

**Location**: `packages/domain/src/categorization.ts`

**Behavior**:
- Multi-stage prioritization pipeline
- Applies merchant, keyword, and regex rules
- Falls back through confidence levels
- Can auto-create rules from user behavior

**Stage Priority**:
1. Manual override → confidence 1.0
2. Merchant rules → 0.95
3. Keyword rules → 0.80
4. Regex rules → 0.75
5. AI suggestions → ~0.85
6. Fallback category → 0.50

**Agent Characteristics**:
- ✅ Multi-stage decision making
- ✅ Priority-based execution
- ✅ Learning from user corrections
- ✅ Confidence scoring

---

## Proposed Future Agents

### 1. **Budget Monitoring Agent**

**Purpose**: Proactively monitor spending and alert users to budget issues

**Capabilities**:
- Track spending against planned budgets in real-time
- Detect unusual spending patterns
- Alert users when approaching or exceeding limits
- Suggest budget adjustments based on historical trends

**Implementation Priority**: HIGH

**Example Scenario**:
```
User: *Makes 3rd restaurant transaction this week*
Agent: "Notice: Restaurant spending at 80% of monthly budget (18 days remaining)"
Agent: *Sends push notification*
```

**Technical Requirements**:
- WebSocket or Server-Sent Events for real-time updates
- Push notification integration (web + mobile)
- Configurable alert thresholds per category
- Historical trend analysis

### 2. **Smart Categorization Learning Agent**

**Purpose**: Continuously improve categorization accuracy by learning from user corrections

**Capabilities**:
- Detect when users manually recategorize transactions
- Identify patterns in corrections (e.g., "Netflix" → Entertainment)
- Auto-create or update categorization rules
- A/B test rule effectiveness
- Archive low-confidence or unused rules

**Implementation Priority**: MEDIUM

**Example Scenario**:
```
User: *Recategorizes 3 "Coffee Shop X" transactions from "Food" → "Coffee"*
Agent: *Auto-creates merchant rule: "Coffee Shop X" → "Coffee"*
Agent: "I've created a rule for Coffee Shop X. Future transactions will be categorized as Coffee."
```

**Technical Requirements**:
- User correction event tracking
- Rule creation confidence thresholds
- Rule effectiveness scoring (acceptance rate)
- Periodic rule cleanup (archive unused rules)

### 3. **Partner Invitation Management Agent**

**Purpose**: Manage household partner invitations and reminders

**Capabilities**:
- Send reminder emails for pending invitations
- Auto-expire old invitations after 7 days
- Notify users when invitations are accepted/rejected
- Suggest re-inviting partners who haven't joined

**Implementation Priority**: LOW

**Example Scenario**:
```
User: *Sends partner invite*
Agent: *Waits 3 days*
Agent: *Sends reminder email to partner*
Agent: *After 7 days, marks invitation as expired*
Agent: "Your partner invitation to alex@example.com expired. Would you like to send a new one?"
```

**Technical Requirements**:
- Email service integration
- Invitation state machine
- Scheduled reminder jobs
- Expiration handling

### 4. **Data Cleanup Agent**

**Purpose**: Maintain data quality by identifying and resolving inconsistencies

**Capabilities**:
- Detect duplicate merchants with similar names
- Suggest merchant consolidation ("Netflix Inc" vs "Netflix")
- Identify orphaned or unused categories
- Flag suspicious transactions (e.g., very high amounts)
- Archive old demo data

**Implementation Priority**: MEDIUM

**Example Scenario**:
```
Agent: *Analyzes merchant names*
Agent: "Found 3 similar merchants: 'Starbucks', 'Starbucks Coffee', 'STARBUCKS'. Consolidate?"
User: *Approves consolidation*
Agent: *Merges merchants, updates transactions*
```

**Technical Requirements**:
- Fuzzy string matching (Levenshtein distance)
- Merchant normalization
- Batch transaction updates
- Rollback capability for undo

### 5. **Insight Generation Agent**

**Purpose**: Proactively surface financial insights and recommendations

**Capabilities**:
- Monthly spending summaries ("You spent 15% less on groceries this month")
- Category trend analysis ("Coffee spending increased 40% vs last quarter")
- Savings opportunities ("You could save ₪200/month by reducing subscriptions")
- Anomaly detection ("Unusual ₪500 charge in 'Transportation'")
- Year-over-year comparisons

**Implementation Priority**: HIGH

**Example Scenario**:
```
Agent: *Runs end-of-month analysis*
Agent: "Monthly Insight: You spent ₪2,400 on groceries (↓12% vs last month). Great job staying under budget!"
Agent: "Opportunity: 3 unused subscriptions detected (Netflix, Spotify, Gym). Consider canceling to save ₪150/month."
```

**Technical Requirements**:
- Statistical analysis functions
- Insight scoring (relevance)
- Natural language generation
- Dashboard widget integration

### 6. **Recurring Transaction Validation Agent**

**Purpose**: Ensure recurring transactions are executing as expected

**Capabilities**:
- Detect missed recurring transactions (e.g., salary not received)
- Alert on amount changes (e.g., rent increased)
- Suggest updating recurring templates based on actual transactions
- Identify one-time transactions that should be recurring

**Implementation Priority**: MEDIUM

**Example Scenario**:
```
Agent: *Detects no "Salary" transaction by 5th of month*
Agent: "Alert: Expected recurring salary transaction not found. Transaction delayed?"
---
Agent: *Detects rent amount changed from ₪4,000 → ₪4,200*
Agent: "Notice: Rent amount increased by ₪200. Update recurring template?"
```

**Technical Requirements**:
- Recurring schedule validation
- Amount change detection (tolerance thresholds)
- Template suggestion engine
- Alert scheduling

---

## Agent Design Principles

### 1. **Autonomy with Oversight**

Agents should operate independently but allow user control:

```typescript
interface AgentConfig {
  enabled: boolean;           // User can disable agent
  notificationLevel: 'all' | 'important' | 'none';
  autoApprove: boolean;       // Auto-apply suggestions vs ask first
  schedule?: CronExpression;  // When agent runs
}
```

### 2. **Confidence-Based Decision Making**

Every agent decision should have a confidence score:

```typescript
interface AgentDecision {
  action: string;
  confidence: number;         // 0-1 (0% to 100%)
  reasoning: string;          // Explain why
  suggestedAction?: string;   // What should happen
  requiresApproval: boolean;  // confidence < 0.75
}
```

**Confidence Thresholds**:
- **≥0.90**: Auto-execute (high confidence)
- **0.75-0.89**: Execute with notification
- **0.50-0.74**: Suggest to user for approval
- **<0.50**: Do not suggest (too uncertain)

### 3. **Transparency and Explainability**

Users should understand why agents made decisions:

```typescript
interface AgentExecution {
  id: string;
  agentType: string;
  timestamp: Date;
  action: string;
  reasoning: string[];        // Step-by-step explanation
  dataUsed: Record<string, any>; // Input data
  outcome: 'success' | 'failed' | 'pending';
  userFeedback?: 'approved' | 'rejected' | 'modified';
}
```

**Example Log**:
```json
{
  "agentType": "SmartCategorization",
  "action": "Created merchant rule: Netflix → Entertainment",
  "reasoning": [
    "User manually recategorized 3 Netflix transactions",
    "All corrections were to 'Entertainment' category",
    "Confidence: 0.95 (high agreement)"
  ],
  "userFeedback": "approved"
}
```

### 4. **State Persistence**

Agents must track execution history:

```prisma
model AgentExecution {
  id            String   @id @default(cuid())
  agentType     String   // e.g., "BudgetMonitoring"
  householdId   String
  status        String   // "running" | "completed" | "failed"
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  actionsCount  Int      @default(0)
  successCount  Int      @default(0)
  failureCount  Int      @default(0)
  metadata      Json?    // Agent-specific data
  logs          Json[]   // Execution logs

  household     Household @relation(fields: [householdId], references: [id])

  @@index([householdId, agentType])
  @@index([startedAt])
}
```

### 5. **Graceful Degradation**

Agents should handle failures without breaking the app:

```typescript
class BaseAgent {
  async execute() {
    try {
      await this.run();
    } catch (error) {
      await this.handleError(error);
      // Don't throw - log and continue
    }
  }

  async handleError(error: Error) {
    await logAgentError({
      agentType: this.type,
      error: error.message,
      stack: error.stack
    });

    // Disable agent if repeated failures
    if (await this.getRecentFailureCount() > 5) {
      await this.disable();
      await notifyAdmin('Agent disabled due to repeated failures');
    }
  }
}
```

### 6. **Performance Optimization**

Agents should not impact user-facing performance:

- Run during off-peak hours (configurable)
- Use database indexes for queries
- Batch operations when possible
- Implement rate limiting
- Use job queues for long-running tasks

```typescript
// Example: Rate-limited batch processing
async function processTransactions(transactions: Transaction[]) {
  const batches = chunk(transactions, 100); // Process 100 at a time

  for (const batch of batches) {
    await processBatch(batch);
    await sleep(1000); // Rate limit: 1 batch/second
  }
}
```

---

## Implementation Guide

### Step 1: Define Agent Interface

All agents should implement a common interface:

```typescript
// packages/domain/src/agents/base-agent.ts

export interface AgentConfig {
  enabled: boolean;
  schedule?: string; // Cron expression
  notificationLevel: 'all' | 'important' | 'none';
  autoApprove: boolean;
  metadata?: Record<string, any>;
}

export interface AgentExecutionResult {
  success: boolean;
  actionsCount: number;
  logs: string[];
  errors?: string[];
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected householdId: string;

  constructor(householdId: string, config: AgentConfig) {
    this.householdId = householdId;
    this.config = config;
  }

  abstract get type(): string;
  abstract run(): Promise<AgentExecutionResult>;

  async execute(): Promise<AgentExecutionResult> {
    if (!this.config.enabled) {
      return { success: false, actionsCount: 0, logs: ['Agent disabled'] };
    }

    const startedAt = new Date();

    try {
      const result = await this.run();
      await this.logExecution(startedAt, result);
      return result;
    } catch (error) {
      const errorResult = await this.handleError(error as Error);
      await this.logExecution(startedAt, errorResult);
      return errorResult;
    }
  }

  protected async logExecution(
    startedAt: Date,
    result: AgentExecutionResult
  ): Promise<void> {
    // Log to database (AgentExecution model)
  }

  protected async handleError(error: Error): Promise<AgentExecutionResult> {
    return {
      success: false,
      actionsCount: 0,
      logs: [],
      errors: [error.message]
    };
  }

  protected async notify(message: string, level: 'info' | 'warning' | 'error'): Promise<void> {
    if (this.config.notificationLevel === 'none') return;
    if (this.config.notificationLevel === 'important' && level === 'info') return;

    // Send notification (email, push, etc.)
  }
}
```

### Step 2: Implement Specific Agent

```typescript
// packages/domain/src/agents/budget-monitoring-agent.ts

import { BaseAgent, AgentExecutionResult } from './base-agent';
import { calculateBudgetStatus } from '../budget';

export class BudgetMonitoringAgent extends BaseAgent {
  get type() {
    return 'BudgetMonitoring';
  }

  async run(): Promise<AgentExecutionResult> {
    const logs: string[] = [];
    let actionsCount = 0;

    // 1. Get current month budgets
    const budgets = await this.getBudgets();
    logs.push(`Found ${budgets.length} budgets to monitor`);

    // 2. Check each budget status
    for (const budget of budgets) {
      const status = await calculateBudgetStatus(budget);

      // 3. Alert if over threshold
      if (status.percentageUsed >= 80) {
        await this.notify(
          `Warning: ${budget.category.name} at ${status.percentageUsed}% of budget`,
          status.percentageUsed >= 100 ? 'error' : 'warning'
        );
        actionsCount++;
        logs.push(`Sent alert for ${budget.category.name}`);
      }
    }

    return { success: true, actionsCount, logs };
  }

  private async getBudgets() {
    // Fetch budgets for household
  }
}
```

### Step 3: Register Agent with Scheduler

```typescript
// packages/web/src/lib/scheduler.ts

import { BudgetMonitoringAgent } from '@acme/domain/agents/budget-monitoring-agent';

export function initScheduler() {
  // Existing bank sync...

  // Budget monitoring - runs daily at 8 AM
  cron.schedule('0 8 * * *', async () => {
    const households = await getActiveHouseholds();

    for (const household of households) {
      const config = await getAgentConfig(household.id, 'BudgetMonitoring');
      const agent = new BudgetMonitoringAgent(household.id, config);
      await agent.execute();
    }
  }, { timezone: 'Asia/Jerusalem' });
}
```

### Step 4: Add Agent Configuration UI

```typescript
// apps/web/src/app/settings/agents/page.tsx

export default function AgentsSettingsPage() {
  return (
    <div>
      <h1>Agent Settings</h1>

      <AgentConfigCard
        name="Budget Monitoring"
        description="Get alerts when approaching budget limits"
        enabled={config.budgetMonitoring.enabled}
        schedule="Daily at 8 AM"
        onToggle={(enabled) => updateConfig('budgetMonitoring', { enabled })}
      />

      <AgentConfigCard
        name="Smart Categorization Learning"
        description="Automatically improve categorization based on your corrections"
        enabled={config.smartCategorization.enabled}
        autoApprove={config.smartCategorization.autoApprove}
        onToggle={(enabled) => updateConfig('smartCategorization', { enabled })}
      />
    </div>
  );
}
```

### Step 5: Add tRPC Router for Agent Management

```typescript
// packages/api/src/routers/agents.ts

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const agentsRouter = createTRPCRouter({
  getConfigs: protectedProcedure.query(async ({ ctx }) => {
    // Return all agent configs for household
  }),

  updateConfig: protectedProcedure
    .input(z.object({
      agentType: z.string(),
      config: z.object({
        enabled: z.boolean(),
        notificationLevel: z.enum(['all', 'important', 'none']),
        autoApprove: z.boolean().optional(),
      })
    }))
    .mutation(async ({ ctx, input }) => {
      // Update agent config
    }),

  getExecutions: protectedProcedure
    .input(z.object({
      agentType: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Return execution history
    }),

  retryExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Manually trigger agent execution
    }),
});
```

---

## Testing Agents

### Unit Tests

Test agent logic in isolation:

```typescript
// packages/domain/src/agents/__tests__/budget-monitoring-agent.test.ts

import { describe, it, expect, vi } from 'vitest';
import { BudgetMonitoringAgent } from '../budget-monitoring-agent';

describe('BudgetMonitoringAgent', () => {
  it('should send alert when budget exceeds 80%', async () => {
    const mockNotify = vi.fn();
    const agent = new BudgetMonitoringAgent('household-1', {
      enabled: true,
      notificationLevel: 'all',
      autoApprove: false,
    });
    agent['notify'] = mockNotify;

    // Mock budget at 85%
    vi.mocked(calculateBudgetStatus).mockResolvedValue({
      percentageUsed: 85,
      spent: 850,
      planned: 1000,
    });

    await agent.run();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.stringContaining('at 85% of budget'),
      'warning'
    );
  });

  it('should not send alert when budget under 80%', async () => {
    const mockNotify = vi.fn();
    const agent = new BudgetMonitoringAgent('household-1', {
      enabled: true,
      notificationLevel: 'all',
      autoApprove: false,
    });
    agent['notify'] = mockNotify;

    // Mock budget at 50%
    vi.mocked(calculateBudgetStatus).mockResolvedValue({
      percentageUsed: 50,
      spent: 500,
      planned: 1000,
    });

    await agent.run();

    expect(mockNotify).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

Test agent execution end-to-end:

```typescript
// packages/api/src/__tests__/agents.integration.test.ts

import { describe, it, expect } from 'vitest';
import { createTestContext } from './helpers';

describe('Agent Integration', () => {
  it('should execute budget monitoring agent and create execution record', async () => {
    const ctx = await createTestContext();

    // Create test budget at 90%
    await ctx.db.budget.create({
      data: {
        householdId: ctx.household.id,
        categoryId: ctx.category.id,
        month: '2026-01',
        planned: 1000,
        // Add transactions totaling 900
      }
    });

    // Execute agent
    const agent = new BudgetMonitoringAgent(ctx.household.id, {
      enabled: true,
      notificationLevel: 'all',
      autoApprove: false,
    });
    const result = await agent.execute();

    expect(result.success).toBe(true);
    expect(result.actionsCount).toBe(1); // One alert sent

    // Verify execution logged
    const execution = await ctx.db.agentExecution.findFirst({
      where: {
        householdId: ctx.household.id,
        agentType: 'BudgetMonitoring',
      }
    });

    expect(execution).toBeDefined();
    expect(execution.status).toBe('completed');
  });
});
```

### E2E Tests with Playwright

Test agent UI configuration:

```typescript
// apps/web/tests/agents.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Agent Settings', () => {
  test('should enable budget monitoring agent', async ({ page }) => {
    await page.goto('/settings/agents');

    // Find budget monitoring toggle
    const toggle = page.getByRole('switch', { name: 'Budget Monitoring' });
    await expect(toggle).not.toBeChecked();

    // Enable agent
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Verify saved
    await page.reload();
    await expect(toggle).toBeChecked();
  });

  test('should display agent execution history', async ({ page }) => {
    await page.goto('/settings/agents/budget-monitoring');

    // Should show recent executions
    await expect(page.getByText('Execution History')).toBeVisible();
    await expect(page.getByText(/Completed|Running|Failed/)).toBeVisible();

    // Should show action count
    await expect(page.getByText(/\d+ actions?/)).toBeVisible();
  });
});
```

---

## Agent Monitoring and Observability

### Metrics to Track

```typescript
interface AgentMetrics {
  agentType: string;
  executionCount: number;
  successRate: number;        // % of successful executions
  avgDuration: number;         // Average execution time (ms)
  actionsPerExecution: number; // Average actions taken
  errorRate: number;           // % of failed executions
  lastExecutedAt: Date;
}
```

### Health Checks

```typescript
// packages/api/src/routers/agents.ts

export const agentsRouter = createTRPCRouter({
  getHealth: protectedProcedure.query(async ({ ctx }) => {
    const agents = await getAgentMetrics(ctx.household.id);

    return agents.map(agent => ({
      type: agent.agentType,
      status: agent.errorRate > 0.5 ? 'unhealthy' : 'healthy',
      lastRun: agent.lastExecutedAt,
      successRate: agent.successRate,
    }));
  }),
});
```

### Alerting

Set up alerts for agent failures:

```typescript
class BaseAgent {
  protected async handleError(error: Error): Promise<AgentExecutionResult> {
    const recentFailures = await this.getRecentFailureCount();

    // Alert admins after 3 consecutive failures
    if (recentFailures >= 3) {
      await notifyAdmin({
        subject: `Agent ${this.type} failing repeatedly`,
        body: `Agent has failed ${recentFailures} times. Last error: ${error.message}`,
        severity: 'high',
      });
    }

    return {
      success: false,
      actionsCount: 0,
      logs: [],
      errors: [error.message]
    };
  }
}
```

---

## Security Considerations

### 1. **Access Control**

Agents should respect household data boundaries:

```typescript
class BaseAgent {
  protected async ensureAccess(resourceId: string): Promise<void> {
    const resource = await db.resource.findUnique({
      where: { id: resourceId },
      select: { householdId: true }
    });

    if (resource?.householdId !== this.householdId) {
      throw new Error('Unauthorized access to resource');
    }
  }
}
```

### 2. **Rate Limiting**

Prevent agents from overwhelming external APIs:

```typescript
class AICategorizationAgent extends BaseAgent {
  private rateLimiter = new RateLimiter({
    maxRequests: 100,
    windowMs: 60_000, // 100 requests per minute
  });

  async categorizeTransaction(tx: Transaction): Promise<void> {
    await this.rateLimiter.acquire();
    const result = await suggestCategoryWithAI(tx, categories);
    // ...
  }
}
```

### 3. **Data Privacy**

Agents should not log sensitive data:

```typescript
class BaseAgent {
  protected async logExecution(result: AgentExecutionResult): Promise<void> {
    await db.agentExecution.create({
      data: {
        agentType: this.type,
        householdId: this.householdId,
        status: result.success ? 'completed' : 'failed',
        actionsCount: result.actionsCount,
        // DO NOT log transaction details, amounts, merchant names
        logs: sanitizeLogs(result.logs),
      }
    });
  }
}
```

### 4. **Rollback Capability**

Allow users to undo agent actions:

```typescript
interface AgentAction {
  id: string;
  agentType: string;
  actionType: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  previousState?: any; // For rollback
  newState: any;
  timestamp: Date;
}

async function rollbackAction(actionId: string): Promise<void> {
  const action = await db.agentAction.findUnique({
    where: { id: actionId }
  });

  if (action.actionType === 'create') {
    await db[action.resourceType].delete({
      where: { id: action.resourceId }
    });
  } else if (action.actionType === 'update') {
    await db[action.resourceType].update({
      where: { id: action.resourceId },
      data: action.previousState,
    });
  }
  // ... handle delete case
}
```

---

## Future Enhancements

### 1. **Agent Marketplace**

Allow users to install community-created agents:

- Agent registry with metadata (name, description, permissions)
- Sandboxed execution environment
- Code signing and verification
- User reviews and ratings

### 2. **Agent Collaboration**

Enable agents to work together:

```typescript
// Example: Pattern Detection Agent → Smart Categorization Agent
class PatternDetectionAgent extends BaseAgent {
  async run(): Promise<AgentExecutionResult> {
    const patterns = detectRecurringPatterns(transactions);

    // Notify SmartCategorization agent about patterns
    await this.notifyAgent('SmartCategorization', {
      type: 'patterns_detected',
      patterns,
    });
  }
}
```

### 3. **User-Defined Agents**

Let users create simple agents via UI:

```typescript
interface UserDefinedAgent {
  name: string;
  trigger: 'schedule' | 'event';
  conditions: Condition[]; // If X happens...
  actions: Action[];       // Then do Y
}

// Example: "If grocery spending > 500, send email"
const agent: UserDefinedAgent = {
  name: 'Grocery Budget Alert',
  trigger: 'event',
  conditions: [
    { field: 'category.name', operator: 'equals', value: 'Groceries' },
    { field: 'totalSpent', operator: 'greaterThan', value: 500 }
  ],
  actions: [
    { type: 'sendEmail', subject: 'Grocery budget exceeded' }
  ]
};
```

### 4. **Agent Analytics Dashboard**

Visualize agent performance:

- Execution timeline
- Actions taken over time
- Success/failure rates
- Impact metrics (e.g., "Saved 50 hours of manual categorization")

---

## Conclusion

Agents transform Sharristh Budget from a reactive tool to a proactive financial assistant. By implementing autonomous services with confidence-based decision making, we can:

- Reduce manual categorization work
- Provide timely budget alerts
- Surface actionable insights
- Maintain data quality automatically
- Learn from user behavior over time

The foundation is already in place with existing scheduler infrastructure, AI integration, and pattern detection. Building on these patterns will create a powerful agent ecosystem.

**Next Steps**:
1. Review and approve agent architecture (see `AGENTS_ARCHITECTURE.md`)
2. Implement high-priority agents (Budget Monitoring, Insight Generation)
3. Add agent configuration UI
4. Set up monitoring and observability
5. Gather user feedback and iterate

For technical architecture details, see [AGENTS_ARCHITECTURE.md](./AGENTS_ARCHITECTURE.md).
