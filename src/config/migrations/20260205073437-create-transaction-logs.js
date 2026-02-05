'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_transaction_logs_type" AS ENUM ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'REFUND');
      CREATE TYPE "enum_transaction_logs_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');
    `);

    await queryInterface.createTable('transaction_logs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      idempotency_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: 'enum_transaction_logs_type',
        allowNull: false,
      },
      from_wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      to_wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'NGN',
      },
      status: {
        type: 'enum_transaction_logs_status',
        allowNull: false,
        defaultValue: 'PENDING',
      },
      description: Sequelize.TEXT,
      error_message: Sequelize.TEXT,
      metadata: Sequelize.JSONB,
      completed_at: Sequelize.DATE,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });

    await queryInterface.addIndex('transaction_logs', ['idempotency_key'], { unique: true });
    await queryInterface.addIndex('transaction_logs', ['from_wallet_id']);
    await queryInterface.addIndex('transaction_logs', ['to_wallet_id']);
    await queryInterface.addIndex('transaction_logs', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transaction_logs');
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_transaction_logs_type";
      DROP TYPE "enum_transaction_logs_status";
    `);
  },
};
