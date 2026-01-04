const express = require("express");
const PostsRouter = express.Router();
const { Post, PostMedia, PostLike, PostBookmark, PostMention, User, Notification, Follow } = require("../models");
const { createNotification } = require("./notifications");
const { Op } = require("sequelize");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');

const upload = multer({ storage: multer.memoryStorage() });

const POST_INCLUDES = [
    { model: User, as: 'author', attributes: ['username', 'profile_image', 'pronouns'] },
    { model: PostMedia, as: 'media' },
    { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username'] }] },
    { model: PostBookmark, as: 'bookmarks', attributes: ['user_id'] },
    { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] },
    { 
        model: Post, 
        as: 'parent', 
        include: [
            { model: User, as: 'author', attributes: ['username', 'profile_image', 'pronouns'] },
            { model: PostMedia, as: 'media' },
            { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] },
            {
                model: Post,
                as: 'parent',
                include: [
                    { model: User, as: 'author', attributes: ['username', 'profile_image', 'pronouns'] }
                ]
            }
        ] 
    }
];

// POST /posts - Criar um post (ou reply/repost)
PostsRouter.post('/', upload.array('media', 4), async (req, res) => {
    try {
        const { content, parent_id, type } = req.body;
        const userId = req.user.id;

        if (!content && (!req.files || req.files.length === 0) && type !== 'repost') {
            return res.status(400).json({ error: 'O post deve ter texto ou mídia.' });
        }

        if (content && content.length > 300) {
            return res.status(400).json({ error: 'O texto deve ter no máximo 300 caracteres.' });
        }

        const post = await Post.create({
            user_id: userId,
            content: content,
            parent_id: parent_id,
            type: type
        });

        // Processar mídia
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaUrl = await uploadToFileServer({
                    buffer: file.buffer,
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    folder: 'posts'
                });
                const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                await PostMedia.create({
                    post_id: post.id,
                    url: mediaUrl,
                    type: mediaType
                });
            }
        }

        // Processar menções
        if (content) {
            const usernames = content.match(/@(\w+)/g);
            if (usernames) {
                const uniqueUsernames = [...new Set(usernames)];
                const mentionedUsers = await User.findAll({
                    where: { username: uniqueUsernames }
                });

                for (const mentionedUser of mentionedUsers) {
                    await PostMention.create({
                        post_id: post.id,
                        user_id: mentionedUser.id,
                        mentioned_username: mentionedUser.username
                    });

                    // Notificar usuário mencionado
                    if (mentionedUser.id !== userId) {
                        await createNotification({
                            userId: mentionedUser.id,
                            type: 'MENTION',
                            title: 'Menção em Post',
                            body: `${req.user.username} mencionou você em um post.`,
                            link: `/${req.user.username}?post=${post.id}`
                        });
                    }
                }
            }
        }

        // Se for um reply ou repost, notificar o autor do post original e atualizar contadores
        if (parent_id) {
            const parentPost = await Post.findByPk(parent_id, {
                include: [{ model: User, as: 'author', attributes: ['username'] }]
            });
            if (parentPost) {
                if (type === 'reply') {
                    await parentPost.increment('replies_count');
                } else if (type === 'repost') {
                    await parentPost.increment('reposts_count');
                }

                // Emitir atualização do pai via socket
                const io = req.app.get('io');
                if (io) {
                    io.to(`profile_${parentPost.author.username}`).emit('postUpdate', { 
                        id: parentPost.id, 
                        replies_count: type === 'reply' ? parentPost.replies_count + 1 : parentPost.replies_count,
                        reposts_count: type === 'repost' ? parentPost.reposts_count + 1 : parentPost.reposts_count
                    });
                }

                if (parentPost.user_id !== userId) {

                    const notifType = type === 'reply' ? 'POST_REPLY' : 'POST_REPOST';
                    const notifTitle = type === 'reply' ? 'Nova Resposta' : 'Novo Repost';
                    const notifBody = type === 'reply' 
                        ? `${req.user.username} respondeu ao seu post.`
                        : `${req.user.username} repostou seu post.`;
                    
                    await createNotification({
                        userId: parentPost.user_id,
                        type: notifType,
                        title: notifTitle,
                        body: notifBody,
                        link: `/${req.user.username}?post=${post.id}`
                    });
                }
            }
        }

        // Buscar post completo para emitir via socket e retornar
        const fullPost = await Post.findByPk(post.id, {
            include: POST_INCLUDES
        });

        // Emitir via socket para a sala do perfil
        const io = req.app.get('io');
        if (io) {
            io.to(`profile_${req.user.username}`).emit('newPost', fullPost);
        }

        res.status(201).json(fullPost);
    } catch (error) {
        console.error('[Posts] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro interno ao criar post.' });
    }
});

