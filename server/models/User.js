const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.TINYINT.UNSIGNED,
        primaryKey: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING(64)
    }
}, {
    tableName: 'role',
    timestamps: false
});

Role.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    return values;
};

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    roleId: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 20,
        references: {
            model: Role,
            key: 'id'
        }
    },
    passwordhash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    birthday: {
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW
    },
    pronouns: {
        type: DataTypes.STRING(16),
        allowNull: true
    },
    bio: {
        type: DataTypes.STRING(160),
        defaultValue: ''
    },
    backgroundimage: {
        type: DataTypes.STRING(255)
    },
    profileimage: {
        type: DataTypes.STRING(255)
    },
    postcount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    lastaccess: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'user',
    timestamps: false,
    indexes: [
        {
            name: 'idx_username_search',
            fields: ['username']
        }
    ]
});

User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.passwordhash;
    return values;
};

// Relacionamento
User.belongsTo(Role, { foreignKey: 'roleId' });

module.exports = User;