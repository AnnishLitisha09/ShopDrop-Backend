'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Users table additions
    await queryInterface.addColumn('users', 'registerNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    }).catch(() => {});

    await queryInterface.addColumn('users', 'year', {
      type: Sequelize.INTEGER,
      allowNull: true,
    }).catch(() => {});

    await queryInterface.addColumn('users', 'passOutYear', {
      type: Sequelize.INTEGER,
      allowNull: true,
    }).catch(() => {});

    await queryInterface.addColumn('users', 'mustChangePassword', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    }).catch(() => {});

    // 2. Products table stock addition
    await queryInterface.addColumn('products', 'stock', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 10,
    }).catch(() => {});

    // 3. Institutions table additions
    await queryInterface.addColumn('institutions', 'city', {
      type: Sequelize.STRING,
      allowNull: true,
    }).catch(() => {});

    await queryInterface.addColumn('institutions', 'domain', {
      type: Sequelize.STRING,
      allowNull: true,
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'registerNumber').catch(() => {});
    await queryInterface.removeColumn('users', 'year').catch(() => {});
    await queryInterface.removeColumn('users', 'passOutYear').catch(() => {});
    await queryInterface.removeColumn('users', 'mustChangePassword').catch(() => {});
    await queryInterface.removeColumn('products', 'stock').catch(() => {});
    await queryInterface.removeColumn('institutions', 'city').catch(() => {});
    await queryInterface.removeColumn('institutions', 'domain').catch(() => {});
  }
};
