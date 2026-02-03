const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    authorUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    isrodinha: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    attachedPostId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('post', 'repost', 'reply', 'comment'),
        allowNull: false,
        defaultValue: 'post'
    },
    likecount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    replycount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    repostcount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
    },
    bookmarkcount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
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
    },
    updatedat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'post',
    timestamps: false
});

const PostMedia = sequelize.define('PostMedia', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('image/gif', 'video'),
        allowNull: false
    },
    url: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'postmedia',
    timestamps: false
});

const PostMention = sequelize.define('PostMention', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    }
}, {
    tableName: 'postmention',
    timestamps: false
});

const PostLike = sequelize.define('PostLike', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'postlike',
    timestamps: false
});

const PostBookmark = sequelize.define('PostBookmark', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    createdat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'postbookmark',
    timestamps: false
});

const Rodinha = sequelize.define('Rodinha', {
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true
    },
    targetUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true
    }
}, {
    tableName: 'rodinha',
    timestamps: false
});

module.exports = {
    Post,
    PostMedia,
    PostLike,
    PostBookmark,
    PostMention,
    Rodinha
};
