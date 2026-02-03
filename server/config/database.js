const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.mysql_database,
    process.env.mysql_user,
    process.env.mysql_password,
    {
        host: process.env.mysql_host,
        dialect: 'mysql',
        logging: false, // Mude para console.log para ver as queries SQL
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: false, // Desativa createdAt e updatedAt automáticos
            underscored: false // Mantém os nomes das colunas como definidos nos modelos
        }
    }
);

// Teste de conexão
sequelize.authenticate()
    .then(() => console.log('✓ Conexão com banco de dados estabelecida com sucesso'))
    .catch(err => console.error('✗ Erro ao conectar ao banco de dados:', err));

module.exports = sequelize;
