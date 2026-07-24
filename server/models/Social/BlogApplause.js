const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const BlogApplause = sequelize.define('BlogApplause', {
    blogId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'blog',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'blogapplause',
    timestamps: false
});

module.exports = BlogApplause;
