const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    parent_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('post', 'repost', 'reply'),
        defaultValue: 'post'
    },
    likes_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    reposts_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    replies_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Post;
