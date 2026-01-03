const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostMedia = sequelize.define('PostMedia', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    post_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('image', 'video'),
        defaultValue: 'image'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'post_media',
    timestamps: false
});

module.exports = PostMedia;
