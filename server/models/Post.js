const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
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

Post.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Mantendo id e publicid separados para evitar ambiguidade
    if (values.author && values.author.publicid) {
        values.authorUserId = values.author.publicid;
    }
    delete values.attachedPostId;
    return values;
};

const PostMedia = sequelize.define('PostMedia', {
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

PostMedia.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.postId;
    return values;
};

const PostMention = sequelize.define('PostMention', {
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

PostMention.prototype.toJSON = function () {
    const values = { ...this.get() };
    if (values.user && values.user.publicid) {
        values.userId = values.user.publicid;
    }
    delete values.postId;
    return values;
};

const PostLike = sequelize.define('PostLike', {
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

PostLike.prototype.toJSON = function () {
    const values = { ...this.get() };
    if (values.user && values.user.publicid) {
        values.userId = values.user.publicid;
    }
    delete values.postId;
    return values;
};

const PostBookmark = sequelize.define('PostBookmark', {
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

PostBookmark.prototype.toJSON = function () {
    const values = { ...this.get() };
    if (values.user && values.user.publicid) {
        values.userId = values.user.publicid;
    }
    delete values.postId;
    return values;
};

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
