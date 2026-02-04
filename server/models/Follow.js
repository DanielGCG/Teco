const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Follow = sequelize.define('Follow', {
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
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

Follow.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.followerUserId;
    delete values.followedUserId;

    if (values.follower && values.follower.publicid) {
        values.followerUserId = values.follower.publicid;
    }
    if (values.followed && values.followed.publicid) {
        values.followedUserId = values.followed.publicid;
    }

    return values;
};

module.exports = Follow;
