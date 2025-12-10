const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Destinatário da notificação',
        references: {
            model: User,
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_DM', 'NEW_CARTINHA', 'MENTION', 'SYSTEM'),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    link: {
        type: DataTypes.STRING(512),
        comment: 'Link de destino ao clicar'
    },
    data: {
        type: DataTypes.JSON,
        comment: 'Dados adicionais da notificação'
    },
    read_at: {
        type: DataTypes.DATE,
        comment: 'Quando foi marcada como lida'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expires_at: {
        type: DataTypes.DATE,
        comment: 'Quando a notificação expira (opcional)'
    }
}, {
    tableName: 'notifications',
    timestamps: false,
    indexes: [
        {
            name: 'idx_user_unread',
            fields: ['user_id', 'read_at']
        },
        {
            name: 'idx_created_at',
            fields: ['created_at']
        },
        {
            name: 'idx_expires_at',
            fields: ['expires_at']
        }
    ]
});

// Relacionamentos
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Notification;
