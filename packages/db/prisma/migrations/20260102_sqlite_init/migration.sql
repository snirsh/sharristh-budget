-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "authenticators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" INTEGER NOT NULL,
    "transports" TEXT,
    CONSTRAINT "authenticators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'global',
    "householdId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "usedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invite_codes_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invite_codes_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invite_codes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "balance" REAL NOT NULL DEFAULT 0,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "institutionName" TEXT,
    "externalAccountId" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "isSystem" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,
    "categoryId" TEXT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "amount" REAL NOT NULL,
    "direction" TEXT NOT NULL,
    "categorizationSource" TEXT,
    "confidence" REAL,
    "notes" TEXT,
    "needsReview" INTEGER NOT NULL DEFAULT 0,
    "isIgnored" INTEGER NOT NULL DEFAULT 0,
    "isRecurringInstance" INTEGER NOT NULL DEFAULT 0,
    "recurringTemplateId" TEXT,
    "recurringInstanceKey" TEXT,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transactions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "plannedAmount" REAL NOT NULL,
    "limitAmount" REAL,
    "limitType" TEXT,
    "alertThresholdPct" REAL NOT NULL DEFAULT 0.8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "budgets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "category_rules_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "category_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_corrections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromCategoryId" TEXT,
    "toCategoryId" TEXT NOT NULL,
    "createdRuleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_corrections_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "defaultCategoryId" TEXT,
    "description" TEXT,
    "merchant" TEXT,
    "accountId" TEXT,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" TEXT,
    "byMonthDay" INTEGER,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recurring_templates_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_templates_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recurring_overrides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "instanceKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" REAL,
    "categoryId" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recurring_overrides_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "encryptedCreds" TEXT NOT NULL,
    "longTermToken" TEXT,
    "accountMappings" TEXT,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bank_connections_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "transactionsFound" INTEGER NOT NULL DEFAULT 0,
    "transactionsNew" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_jobs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "bank_connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_credentialID_key" ON "authenticators"("credentialID");

-- CreateIndex
CREATE INDEX "authenticators_userId_idx" ON "authenticators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_userId_credentialID_key" ON "authenticators"("userId", "credentialID");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_householdId_idx" ON "invite_codes"("householdId");

-- CreateIndex
CREATE INDEX "invite_codes_createdByUserId_idx" ON "invite_codes"("createdByUserId");

-- CreateIndex
CREATE INDEX "invite_codes_expiresAt_idx" ON "invite_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "household_members_householdId_idx" ON "household_members"("householdId");

-- CreateIndex
CREATE INDEX "household_members_userId_idx" ON "household_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_householdId_userId_key" ON "household_members"("householdId", "userId");

-- CreateIndex
CREATE INDEX "accounts_householdId_idx" ON "accounts"("householdId");

-- CreateIndex
CREATE INDEX "accounts_externalAccountId_idx" ON "accounts"("externalAccountId");

-- CreateIndex
CREATE INDEX "categories_householdId_idx" ON "categories"("householdId");

-- CreateIndex
CREATE INDEX "categories_parentCategoryId_idx" ON "categories"("parentCategoryId");

-- CreateIndex
CREATE INDEX "categories_type_idx" ON "categories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_name_parentCategoryId_key" ON "categories"("householdId", "name", "parentCategoryId");

-- CreateIndex
CREATE INDEX "transactions_householdId_idx" ON "transactions"("householdId");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_householdId_date_idx" ON "transactions"("householdId", "date");

-- CreateIndex
CREATE INDEX "transactions_recurringTemplateId_idx" ON "transactions"("recurringTemplateId");

-- CreateIndex
CREATE INDEX "transactions_externalId_idx" ON "transactions"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_recurringTemplateId_recurringInstanceKey_key" ON "transactions"("recurringTemplateId", "recurringInstanceKey");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_accountId_externalId_key" ON "transactions"("accountId", "externalId");

-- CreateIndex
CREATE INDEX "budgets_householdId_idx" ON "budgets"("householdId");

-- CreateIndex
CREATE INDEX "budgets_categoryId_idx" ON "budgets"("categoryId");

-- CreateIndex
CREATE INDEX "budgets_month_idx" ON "budgets"("month");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_householdId_categoryId_month_key" ON "budgets"("householdId", "categoryId", "month");

-- CreateIndex
CREATE INDEX "category_rules_householdId_idx" ON "category_rules"("householdId");

-- CreateIndex
CREATE INDEX "category_rules_categoryId_idx" ON "category_rules"("categoryId");

-- CreateIndex
CREATE INDEX "category_rules_type_idx" ON "category_rules"("type");

-- CreateIndex
CREATE INDEX "user_corrections_userId_idx" ON "user_corrections"("userId");

-- CreateIndex
CREATE INDEX "user_corrections_transactionId_idx" ON "user_corrections"("transactionId");

-- CreateIndex
CREATE INDEX "recurring_templates_householdId_idx" ON "recurring_templates"("householdId");

-- CreateIndex
CREATE INDEX "recurring_templates_isActive_idx" ON "recurring_templates"("isActive");

-- CreateIndex
CREATE INDEX "recurring_templates_nextRunAt_idx" ON "recurring_templates"("nextRunAt");

-- CreateIndex
CREATE INDEX "recurring_overrides_templateId_idx" ON "recurring_overrides"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_overrides_templateId_instanceKey_key" ON "recurring_overrides"("templateId", "instanceKey");

-- CreateIndex
CREATE INDEX "bank_connections_householdId_idx" ON "bank_connections"("householdId");

-- CreateIndex
CREATE INDEX "bank_connections_isActive_idx" ON "bank_connections"("isActive");

-- CreateIndex
CREATE INDEX "sync_jobs_connectionId_idx" ON "sync_jobs"("connectionId");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_createdAt_idx" ON "sync_jobs"("createdAt");
