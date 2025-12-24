const sequelize = require('../config/database');

// Importa todos os modelos
const User = require('./User');
const UserSession = require('./UserSession');
const Chat = require('./Chat');
const ChatParticipant = require('./ChatParticipant');
const ChatMessage = require('./ChatMessage');
const ChatRead = require('./ChatRead');
const Cartinha = require('./Cartinha');
const Friendship = require('./Friendship');
const Notification = require('./Notification');
const { Filme, Genero, FilmeGenero } = require('./Watchlist');
const { ImagemDoDia, ImagemDoDiaBorder } = require('./ImagemDoDia');
const { Galeria, GaleriaImagem, GaleriaPermissao } = require('./Galeria');

// Associações
ImagemDoDia.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(ImagemDoDia, { foreignKey: 'user_id' });

Filme.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(Filme, { foreignKey: 'user_id' });

// Galerias
Galeria.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
User.hasMany(Galeria, { foreignKey: 'user_id' });

Galeria.hasMany(GaleriaImagem, { foreignKey: 'galeria_id', as: 'imagens' });
GaleriaImagem.belongsTo(Galeria, { foreignKey: 'galeria_id' });

GaleriaImagem.belongsTo(User, { foreignKey: 'user_id', as: 'uploader' });

Galeria.belongsToMany(User, { through: GaleriaPermissao, foreignKey: 'galeria_id', otherKey: 'user_id', as: 'colaboradores' });
User.belongsToMany(Galeria, { through: GaleriaPermissao, foreignKey: 'user_id', otherKey: 'galeria_id', as: 'galerias_permitidas' });

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
    Friendship,
    Notification,
    Filme,
    Genero,
    FilmeGenero,
    ImagemDoDia,
    ImagemDoDiaBorder,
    Galeria,
    GaleriaImagem,
    GaleriaPermissao
};
