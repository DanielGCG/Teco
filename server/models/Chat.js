const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatTopic = sequelize.define('ChatTopic', {
    name: {
        type: DataTypes.STRING(64),
        primaryKey: true
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'chattopic',
    timestamps: false
});

const Chat = sequelize.define('Chat', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    title: {
        type: DataTypes.STRING(160),
        allowNull: false
    },
    chatTopicName: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: 'Geral',
        references: {
            model: 'chattopic',
            key: 'name'
        }
    },
    lastChatMessageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    lastmessageat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chat',
    timestamps: false
});

Chat.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.createdbyUserId;
    delete values.lastChatMessageId;
    return values;
};

const ChatMessage = sequelize.define('ChatMessage', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    chatId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'chat',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isedited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chatmessages',
    timestamps: false
});

ChatMessage.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.chatId;
    delete values.userId;
    return values;
};

const DM = sequelize.define('DM', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    userId1: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    userId2: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'dm',
    timestamps: false
});

DM.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.userId1;
    delete values.userId2;
    return values;
};

const DMMessage = sequelize.define('DMMessage', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    dmId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'dm',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isedited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    isread: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'dmmessage',
    timestamps: false
});

DMMessage.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.dmId;
    delete values.userId;
    return values;
};

module.exports = { ChatTopic, Chat, ChatMessage, DM, DMMessage };
