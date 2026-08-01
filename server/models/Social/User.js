const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

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
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true
    },
    emailVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    verificationExpires: {
        type: DataTypes.DATE,
        allowNull: true
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
    bannerimage: {
        type: DataTypes.STRING(255)
    },
    backgroundimage: {
        type: DataTypes.STRING(255)
    },
    backgroundcolor: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: null
    },
    backgroundfill: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'cover'
    },
    profileimage: {
        type: DataTypes.STRING(255)
    },
    lastfmusername: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    postcount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    cutucadasRestantes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20
    },
    lastCutucadaReset: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastCutucadaGeral: {
        type: DataTypes.DATE,
        allowNull: true
    },
    consentVersion: {
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

// Método para calcular o status das cutucadas
User.prototype.getCutucadasStatus = function() {
    const now = new Date();
    let remainingNormalCutucadas = this.cutucadasRestantes;
    let remainingGlobalCutucadas = 1;

    // Cutucadas Normais (recarrega para 20 a cada 1 hora)
    if (!this.lastCutucadaReset || (now - new Date(this.lastCutucadaReset)) >= 60 * 60 * 1000) {
        remainingNormalCutucadas = 20;
    }

    // Cutucada Geral (recarrega 1 a cada 1 hora)
    if (!this.lastCutucadaGeral || (now - new Date(this.lastCutucadaGeral)) >= 60 * 60 * 1000) {
        remainingGlobalCutucadas = 1;
    } else {
        remainingGlobalCutucadas = 0;
    }

    return {
        remainingNormalCutucadas,
        remainingGlobalCutucadas
    };
};

// Relacionamentos expostos via objeto
module.exports = { User, Role };