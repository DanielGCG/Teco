const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImagemDoDia = sequelize.define('ImagemDoDia', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    url: {
        type: DataTypes.STRING(256),
        allowNull: false
    },
    border_url: {
        type: DataTypes.STRING(256),
        allowNull: false
    },
    texto: {
        type: DataTypes.STRING(32),
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    start_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'br_imagemdodia',
    timestamps: false
});

const ImagemDoDiaBorder = sequelize.define('ImagemDoDiaBorder', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    url: {
        type: DataTypes.STRING(256),
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'br_imagemdodia_borders',
    timestamps: false
});

module.exports = { ImagemDoDia, ImagemDoDiaBorder };
