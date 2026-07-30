# Teco

O **Teco** é uma rede social desenvolvida em Node.js, oferecendo perfis personalizáveis, publicações de posts, troca de mensagens, gerenciamento de blogs, listas de filmes e séries, pets virtuais e outros recursos de interação. 

---

## 📋 Resumo

A aplicação foi estruturada utilizando **Node.js**, **Express**, **Sequelize** e **EJS** e **Socket.IO**. Possui um painel administrativo integrado para gestão de usuários, moderação de conteúdo e configurações do sistema.

---

## ✨ Funcionalidades Implementadas

### 👤 Autenticação & Gestão de Contas
- **Registro e Login**: Autenticação protegida por hash de senhas (`bcrypt`) e controle de sessão (`JWT`/Cookies).
- **Controle de Acesso (RBAC)**: Sistema de permissões baseadas em funções/papéis (usuário, moderador, administrador).
- **Gestão de Perfil**: Atualização de avatar, capa, biografia e informações pessoais.
- **Redefinição de Senha**: Funcionalidades de recuperação e alteração de credenciais.

### 🤝 Interações
- **Feed de Publicações**: Criação de postagens com suporte a anexos de mídia, curtidas, menções e bookmarks.
- **Sistema de Conexões**: Lista de amigos e seguidores.
- **Conquistas e Selos**: Atribuição de Insígnias (Badges) e Selos (Stamps) visíveis nos perfis.
- **Cutucadas**: Envio de interação entre usuários, semelhante ao do MSN.
- **Rodinhas (em breve)**: Sistema de círculos de amizade e conexão.

### ✉️ Comunicação
- **Cartinhas**: Envio de cartas virtuais entre usuários, organizadas em caixas de entrada, enviados e favoritos.
- **Notificações**: Sistema de notificações in-app e suporte a Notificações Push de navegador (Web-Push/VAPID).

### 👾 Pet Virtual (em desenvolvimento)
- **Adoção e Estado**: Cada usuário pode manter um pet virtual com acompanhamento de atributos de sobrevivência (Fome, Felicidade, Energia e Saúde).
- **Inventário de Itens**: Armazenamento e consumo de itens (alimentos, brinquedos, medicamentos).

### 📸 Mídia
- **Galeria de Mídias**: Upload e exibição de mídias em um mural interativo.
- **Imagem do Dia**: Sistema para os usuários sugerirem imagens de destaque.
- **Blog Pessoal**: Ferramenta de publicação de artigos com engajamento por meio de aplausos.
- **Watchlist**: Gerenciador de filmes e séries, no qual a comunidade pode marcar como assistido e dar nota para obras.

### ⚙️ Painel Administrativo
- **Moderação**: Edição de dados de perfil, alteração de níveis de privilégio e redefinição forçada de credenciais.
- **Aprovação de Conteúdo**: Moderação de imagens enviadas para a "Imagem do Dia" e controle das galerias.
- **Configurações do Sistema**: Modificação de parâmetros dinâmicos globais (`SystemConfig`).

---

## 🛠️ Tecnologias utilizadas

### Backend
- **Node.js (v20.x)** & **Express.js (v5.x)**
- **Sequelize ORM** e banco de dados **MariaDB (SQL)**
- **Socket.IO** (WebSockets para marcador de online e notificações em tempo real)
- **Node-Cron** (Agendamento de rotinas internas)

### Frontend
- **EJS** & **Express EJS Layouts**
- **CSS Customizado** e **HTML5**

### Processamento, Utilitários & Segurança
- **Bcrypt** e **Cookie-Parser**
- **Multer** e **Sharp**
- **Zod**
- **Web-Push**
- **Axios**

---

## 🚀 Instruções de Execução

### Pré-requisitos
- Node.js
- Instância ativa do MariaDB (utilize o esquema db/01.sql)

### Configuração Inicial

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/DanielGCG/Teco.git
   cd Teco
   ```

2. **Instale as dependências via npm:**
   ```bash
   npm install
   ```

3. **Definição das Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto com o seguinte formato:
   ```env
   PORT=
   DB_HOST=
   DB_USER=
   DB_PASS=
   DB_NAME=
   VERSION
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

A aplicação estará rodando localmente na porta configurada e poderá ser acessada via `http://localhost:PORT`.