const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Filme = sequelize.define('Filme', {
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
        type: DataTypes.STRING(160),
        allowNull: false
    },
    overview: {
        type: DataTypes.TEXT
    },
    popularity: {
        type: DataTypes.FLOAT
    },
    type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['movie', 'tv']]
        }
    },
    originallang: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    posterurl: {
        type: DataTypes.STRING(255)
    },
    backdropurl: {
        type: DataTypes.STRING(255)
    },
    releasedate: {
        type: DataTypes.DATEONLY
    },
    voteaverage: {
        type: DataTypes.FLOAT
    },
    votecount: {
        type: DataTypes.INTEGER
    },
    voteboteco: {
        type: DataTypes.FLOAT
    },
    iswatched: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
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
    tableName: 'movie',
    timestamps: false
});

Filme.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.createdbyUserId;
    return values;
};

module.exports = { Filme };
