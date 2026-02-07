# Database Testing, Migrations, and Seeds Patterns

This document outlines the comprehensive patterns for database management, testing, migrations, and seeds in a Turborepo monorepo with Drizzle ORM and PostgreSQL.

## Architecture Overview

### Core Structure
```
packages/database/               # Shared database package
├── src/
│   ├── schema/                 # Drizzle schema definitions
│   │   ├── index.ts           # Schema exports
│   │   ├── users.ts           # User-related tables
│   │   ├── challenges.ts      # Challenge-related tables
│   │   ├── activities.ts      # Activity-related tables
│   │   └── categories.ts      # Category-related tables
│   ├── queries/               # Pre-built queries
│   ├── migrations/            # Generated migrations
│   ├── seeds.ts              # Database seeding
│   ├── reset.ts              # Database reset utility
│   ├── test-db.ts            # Test database exports
│   └── index.ts              # Main package exports
├── test-setup.ts             # Vitest test setup
├── drizzle.config.ts         # Drizzle configuration
└── package.json              # Database package config

apps/web/                      # Next.js application
├── tests/
│   ├── api/                  # API route tests
│   ├── helpers/
│   │   └── test-utils.ts     # Test utilities
│   └── global-setup.ts       # Global test setup
├── vitest.config.ts          # Vitest configuration
└── package.json              # Web app config

docker-compose.test.yml        # Test database container
```

## 1. Database Configuration

### Drizzle Configuration (`packages/database/drizzle.config.ts`)
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### Environment Variables
```bash
# Development
DATABASE_URL=postgresql://user:password@localhost:5432/dev_db

# Test
DATABASE_URL=postgresql://test:test@localhost:5433/test_db

# Production
DATABASE_URL=postgresql://user:password@host:5432/prod_db
```

## 2. Schema Organization

### Schema Structure (`packages/database/src/schema/`)
```typescript
// index.ts - Central schema exports
export * from "./enums";
export * from "./users";
export * from "./categories";
export * from "./challenges";
export * from "./participations";
export * from "./activities";

// Example: users.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  username: text("username").unique(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

## 3. Testing Setup

### Docker Test Database (`docker-compose.test.yml`)
```yaml
services:
  test-postgres:
    image: postgres:17-alpine
    container_name: march-fitness-test-db
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - "5433:5432"
    volumes:
      - test-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d test_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  test-postgres-data:
```

### Global Test Setup (`apps/web/tests/global-setup.ts`)
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalSetup() {
  const isLocal = !process.env.CI && !process.env.USE_NEON_TESTS;

  if (isLocal) {
    try {
      // Check if Docker is running
      await execAsync('docker info');

      // Start local test database if not already running
      try {
        await execAsync('docker compose -f ../../docker-compose.test.yml up -d --wait');
        console.log('✅ Local test database started');
      } catch (error) {
        console.warn('Failed to start local test database:', error);
      }
    } catch (error) {
      console.warn('Docker not available, assuming local Postgres is running');
    }
  } else {
    console.log('🔥 Using Neon branches for testing');
  }
}

export async function globalTeardown() {
  const isLocal = !process.env.CI && !process.env.USE_NEON_TESTS;

  if (isLocal) {
    try {
      await execAsync('docker compose -f ../../docker-compose.test.yml down');
      console.log('✅ Local test database stopped');
    } catch (error) {
      console.warn('Failed to stop local test database:', error);
    }
  }
}
```

### Database Test Setup (`packages/database/test-setup.ts`)
```typescript
import { beforeEach, afterAll } from 'vitest';
import { reset } from 'drizzle-seed';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema/index';

// Use dedicated test database
const testDatabaseUrl = 'postgresql://test:test@localhost:5433/test_db';

// Override environment for tests
process.env.DATABASE_URL = testDatabaseUrl;

const client = postgres(testDatabaseUrl, {
  onnotice: () => {}, // Suppress notices
});

const db = drizzle(client, {
  schema,
  logger: false // Suppress query logs during tests
});

beforeEach(async () => {
  // Use Drizzle's built-in reset - much more reliable than custom logic
  await reset(db, schema);
});

afterAll(async () => {
  await client.end();
});
```

