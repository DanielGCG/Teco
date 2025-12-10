const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Cartinha = sequelize.define('Cartinha', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    remetente_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem enviou a cartinha',
        references: {
            model: User,
            key: 'id'
        }
    },
    destinatario_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem recebeu a cartinha',
        references: {
            model: User,
            key: 'id'
        }
    },
    titulo: {
        type: DataTypes.STRING(40),
        allowNull: false,
        comment: 'Máximo 40 caracteres'
    },
    conteudo: {
        type: DataTypes.STRING(560),
        allowNull: false,
        comment: 'Máximo 560 caracteres'
    },
    data_envio: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    data_lida: {
        type: DataTypes.DATE,
        comment: 'Quando foi marcada como lida'
    },
    lida: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    favoritada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    data_favoritada: {
        type: DataTypes.DATE,
        comment: 'Quando foi favoritada'
    }
}, {
    tableName: 'cartinhas',
    timestamps: false,
    indexes: [
        {
            name: 'idx_destinatario_lida',
            fields: ['destinatario_id', 'lida']
        },
        {
            name: 'idx_destinatario_favoritada',
            fields: ['destinatario_id', 'favoritada']
        }
    ],
    hooks: {
        beforeUpdate: (cartinha) => {
            // Se está marcando como lida pela primeira vez
            if (cartinha.changed('lida') && cartinha.lida && !cartinha.data_lida) {
                cartinha.data_lida = new Date();
            }
            
            // Se está favoritando pela primeira vez
            if (cartinha.changed('favoritada') && cartinha.favoritada && !cartinha.data_favoritada) {
                cartinha.data_favoritada = new Date();
            }
            
            // Se está desfavoritando
            if (cartinha.changed('favoritada') && !cartinha.favoritada) {
                cartinha.data_favoritada = null;
            }
        }
    }
});

// Relacionamentos
User.hasMany(Cartinha, { foreignKey: 'remetente_id', as: 'cartinhas_enviadas', onDelete: 'CASCADE' });
User.hasMany(Cartinha, { foreignKey: 'destinatario_id', as: 'cartinhas_recebidas', onDelete: 'CASCADE' });

Cartinha.belongsTo(User, { foreignKey: 'remetente_id', as: 'remetente' });
Cartinha.belongsTo(User, { foreignKey: 'destinatario_id', as: 'destinatario' });

module.exports = Cartinha;
