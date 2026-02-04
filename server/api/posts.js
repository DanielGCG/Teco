const express = require("express");
const PostsRouter = express.Router();
const { Post, PostMedia, PostLike, PostBookmark, PostMention, User, Notification, Follow } = require("../models");
const { createNotification } = require("./notifications");
const { Op } = require("sequelize");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');

const upload = multer({ storage: multer.memoryStorage() });

const POST_INCLUDES = [
    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns', 'publicid'] },
    { model: PostMedia, as: 'media' },
    { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username', 'publicid'] }] },
    { model: PostBookmark, as: 'bookmarks', include: [{ model: User, as: 'user', attributes: ['publicid'] }] },
    { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username', 'publicid'] }] },
    { 
        model: Post, 
        as: 'parent', 
        include: [
            { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns', 'publicid'] },
            { model: PostMedia, as: 'media' },
            { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username', 'publicid'] }] },
            {
                model: Post,
                as: 'parent',
                include: [
                    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns', 'publicid'] }
                ]
            }
        ] 
    }
];

// POST /posts - Criar um post (ou reply/repost)
PostsRouter.post('/', upload.array('media', 4), async (req, res) => {
    try {
        const { content, type } = req.body;
        // Frontend deve enviar como attachedPostPublicId
        const attachedPostPublicId = req.body.attachedPostPublicId || req.body.attachedPostId;
        const userId = req.user.id;

        if (!content && (!req.files || req.files.length === 0) && type !== 'repost') {
            return res.status(400).json({ error: 'O post deve ter texto ou mídia.' });
        }

        if (content && content.length > 400) {
            return res.status(400).json({ error: 'O texto deve ter no máximo 400 caracteres.' });
        }

        let attachedPostId = null;
        if (attachedPostPublicId) {
            const parentPost = await Post.findOne({ where: { publicid: attachedPostPublicId } });
            if (parentPost) {
                attachedPostId = parentPost.id;
            }
        }

        const post = await Post.create({
            authorUserId: userId,
            content: content,
            attachedPostId: attachedPostId,
            type: type
        });

        // Incrementar contadores no post pai se for reply ou repost
        if (attachedPostId) {
            if (type === 'repost' || type === 'reply') {
                await Post.increment('repostcount', { where: { id: attachedPostId } });
            } else if (type === 'comment') {
                await Post.increment('replycount', { where: { id: attachedPostId } });
            }
        }

        // Processar mídia
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaUrl = await uploadToFileServer({
                    buffer: file.buffer,
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    folder: 'posts'
                });
                const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image/gif';
                await PostMedia.create({
                    postId: post.id,
                    url: mediaUrl,
                    type: mediaType
                });
            }
        }

        // Processar menções
        if (content) {
            const usernames = content.match(/@(\w+)/g);
            if (usernames) {
                const uniqueUsernames = [...new Set(usernames.map(u => u.substring(1)))];
                const mentionedUsers = await User.findAll({
                    where: { username: uniqueUsernames }
                });

                for (const mentionedUser of mentionedUsers) {
                    await PostMention.create({
                        postId: post.id,
                        userId: mentionedUser.id
                    });

                    // Notificar usuário mencionado
                    if (mentionedUser.id !== userId) {
                        await createNotification({
                            userId: mentionedUser.id,
                            type: 'info', // 'MENTION' não está no ENUM do SQL, usando 'info'
                            title: 'Menção em Post',
                            body: `${req.user.username} mencionou você em um post.`,
                            link: `/${req.user.username}/status/${post.publicid}`
                        });

                        // Emitir via socket
                        const io = req.app.get('io');
                        if (io) {
                            io.to(`user_${mentionedUser.id}`).emit('newNotification', { type: 'mention' });
                        }
                    }
                }
            }
        }

        // Se for um reply ou repost, notificar o autor do post original e atualizar contadores
        if (attachedPostId) {
            const parentPost = await Post.findByPk(attachedPostId, {
                include: [{ model: User, as: 'author', attributes: ['username'] }]
            });
            if (parentPost) {
                // Já incrementamos no banco lá no início, então apenas emitimos o valor atual
                
                // Emitir atualização do pai via socket
                const io = req.app.get('io');
                if (io) {
                    io.to(`profile_${parentPost.author.username}`).emit('postUpdate', { 
                        id: parentPost.publicid, 
                        replycount: parentPost.replycount,
                        repostcount: parentPost.repostcount
                    });
                }

                if (parentPost.authorUserId !== userId) {

                    const notifType = (type === 'repost' || type === 'reply') ? 'postrepost' : 'postcomment';
                    const notifTitle = (type === 'repost' || type === 'reply') ? 'Novo Repost' : 'Nova Resposta';
                    let notifBody;
                    if (type === 'repost') {
                        notifBody = `${req.user.username} repostou seu post.`;
                    } else if (type === 'reply') {
                        notifBody = `${req.user.username} repostou seu post com comentário.`;
                    } else {
                        notifBody = `${req.user.username} respondeu ao seu post.`;
                    }
                    
                    await createNotification({
                        userId: parentPost.authorUserId,
                        type: notifType,
                        title: notifTitle,
                        body: notifBody,
                        link: `/${req.user.username}/status/${post.publicid}`
                    });

                    // Emitir via socket
                    const io = req.app.get('io');
                    if (io) {
                        io.to(`user_${parentPost.authorUserId}`).emit('newNotification', { type: type });
                    }
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
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || 'for-you';

        // Buscar IDs de quem o usuário segue
        const following = await Follow.findAll({
            where: { followerUserId: userId },
            attributes: ['followedUserId']
        });
        const followingIds = following.map(f => f.followedUserId);
        
        // Incluir o próprio usuário no feed
        followingIds.push(userId);

        let where = {
            type: { [Op.ne]: 'comment' }
        };

        if (type === 'following') {
            where.authorUserId = { [Op.in]: followingIds };
        } else {
            // for-you: posts de quem segue + posts públicos (tipo 'post')
            where[Op.or] = [
                { authorUserId: { [Op.in]: followingIds } },
                { type: 'post' }
            ];
        }

        const posts = await Post.findAll({
            where,
            include: POST_INCLUDES,
            order: [['createdat', 'DESC']],
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
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const user = await User.findOne({ where: { username: username } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const posts = await Post.findAll({
            where: { 
                authorUserId: user.id, 
                type: { [Op.ne]: 'comment' }
            },
            include: POST_INCLUDES,
            order: [['createdat', 'DESC']],
            limit: limit,
            offset: offset
        });

        res.json(posts);
    } catch (error) {
        console.error('[Posts] Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro interno ao buscar posts.', details: error.message });
    }
});

// GET /posts/:publicid/replies - Listar respostas de um post
PostsRouter.get('/:publicid/replies', async (req, res) => {
    try {
        const { publicid } = req.params;
        const parentPost = await Post.findOne({ where: { publicid: publicid } });
        if (!parentPost) return res.status(404).json({ error: 'Post pai não encontrado.' });

        const replies = await Post.findAll({
            where: { 
                attachedPostId: parentPost.id, 
                type: 'comment'
            },
            include: [
                { model: User, as: 'author', attributes: ['username', 'profileimage'] },
                { model: PostMedia, as: 'media' },
                { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] }
            ],
            order: [
                ['likecount', 'DESC'],
                ['createdat', 'ASC']
            ]
        });
        res.json(replies);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar respostas.' });
    }
});

// POST /posts/:publicid/like - Curtir/Descurtir
PostsRouter.post('/:publicid/like', async (req, res) => {
    try {
        const { publicid } = req.params;
        const userId = req.user.id;

        const post = await Post.findOne({
            where: { publicid: publicid },
            include: [{ model: User, as: 'author', attributes: ['username'] }]
        });

        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
        const postId = post.id;

        const existingLike = await PostLike.findOne({
            where: { postId: postId, userId: userId }
        });

        if (existingLike) {
            await existingLike.destroy();
            await post.reload();
            
            // Emitir atualização via socket
            const io = req.app.get('io');
            if (io) {
                io.to(`profile_${post.author.username}`).emit('postUpdate', { 
                    publicid: post.publicid, 
                    likecount: post.likecount 
                });
            }

            return res.json({ liked: false, likecount: post.likecount, publicid: post.publicid });
        } else {
            await PostLike.create({ postId: postId, userId: userId });
            await post.reload();
            
            // Emitir atualização via socket
            const io = req.app.get('io');
            if (io) {
                io.to(`profile_${post.author.username}`).emit('postUpdate', { 
                    publicid: post.publicid, 
                    likecount: post.likecount 
                });
            }

            // Notificar autor do post
            if (post.authorUserId !== userId) {
                await createNotification({
                    userId: post.authorUserId,
                    type: 'info',
                    title: 'Nova Curtida',
                    body: `${req.user.username} curtiu seu post.`,
                    link: `/${post.author.username}/status/${post.publicid}`
                });

                // Emitir via socket
                const io = req.app.get('io');
                if (io) {
                    io.to(`user_${post.authorUserId}`).emit('newNotification', { type: 'like' });
                }
            }
            
            return res.json({ liked: true, likecount: post.likecount, publicid: post.publicid });
        }

    } catch (error) {
        console.error('[Posts] Erro ao curtir:', error);
        res.status(500).json({ error: 'Erro interno ao processar curtida.' });
    }
});

// GET /posts/:publicid - Buscar um post específico (com ancestralidade)
PostsRouter.get('/:publicid', async (req, res) => {
    try {
        const { publicid } = req.params;
        const post = await Post.findOne({
            where: { publicid: publicid },
            include: POST_INCLUDES
        });
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        // Buscar ancestralidade (pais)
        const ancestry = [];
        let currentParentId = post.attachedPostId;
        let depth = 0;
        
        while (currentParentId && depth < 10) {
            const parent = await Post.findByPk(currentParentId, {
                include: [
                    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns', 'publicid'] },
                    { model: PostMedia, as: 'media' },
                    { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username', 'publicid'] }] }
                ]
            });
            
            if (!parent) break;
            ancestry.unshift(parent);
            currentParentId = parent.attachedPostId;
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
            where: { userId: user.id },
            include: [{
                model: Post,
                required: true,
                include: POST_INCLUDES
            }],
            order: [['createdat', 'DESC']],
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

// POST /posts/:publicid/bookmark - Favoritar/Desfavoritar
PostsRouter.post('/:publicid/bookmark', async (req, res) => {
    try {
        const { publicid } = req.params;
        const userId = req.user.id;

        const post = await Post.findOne({ where: { publicid: publicid } });
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
        const postId = post.id;

        const existingBookmark = await PostBookmark.findOne({
            where: { postId: postId, userId: userId }
        });

        if (existingBookmark) {
            await existingBookmark.destroy();
            await post.reload();
            return res.json({ bookmarked: false, bookmarkcount: post.bookmarkcount, publicid: post.publicid });
        } else {
            await PostBookmark.create({ postId: postId, userId: userId });
            await post.reload();
            return res.json({ bookmarked: true, bookmarkcount: post.bookmarkcount, publicid: post.publicid });
        }
    } catch (error) {
        console.error('[Posts] Erro ao favoritar:', error);
        res.status(500).json({ error: 'Erro interno ao processar favorito.' });
    }
});
// DELETE /posts/:publicid - Deletar um post
PostsRouter.delete('/:publicid', async (req, res) => {
    try {
        const { publicid } = req.params;
        const post = await Post.findOne({ where: { publicid: publicid } });
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        // Apenas o autor pode deletar
        if (post.authorUserId !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para deletar este post.' });
        }

        // Se for um reply ou repost, vamos decrementar o contador do pai manualmente
        if (post.attachedPostId) {
            if (post.type === 'repost' || post.type === 'reply') {
                await Post.decrement('repostcount', { where: { id: post.attachedPostId } });
            } else if (post.type === 'comment') {
                await Post.decrement('replycount', { where: { id: post.attachedPostId } });
            }

            // Notificar atualização do pai via socket
            const parent = await Post.findByPk(post.attachedPostId, {
                include: [{ model: User, as: 'author', attributes: ['username'] }]
            });
            if (parent && parent.author) {
                const io = req.app.get('io');
                if (io) {
                    io.to(`profile_${parent.author.username}`).emit('postUpdate', {
                        publicid: parent.publicid,
                        replycount: parent.replycount,
                        repostcount: parent.repostcount
                    });
                }
            }
        }

        // Buscar mídias para deletar do servidor de arquivos
        const media = await PostMedia.findAll({ where: { postId: post.id } });
        for (const m of media) {
            await deleteFromFileServer({ fileUrl: m.url });
        }

        // Buscar autor para emitir via socket
        const author = await User.findByPk(post.authorUserId);

        // Hard delete: remove completamente (o banco cuida dos ON DELETE CASCADE para mídia, likes, etc.)
        await post.destroy();

        // Emitir deleção via socket
        const io = req.app.get('io');
        if (io && author) {
            io.to(`profile_${author.username}`).emit('postDeleted', post.publicid);
        }

        res.json({ success: true, publicid: post.publicid });
    } catch (error) {
        console.error('[Posts] Erro ao deletar:', error);
        res.status(500).json({ error: 'Erro interno ao deletar post.' });
    }
});

module.exports = PostsRouter;
