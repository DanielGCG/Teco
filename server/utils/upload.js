const multer = require('multer');

// Configuração padrão
const upload = multer({ storage: multer.memoryStorage() });

// Configuração para imagens pesadas (limite de 50MB)
const uploadImage = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 50 * 1024 * 1024 } 
});

// Configuração para vídeos pesados (limite de 100MB)
const uploadVideo = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } 
});

module.exports = {
    upload,
    uploadImage,
    uploadVideo
};
