const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Chat = require('./Chat');
const User = require('./User');

const ChatParticipant = sequelize.define('ChatParticipant', {
    chat_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        references: {
            model: Chat,
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    tableName: 'chat_participants',
    timestamps: false
});

// Relacionamentos diretos (não usar belongsToMany para evitar conflitos)
Chat.hasMany(ChatParticipant, { foreignKey: 'chat_id', onDelete: 'CASCADE' });
ChatParticipant.belongsTo(Chat, { foreignKey: 'chat_id' });

User.hasMany(ChatParticipant, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ChatParticipant.belongsTo(User, { foreignKey: 'user_id' });

module.exports = ChatParticipant;
