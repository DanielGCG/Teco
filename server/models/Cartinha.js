const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Cartinha = sequelize.define('Cartinha', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true
    },
    senderUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    recipientUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(160),
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    contenturl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    isanonymous: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    isread: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    isfavorited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    readat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    favoritedat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'cartinha',
    timestamps: false,
    hooks: {
        beforeUpdate: (cartinha) => {
            if (cartinha.changed('isread') && cartinha.isread && !cartinha.readat) {
                cartinha.readat = new Date();
            }
            if (cartinha.changed('isfavorited') && cartinha.isfavorited && !cartinha.favoritedat) {
                cartinha.favoritedat = new Date();
            }
            if (cartinha.changed('isfavorited') && !cartinha.isfavorited) {
                cartinha.favoritedat = null;
            }
        }
    }
});

module.exports = Cartinha;
