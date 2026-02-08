const sequelize = require('../config/database');

const User = require('./User');
const UserSession = require('./UserSession');
const { ChatTopic, Chat, ChatMessage, DM, DMMessage } = require('./Chat');
const Cartinha = require('./Cartinha');
const Follow = require('./Follow');
const Notification = require('./Notification');
const { Post, PostMedia, PostLike, PostBookmark, PostMention, Rodinha } = require('./Post');
const { Filme } = require('./Watchlist');
const { ImagemDoDia, ImagemDoDiaBorder } = require('./ImagemDoDia');
const { Galeria, GaleriaItem, GaleriaContributor } = require('./Galeria');
const { Badge, BadgeUser } = require('./Badges');

// Associações Imagem do Dia
ImagemDoDia.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'requester' });
User.hasMany(ImagemDoDia, { foreignKey: 'createdbyUserId' });

ImagemDoDia.belongsTo(ImagemDoDiaBorder, { foreignKey: 'borderId', as: 'border' });
ImagemDoDiaBorder.hasMany(ImagemDoDia, { foreignKey: 'borderId' });

ImagemDoDiaBorder.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'creator' });

// Associações Watchlist
Filme.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'requester' });
User.hasMany(Filme, { foreignKey: 'createdbyUserId' });

// Dono da galeria
Galeria.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'owner' });
User.hasMany(Galeria, { foreignKey: 'createdbyUserId' });

// Itens da galeria (Mudado de 'imagens' para 'items')
Galeria.hasMany(GaleriaItem, { foreignKey: 'galleryId', as: 'items' });
GaleriaItem.belongsTo(Galeria, { foreignKey: 'galleryId' });

// Uploader do item
GaleriaItem.belongsTo(User, { foreignKey: 'editedbyUserId', as: 'uploader' });

// Colaboradores
Galeria.belongsToMany(User, { 
    through: GaleriaContributor, 
    foreignKey: 'galleryId', 
    otherKey: 'userId', 
    as: 'collaborators' 
});

User.belongsToMany(Galeria, { 
    through: GaleriaContributor, 
    foreignKey: 'userId', 
    otherKey: 'galleryId', 
    as: 'shared_galleries' 
});

// Associações de Posts
Post.belongsTo(User, { foreignKey: 'authorUserId', as: 'author' });
User.hasMany(Post, { foreignKey: 'authorUserId', as: 'posts' });

Post.hasMany(PostMedia, { foreignKey: 'postId', as: 'media' });
PostMedia.belongsTo(Post, { foreignKey: 'postId' });

Post.hasMany(PostLike, { foreignKey: 'postId', as: 'likes' });
PostLike.belongsTo(Post, { foreignKey: 'postId' });
PostLike.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Post.hasMany(PostBookmark, { foreignKey: 'postId', as: 'bookmarks' });
PostBookmark.belongsTo(Post, { foreignKey: 'postId' });
PostBookmark.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Post.hasMany(PostMention, { foreignKey: 'postId', as: 'mentions' });
PostMention.belongsTo(Post, { foreignKey: 'postId' });
PostMention.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Post.belongsTo(Post, { foreignKey: 'attachedPostId', as: 'parent', onDelete: 'CASCADE' });
Post.hasMany(Post, { foreignKey: 'attachedPostId', as: 'comments', onDelete: 'CASCADE' });

// Associações de Rodinha
User.belongsToMany(User, { 
    through: Rodinha, 
    as: 'rodinhaMembers', 
    foreignKey: 'userId', 
    otherKey: 'targetUserId' 
});

User.belongsToMany(User, { 
    through: Rodinha, 
    as: 'inRodinhas', 
    foreignKey: 'targetUserId', 
    otherKey: 'userId' 
});

// Associações de Follow
User.hasMany(Follow, { foreignKey: 'followerUserId', as: 'following', onDelete: 'CASCADE' });
User.hasMany(Follow, { foreignKey: 'followedUserId', as: 'followers', onDelete: 'CASCADE' });

Follow.belongsTo(User, { foreignKey: 'followerUserId', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'followedUserId', as: 'followed' });

// Associações de Chat
Chat.belongsTo(ChatTopic, { foreignKey: 'chatTopicName', as: 'topic' });
ChatTopic.hasMany(Chat, { foreignKey: 'chatTopicName' });

Chat.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'creator' });
User.hasMany(Chat, { foreignKey: 'createdbyUserId' });

Chat.hasMany(ChatMessage, { foreignKey: 'chatId', as: 'messages' });
ChatMessage.belongsTo(Chat, { foreignKey: 'chatId' });

ChatMessage.belongsTo(User, { foreignKey: 'userId', as: 'author' });
User.hasMany(ChatMessage, { foreignKey: 'userId' });

Chat.belongsTo(ChatMessage, { foreignKey: 'lastChatMessageId', as: 'lastMessage', constraints: false });

// Associações de DM
DM.belongsTo(User, { foreignKey: 'userId1', as: 'user1' });
DM.belongsTo(User, { foreignKey: 'userId2', as: 'user2' });

DM.hasMany(DMMessage, { foreignKey: 'dmId', as: 'messages' });
DMMessage.belongsTo(DM, { foreignKey: 'dmId' });

DMMessage.belongsTo(User, { foreignKey: 'userId', as: 'author' });
DMMessage.belongsTo(User, { foreignKey: 'userId', as: 'Sender' }); // Alias usado no socket
User.hasMany(DMMessage, { foreignKey: 'userId' });

// Associações de Sessão
User.hasMany(UserSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserSession.belongsTo(User, { foreignKey: 'userId' });

// Associações de Notificação
User.hasMany(Notification, { foreignKey: 'targetUserId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'targetUserId' });

// Associações de Cartinha
User.hasMany(Cartinha, { foreignKey: 'senderUserId', as: 'cartinhas_enviadas' });
User.hasMany(Cartinha, { foreignKey: 'recipientUserId', as: 'cartinhas_recebidas' });
Cartinha.belongsTo(User, { foreignKey: 'senderUserId', as: 'remetente' });
Cartinha.belongsTo(User, { foreignKey: 'recipientUserId', as: 'destinatario' });

// Associações de Badges
Badge.belongsTo(User, { foreignKey: 'createdbyUserId', as: 'creator' });
User.hasMany(Badge, { foreignKey: 'createdbyUserId', as: 'createdBadges' });

User.belongsToMany(Badge, {
    through: BadgeUser,
    foreignKey: 'userId',
    otherKey: 'badgeId',
    as: 'badges'
});
Badge.belongsToMany(User, {
    through: BadgeUser,
    foreignKey: 'badgeId',
    otherKey: 'userId',
    as: 'owners'
});

BadgeUser.belongsTo(Badge, { foreignKey: 'badgeId' });
BadgeUser.belongsTo(User, { foreignKey: 'userId' });

// Sincroniza modelos (use com cuidado em produção)
// sequelize.sync({ alter: true });

module.exports = {
    sequelize,
    User,
    UserSession,
    ChatTopic,
    Chat,
    ChatMessage,
    DM,
    DMMessage,
    Cartinha,
    Follow,
    Notification,
    Post,
    PostMedia,
    PostLike,
    PostBookmark,
    PostMention,
    Rodinha,
    Filme,
    ImagemDoDia,
    ImagemDoDiaBorder,
    Galeria,
    GaleriaItem,
    GaleriaContributor,
    Badge,
    BadgeUser
};