// GET /posts/feed - Feed global (seguidos + outros)
PostsRouter.get('/feed', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || 'for-you';

        // Buscar IDs de quem o usuário segue
        const following = await Follow.findAll({
            where: { follower_id: userId },
            attributes: ['following_id']
        });
        const followingIds = following.map(f => f.following_id);
        
        // Incluir o próprio usuário no feed
        followingIds.push(userId);

        let where = {
            is_deleted: false,
            type: { [Op.ne]: 'reply' }
        };

        if (type === 'following') {
            where.user_id = { [Op.in]: followingIds };
        } else {
            // for-you: posts de quem segue + posts públicos (tipo 'post')
            where[Op.or] = [
                { user_id: { [Op.in]: followingIds } },
                { type: 'post' }
            ];
        }

        const posts = await Post.findAll({
            where,
            include: POST_INCLUDES,
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        res.json(posts);
    } catch (error) {
        console.error('[Posts] Erro ao buscar feed:', error);
        res.status(500).json({ error: 'Erro ao buscar feed.' });
    }
});

// GET /posts/user/:username - Listar posts de um usuário
PostsRouter.get('/user/:username', async (req, res) => {
    try {
        let username = req.params.username;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const user = await User.findOne({ where: { username: username } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const posts = await Post.findAll({
            where: { 
                user_id: user.id, 
                type: { [Op.ne]: 'reply' },
                is_deleted: false 
            },
            include: POST_INCLUDES,
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        res.json(posts);
    } catch (error) {
        console.error('[Posts] Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro interno ao buscar posts.', details: error.message });
    }
});

// GET /posts/:id/replies - Listar respostas de um post
PostsRouter.get('/:id/replies', async (req, res) => {
    try {
        const replies = await Post.findAll({
            where: { 
                parent_id: req.params.id, 
                type: 'reply',
                is_deleted: false 
            },
            include: [
                { model: User, as: 'author', attributes: ['username', 'profile_image'] },
                { model: PostMedia, as: 'media' },
                { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] }
            ],
            order: [['created_at', 'ASC']]
        });
        res.json(replies);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar respostas.' });
    }
});

// POST /posts/:id/like - Curtir/Descurtir
PostsRouter.post('/:id/like', async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        const existingLike = await PostLike.findOne({
            where: { post_id: postId, user_id: userId }
        });

        const post = await Post.findByPk(postId, {
            include: [{ model: User, as: 'author', attributes: ['username'] }]
        });

        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        if (existingLike) {
            await existingLike.destroy();
            if (post.likes_count > 0) {
                await post.decrement('likes_count');
            }
            const newCount = Math.max(0, post.likes_count - 1);
            
            // Emitir atualização via socket
            const io = req.app.get('io');
            if (io) {
                io.to(`profile_${post.author.username}`).emit('postUpdate', { 
                    id: post.id, 
                    likes_count: newCount 
                });
            }

            return res.json({ liked: false, likes_count: newCount });
        } else {
            await PostLike.create({ post_id: postId, user_id: userId });
            await post.increment('likes_count');
            const newCount = post.likes_count + 1;
            
            // Emitir atualização via socket
            const io = req.app.get('io');
            if (io) {
                io.to(`profile_${post.author.username}`).emit('postUpdate', { 
                    id: post.id, 
                    likes_count: newCount 
                });
            }

            // Notificar autor do post
            if (post.user_id !== userId) {
                await createNotification({
                    userId: post.user_id,
                    type: 'POST_LIKE',
                    title: 'Nova Curtida',
                    body: `${req.user.username} curtiu seu post.`,
                    link: `/${post.author.username}`
                });
            }
            
            return res.json({ liked: true, likes_count: newCount });
        }

    } catch (error) {
        console.error('[Posts] Erro ao curtir:', error);
        res.status(500).json({ error: 'Erro interno ao processar curtida.' });
    }
});

