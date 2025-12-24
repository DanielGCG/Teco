const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Galeria = sequelize.define('Galeria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT
    },
    capa_url: {
        type: DataTypes.STRING(255)
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    background_url: {
        type: DataTypes.STRING(255)
    },
    background_color: {
        type: DataTypes.STRING(7),
        defaultValue: '#e2e1cf'
    },
    font_family: {
        type: DataTypes.STRING(50),
        defaultValue: 'Inter'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'br_galeria',
    timestamps: false
});

const GaleriaImagem = sequelize.define('GaleriaImagem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    galeria_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Galeria,
            key: 'id'
        }
    },
    url: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(100)
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'br_galeria_imagem',
    timestamps: false
});

const GaleriaPermissao = sequelize.define('GaleriaPermissao', {
    galeria_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: Galeria,
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'br_galeria_permissao',
    timestamps: false
});

module.exports = { Galeria, GaleriaImagem, GaleriaPermissao };
