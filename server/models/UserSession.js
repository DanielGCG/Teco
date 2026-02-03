const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const UserSession = sequelize.define('UserSession', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    cookie: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expiresat: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'session',
    timestamps: false
});

module.exports = UserSession;