// GET /posts/:id - Buscar um post específico (com ancestralidade)
PostsRouter.get('/:id', async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id, {
            include: POST_INCLUDES
        });
        if (!post || post.is_deleted) return res.status(404).json({ error: 'Post não encontrado ou deletado.' });

        // Buscar ancestralidade (pais)
        const ancestry = [];
        let currentParentId = post.parent_id;
        let depth = 0;
        
        while (currentParentId && depth < 10) {
            const parent = await Post.findByPk(currentParentId, {
                include: [
                    { model: User, as: 'author', attributes: ['username', 'profile_image', 'pronouns'] },
                    { model: PostMedia, as: 'media' },
                    { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] }
                ]
            });
            
            if (!parent) break;
            ancestry.unshift(parent);
            currentParentId = parent.parent_id;
            depth++;
        }

        res.json({ ...post.toJSON(), ancestry });
    } catch (error) {
        console.error('[Posts] Erro ao buscar post:', error);
        res.status(500).json({ error: 'Erro ao buscar post.' });
    }
});

// GET /posts/user/:username/bookmarks - Listar favoritos de um usuário
PostsRouter.get('/user/:username/bookmarks', async (req, res) => {
    try {
        let username = req.params.username;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const user = await User.findOne({ where: { username: username } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        // Apenas o próprio usuário pode ver seus favoritos
        if (req.user.id !== user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para ver os favoritos deste usuário.' });
        }

        const bookmarks = await PostBookmark.findAll({
            where: { user_id: user.id },
            include: [{
                model: Post,
                where: { is_deleted: false },
                required: true,
                include: POST_INCLUDES
            }],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        const posts = bookmarks.map(b => b.Post);
        res.json(posts);
    } catch (error) {
        console.error('[Posts] Erro ao buscar favoritos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar favoritos.' });
    }
});

// POST /posts/:id/bookmark - Favoritar/Desfavoritar
PostsRouter.post('/:id/bookmark', async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        const existingBookmark = await PostBookmark.findOne({
            where: { post_id: postId, user_id: userId }
        });

        if (existingBookmark) {
            await existingBookmark.destroy();
            return res.json({ bookmarked: false });
        } else {
            await PostBookmark.create({ post_id: postId, user_id: userId });
            return res.json({ bookmarked: true });
        }
    } catch (error) {
        console.error('[Posts] Erro ao favoritar:', error);
        res.status(500).json({ error: 'Erro interno ao processar favorito.' });
    }
});

// DELETE /posts/:id - Deletar um post
PostsRouter.delete('/:id', async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        // Apenas o autor pode deletar
        if (post.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para deletar este post.' });
        }

        // Se for um reply ou repost, decrementar contador do pai
        if (post.parent_id) {
            const parentPost = await Post.findByPk(post.parent_id);
            if (parentPost) {
                if (post.type === 'reply' && parentPost.replies_count > 0) {
                    await parentPost.decrement('replies_count');
                } else if (post.type === 'repost' && parentPost.reposts_count > 0) {
                    await parentPost.decrement('reposts_count');
                }
            }
        }

        // Verificar se existem reposts ou replies que dependem deste post
        const childrenCount = await Post.count({ where: { parent_id: post.id } });

        // Buscar mídias para deletar do servidor de arquivos
        const media = await PostMedia.findAll({ where: { post_id: post.id } });
        for (const m of media) {
            await deleteFromFileServer({ fileUrl: m.url });
        }

        // Deletar registros de mídia do banco (independente de ser soft ou hard delete)
        await PostMedia.destroy({ where: { post_id: post.id } });

        // Buscar autor para emitir via socket
        const author = await User.findByPk(post.user_id);

        if (childrenCount > 0) {
            // Soft delete: mantém o registro para não quebrar a integridade das correntes
            await post.update({
                content: null,
                is_deleted: true
            });
        } else {
            // Hard delete: remove completamente se ninguém depender dele
            await post.destroy();
        }

        // Emitir deleção via socket
        const io = req.app.get('io');
        if (io && author) {
            io.to(`profile_${author.username}`).emit('postDeleted', post.id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Posts] Erro ao deletar:', error);
        res.status(500).json({ error: 'Erro interno ao deletar post.' });
    }
});

module.exports = PostsRouter;
