# Backend Engineer Assessment - Sycamore

## Overview

This repository contains solutions for both practical assessments:

- **Task A**: Idempotent Wallet Transfer Endpoint
- **Task B**: Interest Accumulator Service

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **Framework**: NestJS
- **Database**: PostgreSQL 14+
- **ORM**: Sequelize with TypeScript
- **Caching**: Redis
- **Testing**: Jest
- **Validation**: class-validator

## Project Structure

```
backend-assessment/
├── src/
│   ├── wallet/                 # Task A: Transfer endpoint
│   │   ├── wallet.controller.ts
│   │   ├── wallet.service.ts
│   │   ├── wallet.module.ts
│   │   ├── dto/
│   │   ├── entities/
│   │   └── __tests__/
│   ├── interest/               # Task B: Interest calculator
│   │   ├── interest.service.ts
│   │   ├── interest.module.ts
│   │   ├── entities/
│   │   └── __tests__/
│   ├── config/
│   │   ├── seeders/
│   │   └── migrations/
├── test/
├── .env.example
└── package.json
```

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0
- npm or yarn

## Setup Instructions

### 1. Clone Repository

```bash
git clone <repository-url>
cd backend-assessment
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=sycamore_assessment

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
PORT=3000
NODE_ENV=development
```

### 4. Database Setup

```bash
# Create database
createdb sycamore_assessment

# Run migrations
npm run migration:run

# Seed initial data (optional)
npm run seed
```

### 5. Start Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Database Migrations

### Available Migrations

1. `20240201-create-wallets.ts` - Wallet accounts table
2. `20240201-create-transaction-logs.ts` - Transaction logging
3. `20240201-create-ledger-entries.ts` - Double-entry ledger
4. `20240201-create-interest-records.ts` - Interest calculation tracking

### Migration Commands

```bash
# Run all pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration
npm run migration:generate --name=your-migration-name
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run Specific Test Suite

```bash
# Task A tests
npm test -- wallet.service

