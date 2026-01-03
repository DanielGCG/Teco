const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    role: {
        type: DataTypes.TINYINT,
        defaultValue: 0,
        comment: '0 = usuário comum, 1 = admin, 2 = dono'
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    pronouns: {
        type: DataTypes.STRING(12),
        allowNull: true
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    background_image: {
        type: DataTypes.STRING(255)
    },
    profile_image: {
        type: DataTypes.STRING(255)
    },
    bio: {
        type: DataTypes.STRING(160)
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    last_access: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: false,
    indexes: [
        {
            name: 'idx_username_search',
            fields: ['username']
        }
    ]
});

module.exports = User;
