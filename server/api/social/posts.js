const express = require("express");
const PostsRouter = express.Router();
const { Post, PostMedia, PostLike, PostMention, User, Follow, Notification, Rodinha } = require("../../models");
const { createNotification } = require("../notifications");
const { Op } = require("sequelize");
const { upload } = require('../../utils/upload');
const { uploadToFileServer, deleteFromFileServer } = require('../../utils/fileServer');
const { sanitizeFilename } = require('../../utils/sanitize');

const POST_INCLUDES = [
    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns', 'publicid'] },
    { model: PostMedia, as: 'media' },
    { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username', 'publicid'] }] },

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

// POST /posts/media/upload - Pré-upload de mídia
PostsRouter.post('/media/upload', upload.array('media', 4), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhuma mídia enviada.' });
        }

        const mediaObjects = await Promise.all(req.files.map(async file => {
            const mediaUrl = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizeFilename(file.originalname),
                mimetype: file.mimetype,
                folder: 'posts'
            });
            const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image/gif';
            return { url: mediaUrl, type: mediaType };
        }));

        res.status(200).json({ mediaUrls: mediaObjects });
    } catch (err) {
        console.error('Erro no pre-upload:', err);
        res.status(500).json({ error: 'Erro ao fazer upload da mídia.' });
    }
});

// DELETE /posts/media/upload - Excluir pré-upload cancelado
PostsRouter.delete('/media/upload', express.json(), async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL não fornecida.' });
        
        const success = await deleteFromFileServer(url);
        if (success) {
            res.json({ message: 'Arquivo deletado com sucesso.' });
        } else {
            res.status(500).json({ error: 'Erro ao deletar arquivo do servidor.' });
        }
    } catch (err) {
        console.error('Erro ao deletar pre-upload:', err);
        res.status(500).json({ error: 'Erro ao deletar arquivo.' });
    }
});

