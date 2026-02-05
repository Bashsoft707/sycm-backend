'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interest_records', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      account_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      principal_amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false,
      },
      annual_rate: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      daily_rate: {
        type: Sequelize.DECIMAL(12, 10),
        allowNull: false,
      },
      interest_amount: {
        type: Sequelize.DECIMAL(20, 2),
        allowNull: false,
      },
      calculation_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      is_leap_year: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      days_in_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      metadata: Sequelize.JSONB,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });

    await queryInterface.addIndex('interest_records', ['account_id']);
    await queryInterface.addIndex('interest_records', ['calculation_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interest_records');
  },
};

