'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      institutionId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      vendorId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      totalAmount: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      serviceFee: {
        type: Sequelize.FLOAT,
        defaultValue: 0.99,
      },
      vendorCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      paymentMethod: {
        type: Sequelize.STRING,
        defaultValue: 'Campus Card Wallet',
      },
      deliveryAddress: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      pickupNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('placed', 'preparing', 'ready', 'completed', 'cancelled'),
        defaultValue: 'placed',
      },
      pickupCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  },
};
