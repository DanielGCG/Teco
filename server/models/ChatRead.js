const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Chat = require('./Chat');
const User = require('./User');

const ChatRead = sequelize.define('ChatRead', {
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
    },
    last_read_message_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    }
}, {
    tableName: 'chat_reads',
    timestamps: false
});

// Relacionamentos
Chat.hasMany(ChatRead, { foreignKey: 'chat_id', onDelete: 'CASCADE' });
ChatRead.belongsTo(Chat, { foreignKey: 'chat_id' });

User.hasMany(ChatRead, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ChatRead.belongsTo(User, { foreignKey: 'user_id' });

module.exports = ChatRead;
