// ==========================================================================
// SISTEMA DE NOTIFICAÇÕES (TOASTS), MODAIS E CONFIRMAÇÕES
// ==========================================================================

export function garantirModalConfirmacao() {
    if (!document.getElementById('modal-confirmacao')) {
        const confModal = document.createElement('div');
        confModal.id = 'modal-confirmacao';
        confModal.className = 'modal-overlay';
        confModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div style="margin-bottom:15px; color:var(--primary);"><i class="ph ph-question" style="font-size: 48px;"></i></div>
                <h3 style="margin-top:0; color:var(--text); font-size:18px;" id="lblConfirmacaoTexto">Tem certeza?</h3>
                <div style="display:flex; gap:10px; margin-top:25px;">
                    <button type="button" class="btn btn-primary" style="flex:1;" onclick="window.executarConfirmacao()"><i class="ph ph-check"></i> Sim</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="window.fecharModal('modal-confirmacao')">Não</button>
                </div>
            </div>
        `;
        document.body.appendChild(confModal);
    }

    // Habilita fechar modal clicando fora (backdrop light-dismiss)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (!overlay.dataset.backdropBound) {
            overlay.dataset.backdropBound = 'true';
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        }
    });
}

export function mostrarToast(mensagem, isErro = false) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-msg' + (isErro ? ' toast-erro' : '');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = (isErro
        ? '<i class="ph ph-warning-circle" style="font-size:22px;"></i> '
        : '<i class="ph ph-check-circle" style="font-size:22px;"></i> ') + mensagem;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

export function fecharModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

export function abrirConfirmacao(mensagem, callback) {
    garantirModalConfirmacao();
    const lbl = document.getElementById('lblConfirmacaoTexto');
    if (lbl) lbl.innerText = mensagem;
    window.acaoConfirmacaoPendente = callback;
    abrirModal('modal-confirmacao');
}

export function executarConfirmacao() {
    const cb = window.acaoConfirmacaoPendente;
    window.acaoConfirmacaoPendente = null;
    fecharModal('modal-confirmacao');
    if (typeof cb === 'function') {
        cb();
    }
}
