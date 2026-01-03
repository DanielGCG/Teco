const sequelize = require('../config/database');

// Importa todos os modelos
const User = require('./User');
const UserSession = require('./UserSession');
const Chat = require('./Chat');
const ChatParticipant = require('./ChatParticipant');
const ChatMessage = require('./ChatMessage');
const ChatRead = require('./ChatRead');
const Cartinha = require('./Cartinha');
const Follow = require('./Follow');
const Notification = require('./Notification');
const Post = require('./Post');
const PostMedia = require('./PostMedia');
const PostLike = require('./PostLike');
const PostBookmark = require('./PostBookmark');
const PostMention = require('./PostMention');
const { Filme, Genero, FilmeGenero } = require('./Watchlist');
const { ImagemDoDia, ImagemDoDiaBorder } = require('./ImagemDoDia');
const { Galeria, GaleriaItem, GaleriaPermissao } = require('./Galeria');

// Associações Imagem do Dia
ImagemDoDia.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(ImagemDoDia, { foreignKey: 'user_id' });

// Associações Watchlist
Filme.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(Filme, { foreignKey: 'user_id' });

// Dono da galeria
Galeria.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
User.hasMany(Galeria, { foreignKey: 'user_id' });

// Itens da galeria (Mudado de 'imagens' para 'items')
Galeria.hasMany(GaleriaItem, { foreignKey: 'gallery_id', as: 'items' });
GaleriaItem.belongsTo(Galeria, { foreignKey: 'gallery_id' });

// Uploader do item
GaleriaItem.belongsTo(User, { foreignKey: 'user_id', as: 'uploader' });

// Colaboradores
Galeria.belongsToMany(User, { 
    through: GaleriaPermissao, 
    foreignKey: 'gallery_id', 
    otherKey: 'user_id', 
    as: 'collaborators' 
});

User.belongsToMany(Galeria, { 
    through: GaleriaPermissao, 
    foreignKey: 'user_id', 
    otherKey: 'gallery_id', 
    as: 'shared_galleries' 
});

// Associações de Posts
Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });

Post.hasMany(PostMedia, { foreignKey: 'post_id', as: 'media' });
PostMedia.belongsTo(Post, { foreignKey: 'post_id' });

Post.hasMany(PostLike, { foreignKey: 'post_id', as: 'likes' });
PostLike.belongsTo(Post, { foreignKey: 'post_id' });
PostLike.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Post.hasMany(PostBookmark, { foreignKey: 'post_id', as: 'bookmarks' });
PostBookmark.belongsTo(Post, { foreignKey: 'post_id' });
PostBookmark.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Post.hasMany(PostMention, { foreignKey: 'post_id', as: 'mentions' });
PostMention.belongsTo(Post, { foreignKey: 'post_id' });
PostMention.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Post.belongsTo(Post, { foreignKey: 'parent_id', as: 'parent' });
Post.hasMany(Post, { foreignKey: 'parent_id', as: 'replies' });

// Sincroniza modelos (use com cuidado em produção)
// sequelize.sync({ alter: true });

module.exports = {
    sequelize,
    User,
    UserSession,
    Chat,
    ChatParticipant,
    ChatMessage,
    ChatRead,
    Cartinha,
    Follow,
    Notification,
    Post,
    PostMedia,
    PostLike,
    PostBookmark,
    PostMention,
    Filme,
    Genero,
    FilmeGenero,
    ImagemDoDia,
    ImagemDoDiaBorder,
    Galeria,
    GaleriaItem,
    GaleriaPermissao
};