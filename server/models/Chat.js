const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Chat = sequelize.define('Chat', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(100),
        unique: true
    },
    tipo: {
        type: DataTypes.ENUM('public', 'dm'),
        defaultValue: 'public',
        allowNull: false
    },
    criado_por: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chats',
    timestamps: false
});

// Relacionamento
User.hasMany(Chat, { foreignKey: 'criado_por', as: 'chats_criados', onDelete: 'CASCADE' });
Chat.belongsTo(User, { foreignKey: 'criado_por', as: 'criador' });

module.exports = Chat;