### Vitest Configuration (`apps/web/vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../../packages/database/test-setup.ts'],
    globalSetup: './tests/global-setup.ts',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'], // All tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  esbuild: {
    target: 'node14',
  },
});
```

## 4. Test Utilities

### Test Helper Functions (`apps/web/tests/helpers/test-utils.ts`)
```typescript
import { vi } from 'vitest';
import { auth, currentUser } from '@clerk/nextjs/server';
import { users, challenges, testDb, setTestSchema } from '@repo/database';

// Mock Clerk authentication for tests
export const mockAuth = (userId: string = 'test-user-id') => {
  const mockUser = {
    id: userId,
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    firstName: 'Test',
    lastName: 'User',
    imageUrl: 'https://example.com/avatar.jpg',
  };

  (auth as any) = vi.fn().mockResolvedValue({
    userId,
    user: mockUser,
  });

  (currentUser as any) = vi.fn().mockResolvedValue(mockUser);

  return mockUser;
};

export const clearAuthMock = () => {
  vi.clearAllMocks();
  (auth as any) = vi.fn().mockResolvedValue({ userId: null, user: null });
  (currentUser as any) = vi.fn().mockResolvedValue(null);
};

// Helper to create API request/response mocks
export const createApiMocks = (
  method: string = 'GET',
  url: string = '/',
  body?: any
) => {
  const req = new Request(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return { req };
};

// Helper to create authenticated user in database
export const createTestUser = async (overrides: any = {}) => {
  await setTestSchema();

  const randomId = crypto.randomUUID().substring(0, 8);
  const userData = {
    id: overrides.id || crypto.randomUUID(),
    email: overrides.email || `test-${randomId}@example.com`,
    name: 'Test User',
    username: overrides.username || `testuser-${randomId}`,
    clerkId: overrides.clerkId || `clerk-${randomId}`,
    ...overrides,
  };

  const [user] = await testDb.insert(users).values(userData).returning();
  return user;
};

// Helper to create test challenge
export const createTestChallenge = async (creatorId: string, overrides: any = {}) => {
  await setTestSchema();

  const challengeData = {
    name: 'Test Challenge',
    description: 'A test challenge',
    creatorId,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    durationDays: 31,
    streakMinPoints: 10,
    ...overrides,
  };

  const [challenge] = await testDb.insert(challenges).values(challengeData).returning();
  return challenge;
};
```

## 5. Example Test Implementation

### API Route Test (`apps/web/tests/api/activities.test.ts`)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb as db, activityTypes, userChallenges, setTestSchema } from '@repo/database';
import { POST } from '../../app/api/activities/log/route';
import { mockAuth, clearAuthMock, createApiMocks, createTestUser, createTestChallenge } from '../helpers/test-utils';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

describe('/api/activities', () => {
  beforeEach(async () => {
    clearAuthMock();
    await setTestSchema();
  });

  describe('POST /api/activities/log', () => {
    it('should log a new activity', async () => {
      // Setup
      const testUserId = crypto.randomUUID();
      mockAuth(testUserId);
      const dbUser = await createTestUser({ clerkId: testUserId });
      const challenge = await createTestChallenge(dbUser.id);

      // Create user participation
      await db.insert(userChallenges).values({
        userId: dbUser.id,
        challengeId: challenge.id,
        joinedAt: new Date(),
      });

      // Create activity type
      const [activityType] = await db.insert(activityTypes).values({
        challengeId: challenge.id,
        name: 'Running',
        scoringConfig: {
          unit: 'minutes',
          pointsPerUnit: 1,
          basePoints: 5,
        },
      }).returning();

      const activityData = {
        challengeId: challenge.id,
        activityTypeId: activityType.id,
        loggedDate: '2024-01-15',
        metrics: { minutes: 30 },
        notes: 'Morning run',
      };

      const { req } = createApiMocks('POST', '/api/activities/log', activityData);

      // Execute
      const response = await POST(req);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.metrics.minutes).toBe(30);
      expect(data.pointsEarned).toBeGreaterThan(0);
      expect(data.userId).toBe(dbUser.id);
      expect(data.challengeId).toBe(challenge.id);
    });

    it('should calculate points correctly', async () => {
      // Setup
      const testUserId = crypto.randomUUID();
      mockAuth(testUserId);
      const dbUser = await createTestUser({ clerkId: testUserId });
      const challenge = await createTestChallenge(dbUser.id);

      await db.insert(userChallenges).values({
        userId: dbUser.id,
        challengeId: challenge.id,
        joinedAt: new Date(),
      });

      const [activityType] = await db.insert(activityTypes).values({
        challengeId: challenge.id,
        name: 'Running',
        scoringConfig: {
          unit: 'minutes',
          pointsPerUnit: 2, // 2 points per minute
          basePoints: 10,   // Plus 10 base points
        },
      }).returning();

      const activityData = {
        challengeId: challenge.id,
        activityTypeId: activityType.id,
        loggedDate: '2024-01-15',
        metrics: { minutes: 15 }, // 15 minutes
      };

      const { req } = createApiMocks('POST', '/api/activities/log', activityData);

      // Execute
      const response = await POST(req);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      // Points should be: (15 minutes * 2 points/minute) + 10 base = 40 points
      expect(data.pointsEarned).toBe(40);
    });
  });
});
```

## 6. Database Operations

### Migration Commands
```bash
# Generate new migration
pnpm -F database db:generate

# Push schema changes to database (development)
pnpm -F database db:push

# Run migrations (production)
pnpm -F database db:migrate

# Open Drizzle Studio
pnpm -F database db:studio
```

### Reset and Seed Operations
```bash
# Reset database and seed
pnpm -F database db:reset

# Seed only
pnpm -F database db:seed
```

### Database Reset Implementation (`packages/database/src/reset.ts`)
```typescript
import { reset } from "drizzle-seed";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export async function resetDatabase() {
  console.log("🔄 Resetting database...");

  try {
    await reset(db, schema);
    console.log("✅ Database reset completed");
  } catch (error) {
    console.error("❌ Reset failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Reset failed:", error);
      process.exit(1);
    });
}
```

## 7. Comprehensive Seeds Implementation

### Seeds Structure (`packages/database/src/seeds.ts`)
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export async function seed() {
  console.log("🌱 Seeding database...");

  // Seed categories
  const categories = await db
    .insert(schema.categories)
    .values([
      {
        name: "Outdoor Running",
        description: "Running, jogging, hiking, walking for fitness",
      },
      {
        name: "Cycling",
        description: "Outdoor cycling activities",
      },
      {
        name: "Low Intensity Cardio",
        description: "<75% max HR - lifting, pilates, bouldering, elliptical",
      },
      // ... more categories
    ])
    .returning();

  console.log("✅ Categories seeded");

  // Seed template activity types
  const templateActivityTypes = await db
    .insert(schema.templateActivityTypes)
    .values([
      {
        name: "Outdoor Run",
        categoryId: categories[0].id,
        scoringConfig: {
          type: "distance",
          unit: "miles",
          pointsPerUnit: 7.5,
        },
        contributesToStreak: true,
      },
      // ... more activity types
    ])
    .returning();

  console.log("✅ Template activity types seeded");

  // Seed sample data
  const sampleUser = await db
    .insert(schema.users)
    .values({
      clerkId: "sample-user-123",
      username: "sampleuser",
      email: "sample@example.com",
      name: "Sample User",
    })
    .returning()
    .then((res) => res[0]);

  const challenge = await db
    .insert(schema.challenges)
    .values({
      name: "March Fitness Challenge",
      description: "Get fit this March!",
      creatorId: sampleUser.id,
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-03-31"),
      durationDays: 31,
      streakMinPoints: 10,
    })
    .returning()
    .then((res) => res[0]);

  // Link activity types to challenge
  const challengeActivityTypes = templateActivityTypes.map((template) => ({
    challengeId: challenge.id,
    templateId: template.id,
    name: template.name,
    categoryId: template.categoryId,
    scoringConfig: template.scoringConfig,
    contributesToStreak: template.contributesToStreak,
    isNegative: template.isNegative || false,
  }));

  await db.insert(schema.activityTypes).values(challengeActivityTypes);

  console.log("✅ Sample challenge and activity types seeded");
  console.log("🎉 Database seeding completed!");
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    })
    .finally(() => client.end());
}
```

## 8. Package.json Scripts

### Database Package (`packages/database/package.json`)
```json
{
  "scripts": {
    "db:generate": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit generate",
    "db:migrate": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit migrate",
    "db:push": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit push",
    "db:reset": "dotenv -e ../../.env.local -e ../../.env -- tsx src/reset.ts && dotenv -e ../../.env.local -e ../../.env -- tsx src/seeds.ts",
    "db:seed": "dotenv -e ../../.env.local -e ../../.env -- tsx src/seeds.ts",
    "db:studio": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit studio",
    "test:migrate": "DATABASE_URL=postgresql://test:test@localhost:5433/test_db drizzle-kit push --force"
  }
}
```

### Web App Package (`apps/web/package.json`)
```json
{
  "scripts": {
    "test": "vitest",
    "test:integration": "USE_NEON_TESTS=true vitest",
    "test:local": "TEST_DATABASE_URL=postgresql://test:test@localhost:5433/test_db vitest",
    "test:setup": "docker compose -f ../../docker-compose.test.yml up -d && sleep 2 && pnpm -F database test:migrate",
    "test:teardown": "docker compose -f ../../docker-compose.test.yml down"
  }
}
```

### Root Package (`package.json`)
```json
{
  "scripts": {
    "test": "turbo test --cache-dir=.turbo",
    "typecheck": "turbo typecheck --affected --cache-dir=.turbo",
    "lint": "turbo lint --cache-dir=.turbo --affected --continue -- --cache --cache-location \"node_modules/.cache/.eslintcache\" && manypkg check"
  }
}
```

## 9. Testing Workflow

### Local Development Testing
```bash
# 1. Setup test database (one time)
pnpm test:setup

