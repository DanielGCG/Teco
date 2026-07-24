const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Blog = sequelize.define('Blog', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    authorUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    applausecount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    backgroundurl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    backgroundfill: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'cover'
    },
    backgroundcolor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#f4f4f4'
    },
    fontcolor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#000000'
    },
    fontfamily: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Inter'
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'blog',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
});

module.exports = Blog;
