const crypto = require('crypto');

// A chave está no padrão aes-256-cbc.
const getEncryptionKey = () => {
    const key = process.env.CARTINHA_ENCRYPTION_KEY;
    if (!key) return null;

    // Se for uma string hexadecimal de 64 caracteres (32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
        return Buffer.from(key, 'hex');
    }

    // Se for uma string normal de 32 caracteres (32 bytes)
    if (key.length === 32) {
        return Buffer.from(key, 'utf8');
    }

    else {
        return null;
    }
};

const encrypt = (text) => {
    if (!text) return text;
    const key = getEncryptionKey();
    if (!key) return text; // Se não houver chave configurada, salva sem criptografia (fallback)

    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        console.error('Erro na criptografia:', err);
        return text;
    }
};

const decrypt = (text) => {
    if (!text) return text;
    // Se o texto não contiver ':' provavelmemte não está criptografado (legado)
    if (!text.includes(':')) return text;
    
    const key = getEncryptionKey();
    if (!key) return text;

    try {
        const textParts = text.split(':');
        // Se a string contiver ':' mas não for um hex válido de 16 bytes, pode ser um falso positivo.
        if (textParts[0].length !== 32) return text;

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        // Em caso de erro na descriptografia, retorna o texto original.
        console.error('Erro na descriptografia:', err);
        return text;
    }
};

module.exports = {
    encrypt,
    decrypt
};
