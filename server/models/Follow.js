const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Follow = sequelize.define('Follow', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    follower_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem segue',
        references: {
            model: User,
            key: 'id'
        }
    },
    following_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Quem é seguido',
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
    tableName: 'follows',
    timestamps: false,
    indexes: [
        {
            name: 'unique_follow',
            unique: true,
            fields: ['follower_id', 'following_id']
        },
        {
            name: 'idx_follower',
            fields: ['follower_id']
        },
        {
            name: 'idx_following',
            fields: ['following_id']
        }
    ]
});

// Relacionamentos
User.hasMany(Follow, { foreignKey: 'follower_id', as: 'following', onDelete: 'CASCADE' });
User.hasMany(Follow, { foreignKey: 'following_id', as: 'followers', onDelete: 'CASCADE' });

Follow.belongsTo(User, { foreignKey: 'follower_id', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'following_id', as: 'followed' });

module.exports = Follow;
