'use strict';

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('ledger_entries', 'updated_at', {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('NOW()'),
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.removeColumn('ledger_entries', 'updated_at');
}

