const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Student who authored the review',
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Associated completed order ID',
    },
    vendorId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Vendor shop being rated',
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional specific product reviewed',
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'reviews',
    timestamps: true,
  });

  return Review;
};
