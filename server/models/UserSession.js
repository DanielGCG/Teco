const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const UserSession = sequelize.define('UserSession', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    cookie_value: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'user_sessions',
    timestamps: false
});

// Relacionamentos
User.hasMany(UserSession, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserSession.belongsTo(User, { foreignKey: 'user_id' });

module.exports = UserSession;
