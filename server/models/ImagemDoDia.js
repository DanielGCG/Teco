const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImagemDoDia = sequelize.define('ImagemDoDia', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    position: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    text: {
        type: DataTypes.STRING(32),
        allowNull: false
    },
    borderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        references: {
            model: 'imagemdodiaborder',
            key: 'id'
        }
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'imagemdodia',
    timestamps: false
});

ImagemDoDia.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.borderId;
    delete values.createdbyUserId;

    if (values.requester) {
        values.createdbyUserId = values.requester.publicid;
    }
    if (values.border && values.border.publicid) {
        values.borderId = values.border.publicid;
    }

    return values;
};

const ImagemDoDiaBorder = sequelize.define('ImagemDoDiaBorder', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
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
    url: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'imagemdodiaborder',
    timestamps: false
});

ImagemDoDiaBorder.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.createdbyUserId;

    if (values.creator) {
        values.createdbyUserId = values.creator.publicid;
    }

    return values;
};

module.exports = { ImagemDoDia, ImagemDoDiaBorder };
