'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum type safely
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_wallets_type" AS ENUM ('POOL', 'USER', 'MERCHANT');
      CREATE TYPE "enum_wallets_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
    `);

    await queryInterface.createTable('wallets', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      owner_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: 'enum_wallets_type',
        allowNull: false,
      },
      balance: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false,
        defaultValue: '0.00',
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'NGN',
      },
      status: {
        type: 'enum_wallets_status',
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });

    await queryInterface.addIndex('wallets', ['owner_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallets');
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_wallets_type";
      DROP TYPE "enum_wallets_status";
    `);
  },
};
