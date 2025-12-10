const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Friendship = sequelize.define('Friendship', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    requester_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem enviou o pedido',
        references: {
            model: User,
            key: 'id'
        }
    },
    addressee_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem recebeu o pedido',
        references: {
            model: User,
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'friendships',
    timestamps: false,
    indexes: [
        {
            name: 'unique_friendship',
            unique: true,
            fields: ['requester_id', 'addressee_id']
        },
        {
            name: 'idx_requester',
            fields: ['requester_id', 'status']
        },
        {
            name: 'idx_addressee',
            fields: ['addressee_id', 'status']
        }
    ],
    hooks: {
        beforeCreate: (friendship) => {
            if (friendship.requester_id === friendship.addressee_id) {
                throw new Error('Usuário não pode adicionar a si mesmo como amigo');
            }
        }
    }
});

// Relacionamentos
User.hasMany(Friendship, { foreignKey: 'requester_id', as: 'sentFriendRequests', onDelete: 'CASCADE' });
User.hasMany(Friendship, { foreignKey: 'addressee_id', as: 'receivedFriendRequests', onDelete: 'CASCADE' });

Friendship.belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });
Friendship.belongsTo(User, { foreignKey: 'addressee_id', as: 'addressee' });

module.exports = Friendship;
