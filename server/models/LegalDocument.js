const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LegalDocument = sequelize.define('LegalDocument', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    version: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    termsText: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    privacyText: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'legal_document',
    timestamps: true,
});

module.exports = LegalDocument;
