const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); 

const PushSubscription = sequelize.define('PushSubscription', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    endpoint: {
        type: DataTypes.STRING(512),
        allowNull: false
    },
    p256dh: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    auth: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'pushsubscription',
    timestamps: false
});

module.exports = PushSubscription;