# 2. Run database migrations for test DB
cd packages/database && DATABASE_URL=postgresql://test:test@localhost:5433/test_db pnpm db:push

# 3. Run tests
pnpm test

# 4. Cleanup (optional)
pnpm test:teardown
```

### CI/CD Testing with Neon Branches
```bash
# Use Neon database branches for testing
USE_NEON_TESTS=true pnpm test
```

## 10. Key Benefits

1. **Isolated Test Environment**: Each test runs with a clean database state
2. **Fast Reset**: Using `drizzle-seed` reset for reliable test isolation
3. **Flexible Testing**: Support for both local Docker and cloud Neon testing
4. **Type Safety**: Full TypeScript support with Drizzle ORM
5. **Comprehensive Seeds**: Rich test data matching production scenarios
6. **Monorepo Integration**: Seamless integration with Turborepo build system
7. **Environment Separation**: Clear separation between dev, test, and production

## 11. Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "drizzle-orm": "^0.44.5",
    "drizzle-seed": "^0.3.1",
    "postgres": "^3.4.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "vitest": "^1.6.0",
    "tsx": "^4.7.0",
    "dotenv-cli": "^10.0.0"
  }
}
```

This pattern provides a robust, scalable foundation for database operations in a modern TypeScript monorepo with comprehensive testing capabilities.

