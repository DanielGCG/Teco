const sharp = require('sharp');

/**
 * Processa um buffer de arquivo de imagem.
 * Lida automaticamente com GIFs (preserva a animação) e converte outros formatos para PNG.
 * 
 * @param {Object} file - O objeto de arquivo recebido pelo multer (deve conter buffer e mimetype)
 * @param {Object} options - Opções adicionais { width, height, fit, name }
 * @returns {Object} Um objeto contendo { buffer, filename, mimetype }
 */
async function processImage(file, options = {}) {
    let filename = options.name || 'image';
    let mimetype = 'image/png';
    let processedBuffer;

    if (file.mimetype === 'image/gif') {
        filename = `${filename}.gif`;
        mimetype = 'image/gif';
        const sharpInstance = sharp(file.buffer, { animated: true });
        
        if (options.width || options.height) {
            sharpInstance.resize({ 
                width: options.width, 
                height: options.height, 
                fit: options.fit || 'inside' 
            });
        }
        
        processedBuffer = await sharpInstance.gif().toBuffer();
    } else {
        filename = `${filename}.png`;
        mimetype = 'image/png';
        const sharpInstance = sharp(file.buffer);

        if (options.width || options.height) {
            sharpInstance.resize({ 
                width: options.width, 
                height: options.height, 
                fit: options.fit || 'inside' 
            });
        }
        
        processedBuffer = await sharpInstance.png().toBuffer();
    }

    return { buffer: processedBuffer, filename, mimetype };
}

module.exports = { processImage };
