const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vendor = sequelize.define('Vendor', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shopName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Food',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Student Union Building, 1st Floor',
    },
    operatingHours: {
      type: DataTypes.STRING,
      defaultValue: '8:00 AM - 9:00 PM',
    },
    paymentMethods: {
      type: DataTypes.STRING,
      defaultValue: 'Campus Card, Credit/Debit, UPI',
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bannerUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 4.5,
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 24,
    },
    isOpen: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pickupTime: {
      type: DataTypes.STRING,
      defaultValue: '10-15 mins',
    },
    institutionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
  }, {
    tableName: 'vendors',
    timestamps: true,
  });

  return Vendor;
};
