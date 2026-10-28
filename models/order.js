const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    institutionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    vendorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    serviceFee: {
      type: DataTypes.FLOAT,
      defaultValue: 0.99,
    },
    vendorCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: 'Campus Card Wallet',
    },
    deliveryAddress: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Dynamic campus delivery/pickup address details',
    },
    pickupNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('placed', 'preparing', 'ready', 'completed', 'cancelled'),
      defaultValue: 'placed',
    },
    pickupCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentOrderId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'paid',
    },
    refundStatus: {
      type: DataTypes.STRING,
      defaultValue: 'none',
    },
    refundAmount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    cancellationFee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    refundTxnId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cancelledBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellationWindowExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'orders',
    timestamps: true,
  });

  return Order;
};
