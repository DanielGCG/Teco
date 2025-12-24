const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Filme = sequelize.define('Filme', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    overview: {
        type: DataTypes.TEXT
    },
    popularity: {
        type: DataTypes.FLOAT
    },
    media_type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['movie', 'tv']]
        }
    },
    original_language: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    poster_path: {
        type: DataTypes.STRING(128)
    },
    backdrop_path: {
        type: DataTypes.STRING(128)
    },
    release_date: {
        type: DataTypes.DATEONLY
    },
    vote_average: {
        type: DataTypes.FLOAT
    },
    vote_count: {
        type: DataTypes.INTEGER
    },
    watched: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    custom_rating: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'wl_filme',
    timestamps: false,
    indexes: [
        { fields: ['title'] },
        { fields: ['release_date'] },
        { fields: ['popularity'] }
    ]
});

const Genero = sequelize.define('Genero', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    tableName: 'wl_genero',
    timestamps: false
});

const FilmeGenero = sequelize.define('FilmeGenero', {
    filme_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        references: {
            model: Filme,
            key: 'id'
        }
    },
    genero_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: Genero,
            key: 'id'
        }
    }
}, {
    tableName: 'wl_filme_genero',
    timestamps: false
});

// Relacionamentos N:N
Filme.belongsToMany(Genero, { through: FilmeGenero, foreignKey: 'filme_id', otherKey: 'genero_id', as: 'generos' });
Genero.belongsToMany(Filme, { through: FilmeGenero, foreignKey: 'genero_id', otherKey: 'filme_id', as: 'filmes' });

module.exports = { Filme, Genero, FilmeGenero };
