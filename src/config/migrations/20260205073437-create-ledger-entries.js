'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_ledger_entries_type" AS ENUM ('DEBIT', 'CREDIT');
    `);

    await queryInterface.createTable('ledger_entries', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      transaction_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      type: {
        type: 'enum_ledger_entries_type',
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
      balance_after: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false,
      },
      description: Sequelize.TEXT,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE
    });

    await queryInterface.addIndex('ledger_entries', ['transaction_id']);
    await queryInterface.addIndex('ledger_entries', ['wallet_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_ledger_entries_type";
    `);
  },
};
