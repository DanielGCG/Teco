const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Follow = sequelize.define('Follow', {
    followerUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'followerUserId',
        references: {
            model: 'user',
            key: 'id'
        }
    },
    followedUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        field: 'followedUserId',
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'createdat'
    }
}, {
    tableName: 'follow',
    timestamps: false
});

module.exports = Follow;
