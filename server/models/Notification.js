const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Notification = sequelize.define('Notification', {
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
    targetUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('system', 'everyone', 'followaccept', 'followarequest', 'dm', 'cutucado', 'postcomment', 'postlike', 'postrepost', 'info'),
        allowNull: false,
        defaultValue: 'info'
    },
    title: {
        type: DataTypes.STRING(160),
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    link: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    readat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expiresat: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'notification',
    timestamps: false,
    indexes: [
        {
            name: 'idx_notif_cleanup',
            fields: ['targetUserId', 'readat']
        }
    ]
});

Notification.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.targetUserId;
    return values;
};

module.exports = Notification;
