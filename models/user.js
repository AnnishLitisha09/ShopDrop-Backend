const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'institution_admin', 'vendor', 'student'),
      allowNull: false,
      defaultValue: 'student',
    },
    institutionId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Associated institution for student, vendor, or institution_admin',
    },
    vendorId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Associated vendor shop if user is a vendor',
    },
    savedAddress: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Saved campus delivery address schema',
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
  }, {
    tableName: 'users',
    timestamps: true,
  });

  return User;
};