// POST /posts - Criar um post (ou reply/repost)
PostsRouter.post('/', express.json(), async (req, res) => {
    try {
        const { content, type, mediaUrls = [] } = req.body;
        const attachedPostPublicId = req.body.attachedPostPublicId;
        const userId = req.user.id;

        if (!content && (!mediaUrls || mediaUrls.length === 0) && type !== 'repost') {
            return res.status(400).json({ error: 'O post deve ter texto ou mídia.' });
        }

        if (content && content.length > 400) {
            return res.status(400).json({ error: 'O texto deve ter no máximo 400 caracteres.' });
        }

        let attachedPostId = null;
        let isrodinha = Boolean(req.body.isrodinha);

        if (attachedPostPublicId) {
            const parentPost = await Post.findOne({ where: { publicid: attachedPostPublicId } });
            if (!parentPost) {
                return res.status(404).json({ error: 'Post referenciado não encontrado.' });
            }
            attachedPostId = parentPost.id;
            
            // Herança obrigatória
            if (parentPost.isrodinha) {
                if (type === 'repost') {
                    return res.status(403).json({ error: 'Você não pode repostar um post de rodinha.' });
                }
                isrodinha = true;
            }
        }

        const post = await Post.create({
            authorUserId: userId,
            content: content,
            attachedPostId: attachedPostId,
            type: type,
            isrodinha: isrodinha
        });

        // Incrementar contador de posts do usuário
        await User.increment('postcount', { where: { id: userId } });

        // Incrementar contadores no post pai se for reply ou repost
        if (attachedPostId) {
            if (type === 'repost' || type === 'reply') {
                await Post.increment('repostcount', { where: { id: attachedPostId } });
            } else if (type === 'comment') {
                await Post.increment('replycount', { where: { id: attachedPostId } });
            }
        }

        // Processar mídia (Pre-upload via JSON)
        if (mediaUrls && mediaUrls.length > 0) {
            const mediaObjects = mediaUrls.map(media => ({
                postId: post.id,
                url: media.url,
                type: media.type
            }));
            await PostMedia.bulkCreate(mediaObjects);
        }

        // Processar menções
        if (content) {
            const usernames = content.match(/@(\w+)/g);
            if (usernames) {
                const uniqueUsernames = [...new Set(usernames.map(u => u.toLowerCase()))];
                const mentionedUsers = await User.findAll({
                    where: { username: uniqueUsernames }
                });

                if (mentionedUsers.length > 0) {
                    const mentionObjects = mentionedUsers.map(u => ({
                        postId: post.id,
                        userId: u.id
                    }));
                    await PostMention.bulkCreate(mentionObjects);

                    // Enviar notificações
                    await Promise.all(mentionedUsers.map(async mentionedUser => {
                        if (mentionedUser.id !== userId) {
                            await createNotification({
                                userId: mentionedUser.id,
                                type: 'info',
                                title: 'Menção em Post',
                                body: `${req.user.username} mencionou você em um post.`,
                                link: `/${req.user.username}/status/${post.publicid}`,
                                io: req.app.get('io'),
                                socketType: 'mention'
                            });
                        }
                    }));
                }
            }
        }

        // Buscar post completo para emitir via socket
        const fullPost = await Post.findByPk(post.id, {
            include: POST_INCLUDES
        });

        // Se for um reply ou repost, notificar o autor do post original e atualizar contadores
        if (attachedPostId) {
            const parentPost = await Post.findByPk(attachedPostId, {
                include: [{ model: User, as: 'author', attributes: ['username'] }]
            });
            if (parentPost) {
                // Emitir atualização do pai via socket
                const io = req.app.get('io');
                if (io) {
                    io.to(`profile_${parentPost.author.username}`).emit('postUpdate', { 
                        publicid: parentPost.publicid, 
                        replycount: parentPost.replycount,
                        repostcount: parentPost.repostcount
                    });
                    // Também emitir para a sala do próprio post (thread)
                    io.to(`post_${parentPost.publicid}`).emit('newReply', fullPost);
                    io.to(`post_${parentPost.publicid}`).emit('postUpdate', {
                        publicid: parentPost.publicid,
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
                        link: `/${req.user.username}/status/${post.publicid}`,
                        io: req.app.get('io'),
                        socketType: type
                    });
                }
            }
        }

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

// GET /posts/feed - Feed global
PostsRouter.get('/feed', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || 'for-you';

        // Buscar quem o usuário já segue
        const following = await Follow.findAll({
            where: { followerUserId: userId },
            attributes: ['followedUserId']
        });
        const followingIds = following.map(f => f.followedUserId);
        
        // Incluir o próprio usuário no feed
        followingIds.push(userId);

        // Buscar autores que colocaram este usuário em suas rodinhas
        const inRodinhas = await Rodinha.findAll({
            where: { targetUserId: userId },
            attributes: ['userId']
        });
        const inRodinhasIds = inRodinhas.map(r => r.userId);
        inRodinhasIds.push(userId); // Sempre pode ver sua própria rodinha

        const filterTypes = { [Op.in]: ['post', 'repost', 'reply'] };

        const rodinhaCondition = {
            [Op.or]: [
                { isrodinha: false },
                { isrodinha: true, authorUserId: { [Op.in]: inRodinhasIds } }
            ]
        };

        const where = type === 'following' 
            ? {
                type: filterTypes,
                authorUserId: { [Op.in]: followingIds },
                ...rodinhaCondition
            } 
            : {
                [Op.and]: [
                    { type: filterTypes },
                    rodinhaCondition,
                    {
                        [Op.or]: [
                            { authorUserId: { [Op.in]: followingIds } },
                            { type: 'post' } // Opcional: mostrar posts públicos mesmo de quem não segue
                        ]
                    }
                ]
            };

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

        // Verificar se tem acesso a rodinha do usuário
        let canViewRodinha = false;
        if (req.user.id === user.id) {
            canViewRodinha = true;
        } else {
            const isRodinhaMember = await Rodinha.findOne({
                where: { userId: user.id, targetUserId: req.user.id }
            });
            if (isRodinhaMember) canViewRodinha = true;
        }

        const whereCondition = { 
            authorUserId: user.id, 
            type: { [Op.in]: ['post', 'repost', 'reply'] }
        };

        if (!canViewRodinha) {
            whereCondition.isrodinha = false;
        }

        const posts = await Post.findAll({
            where: whereCondition,
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

// GET /posts/:publicid/replies - Listar respostas de um post (incluindo respostas de respostas)
PostsRouter.get('/:publicid/replies', async (req, res) => {
    try {
        const { publicid } = req.params;
        const parentPost = await Post.findOne({ where: { publicid: publicid } });
        if (!parentPost) return res.status(404).json({ error: 'Post pai não encontrado.' });

        const replies = await Post.findAll({
            where: { 
                attachedPostId: parentPost.id, 
                type: { [Op.in]: ['comment', 'reply'] }
            },
            include: POST_INCLUDES,
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
                const updateData = { 
                    publicid: post.publicid, 
                    likecount: post.likecount 
                };
                io.to(`profile_${post.author.username}`).emit('postUpdate', updateData);
                io.to(`post_${post.publicid}`).emit('postUpdate', updateData);
            }

            return res.json({ liked: false, likecount: post.likecount, publicid: post.publicid });
        } else {
            await PostLike.create({ postId: postId, userId: userId });
            await post.reload();
            
            // Emitir atualização via socket
            const io = req.app.get('io');
            if (io) {
                const updateData = { 
                    publicid: post.publicid, 
                    likecount: post.likecount 
                };
                io.to(`profile_${post.author.username}`).emit('postUpdate', updateData);
                io.to(`post_${post.publicid}`).emit('postUpdate', updateData);
            }

            // Notificar autor do post
            if (post.authorUserId !== userId) {
                const existingNotif = await Notification.findOne({
                    where: {
                        targetUserId: post.authorUserId,
                        link: `/${post.author.username}/status/${post.publicid}`,
                        body: `${req.user.username} curtiu seu post.`,
                        readat: null
                    }
                });

                if (!existingNotif) {
                    await createNotification({
                        userId: post.authorUserId,
                        type: 'info',
                        title: 'Nova Curtida',
                        body: `${req.user.username} curtiu seu post.`,
                        link: `/${post.author.username}/status/${post.publicid}`,
                        io: req.app.get('io'),
                        socketType: 'like'
                    });
                }
            }
            
            return res.json({ liked: true, likecount: post.likecount, publicid: post.publicid });
        }

    } catch (error) {
        console.error('[Posts] Erro ao curtir:', error);
        res.status(500).json({ error: 'Erro interno ao processar curtida.' });
    }
});

// GET /posts/:publicid - Buscar um post específico (e seus parentes)
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
                include: POST_INCLUDES
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

// DELETE /posts/:publicid - Deletar um post
PostsRouter.delete('/:publicid', async (req, res) => {
    try {
        const { publicid } = req.params;
        const post = await Post.findOne({ where: { publicid: publicid } });
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        const isMod = req.user.roleId <= 10;
        const isAuthor = post.authorUserId === req.user.id;

        // Regra de permissão: 
        // 1. Autor pode deletar o próprio post
        // 2. Moderador (<=10) pode deletar posts de qualquer um
        if (!isAuthor && !isMod) {
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

        // Buscar autor para emitir via socket e decrementar postcount
        const author = await User.findByPk(post.authorUserId);
        if (author) {
            await author.decrement('postcount');
        }

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
