const express = require("express");
const CartinhasRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

const cartinhasRender = (view, title, description) => 
    renderStaticPage(`pages/cartinhas/${view}`, { title, description });

CartinhasRouter.get('/', cartinhasRender('cartinhas', 'Correio', 'Suas cartinhas'));
CartinhasRouter.get('/recebidas', cartinhasRender('recebidas', 'Caixa de entrada', 'Suas cartinhas recebidas'));
CartinhasRouter.get('/escrever', cartinhasRender('escrever', 'Escrever cartinha', 'Escreva uma nova cartinha'));
CartinhasRouter.get('/favoritas', cartinhasRender('favoritas', 'Cartinhas favoritas', 'Suas cartinhas favoritas'));
CartinhasRouter.get('/enviadas', cartinhasRender('enviadas', 'Cartinhas enviadas', 'Gerencie as cartinhas enviadas'));

module.exports = CartinhasRouter;
