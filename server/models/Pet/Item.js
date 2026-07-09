const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Item = sequelize.define('Item', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    publicid: { type: DataTypes.STRING(36), allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(64), allowNull: false },
    type: { type: DataTypes.ENUM('food', 'water', 'soap', 'toy'), allowNull: false },
    value: { type: DataTypes.INTEGER, allowNull: false },
    emoji: { type: DataTypes.STRING(10), allowNull: true },
    imageurl: { type: DataTypes.STRING(255), allowNull: true }
}, {
    tableName: 'item',
    timestamps: false
});

Item.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.id;
    return values;
};

module.exports = Item;