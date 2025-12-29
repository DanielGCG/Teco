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
const { Galeria, GaleriaItem, GaleriaPermissao } = require('./Galeria');

// Associações Imagem do Dia
ImagemDoDia.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(ImagemDoDia, { foreignKey: 'user_id' });

// Associações Watchlist
Filme.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
User.hasMany(Filme, { foreignKey: 'user_id' });

// --- Associações de Galeria (CORRIGIDAS PARA INGLÊS) ---

// Dono da galeria
Galeria.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
User.hasMany(Galeria, { foreignKey: 'user_id' });

// Itens da galeria (Mudado de 'imagens' para 'items')
Galeria.hasMany(GaleriaItem, { foreignKey: 'gallery_id', as: 'items' });
GaleriaItem.belongsTo(Galeria, { foreignKey: 'gallery_id' });

// Uploader do item
GaleriaItem.belongsTo(User, { foreignKey: 'user_id', as: 'uploader' });

// Colaboradores (Mudado de 'colaboradores' para 'collaborators')
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
    GaleriaItem,
    GaleriaPermissao
};