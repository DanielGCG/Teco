/**
 * Sistema compartilhado de cartinhas
 * Funções e lógica reutilizável para recebidas, enviadas e favoritas
 */

/**
 * Sistema de Modal Compartilhado para Cartinhas
 */
class ModalCartinha {
    constructor() {
        this.ensureModalExists();
    }

    ensureModalExists() {
        let modal = document.getElementById('modalCartinhaGlobal');
        if (modal) return;
        
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modalCartinhaGlobal" class="window" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10001; width: 90%; max-width: 500px; box-shadow: 2px 2px 10px rgba(0,0,0,0.5);">
                <div class="window-header">
                    <span id="modal-cartinha-title">Cartinha</span>
                    <button onclick="window.modalCartinha.fechar()" style="float: right; padding: 0 4px;">X</button>
                </div>
                <div class="window-content" id="modal-cartinha-content" style="background: white; max-height: 400px; overflow-y: auto;">
                </div>
                <div class="window-footer" id="modal-cartinha-footer" style="background: var(--retro-bg); border-top: 1px solid var(--retro-border-dark); padding: 5px; display: flex; justify-content: flex-end; gap: 5px;">
                </div>
            </div>
            <div id="overlayCartinhaRetro" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 10000;" onclick="window.modalCartinha.fechar()"></div>
        `);
    }

    abrir({ cartinha, usuario, tipo, acoes = [] }) {
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');
        
        // Limpar o footer para não duplicar botões
        footer.innerHTML = '';
        
        const labelNome = tipo === 'enviadas' ? 'Para: ' : 'De: ';
        const assinatura = tipo === 'enviadas' ? 'Você' : `<a href="/${usuario.username}" style="text-decoration: underline; font-weight: bold; color: blue;">${usuario.username}</a>`;

        // Se a cartinha não tiver body (veio da listagem que exclui esse campo), buscar os detalhes
        if (cartinha.body === undefined) {
            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="font-size: 11px;">Carregando conteúdo...</p>
                </div>
            `;
            
            fetch(`/api/cartinhas/${cartinha.publicid || cartinha.id}`, { credentials: 'include' })
                .then(res => res.json())
                .then(fullData => {
                    this.renderizarConteudoModal(fullData, usuario, labelNome, assinatura, acoes);
                })
                .catch(() => {
                    content.innerHTML = `<div style="color: red; padding: 10px; font-size: 11px;">Erro ao carregar o conteúdo da cartinha.</div>`;
                });
        } else {
            this.renderizarConteudoModal(cartinha, usuario, labelNome, assinatura, acoes);
        }

        document.getElementById('modalCartinhaGlobal').style.display = 'block';
        document.getElementById('overlayCartinhaRetro').style.display = 'block';
    }

    renderizarConteudoModal(cartinha, usuario, labelNome, assinatura, acoes) {
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');

        content.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ccc;">
                <img src="${usuario.profileimage}" style="width: 40px; height: 40px; border: 1px solid #808080; margin-right: 10px; object-fit: cover;">
                <div style="flex-grow: 1;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <div>
                            <span style="color: #666;">${labelNome}</span>
                            <div style="font-weight: bold;"><a href="/${usuario.username}" style="color: blue; text-decoration: underline;">${usuario.username}</a></div>
                        </div>
                        <div style="text-align: right; color: #666;">
                            ${UIUtils.formatarData(cartinha.createdat)}
                        </div>
                    </div>
                </div>
            </div>
            <div style="padding: 5px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">${cartinha.title}</h3>
                <div style="font-size: 12px; line-height: 1.4; white-space: pre-wrap; min-height: 80px; font-family: 'Times New Roman', Times, serif;">${cartinha.body}</div>
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc; text-align: right; font-size: 11px;">
                    <p style="margin: 0;">Atenciosamente,</p>
                    <div style="font-weight: bold;">${assinatura}</div>
                </div>
            </div>
        `;

        acoes.forEach(acao => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.fontSize = '11px';
            btn.textContent = acao.label;
            btn.onclick = () => {
                if (acao.callback) acao.callback(cartinha, usuario);
            };
            footer.appendChild(btn);
        });
        
        // Botão Fechar padrão
        const btnFechar = document.createElement('button');
        btnFechar.type = 'button';
        btnFechar.style.fontSize = '11px';
        btnFechar.textContent = 'Fechar';
        btnFechar.onclick = () => this.fechar();
        footer.appendChild(btnFechar);
    }

    fechar() {
        const mEl = document.getElementById('modalCartinhaGlobal');
        const oEl = document.getElementById('overlayCartinhaRetro');
        if (mEl) mEl.style.display = 'none';
        if (oEl) oEl.style.display = 'none';
    }

    abrirEdicao(cartinha, callback) {
        const title = document.getElementById('modal-cartinha-title');
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');

        title.textContent = 'Editar Cartinha';
        footer.innerHTML = '';

        content.innerHTML = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 11px; font-weight: bold;">Assunto:</label>
                    <input type="text" id="edit-titulo" style="width: 100%; box-sizing: border-box;" value="${cartinha.title}">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: bold;">Mensagem:</label>
                    <textarea id="edit-conteudo" rows="8" style="width: 100%; box-sizing: border-box; resize: vertical;">${cartinha.body}</textarea>
                </div>
            </div>
        `;

        const btnSalvar = document.createElement('button');
        btnSalvar.textContent = 'Salvar Alterações';
        btnSalvar.style.fontSize = '11px';
        btnSalvar.onclick = () => {
            const novoT = document.getElementById('edit-titulo').value;
            const novoC = document.getElementById('edit-conteudo').value;
            if (callback) callback(novoT, novoC);
        };

        const btnCancelar = document.createElement('button');
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.style.fontSize = '11px';
        btnCancelar.onclick = () => this.abrir({ cartinha, usuario: window.usuarioCacheEdicao || {}, tipo: window.tipoCartinhas });

        footer.appendChild(btnSalvar);
        footer.appendChild(btnCancelar);

        document.getElementById('modalCartinhaGlobal').style.display = 'block';
        document.getElementById('overlayCartinhaRetro').style.display = 'block';
    }
}

