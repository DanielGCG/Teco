const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Chat = require('./Chat');
const User = require('./User');

const ChatMessage = sequelize.define('ChatMessage', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    chat_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: Chat,
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    mensagem: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chat_messages',
    timestamps: false
});

// Relacionamentos
Chat.hasMany(ChatMessage, { foreignKey: 'chat_id', onDelete: 'CASCADE' });
ChatMessage.belongsTo(Chat, { foreignKey: 'chat_id' });

User.hasMany(ChatMessage, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ChatMessage.belongsTo(User, { foreignKey: 'user_id' });

module.exports = ChatMessage;
