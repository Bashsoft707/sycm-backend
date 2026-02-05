'use strict';
import { v4 as uuidv4 } from 'uuid';

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface) {
  // Wallets
  await queryInterface.bulkInsert('wallets', [
    {
      id: uuidv4(),
      owner_id: 'USER_1',
      type: 'USER',
      balance: '1000.00',
      currency: 'NGN',
      status: 'ACTIVE',
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      owner_id: 'USER_2',
      type: 'USER',
      balance: '500.00',
      currency: 'NGN',
      status: 'ACTIVE',
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      owner_id: 'POOL_1',
      type: 'POOL',
      balance: '100000.00',
      currency: 'NGN',
      status: 'ACTIVE',
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Example transaction log
  const txId = uuidv4();
  await queryInterface.bulkInsert('transaction_logs', [
    {
      id: txId,
      idempotency_key: 'init_transfer_100_ngn',
      type: 'TRANSFER',
      from_wallet_id: '11111111-1111-1111-1111-111111111111',
      to_wallet_id: '22222222-2222-2222-2222-222222222222',
      amount: '100.00',
      currency: 'NGN',
      status: 'PENDING',
      description: 'Initial transfer seed',
      metadata: JSON.stringify({ seed: true }),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Ledger entries
  await queryInterface.bulkInsert('ledger_entries', [
    {
      id: uuidv4(),
      transaction_id: txId,
      wallet_id: '11111111-1111-1111-1111-111111111111',
      type: 'DEBIT',
      amount: '100.00',
      balance_after: '900.00',
      currency: 'NGN',
      description: 'Debit from USER_1 wallet',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      transaction_id: txId,
      wallet_id: '22222222-2222-2222-2222-222222222222',
      type: 'CREDIT',
      amount: '100.00',
      balance_after: '600.00',
      currency: 'NGN',
      description: 'Credit to USER_2 wallet',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Interest records
  await queryInterface.bulkInsert('interest_records', [
    {
      id: uuidv4(),
      account_id: '11111111-1111-1111-1111-111111111111',
      principal_amount: '1000.00',
      annual_rate: '27.5',
      daily_rate: '0.0753424658',
      interest_amount: '0.75',
      calculation_date: new Date().toISOString().slice(0, 10),
      is_leap_year: false,
      days_in_year: 365,
      metadata: JSON.stringify({ seed: true }),
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      account_id: '22222222-2222-2222-2222-222222222222',
      principal_amount: '500.00',
      annual_rate: '27.5',
      daily_rate: '0.0753424658',
      interest_amount: '0.37',
      calculation_date: new Date().toISOString().slice(0, 10),
      is_leap_year: false,
      days_in_year: 365,
      metadata: JSON.stringify({ seed: true }),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}