# Task B tests
npm test -- interest.service
```

### Expected Coverage

- Statements: > 85%
- Branches: > 80%
- Functions: > 85%
- Lines: > 85%

## API Documentation

### Task A: Wallet Transfer

**Endpoint**: `POST /wallet/transfer`

**Request Body**:

```json
{
  "idempotencyKey": "unique-key-123",
  "fromWalletId": "wallet-uuid-1",
  "toWalletId": "wallet-uuid-2",
  "amount": "100.50",
  "currency": "NGN",
  "description": "Loan disbursement"
}
```

**Success Response** (200):

```json
{
  "success": true,
  "transactionId": "txn-uuid",
  "status": "COMPLETED",
  "fromWallet": {
    "id": "wallet-uuid-1",
    "newBalance": "899.50"
  },
  "toWallet": {
    "id": "wallet-uuid-2",
    "newBalance": "100.50"
  },
  "timestamp": "2024-02-05T10:30:00Z"
}
```

**Error Response** (400):

```json
{
  "error": "INSUFFICIENT_FUNDS",
  "message": "Wallet balance insufficient for transfer",
  "details": {
    "available": "50.00",
    "required": "100.50"
  }
}
```

**Idempotency Behavior**:

- Same `idempotencyKey` returns cached result (200)
- Expired keys (>24h) are treated as new requests
- Concurrent requests with same key are blocked until first completes

### Task B: Interest Calculation

**Endpoint**: `POST /interest/calculate-daily`

**Request Body**:

```json
{
  "principalAmount": "10000.00",
  "annualRate": 27.5,
  "calculationDate": "2024-02-05"
}
```

**Response** (200):

```json
{
  "principal": "10000.00",
  "annualRate": 27.5,
  "dailyRate": 0.07534246575,
  "interestAmount": "7.53",
  "calculationDate": "2024-02-05",
  "isLeapYear": false,
  "daysInYear": 365
}
```

## Architectural Decisions

### Task A: Idempotent Wallet

**Key Design Choices**:

1. **Transaction Logging First**: Create `TransactionLog` with PENDING status before any financial operations to ensure audit trail

2. **Database Transactions**: Use Sequelize managed transactions with SERIALIZABLE isolation level to prevent race conditions

3. **Optimistic Locking**: Version field on Wallet entity prevents lost updates from concurrent modifications

4. **Idempotency Storage**: Redis cache with 24-hour TTL for fast duplicate detection

5. **State Machine**:

   ```
   PENDING → PROCESSING → COMPLETED
                       → FAILED
   ```

6. **Double-Entry Ledger**: Every transfer creates two ledger entries (debit + credit) for accounting accuracy

**Race Condition Handling**:

- Database row-level locks (`FOR UPDATE`)
- Unique constraint on `idempotencyKey`
- Atomic balance updates using SQL increments
- Transaction isolation prevents dirty reads

### Task B: Interest Accumulator

**Key Design Choices**:

1. **Decimal Precision**: Use `decimal.js` library to avoid JavaScript floating-point errors

2. **Leap Year Handling**: Detect leap years and adjust divisor (365 vs 366 days)

3. **Formula**:

   ```
   Daily Interest = Principal × (Annual Rate / Days in Year)
   Days in Year = Is Leap Year ? 366 : 365
   ```

4. **Rounding Strategy**: Round to 2 decimal places using HALF_EVEN (banker's rounding)

5. **Audit Trail**: Store every calculation with metadata for compliance

**Edge Cases Covered**:

- Leap year detection (divisible by 4, except centuries unless divisible by 400)
- Negative principal amounts (rejected)
- Zero interest rate (valid, returns 0)
- Very large principals (tested up to 1 billion)
- Precision maintained up to 10 decimal places internally

## Testing Strategy

### Unit Tests

- Service methods in isolation
- Mock database interactions
- Edge case coverage
- Error handling paths

### Integration Tests

- Full request/response cycle
- Database transactions
- Redis caching behavior
- Concurrent request handling

### Load Tests (Optional)

```bash
# Using Artillery
npm run test:load
```

## Performance Considerations

### Task A Optimizations

- Redis caching for idempotency checks (sub-ms lookup)
- Database indexes on wallet_id, idempotency_key
- Connection pooling (max 20 connections)
- Transaction timeout: 5 seconds

### Task B Optimizations

- Batch calculation endpoint for multiple dates
- Cached leap year lookups
- Optimized decimal operations

## Security Measures

1. **Input Validation**: class-validator DTOs reject malformed requests
2. **SQL Injection Prevention**: Sequelize parameterized queries
3. **Rate Limiting**: 100 requests/minute per IP (using Redis)
4. **Amount Validation**: Reject negative values, excessive decimal places
5. **Audit Logging**: All financial operations logged with timestamp + user context

## Monitoring & Observability

### Logs

- Winston logger with JSON formatting
- Transaction traces include correlation IDs
- Error stack traces in non-production

### Environment-Specific Configs

- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

## Troubleshooting

### Common Issues

**Issue**: Migration fails with "relation already exists"

```bash
Solution: npm run migration:revert && npm run migration:run
```

**Issue**: Redis connection timeout

```bash
Solution: Check Redis is running - redis-cli ping
```

**Issue**: Tests fail with "Cannot find module"

```bash
Solution: npm run build && npm test
```

## Future Improvements

1. **Event Sourcing**: Implement event log for complete transaction history
2. **Webhooks**: Notify external systems on transaction completion
3. **Multi-currency**: Support currency conversion in transfers
4. **GraphQL API**: Add GraphQL layer for flexible querying
5. **Distributed Tracing**: Add OpenTelemetry for microservices observability

## Author

**Candidate Submission**  
Date: February 5, 2024

## License

Private Assessment - Not for Distribution