window.modalCartinha = new ModalCartinha();

/**
 * Funções de Grid
 */
function renderizarGridCartinhas(usuarios, containerSelector = '#cartas-grid', hooks = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    let cartinhas = [];
    usuarios.forEach(u => u.cartinhas.forEach(c => cartinhas.push({ ...c, usuario: u })));
    cartinhas.sort((a, b) => new Date(b.createdat) - new Date(a.createdat));

    if (cartinhas.length === 0) {
        document.getElementById('sem-cartinhas').style.display = 'block';
        document.getElementById('cartinhas-container').style.display = 'none';
        return;
    }

    container.innerHTML = `
        <table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; background: white; font-size: 11px;">
            <thead>
                <tr style="background: #e0e0e0;">
                    <th width="30" align="center"></th>
                    <th align="left">Remetente</th>
                    <th align="left">Assunto</th>
                    <th width="100" align="center">Data</th>
                    <th width="50" align="center">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${cartinhas.map(c => `
                    <tr style="cursor: pointer;" onclick="window.cartinhasHooks?.abrirCartinha('${c.publicid || c.id}')" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
                        <td align="center">
                            <img src="${c.usuario.profileimage}" style="width: 20px; height: 20px; border: 1px solid #808080; object-fit: cover;">
                        </td>
                        <td>
                            <b>${c.usuario.username}</b>
                            ${!c.isread && window.tipoCartinhas === 'recebidas' ? '<span style="color: red; font-size: 9px; font-weight: bold; border: 1px solid red; padding: 0 2px; margin-left: 3px;">NOVO</span>' : ''}
                        </td>
                        <td>
                            ${c.isfavorited ? '<span style="color: orange;">★</span> ' : ''}
                            ${c.title || '(Sem assunto)'}
                        </td>
                        <td align="center">${UIUtils.formatarData(c.createdat)}</td>
                        <td align="center">
                            <button style="font-size: 9px;">Ver</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    window.cartinhasHooks = hooks;
    document.getElementById('cartinhas-container').style.display = 'block';
    document.getElementById('sem-cartinhas').style.display = 'none';
}

/**
 * Utilitários
 */
const encontrarCartinha = (id, usuarios) => {
    for (const u of usuarios) {
        const c = u.cartinhas.find(x => (x.publicid || x.id) == id);
        if (c) return c;
    }
    return null;
};

const encontrarUsuarioPorCartinha = (id, usuarios) => {
    for (const u of usuarios) {
        if (u.cartinhas.some(x => (x.publicid || x.id) == id)) return u;
    }
    return null;
};

async function toggleFavoritoCommon(id, usuarios = []) {
    try {
        const res = await fetch(`/api/cartinhas/${id}/toggle-favorito`, { method: 'POST', credentials: 'include' });
        const data = await res.json();
        const c = encontrarCartinha(id, usuarios);
        if (c) c.isfavorited = data.isfavorited;
        if (typeof carregarCartinhas === 'function') carregarCartinhas();
        mostrarFeedback(data.isfavorited ? 'Favoritada!' : 'Removido dos favoritos');
    } catch (e) { mostrarFeedback('Erro ao favoritar', 'danger'); }
}

function mostrarFeedback(msg, tipo = 'success') {
    let c = document.querySelector('.feedback-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'feedback-container';
        c.style.cssText = 'position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `toast align-items-center text-white bg-${tipo} border-0 mb-2 show`;
    t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
