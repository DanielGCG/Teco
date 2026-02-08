const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { id } = require('zod/locales');

const Badge = sequelize.define('Badge', {
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
    name: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'user',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'badge',
    timestamps: false
});

Badge.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.createdbyUserId;
    return values;
}

const BadgeUser = sequelize.define('BadgeUser', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4,
    },
    badgeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'badge',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'user',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'badgeuser',
    timestamps: false
});

BadgeUser.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.createdbyUserId;
    return values;
}

module.exports = { Badge, BadgeUser };