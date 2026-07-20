const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const User = require('./User');

const Cutucada = sequelize.define('Cutucada', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    senderUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    targetUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // Nulo para a "Cutucada Geral"
        references: {
            model: User,
            key: 'id'
        }
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isGlobal: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'cutucadas',
    timestamps: false
});

module.exports = Cutucada;
