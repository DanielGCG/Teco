const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Pet = sequelize.define('Pet', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    publicid: { type: DataTypes.STRING(36), allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(64), allowNull: false },
    
    // Stats
    fome:     { type: DataTypes.FLOAT, allowNull: false, defaultValue: 80 },
    sede:     { type: DataTypes.FLOAT, allowNull: false, defaultValue: 80 },
    limpeza:  { type: DataTypes.FLOAT, allowNull: false, defaultValue: 80 },
    sono:     { type: DataTypes.FLOAT, allowNull: false, defaultValue: 80 },
    diversao: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 80 },
    sleeping: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    
    // Resgate Diário
    lastDailyClaim: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null },
    
    // Morte
    dead:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    diedAt:     { type: DataTypes.DATE,    allowNull: true,  defaultValue: null },
    deathCause: {
        type: DataTypes.ENUM('fome', 'sede', 'limpeza', 'loucura'),
        allowNull: true,
        defaultValue: null
    },
    
    lastUpdate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    createdat:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    tableName: 'pet',
    timestamps: false
});

Pet.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    delete values.userId;
    return values;
};

module.exports = Pet;