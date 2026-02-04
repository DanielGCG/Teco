const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Galeria = sequelize.define('Galeria', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(160),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    publicid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
        defaultValue: DataTypes.UUIDV4
    },
    ispublic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    coverurl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    backgroundurl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    backgroundfill: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'cover'
    },
    backgroundcolor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#e2e1cf'
    },
    cardcolor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#ffffff'
    },
    fontcolor: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#3E3F29'
    },
    fontfamily: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Inter'
    },
    gridxsize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 12
    },
    gridysize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 12
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    editedat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    createdbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    }
}, {
    tableName: 'gallery',
    timestamps: false
});

Galeria.prototype.toJSON = function () {
    const values = { ...this.get() };

    if (values.owner && values.owner.publicid) {
        values.createdbyUserId = values.owner.publicid;
    }

    return values;
};

const GaleriaItem = sequelize.define('GaleriaItem', {
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
    galleryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('image/gif', 'video', 'audio', 'text', 'embed'),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    showtitle: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    textbody: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    coverurl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    covercolor: {
        type: DataTypes.STRING(7),
        allowNull: true
    },
    contenturl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    objectfit: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'cover'
    },
    startpositionx: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    startpositiony: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    endpositionx: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    endpositiony: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    positionz: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    createdat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    editedat: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    editedbyUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    }
}, {
    tableName: 'galleryitem',
    timestamps: false
});

GaleriaItem.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.galleryId;
    delete values.editedbyUserId;

    if (values.uploader && values.uploader.publicid) {
        values.editedbyUserId = values.uploader.publicid;
    }

    return values;
};

const GaleriaContributor = sequelize.define('GaleriaContributor', {
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true
    },
    galleryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true
    }
}, {
    tableName: 'gallerycontributor',
    timestamps: false
});

module.exports = { Galeria, GaleriaItem, GaleriaContributor };