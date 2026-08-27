const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Complaint = sequelize.define('Complaint', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Student who authored the complaint',
    },
    institutionId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Associated campus institution',
    },
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Associated purchase order ID',
    },
    vendorId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Vendor shop involved in the dispute',
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Complaint reason: Wrong item, Missing item, Damaged item, Late pickup, Payment issue, Other',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.ENUM('open', 'under_review', 'escalated', 'resolved', 'rejected'),
      defaultValue: 'open',
    },
    vendorResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolutionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'complaints',
    timestamps: true,
  });

  return Complaint;
};