## 12. Complete Test Setup Guide

### Overview
This project supports two testing environments:
1. **Local Docker PostgreSQL** - For development and CI/CD
2. **Neon Database Branches** - For cloud-based testing

### Prerequisites
- Docker installed and running
- pnpm package manager
- PostgreSQL client tools (optional, for debugging)

### Step-by-Step Setup

#### 1. Initial Project Setup
```bash
# Clone and install dependencies
git clone <repository>
cd <project-directory>
pnpm install
```

#### 2. Environment Configuration
Create environment files in project root:

**`.env.local`** (for development):
```bash
# Development database
DATABASE_URL=postgresql://user:password@localhost:5432/dev_db

# Clerk authentication (if using)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Other environment variables...
```

**`.env`** (for shared config):
```bash
# Any shared environment variables
NODE_ENV=development
```

#### 3. Docker Test Database Setup

**Create `docker-compose.test.yml` in project root:**
```yaml
services:
  test-postgres:
    image: postgres:17-alpine
    container_name: march-fitness-test-db
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - "5433:5432"
    volumes:
      - test-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d test_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  test-postgres-data:
```

#### 4. Package.json Script Configuration

**Root `package.json`:**
```json
{
  "scripts": {
    "test": "turbo test --cache-dir=.turbo",
    "test:integration": "pnpm -F web test:integration",
    "test:local": "pnpm -F web test:local"
  }
}
```

