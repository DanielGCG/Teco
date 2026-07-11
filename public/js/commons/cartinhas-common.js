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
                    <span id="modal-cartinha-title" class="window-title">Cartinha</span>
                    <button type="button" class="window-btn" onclick="window.modalCartinha.fechar()" style="float: right;">[Fechar]</button>
                </div>
                <div class="window-content" id="modal-cartinha-content" style="max-height: 400px; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px;">
                </div>
                <hr style="margin: 0; border-top: 1px solid gray;">
                <div class="window-footer" id="modal-cartinha-footer" style="padding: 10px; display: flex; justify-content: space-between; gap: 5px; background: var(--retro-bg);">
                </div>
            </div>
            <div id="overlayCartinhaRetro" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 10000;" onclick="window.modalCartinha.fechar()"></div>
        `);
    }

    abrir({ cartinha, usuario, tipo, acoes = [] }) {
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');
        const title = document.getElementById('modal-cartinha-title');

        title.textContent = 'Cartinha';
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
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                    <h4 style="margin: 0;">Destinatário</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${usuario.profileimage}" style="width: 40px; height: 40px; border: 2px inset var(--retro-border-dark); object-fit: cover;">
                        <div style="flex-grow: 1;">
                            <div style="color: #666; font-size: 11px;">${labelNome}</div>
                            <div style="font-weight: bold;"><a href="/${usuario.username}" style="color: blue; text-decoration: underline;">${usuario.username}</a></div>
                        </div>
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                    <h4 style="margin: 0;">Detalhes</h4>
                    <div>
                        <div style="color: #666; font-size: 11px;">Data de Envio:</div>
                        <div style="font-weight: bold; font-size: 12px;">${UIUtils.formatarData(cartinha.createdat)}</div>
                    </div>
                </div>
            </div>
            
            <hr style="margin-top: 5px; border-top: 1px solid gray; width: 100%;">
            
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <h4 style="margin: 0;">Mensagem: ${cartinha.title}</h4>
                <div style="background: white; border: 2px inset var(--retro-border-dark); padding: 10px; min-height: 120px; font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; white-space: pre-wrap; overflow-y: auto;">${cartinha.body}</div>
                <div style="text-align: right; font-size: 11px; margin-top: 5px;">
                    <span style="color: #666;">Atenciosamente,</span> <br>
                    <strong>${assinatura}</strong>
                </div>
            </div>
        `;

        const acoesDiv = document.createElement('div');
        acoesDiv.style.display = 'flex';
        acoesDiv.style.gap = '5px';

        const fecharDiv = document.createElement('div');

        acoes.forEach(acao => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'window-btn';
            if (acao.label.toLowerCase().includes('excluir') || acao.label.toLowerCase().includes('apagar')) {
                btn.style.color = 'red';
            } else {
                btn.style.fontWeight = 'bold';
            }
            btn.textContent = acao.label;
            btn.onclick = () => {
                if (acao.callback) acao.callback(cartinha, usuario);
            };
            acoesDiv.appendChild(btn);
        });

        const btnFechar = document.createElement('button');
        btnFechar.type = 'button';
        btnFechar.className = 'window-btn';
        btnFechar.textContent = 'Fechar';
        btnFechar.onclick = () => this.fechar();
        fecharDiv.appendChild(btnFechar);

        footer.appendChild(acoesDiv);
        footer.appendChild(fecharDiv);
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
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <h4 style="margin: 0;">Informações</h4>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Assunto:</label>
                    <input type="text" id="edit-titulo" style="width: 100%; box-sizing: border-box;" value="${cartinha.title}">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Mensagem:</label>
                    <textarea id="edit-conteudo" rows="8" style="width: 100%; box-sizing: border-box; resize: vertical;">${cartinha.body}</textarea>
                </div>
            </div>
        `;

        const acoesDiv = document.createElement('div');
        acoesDiv.style.display = 'flex';
        acoesDiv.style.gap = '5px';

        const btnSalvar = document.createElement('button');
        btnSalvar.type = 'button';
        btnSalvar.className = 'window-btn';
        btnSalvar.style.fontWeight = 'bold';
        btnSalvar.textContent = 'Salvar Alterações';
        btnSalvar.onclick = () => {
            const nT = document.getElementById('edit-titulo').value;
            const nC = document.getElementById('edit-conteudo').value;
            if (callback) callback(nT, nC);
        };
        acoesDiv.appendChild(btnSalvar);

        const fecharDiv = document.createElement('div');
        const btnCancelar = document.createElement('button');
        btnCancelar.type = 'button';
        btnCancelar.className = 'window-btn';
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.onclick = () => this.abrir({ cartinha, usuario: window.usuarioCacheEdicao || {}, tipo: window.tipoCartinhas });
        fecharDiv.appendChild(btnCancelar);

        footer.appendChild(acoesDiv);
        footer.appendChild(fecharDiv);

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

    const isEnviadas = window.tipoCartinhas === 'enviadas';
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
            ${cartinhas.map(c => `
                <div style="display: flex; align-items: center; background: white; border: 2px inset var(--retro-border-dark); padding: 8px 10px; cursor: pointer;" onclick="window.cartinhasHooks?.abrirCartinha('${c.publicid || c.id}')" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
                    <img src="${c.usuario.profileimage}" style="width: 32px; height: 32px; border: 1px solid #808080; object-fit: cover; margin-right: 12px;">
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 3px;">
                            ${isEnviadas ? 'Para:' : 'De:'} <b>${c.usuario.username}</b>
                            ${!c.isread && !isEnviadas ? '<span style="color: white; background: red; font-size: 9px; font-weight: bold; padding: 1px 4px; margin-left: 5px;">NOVO</span>' : ''}
                        </div>
                        <div style="font-weight: bold; font-size: 12px; color: #000080; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${c.isfavorited ? '<span style="color: orange; font-size: 13px;">★</span> ' : ''}${c.title || '(Sem assunto)'}
                        </div>
                    </div>
                    <div style="text-align: right; margin-left: 10px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; height: 100%;">
                        <div style="font-size: 10px; color: #666; margin-bottom: 5px;">${UIUtils.formatarData(c.createdat)}</div>
                        <button type="button" class="window-btn" style="font-size: 10px; padding: 2px 8px;">Abrir</button>
                    </div>
                </div>
            `).join('')}
        </div>
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
