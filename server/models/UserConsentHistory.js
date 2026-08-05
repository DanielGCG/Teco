const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const LegalDocument = require('./LegalDocument');
const { User } = require('./Social/User');

const UserConsentHistory = sequelize.define('UserConsentHistory', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    legalDocumentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    consentedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'userconsenthistory',
    timestamps: false,
});

module.exports = UserConsentHistory;
