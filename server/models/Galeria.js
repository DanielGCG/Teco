const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Galeria = sequelize.define('Galeria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    cover_url: {
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
    background_fill: {
        type: DataTypes.STRING(10),
        defaultValue: 'cover'
    },
    background_color: {
        type: DataTypes.STRING(7),
        defaultValue: '#e2e1cf'
    },
    font_color: {
        type: DataTypes.STRING(7),
        defaultValue: '#3E3F29'
    },
    card_color: {
        type: DataTypes.STRING(7),
        defaultValue: '#ffffff'
    },
    grid_columns: {
        type: DataTypes.INTEGER,
        defaultValue: 12
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
    tableName: 'galleries',
    timestamps: false
});

const GaleriaItem = sequelize.define('GaleriaItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    gallery_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Galeria,
            key: 'id'
        }
    },
    cover_url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    content_url: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    mimetype: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(100)
    },
    grid_w: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    grid_h: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    col_start: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    row_start: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    z_index: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    show_title: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    object_fit: {
        type: DataTypes.STRING(10),
        defaultValue: 'cover'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'gallery_items',
    timestamps: false
});

const GaleriaPermissao = sequelize.define('GaleriaPermissao', {
    gallery_id: {
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
    tableName: 'gallery_permissions',
    timestamps: false
});

module.exports = { Galeria, GaleriaItem, GaleriaPermissao };