**`apps/web/package.json`:**
```json
{
  "scripts": {
    "test": "dotenv -e ../../.env.local -e ../../.env -- vitest",
    "test:integration": "USE_NEON_TESTS=true dotenv -e ../../.env.local -e ../../.env -- vitest",
    "test:local": "TEST_DATABASE_URL=postgresql://test:test@localhost:5433/test_db dotenv -e ../../.env.local -e ../../.env -- vitest",
    "test:setup": "docker compose -f ../../docker-compose.test.yml up -d && sleep 2 && pnpm -F database test:migrate",
    "test:teardown": "docker compose -f ../../docker-compose.test.yml down"
  }
}
```

**`packages/database/package.json`:**
```json
{
  "scripts": {
    "db:generate": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit generate",
    "db:migrate": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit migrate",
    "db:push": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit push",
    "db:reset": "dotenv -e ../../.env.local -e ../../.env -- tsx src/reset.ts && dotenv -e ../../.env.local -e ../../.env -- tsx src/seeds.ts",
    "db:seed": "dotenv -e ../../.env.local -e ../../.env -- tsx src/seeds.ts",
    "db:studio": "dotenv -e ../../.env.local -e ../../.env -- drizzle-kit studio",
    "test:migrate": "DATABASE_URL=postgresql://test:test@localhost:5433/test_db drizzle-kit push --force"
  }
}
```

### Testing Commands Reference

#### Local Development Testing (Recommended)
```bash
# 1. Start local test database (one-time setup per session)
pnpm -F web test:setup

# 2. Run tests with local database
pnpm test:local --run

# 3. Stop test database when done (optional)
pnpm -F web test:teardown
```

#### Cloud Testing with Neon Branches
```bash
# Requires Neon database configured with branch support
pnpm test:integration --run
```

#### Database Management
```bash
# Push schema changes to development database
pnpm -F database db:push

# Generate new migration
pnpm -F database db:generate

# Reset and seed database
pnpm -F database db:reset

# Open Drizzle Studio
pnpm -F database db:studio
```

### Key Configuration Files

