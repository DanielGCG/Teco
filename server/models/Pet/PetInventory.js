const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PetInventory = sequelize.define('PetInventory', {
    petId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    itemId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'petinventory',
    timestamps: false
});

module.exports = PetInventory;