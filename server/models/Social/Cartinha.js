const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const User = require('./User');
const { encrypt, decrypt } = require('../../utils/encryption');

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
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('title');
            return decrypt(rawValue);
        },
        set(value) {
            this.setDataValue('title', encrypt(value));
        }
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('body');
            return decrypt(rawValue);
        },
        set(value) {
            this.setDataValue('body', encrypt(value));
        }
    },
    contenturl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    stampUrl: {
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

Cartinha.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.senderUserId;
    delete values.recipientUserId;
    return values;
};

module.exports = Cartinha;