#### `apps/web/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../../packages/database/test-setup.ts'],
    globalSetup: './tests/global-setup.ts',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  esbuild: {
    target: 'node14',
  },
});
```

#### `apps/web/tests/global-setup.ts`
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { reset } from 'drizzle-seed';
import * as schema from '@repo/database/schema';

const execAsync = promisify(exec);

export default async function globalSetup() {
  const isLocal = !process.env.CI && !process.env.USE_NEON_TESTS;

  if (isLocal) {
    console.log('✅ Local test database started');

    // Setup test database schema
    const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/test_db';
    const client = postgres(connectionString, { max: 1 });
    const db = drizzle(client, { schema });

    try {
      console.log('🛠️  Maintaining test schema...');
      await reset(db, schema);
      console.log('✅ Test database reset and schema is ready');
    } catch (error) {
      console.error('❌ Failed to setup test database schema');
      console.error(error);
      throw new Error('Test database setup failed. See logs above for details.');
    } finally {
      await client.end();
    }
  } else {
    console.log('🔥 Using Neon branches for testing');
  }
}

export async function globalTeardown() {
  const isLocal = !process.env.CI && !process.env.USE_NEON_TESTS;

  if (isLocal) {
    try {
      await execAsync('docker compose -f ../../docker-compose.test.yml down');
      console.log('✅ Local test database stopped');
    } catch (error) {
      console.warn('Failed to stop local test database:', error);
    }
  }
}
```

#### `packages/database/test-setup.ts`
```typescript
import { beforeEach, afterAll } from 'vitest';
import { reset } from 'drizzle-seed';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema/index';

// Use test database URL
const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/test_db';

// Override environment for tests
process.env.DATABASE_URL = testDatabaseUrl;

const client = postgres(testDatabaseUrl, {
  onnotice: () => {}, // Suppress notices
});

const db = drizzle(client, {
  schema,
  logger: false // Suppress query logs during tests
});

beforeEach(async () => {
  // Reset database before each test
  await reset(db, schema);
});

afterAll(async () => {
  await client.end();
});

// Export test database for use in tests
export const testDb = db;
export const setTestSchema = async () => {
  // Function to ensure schema is set up (called in test helpers)
};
```

### Troubleshooting

#### PostCSS Configuration Issues
If you encounter PostCSS plugin errors with Tailwind CSS v4:

**Fix `apps/web/postcss.config.mjs`:**
```javascript
import tailwindcss from "tailwindcss";

const config = {
  plugins: [tailwindcss],
};

export default config;
```

#### Common Error Messages and Solutions

**Error: `Command "test:setup" not found`**
```bash
# Use the correct command with workspace filter
pnpm -F web test:setup
```

**Error: `ECONNREFUSED` during integration tests**
```bash
# The Neon database connection failed, use local testing instead
pnpm test:local --run
```

**Error: `Failed to load PostCSS config`**
```bash
# Update PostCSS config to use proper Tailwind v4 syntax
# See PostCSS Configuration Issues section above
```

**Error: Docker container not starting**
```bash
# Check Docker is running
docker info

# Check if port 5433 is available
lsof -i :5433

# Force restart the container
pnpm -F web test:teardown
pnpm -F web test:setup
```

#### Database Connection Debugging
```bash
# Test database connection manually
psql postgresql://test:test@localhost:5433/test_db

# Check container status
docker ps | grep test-db

# View container logs
docker logs march-fitness-test-db
```

### Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | Main database connection | `postgresql://user:pass@host:5432/db` |
| `TEST_DATABASE_URL` | Test database override | `postgresql://test:test@localhost:5433/test_db` |
| `USE_NEON_TESTS` | Enable Neon branch testing | `true` |
| `NODE_ENV` | Environment mode | `test` |

### Dependencies Required

**Core Testing Dependencies:**
```json
{
  "devDependencies": {
    "vitest": "^1.6.0",
    "drizzle-seed": "^0.3.1",
    "dotenv-cli": "^10.0.0",
    "postgres": "^3.4.7",
    "@vitejs/plugin-react": "^4.3.1"
  }
}
```

### Best Practices

1. **Always use local testing during development** - faster and more reliable
2. **Reserve Neon branch testing for CI/CD** - avoid connection issues
3. **Clean up Docker containers regularly** - prevent port conflicts
4. **Use `--run` flag for CI/CD** - prevents hanging tests
5. **Test database isolation** - each test gets a clean database state
6. **Environment separation** - clear distinction between dev/test/prod databases

This comprehensive setup ensures reliable, fast testing with proper database isolation and supports both local development and cloud-based CI/CD workflows.