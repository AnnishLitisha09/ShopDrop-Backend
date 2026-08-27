'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendors', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shopName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Food',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'Student Union Building, 1st Floor',
      },
      operatingHours: {
        type: Sequelize.STRING,
        defaultValue: '8:00 AM - 9:00 PM',
      },
      paymentMethods: {
        type: Sequelize.STRING,
        defaultValue: 'Campus Card, Credit/Debit, UPI',
      },
      logoUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bannerUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      rating: {
        type: Sequelize.FLOAT,
        defaultValue: 4.5,
      },
      reviewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 24,
      },
      isOpen: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      pickupTime: {
        type: Sequelize.STRING,
        defaultValue: '10-15 mins',
      },
      institutionId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'pending', 'inactive', 'suspended'),
        defaultValue: 'active',
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
    await queryInterface.dropTable('vendors');
  },
};
