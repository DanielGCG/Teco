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
    FilmeGenero
};
