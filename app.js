// ================= IMPORTAÇÕES FIREBASE FIRESTORE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, 
    enableIndexedDbPersistence, increment, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA0z0EPQjYIO4u3cJwQ2RsrEKfb9vmh9bc",
    authDomain: "estoque-bebidas-do-trem.firebaseapp.com",
    projectId: "estoque-bebidas-do-trem",
    storageBucket: "estoque-bebidas-do-trem.firebasestorage.app",
    messagingSenderId: "39050841748",
    appId: "1:39050841748:web:d3778526f2bc33acd8ee81"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
    enableIndexedDbPersistence(db);
} catch (err) {
    console.log("Offline mode persistente já ativo.");
}

// ================= CSS E HTML DINÂMICOS (INJETADOS VIA JS) =================
const toastStyle = document.createElement('style');
toastStyle.innerHTML = `
    .toast-container { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; flex-direction: column; gap: 10px; width: 90%; max-width: 400px; pointer-events: none; }
    .toast-msg { background: #0f766e; color: #ffffff; padding: 14px 18px; border-radius: 12px; font-size: 15px; font-weight: 700; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.25); animation: slideUpFade 0.3s ease-out forwards; display: flex; align-items: center; justify-content: center; gap: 8px; pointer-events: auto; }
    .toast-erro { background: #b91c1c; }
    @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeOutDown { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(30px); } }
`;
document.head.appendChild(toastStyle);

if (!document.getElementById('modal-confirmacao')) {
    const confModal = document.createElement('div');
    confModal.id = 'modal-confirmacao';
    confModal.className = 'modal-overlay';
    confModal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <div style="margin-bottom:15px; color:var(--primary);"><i class="ph ph-question" style="font-size: 48px;"></i></div>
            <h3 style="margin-top:0; color:var(--text); font-size:18px;" id="lblConfirmacaoTexto">Tem certeza?</h3>
            <div style="display:flex; gap:10px; margin-top:25px;">
                <button class="btn btn-primary" style="flex:1;" onclick="window.executarConfirmacao()"><i class="ph ph-check"></i> Sim</button>
                <button class="btn btn-secondary" style="flex:1;" onclick="window.fecharModal('modal-confirmacao')">Não</button>
            </div>
        </div>
    `;
    document.body.appendChild(confModal);
}

// ================= SISTEMA DE NOTIFICAÇÕES E CONFIRMAÇÃO =================
window.mostrarToast = function(mensagem, isErro = false) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-msg' + (isErro ? ' toast-erro' : '');
    toast.innerHTML = (isErro ? '<i class="ph ph-warning-circle" style="font-size:22px;"></i> ' : '<i class="ph ph-check-circle" style="font-size:22px;"></i> ') + mensagem;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

window.acaoConfirmacaoPendente = null;

window.abrirConfirmacao = function(mensagem, callback) {
    document.getElementById('lblConfirmacaoTexto').innerText = mensagem;
    window.acaoConfirmacaoPendente = callback;
    window.abrirModal('modal-confirmacao');
};

window.executarConfirmacao = function() {
    if (typeof window.acaoConfirmacaoPendente === 'function') {
        window.acaoConfirmacaoPendente();
    }
    window.fecharModal('modal-confirmacao');
};

// ================= RECUPERAÇÃO BLINDADA DO CACHE LOCAL =================
function getCache(key, fallback = []) {
    try {
        const val = localStorage.getItem(key);
        if (!val || val === "undefined" || val === "null") return fallback;
        const parsed = JSON.parse(val);
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        return parsed;
    } catch(e) {
        return fallback;
    }
}

// Catálogo com as bebidas oficiais
const catalogoInicial = [
    { id: 'C', nome: 'Coca Lata', unidadesPorFardo: 12, ordem: 1, precoVenda: 8, estoqueContainerUnidades: 1800, estoqueBagageiroUnidades: 35 },
    { id: 'Cp', nome: 'Coca Lata Pequena', unidadesPorFardo: 6, ordem: 2, precoVenda: 6, estoqueContainerUnidades: 600, estoqueBagageiroUnidades: 18 },
    { id: 'Zp', nome: 'Coca Zero Lata Pequena', unidadesPorFardo: 6, ordem: 3, precoVenda: 6, estoqueContainerUnidades: 480, estoqueBagageiroUnidades: 14 },
    { id: 'Gg', nome: 'Guaraná Lata Grande', unidadesPorFardo: 6, ordem: 4, precoVenda: 8, estoqueContainerUnidades: 600, estoqueBagageiroUnidades: 20 },
    { id: 'Gp', nome: 'Guaraná Lata Pequeno', unidadesPorFardo: 6, ordem: 5, precoVenda: 6, estoqueContainerUnidades: 300, estoqueBagageiroUnidades: 12 },
    { id: 'Fgp', nome: 'Fanta Guaraná Pequeno', unidadesPorFardo: 6, ordem: 6, precoVenda: 6, estoqueContainerUnidades: 240, estoqueBagageiroUnidades: 10 },
    { id: 'Am', nome: 'Cerveja Amstel', unidadesPorFardo: 12, ordem: 7, precoVenda: 10, estoqueContainerUnidades: 600, estoqueBagageiroUnidades: 24 },
    { id: 'Acp', nome: 'Água Copo', unidadesPorFardo: 24, ordem: 8, precoVenda: 4, estoqueContainerUnidades: 2400, estoqueBagageiroUnidades: 48 },
    { id: 'Agsp', nome: 'Água Garrafa Sem Gás', unidadesPorFardo: 12, ordem: 9, precoVenda: 6, estoqueContainerUnidades: 480, estoqueBagageiroUnidades: 12 },
    { id: 'Aggp', nome: 'Água Garrafa Com Gás', unidadesPorFardo: 12, ordem: 10, precoVenda: 6, estoqueContainerUnidades: 480, estoqueBagageiroUnidades: 12 },
    { id: 'Chn', nome: 'Chá Normal', unidadesPorFardo: 6, ordem: 11, precoVenda: 6, estoqueContainerUnidades: 240, estoqueBagageiroUnidades: 12 },
    { id: 'Chz', nome: 'Chá Zero', unidadesPorFardo: 6, ordem: 12, precoVenda: 6, estoqueContainerUnidades: 240, estoqueBagageiroUnidades: 12 },
    { id: 'Su', nome: 'Suco de Uva', unidadesPorFardo: 6, ordem: 13, precoVenda: 7, estoqueContainerUnidades: 180, estoqueBagageiroUnidades: 10 },
    { id: 'Sp', nome: 'Suco de Pêssego', unidadesPorFardo: 6, ordem: 14, precoVenda: 7, estoqueContainerUnidades: 180, estoqueBagageiroUnidades: 10 },
    { id: 'KL', nome: 'Kit Lanche', unidadesPorFardo: 1, ordem: 15, precoVenda: 15, estoqueContainerUnidades: 500, estoqueBagageiroUnidades: 50 },
    { id: 'Esp', nome: 'Espumante Garrafa', unidadesPorFardo: 6, ordem: 16, precoVenda: 50, estoqueContainerUnidades: 120, estoqueBagageiroUnidades: 8 },
    { id: 'Gelo', nome: 'Saco de Gelo', unidadesPorFardo: 1, ordem: 17, precoVenda: 0, estoqueContainerUnidades: 50, estoqueBagageiroUnidades: 10 }
];

const receitasIniciaisPadrao = [
    { id: 'rec_turistico_48', nome: 'Base Turístico (48 Lugares)', itens: { C: 24, Gg: 12, Zp: 6, Acp: 24, KL: 49 } },
    { id: 'rec_economico', nome: 'Base Econômico', itens: { C: 24, Gg: 12, Zp: 6, Acp: 24, KL: 49 } },
    { id: 'rec_boutique_padrao', nome: 'Boutique Padrão (Sem Coca Grande / Água Copo)', itens: { Cp: 12, Zp: 12, Gp: 12, Fgp: 6, Am: 12, Agsp: 12, Aggp: 12, Chn: 6, Chz: 6, Su: 6, Sp: 6, KL: 20, Esp: 6, Gelo: 2 } }
];

const frotaInicialPadrao = [
    { id: '11', numero: '11', nome: 'Turístico 11', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '12', numero: '12', nome: 'Turístico 12', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '13', numero: '13', nome: 'Turístico 13', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '14', numero: '14', nome: 'Turístico 14', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '15', numero: '15', nome: 'Turístico 15', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '16', numero: '16', nome: 'Turístico 16', tipo: 'turistico', receitaId: 'rec_turistico_48', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '01', numero: '01', nome: 'Econômico 1', tipo: 'economico', receitaId: 'rec_economico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '18', numero: '18', nome: 'Foz do Iguaçu', tipo: 'boutique', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '20', numero: '20', nome: 'Curitiba', tipo: 'boutique', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Cam', numero: 'Cam', nome: 'Camarote', tipo: 'boutique', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Imp', numero: 'Imp', nome: 'Imperial', tipo: 'boutique', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Bar', numero: 'Bar', nome: 'Vagão Bar', tipo: 'boutique', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '7000', numero: '7000', nome: 'Litorina 7000', tipo: 'litorina', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '7001', numero: '7001', nome: 'Litorina 7001', tipo: 'litorina', receitaId: 'rec_boutique_padrao', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] }
];

window.produtosDB = getCache('trem_cache_produtos', catalogoInicial);
window.usuariosDB = getCache('trem_cache_usuarios', [{ id: '1', nome: 'Gustavo' }]);
window.vagoesDB = getCache('trem_cache_vagoes', frotaInicialPadrao);
window.receitasDB = getCache('trem_cache_receitas', receitasIniciaisPadrao);
window.contagensDB = getCache('trem_cache_contagens', []);
window.cargasDiaDB = getCache('trem_cache_cargas', []);
window.cargasVagoesDB = getCache('trem_cache_cargas_vagoes', []);
window.vendasCarrinhoDB = getCache('trem_cache_vendas', []);
window.viagensStatusDB = getCache('trem_cache_viagens_status', {});

window.contagemTemp = {};
window.itensExtrasCarrinhoTemp = [];
window.modoRelatorioAdmin = 'todos';
window.filtroSentidoRelatorio = 'todos';
window.vagaoOperacaoSelecionadoId = null;

const ORDEM_PADRAO_CHEFE = [
    'C', 'Cp', 'Zp', 'Gg', 'Gp', 'Fgp', 'Am', 'Acp', 'Agsp', 'Aggp', 
    'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Kl', 'Esp', 'Gelo', 'Ac'
];

function formatarEstoqueFardos(totalUnidades, unPorFardo) {
    unPorFardo = unPorFardo || 1;
    totalUnidades = totalUnidades || 0;
    if (unPorFardo <= 1) return `${totalUnidades} Un`;
    const fardos = Math.floor(totalUnidades / unPorFardo);
    const sobra = totalUnidades % unPorFardo;
    if (fardos > 0 && sobra > 0) return `${fardos} Fardos + ${sobra} Un`;
    if (fardos > 0) return `${fardos} Fardos`;
    return `${sobra} Un`;
}

window.escapeHTML = function(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
};

window.focarProximo = function(id) {
    const el = document.getElementById(id);
    if (el) el.focus();
};

window.formatarMoeda = function(v) {
    return (v || 0).toFixed(2).replace('.', ',');
};

// ORDENAÇÃO SEGURA: Se não tiver nome cadastrado, trata como string vazia para não quebrar a tela
function ordenarPorRegra(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.sort((a, b) => {
        const ordA = a.ordem !== undefined && a.ordem !== null && a.ordem !== "" ? parseInt(a.ordem) : 9999;
        const ordB = b.ordem !== undefined && b.ordem !== null && b.ordem !== "" ? parseInt(b.ordem) : 9999;
        if (ordA !== ordB) return ordA - ordB;
        let idxA = ORDEM_PADRAO_CHEFE.indexOf(a.id);
        let idxB = ORDEM_PADRAO_CHEFE.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.nome || "").localeCompare(b.nome || "");
    });
}

// ================= MODAIS ESPECÍFICOS =================
window.abrirModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};

window.fecharModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

// ================= ROTEADOR DE TELAS E INJEÇÃO =================
window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo(0, 0);

    localStorage.setItem('trem_tela_ativa', id);

    const safeCall = (fn) => { if (typeof fn === 'function') fn(); };

    if (id === 'tela-cadastro-produtos') safeCall(window.renderizarProdutosAdmin);
    if (id === 'tela-usuarios') safeCall(window.renderizarUsuarios);
    if (id === 'tela-receitas') safeCall(window.renderizarReceitasAdmin);
    if (id === 'tela-vagoes') safeCall(window.renderizarVagoesAdmin);
    if (id === 'tela-estoques') safeCall(window.abrirTelaEstoques);
    if (id === 'tela-carga-dia') safeCall(window.abrirCargaDoDia);
    if (id === 'tela-carga-vagao') safeCall(window.renderizarVagoesParaCarga);
    if (id === 'tela-ver-carga') safeCall(() => window.carregarManifestoPublico(true));
    if (id === 'tela-relatorios') safeCall(window.renderizarRelatoriosAdmin);
    if (id === 'tela-setup-contagem') safeCall(window.abrirSetupContagem);
    if (id === 'tela-setup-carrinho') safeCall(window.abrirSetupCarrinho);
    if (id === 'tela-operacao-viagem') safeCall(window.carregarMonitorViagem);
    if (id === 'tela-boutiques-hub') safeCall(window.carregarSelectBoutiqueHub);
};

window.irParaPainelChefe = function() {
    if (localStorage.getItem('trem_chefe_sessao') === 'ativo') {
        window.mostrarTela('tela-admin');
    } else {
        window.mostrarTela('tela-login');
    }
};

window.fazerLogin = function() {
    const pass = document.getElementById('loginSenha').value;
    if (pass !== '1234') {
        const msg = document.getElementById('msgLogin');
        msg.innerText = "Senha incorreta!";
        msg.style.display = 'block';
        return;
    }
    document.getElementById('loginSenha').value = "";
    document.getElementById('msgLogin').style.display = 'none';

    localStorage.setItem('trem_chefe_sessao', 'ativo');
    window.mostrarTela('tela-admin');
    window.atualizarDashboardKPIs();
};

window.logout = function() {
    localStorage.removeItem('trem_chefe_sessao');
    localStorage.removeItem('trem_tela_ativa');
    window.mostrarTela('tela-inicial');
};

function restaurarSessaoOuTela() {
    const telaSalva = localStorage.getItem('trem_tela_ativa');
    const chefeLogado = localStorage.getItem('trem_chefe_sessao') === 'ativo';
    const telasAdmin = ['tela-admin', 'tela-carga-dia', 'tela-carga-vagao', 'tela-receitas', 'tela-estoques', 'tela-vagoes', 'tela-usuarios', 'tela-cadastro-produtos', 'tela-relatorios'];

    if (telaSalva && telasAdmin.includes(telaSalva)) {
        if (chefeLogado) {
            window.mostrarTela(telaSalva);
        } else {
            window.mostrarTela('tela-login');
        }
    } else if (telaSalva) {
        window.mostrarTela(telaSalva);
    } else {
        window.mostrarTela('tela-inicial');
    }
}

// ================= SINCRONIZAÇÃO EM NUVEM E OFFLINE =================
// BLINDADO: Se o banco estiver vazio, carrega Arrays VAZIAS e salva no local, permitindo cadastros novos sem travar
function iniciarSincronizacaoNuvem() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        window.produtosDB = snapshot.docs.map(d => {
            const data = d.data();
            if (data.ordem === undefined || data.ordem === null) {
                const idx = ORDEM_PADRAO_CHEFE.indexOf(data.id);
                data.ordem = idx !== -1 ? idx + 1 : 99;
            }
            return data;
        });
        localStorage.setItem('trem_cache_produtos', JSON.stringify(window.produtosDB));
        window.atualizarDashboardKPIs();
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos') window.renderizarProdutosAdmin();
        if (telaAtiva === 'tela-estoques') window.renderizarApenasTabelasResumoEstoques();
    });

    onSnapshot(collection(db, "receitas_carga"), (snapshot) => {
        window.receitasDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_receitas', JSON.stringify(window.receitasDB));
        if (document.getElementById('tela-receitas')?.classList.contains('ativa')) window.renderizarReceitasAdmin();
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        window.usuariosDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_usuarios', JSON.stringify(window.usuariosDB));
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-usuarios') window.renderizarUsuarios();
        if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
        if (telaAtiva === 'tela-setup-carrinho') window.abrirSetupCarrinho();
    });

    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        window.vagoesDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_vagoes', JSON.stringify(window.vagoesDB));
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-vagoes') window.renderizarVagoesAdmin();
        if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
        if (telaAtiva === 'tela-operacao-viagem') window.carregarMonitorViagem();
    });

    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_contagens', JSON.stringify(window.contagensDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) window.renderizarRelatoriosAdmin();
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });

    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas', JSON.stringify(window.cargasDiaDB));
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa')) window.carregarManifestoPublico(false);
        if (document.getElementById('tela-carga-dia')?.classList.contains('ativa')) window.verificarStatusEdicaoCarga();
    });

    onSnapshot(collection(db, "cargas_vagoes"), (snapshot) => {
        window.cargasVagoesDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas_vagoes', JSON.stringify(window.cargasVagoesDB));
        if (document.getElementById('tela-carga-vagao')?.classList.contains('ativa')) window.renderizarVagoesParaCarga();
    });

    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_vendas', JSON.stringify(window.vendasCarrinhoDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) window.renderizarRelatoriosAdmin();
    });

    onSnapshot(collection(db, "viagens_status"), (snapshot) => {
        snapshot.docs.forEach(d => {
            window.viagensStatusDB[d.id] = d.data();
        });
        localStorage.setItem('trem_cache_viagens_status', JSON.stringify(window.viagensStatusDB));
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });
}

window.atualizarDashboardKPIs = function() {
    let totalUnBaga = 0;
    let totalUnCont = 0;
    if (Array.isArray(window.produtosDB)) {
        window.produtosDB.forEach(p => {
            totalUnBaga += (p.estoqueBagageiroUnidades || 0);
            totalUnCont += (p.estoqueContainerUnidades || 0);
        });
    }
    const elBaga = document.getElementById('kpiBagageiroTotal');
    const elCont = document.getElementById('kpiContainerTotal');
    if (elBaga) elBaga.innerText = `${totalUnBaga} un`;
    if (elCont) elCont.innerText = `${totalUnCont} un`;
};

// ================= MÓDULO: RECEITAS DE CARGA =================
window.renderizarReceitasAdmin = function() {
    const div = document.getElementById('listaReceitasAdmin');
    if (!div) return;
    div.innerHTML = "";

    if (!window.receitasDB || window.receitasDB.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma receita de carga criada ainda.</p>';
        return;
    }

    window.receitasDB.forEach(r => {
        let resumoItens = [];
        for (let sigla in r.itens) {
            if (r.itens[sigla] > 0) {
                resumoItens.push(`<b>${r.itens[sigla]}x</b> ${sigla}`);
            }
        }

        div.innerHTML += `
            <div class="card" style="padding:15px; margin-bottom:10px; border-left:5px solid var(--accent);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:16px; color:var(--primary);"><i class="ph ph-receipt"></i> ${r.nome}</strong>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalReceita('${r.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                        <button class="btn btn-danger btn-pequeno" onclick="window.excluirReceita('${r.id}')"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div style="font-size:13px; color:var(--secondary); line-height:1.5;">
                    ${resumoItens.join(' &bull; ') || 'Nenhum item configurado nesta receita.'}
                </div>
            </div>
        `;
    });
};

window.abrirModalReceita = function(id = null) {
    const divProds = document.getElementById('modalReceitaListaProdutos');
    divProds.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    let recObj = null;
    if (id) {
        recObj = window.receitasDB.find(x => x.id === id);
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Receita de Carga';
        document.getElementById('modalReceitaIdOriginal').value = recObj.id;
        document.getElementById('modalReceitaNome').value = recObj.nome;
    } else {
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Nova Receita de Carga';
        document.getElementById('modalReceitaIdOriginal').value = "";
        document.getElementById('modalReceitaNome').value = "";
    }

    window.produtosDB.filter(p => !(p.nome || "").includes('(Venda)')).forEach(p => {
        const valQtd = recObj?.itens?.[p.id] || 0;
        divProds.innerHTML += `
            <div class="item-receita-linha">
                <span><strong>${p.id}</strong> - ${p.nome}</span>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:11px; color:var(--secondary);">Qtd:</span>
                    <input type="number" id="rec_input_${p.id}" value="${valQtd}" min="0" style="width:75px; text-align:center; padding:6px; font-weight:700;">
                </div>
            </div>
        `;
    });

    window.abrirModal('modal-receita');
    setTimeout(() => window.focarProximo('modalReceitaNome'), 100);
};

window.salvarReceitaModal = async function() {
    const idOriginal = document.getElementById('modalReceitaIdOriginal').value;
    const nome = document.getElementById('modalReceitaNome').value.trim();

    if (!nome) { window.mostrarToast("Digite o nome da Receita!", true); return; }

    let itens = {};
    window.produtosDB.filter(p => !(p.nome || "").includes('(Venda)')).forEach(p => {
        const q = parseInt(document.getElementById(`rec_input_${p.id}`)?.value) || 0;
        if (q > 0) itens[p.id] = q;
    });

    const idFinal = idOriginal || ("rec_" + Date.now().toString());
    await setDoc(doc(db, "receitas_carga", idFinal), {
        id: idFinal,
        nome: window.escapeHTML(nome),
        itens: itens
    });

    window.fecharModal('modal-receita');
    window.mostrarToast("Receita de carga salva com sucesso!");
    window.renderizarReceitasAdmin();
};

window.excluirReceita = async function(id) {
    window.abrirConfirmacao("Deseja realmente excluir esta receita de carga?", async () => {
        await deleteDoc(doc(db, "receitas_carga", id));
        window.mostrarToast("Receita excluída com sucesso!");
    });
};

// ================= FROTA DE VAGÕES (SEPARADA & SIMPLIFICADA) =================
window.renderizarVagoesAdmin = function() {
    const div = document.getElementById('listaVagoesAdmin');
    if (!div) return;
    div.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        let corTipo = "var(--primary)";
        if (v.tipo === 'boutique') corTipo = "var(--accent)";
        if (v.tipo === 'litorina') corTipo = "#862ccb";
        if (v.tipo === 'economico') corTipo = "#475569";

        const receitaObj = window.receitasDB.find(r => r.id === v.receitaId);
        const nomeReceita = receitaObj ? receitaObj.nome : 'Nenhuma receita vinculada';

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong style="font-size:16px;">Placa ${v.numero} - ${v.nome}</strong>
                    <br><span style="color:${corTipo}; font-weight:700; font-size:12px; text-transform:uppercase;">[${v.tipo}]</span>
                    <small style="color:var(--secondary); font-size:12px; margin-left:6px;"><i class="ph ph-receipt"></i> ${nomeReceita}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalVagao('${v.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                    <button class="btn btn-danger btn-pequeno" onclick="window.excluirVagao('${v.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.autoSugerirReceitaVagao = function() {
    const tipo = document.getElementById('modalVagaoTipo').value;
    const selRec = document.getElementById('modalVagaoReceitaPadrao');
    
    if (tipo === 'turistico') {
        const rTur = window.receitasDB.find(r => r.id === 'rec_turistico_48' || (r.nome || "").toLowerCase().includes('turístico'));
        if (rTur) selRec.value = rTur.id;
    } else if (tipo === 'economico') {
        const rEco = window.receitasDB.find(r => r.id === 'rec_economico' || (r.nome || "").toLowerCase().includes('econômico'));
        if (rEco) selRec.value = rEco.id;
    } else {
        const rBout = window.receitasDB.find(r => r.id === 'rec_boutique_padrao' || (r.nome || "").toLowerCase().includes('boutique'));
        if (rBout) selRec.value = rBout.id;
    }
    window.atualizarCheckboxesBebidasPadrao();
};

window.abrirModalVagao = function(id = null) {
    const selRec = document.getElementById('modalVagaoReceitaPadrao');
    selRec.innerHTML = '<option value="">-- Nenhuma (Manual) --</option>';
    window.receitasDB.forEach(r => {
        selRec.innerHTML += `<option value="${r.id}">${r.nome}</option>`;
    });

    let permitidas = [];

    if (id) {
        const v = window.vagoesDB.find(x => x.id === id);
        if (!v) return;
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Vagão';
        document.getElementById('modalVagaoIdOriginal').value = v.id;
        document.getElementById('modalVagaoNumero').value = v.numero;
        document.getElementById('modalVagaoNome').value = v.nome;
        document.getElementById('modalVagaoTipo').value = v.tipo || 'turistico';
        selRec.value = v.receitaId || "";
        permitidas = v.bebidasPermitidas || [];
    } else {
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Vagão';
        document.getElementById('modalVagaoIdOriginal').value = "";
        document.getElementById('modalVagaoNumero').value = "";
        document.getElementById('modalVagaoNome').value = "";
        document.getElementById('modalVagaoTipo').value = "turistico";
        window.autoSugerirReceitaVagao();
        permitidas = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'];
    }

    const boxChecks = document.getElementById('boxCheckboxesBebidasVagao');
    boxChecks.innerHTML = "";
    ordenarPorRegra(window.produtosDB);
    
    window.produtosDB.forEach(p => {
        const checked = (permitidas.length === 0 || permitidas.includes(p.id)) ? 'checked' : '';
        boxChecks.innerHTML += `
            <label class="item-chk-bebida">
                <input type="checkbox" value="${p.id}" ${checked}>
                <span>${p.id} (${p.nome})</span>
            </label>
        `;
    });

    window.abrirModal('modal-vagao');
    setTimeout(() => window.focarProximo('modalVagaoNumero'), 100);
};

window.atualizarCheckboxesBebidasPadrao = function() {
    const tipo = document.getElementById('modalVagaoTipo').value;
    const chks = document.querySelectorAll('#boxCheckboxesBebidasVagao input');
    
    if (tipo === 'turistico' || tipo === 'economico') {
        const padraoTur = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'];
        chks.forEach(c => c.checked = padraoTur.includes(c.value));
    } else {
        const proibidasBoutique = ['C', 'Gg', 'Acp', 'Ac'];
        chks.forEach(c => c.checked = !proibidasBoutique.includes(c.value));
    }
};

window.salvarVagaoModal = async function() {
    const idOriginal = document.getElementById('modalVagaoIdOriginal').value;
    const numero = document.getElementById('modalVagaoNumero').value.trim();
    const nome = document.getElementById('modalVagaoNome').value.trim();
    const tipo = document.getElementById('modalVagaoTipo').value;
    const receitaId = document.getElementById('modalVagaoReceitaPadrao').value;

    if (!numero || !nome) { window.mostrarToast("Preencha a Placa/Número e o Nome do Vagão!", true); return; }

    const selecionadas = [];
    document.querySelectorAll('#boxCheckboxesBebidasVagao input:checked').forEach(c => selecionadas.push(c.value));

    const idFinal = idOriginal || ("vagao_" + Date.now().toString());
    await setDoc(doc(db, "vagoes", idFinal), {
        id: idFinal,
        numero: window.escapeHTML(numero),
        nome: window.escapeHTML(nome),
        tipo: tipo,
        receitaId: receitaId || null,
        bebidasPermitidas: selecionadas
    }, { merge: true });

    window.fecharModal('modal-vagao');
    window.mostrarToast("Vagão salvo na frota com sucesso!");
};

window.excluirVagao = async function(id) {
    window.abrirConfirmacao("Tem certeza que deseja excluir este vagão da frota?", async () => {
        await deleteDoc(doc(db, "vagoes", id));
        window.mostrarToast("Vagão excluído!");
    });
};

// ================= CARGA POR VAGÃO (PLANEJAMENTO - NÃO DESCONTA ESTOQUE) =================
window.renderizarVagoesParaCarga = function() {
    const div = document.getElementById('listaVagoesParaCarga');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('dataCargaPorVagao');
    if (!elData.value) elData.value = new Date().toISOString().split('T')[0];
    const dataSel = elData.value;

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        const cargaExistente = window.cargasVagoesDB.find(c => c.data === dataSel && c.vagaoId === v.id);
        const corCard = cargaExistente ? 'border-left: 6px solid var(--success);' : 'border-left: 6px solid var(--secondary);';
        const txtStatus = cargaExistente ? '<span style="color:var(--success); font-weight:700; font-size:12px;">✔ Carga Lançada</span>' : '<span style="color:var(--secondary); font-size:12px;">Pendente</span>';

        div.innerHTML += `
            <div class="card" style="${corCard} padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="window.abrirModalMontarCargaVagao('${v.id}')">
                <div>
                    <strong style="font-size:15px;">Placa ${v.numero} - ${v.nome}</strong><br>
                    ${txtStatus}
                </div>
                <button class="btn btn-primary btn-pequeno"><i class="ph ph-truck"></i> Abrir</button>
            </div>
        `;
    });
};

window.abrirModalMontarCargaVagao = function(vagaoId) {
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    if (!vagao) return;

    document.getElementById('modalMcvVagaoId').value = vagaoId;
    document.getElementById('modalMcvTitulo').innerText = `Carga: ${vagao.nome}`;
    document.getElementById('modalMcvObs').value = "";

    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const cargaExistente = window.cargasVagoesDB.find(c => c.data === dataSel && c.vagaoId === vagaoId);

    const selRec = document.getElementById('modalMcvReceitaSelect');
    selRec.innerHTML = '<option value="">-- Nenhuma (Preencher Manual) --</option>';
    window.receitasDB.forEach(r => {
        selRec.innerHTML += `<option value="${r.id}">${r.nome}</option>`;
    });

    if (cargaExistente) {
        document.getElementById('modalMcvObs').value = cargaExistente.obs || "";
        selRec.value = "";
    } else {
        if (vagao.receitaId) {
            selRec.value = vagao.receitaId;
        }
    }

    window.renderizarItensModalCargaVagao(cargaExistente);
    window.abrirModal('modal-montar-carga-vagao');
};

window.aplicarReceitaNaCargaModal = function() {
    window.renderizarItensModalCargaVagao(null); 
};

window.copiarCargaVagaoAnteriorModal = function() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const dataAtual = document.getElementById('dataCargaPorVagao').value;
    
    const cargasVagao = window.cargasVagoesDB.filter(c => c.vagaoId === vagaoId && c.data !== dataAtual);
    if (cargasVagao.length === 0) return window.mostrarToast("Nenhuma carga anterior para este vagão.", true);
    
    cargasVagao.sort((a, b) => b.data.localeCompare(a.data));
    const cargaAnterior = cargasVagao[0];
    
    window.abrirConfirmacao(`Copiar carga deste vagão do dia ${cargaAnterior.data.split('-').reverse().join('/')}?`, () => {
        window.produtosDB.forEach(p => {
            const elTot = document.getElementById(`mcv_tot_${p.id}`);
            const elBag = document.getElementById(`mcv_bag_${p.id}`);
            if (!elTot || !elBag) return;

            if (cargaAnterior.itens && cargaAnterior.itens[p.id]) {
                elTot.value = cargaAnterior.itens[p.id].qtd || 0;
                elBag.value = cargaAnterior.itens[p.id].baga || 0;
            } else {
                elTot.value = 0;
                elBag.value = 0;
            }
        });

        document.getElementById('modalMcvObs').value = cargaAnterior.obs || "";
        document.getElementById('modalMcvReceitaSelect').value = "";
        window.mostrarToast("Carga copiada! Edite se necessário e Salve.");
    });
};

window.renderizarItensModalCargaVagao = function(cargaExistente) {
    const div = document.getElementById('modalMcvListaItens');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    const receitaId = document.getElementById('modalMcvReceitaSelect').value;
    const receitaObj = window.receitasDB.find(r => r.id === receitaId);
    
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    const permitidas = vagao?.bebidasPermitidas || [];

    window.produtosDB.filter(p => !(p.nome || "").includes('(Venda)')).forEach(p => {
        // Mostra TODAS as bebidas ativadas para este vagão, mesmo que a receita delas seja 0
        if (permitidas.length > 0 && !permitidas.includes(p.id)) return;

        let valTotal = 0;
        let valBaga = 0;

        if (cargaExistente && cargaExistente.itens && cargaExistente.itens[p.id]) {
            valTotal = cargaExistente.itens[p.id].qtd || 0;
            valBaga = cargaExistente.itens[p.id].baga || 0;
        } else if (receitaObj && receitaObj.itens && receitaObj.itens[p.id]) {
            valTotal = receitaObj.itens[p.id];
        }

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div>
                    <strong style="font-size:14px; color:var(--primary);">${p.id}</strong><br>
                    <span style="font-size:12px; color:var(--secondary);">${p.nome}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:10px; font-weight:bold; color:var(--secondary);">Total (Un):</span>
                        <input type="number" id="mcv_tot_${p.id}" value="${valTotal}" min="0" style="width:65px; padding:6px; font-weight:700;">
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:10px; font-weight:bold; color:var(--bagageiro-color);">Do Baga (Un):</span>
                        <input type="number" id="mcv_bag_${p.id}" value="${valBaga}" min="0" style="width:65px; padding:6px; font-weight:700;">
                    </div>
                </div>
            </div>
        `;
    });
};

// Carga por Vagão é apenas planejamento. Não subtrai nem credita nada no DB global "produtos".
window.salvarCargaVagaoModal = async function() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const data = document.getElementById('dataCargaPorVagao').value;
    const obs = document.getElementById('modalMcvObs').value.trim();
    
    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !(x.nome || "").includes('(Venda)'))) {
        const totEl = document.getElementById(`mcv_tot_${p.id}`);
        const bagEl = document.getElementById(`mcv_bag_${p.id}`);
        if (!totEl || !bagEl) continue;

        const total = parseInt(totEl.value) || 0;
        const baga = parseInt(bagEl.value) || 0;
        const cont = Math.max(0, total - baga);

        // SALVA TUDO, MESMO SE FOR 0, PARA PODER MOSTRAR NO MANIFESTO
        itensSalvos[p.id] = { qtd: total, baga, cont };
    }

    const cargaId = `${data}_${vagaoId}`;
    batch.set(doc(db, "cargas_vagoes", cargaId), {
        id: cargaId,
        data,
        vagaoId,
        itens: itensSalvos,
        obs: window.escapeHTML(obs),
        timestamp: Date.now()
    });

    await batch.commit();

    window.fecharModal('modal-montar-carga-vagao');
    window.mostrarToast("Espelho da Carga do Vagão salva para o apoio!");
    window.renderizarVagoesParaCarga();
};


// ================= CARGA DO DIA (MANIFESTO GERAL) - DESCONTA DO ESTOQUE EM FARDOS =================
window.verificarStatusEdicaoCarga = function() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    const boxStatus = document.getElementById('statusCargaEdicao');
    if (!boxStatus || !dataSel) return;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
        boxStatus.innerHTML = `
            <div style="background:#fefce8; border:1.5px solid #fde68a; color:#92400e; padding:10px 14px; border-radius:8px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-pencil-simple-line"></i> Editando Carga Geral de ${dataSel.split('-').reverse().join('/')}. A diferença ajustará os estoques.
            </div>
        `;
    } else {
        boxStatus.innerHTML = `
            <div style="background:#e0f2fe; border:1.5px solid #bae6fd; color:#0369a1; padding:10px 14px; border-radius:8px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-plus-circle"></i> Criando Carga para ${dataSel.split('-').reverse().join('/')}. Ao salvar, subtrai do estoque.
            </div>
        `;
    }
};

window.trocarDataCargaDia = function() {
    localStorage.removeItem('trem_draft_carga');
    window.abrirCargaDoDia();
};

window.copiarCargaDiaAnterior = function() {
    if (!window.cargasDiaDB || window.cargasDiaDB.length === 0) return window.mostrarToast("Nenhuma carga anterior encontrada.", true);
    
    const cargasOrdenadas = [...window.cargasDiaDB].sort((a, b) => b.data.localeCompare(a.data));
    const dataAtual = document.getElementById('dataCargaDia').value;
    const cargaAnterior = cargasOrdenadas.find(c => c.data !== dataAtual) || cargasOrdenadas[0];
    
    if (!cargaAnterior) return window.mostrarToast("Nenhuma carga anterior encontrada.", true);
    
    window.abrirConfirmacao(`Deseja copiar a carga geral do dia ${cargaAnterior.data.split('-').reverse().join('/')}?`, () => {
        window.produtosDB.forEach(p => {
            if (cargaAnterior.itens && cargaAnterior.itens[p.id]) {
                const item = cargaAnterior.itens[p.id];
                const elTot = document.getElementById(`carga_total_${p.id}`);
                const elBag = document.getElementById(`carga_baga_${p.id}`);
                const elDest = document.getElementById(`carga_dest_${p.id}`);
                const elOrd = document.getElementById(`carga_ordem_${p.id}`);
                
                if (elTot) elTot.value = item.total || 0;
                if (elBag) elBag.value = item.baga || 0;
                if (elDest) elDest.value = item.destino || "";
                if (elOrd && item.ordem) elOrd.value = item.ordem;
                
                window.calcularFormulaLinha(p.id);
            } else {
                const elTot = document.getElementById(`carga_total_${p.id}`);
                const elBag = document.getElementById(`carga_baga_${p.id}`);
                const elDest = document.getElementById(`carga_dest_${p.id}`);
                if (elTot) elTot.value = 0;
                if (elBag) elBag.value = 0;
                if (elDest) elDest.value = "";
                window.calcularFormulaLinha(p.id);
            }
        });
        
        const elObs = document.getElementById('obsEspeciaisCarga');
        if (elObs) elObs.value = cargaAnterior.obsEspeciais || "";
        
        window.salvarDraftCarga();
        window.mostrarToast("Carga geral copiada! Salve para confirmar.");
    });
};

window.abrirCargaDoDia = function() {
    const div = document.getElementById('listaItensCargaDia');
    if (!div) return;
    div.innerHTML = "";

    const hj = new Date().toISOString().split('T')[0];
    const elData = document.getElementById('dataCargaDia');
    if (!elData.value) elData.value = hj;
    const dataSel = elData.value;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    const draftStr = localStorage.getItem('trem_draft_carga');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    window.verificarStatusEdicaoCarga();
    ordenarPorRegra(window.produtosDB);

    // Carga Geral agora preenche em FARDOS
    window.produtosDB.filter(p => !(p.nome || "").includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const bagaDisponivel = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unPorFardo);

        let valTotal = 0;
        let valBaga = 0;
        let valDest = "";
        let valOrdem = p.ordem || 99;

        if (draft && draft.data === dataSel && draft.itens?.[p.id]) {
            valTotal = draft.itens[p.id].total || 0;
            valBaga = draft.itens[p.id].baga || 0;
            valDest = draft.itens[p.id].dest || "";
            valOrdem = draft.itens[p.id].ordem !== undefined ? draft.itens[p.id].ordem : valOrdem;
        } else if (cargaExistente && cargaExistente.itens?.[p.id]) {
            valTotal = cargaExistente.itens[p.id].total || 0;
            valBaga = cargaExistente.itens[p.id].baga || 0;
            valDest = cargaExistente.itens[p.id].destino || "";
            valOrdem = cargaExistente.itens[p.id].ordem !== undefined ? cargaExistente.itens[p.id].ordem : valOrdem;
        }

        const valCont = Math.max(0, valTotal - valBaga);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; font-weight:700; color:var(--secondary);">Ordem:</span>
                        <input type="number" id="carga_ordem_${p.id}" value="${valOrdem}" style="width:55px; padding:4px 6px; font-size:13px; text-align:center; border-radius:6px;" oninput="window.salvarDraftCarga()">
                        <strong>${p.nome} (${p.id})</strong>
                    </div>
                    <small style="color:var(--accent); font-size:13px;">Bagageiro: ${bagaDisponivel}</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:8px;">
                    <div>
                        <label>Total (Fardos):</label>
                        <input type="number" id="carga_total_${p.id}" value="${valTotal}" min="0" oninput="window.calcularFormulaLinha('${p.id}'); window.salvarDraftCarga();">
                    </div>
                    <div>
                        <label>Do Baga (Fardos):</label>
                        <input type="number" id="carga_baga_${p.id}" value="${valBaga}" min="0" oninput="window.calcularFormulaLinha('${p.id}'); window.salvarDraftCarga();">
                    </div>
                    <div>
                        <label>= Contêiner:</label>
                        <input type="number" id="carga_cont_${p.id}" readonly class="input-pax" value="${valCont}">
                    </div>
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:var(--secondary);">Distribuição / Destino:</label>
                    <input type="text" id="carga_dest_${p.id}" value="${valDest}" placeholder="Ex: 1 eco, 2 tur, 3 pls 15 e 17" style="padding:8px 12px; font-size:13px;" oninput="window.salvarDraftCarga()">
                </div>
            </div>
        `;
    });

    const elObs = document.getElementById('obsEspeciaisCarga');
    if (elObs) {
        if (draft && draft.data === dataSel) {
            elObs.value = draft.obs || "";
        } else if (cargaExistente) {
            elObs.value = cargaExistente.obsEspeciais || "";
        } else {
            elObs.value = "";
        }
    }
};

window.calcularFormulaLinha = function(id) {
    const total = parseInt(document.getElementById(`carga_total_${id}`).value) || 0;
    const baga = parseInt(document.getElementById(`carga_baga_${id}`).value) || 0;
    let cont = total - baga;
    if (cont < 0) cont = 0;
    document.getElementById(`carga_cont_${id}`).value = cont;
};

window.salvarCargaDoDia = async function() {
    const data = document.getElementById('dataCargaDia').value;
    const obsEspeciais = document.getElementById('obsEspeciaisCarga').value.trim();
    const cargaAntiga = window.cargasDiaDB.find(c => c.data === data);
    let itensSalvos = {};

    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !(x.nome || "").includes('(Venda)'))) {
        const totEl = document.getElementById(`carga_total_${p.id}`);
        if (!totEl) continue;

        // Na Carga Geral do Dia, os valores digitados são Fardos!
        const totalFardos = parseInt(totEl.value) || 0;
        const bagaFardos = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const contFardos = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;
        const destino = document.getElementById(`carga_dest_${p.id}`)?.value.trim() || "";
        const novaOrdem = parseInt(document.getElementById(`carga_ordem_${p.id}`)?.value) || p.ordem || 99;
        
        const unFardo = p.unidadesPorFardo || 1;

        if (p.ordem !== novaOrdem) {
            p.ordem = novaOrdem;
            batch.update(doc(db, "produtos", p.id), { ordem: novaOrdem });
        }

        // SALVA MESMO SE FOR 0, SE ELE EXISTIA NA CARGA ANTIGA, PARA PODER ESTORNAR
        if (totalFardos > 0 || (cargaAntiga && cargaAntiga.itens?.[p.id])) {
            itensSalvos[p.id] = { total: totalFardos, baga: bagaFardos, cont: contFardos, destino, ordem: novaOrdem };

            const antigoContFardos = cargaAntiga?.itens?.[p.id]?.cont || 0;
            const antigoBagaFardos = cargaAntiga?.itens?.[p.id]?.baga || 0;

            const difContFardos = contFardos - antigoContFardos;
            const difBagaFardos = bagaFardos - antigoBagaFardos;

            // Multiplica o fardo pelas unidades do produto para abater do banco
            if (difContFardos !== 0 || difBagaFardos !== 0) {
                const pRef = doc(db, "produtos", p.id);
                batch.update(pRef, {
                    estoqueContainerUnidades: increment(-(difContFardos * unFardo)),
                    estoqueBagageiroUnidades: increment(-(difBagaFardos * unFardo))
                });
            }
        }
    }

    const cargaId = data;
    batch.set(doc(db, "cargas_dia", cargaId), {
        id: cargaId,
        data,
        itens: itensSalvos,
        obsEspeciais,
        timestamp: Date.now()
    });

    await batch.commit();

    localStorage.removeItem('trem_draft_carga');
    window.mostrarToast("Carga Geral salva e estoque atualizado!");
    window.mostrarTela('tela-admin');
};

// ================= SITUAÇÃO DOS ESTOQUES =================
window.renderizarApenasTabelasResumoEstoques = function() {
    ordenarPorRegra(window.produtosDB);

    const tbodyCont = document.getElementById('tabelaResumoContainer');
    if (tbodyCont) {
        tbodyCont.innerHTML = "";
        window.produtosDB.forEach(p => {
            tbodyCont.innerHTML += `
                <tr>
                    <td><strong>${p.id}</strong> - ${p.nome}</td>
                    <td style="color:var(--primary); font-weight:bold;">${formatarEstoqueFardos(p.estoqueContainerUnidades, p.unidadesPorFardo)}</td>
                </tr>
            `;
        });
    }

    const tbodyBaga = document.getElementById('tabelaResumoBagageiro');
    if (tbodyBaga) {
        tbodyBaga.innerHTML = "";
        window.produtosDB.forEach(p => {
            tbodyBaga.innerHTML += `
                <tr>
                    <td><strong>${p.id}</strong> - ${p.nome}</td>
                    <td style="color:var(--bagageiro-color); font-weight:bold;">${formatarEstoqueFardos(p.estoqueBagageiroUnidades, p.unidadesPorFardo)}</td>
                </tr>
            `;
        });
    }
};

window.abrirTelaEstoques = function() {
    window.renderizarApenasTabelasResumoEstoques();

    const draftStr = localStorage.getItem('trem_draft_estoque');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    const divManual = document.getElementById('listaEstoqueGeral');
    if (!divManual) return;
    divManual.innerHTML = "";

    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;

        const contFardosDb = Math.floor((p.estoqueContainerUnidades || 0) / unFardo);
        const contUnidadesDb = (p.estoqueContainerUnidades || 0) % unFardo;
        const bagaFardosDb = Math.floor((p.estoqueBagageiroUnidades || 0) / unFardo);
        const bagaUnidadesDb = (p.estoqueBagageiroUnidades || 0) % unFardo;

        const valCFd = draft?.[p.id]?.cFd !== undefined && draft?.[p.id]?.cFd !== "" ? draft[p.id].cFd : contFardosDb;
        const valCUn = draft?.[p.id]?.cUn !== undefined && draft?.[p.id]?.cUn !== "" ? draft[p.id].cUn : contUnidadesDb;
        const valBFd = draft?.[p.id]?.bFd !== undefined && draft?.[p.id]?.bFd !== "" ? draft[p.id].bFd : bagaFardosDb;
        const valBUn = draft?.[p.id]?.bUn !== undefined && draft?.[p.id]?.bUn !== "" ? draft[p.id].bUn : bagaUnidadesDb;

        divManual.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (${p.id})</span>
                    <small style="color:var(--secondary); font-size:13px; font-weight:700;">1 Fardo = ${unFardo} un</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="box-ajuste-col box-ajuste-cont">
                        <label style="color:var(--container-color);"><i class="ph ph-archive"></i> Contêiner:</label>
                        <div class="input-unidade-group">
                            <div>
                                <span>[ Fardos ]</span>
                                <input type="number" id="est_cont_fd_${p.id}" value="${valCFd}" min="0" oninput="window.salvarDraftEstoque()">
                            </div>
                            <div>
                                <span>[ + Unidades ]</span>
                                <input type="number" id="est_cont_un_${p.id}" value="${valCUn}" min="0" oninput="window.salvarDraftEstoque()">
                            </div>
                        </div>
                    </div>
                    <div class="box-ajuste-col box-ajuste-baga">
                        <label style="color:var(--bagageiro-color);"><i class="ph ph-bag"></i> Bagageiro:</label>
                        <div class="input-unidade-group">
                            <div>
                                <span>[ Fardos ]</span>
                                <input type="number" id="est_baga_fd_${p.id}" value="${valBFd}" min="0" oninput="window.salvarDraftEstoque()">
                            </div>
                            <div>
                                <span>[ + Unidades ]</span>
                                <input type="number" id="est_baga_un_${p.id}" value="${valBUn}" min="0" oninput="window.salvarDraftEstoque()">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
};

window.abrirModalConfirmaEstoque = function() {
    document.getElementById('modalObsAjusteEstoque').value = "";
    window.abrirModal('modal-confirma-estoque');
};

window.confirmarAjustesEstoqueComObs = async function() {
    const obs = document.getElementById('modalObsAjusteEstoque').value.trim();
    const batch = writeBatch(db);

    for (let p of window.produtosDB) {
        const unFardo = p.unidadesPorFardo || 1;
        
        const cFd = parseInt(document.getElementById(`est_cont_fd_${p.id}`)?.value) || 0;
        const cUn = parseInt(document.getElementById(`est_cont_un_${p.id}`)?.value) || 0;
        const bFd = parseInt(document.getElementById(`est_baga_fd_${p.id}`)?.value) || 0;
        const bUn = parseInt(document.getElementById(`est_baga_un_${p.id}`)?.value) || 0;

        const totalCont = (cFd * unFardo) + cUn;
        const totalBaga = (bFd * unFardo) + bUn;

        batch.update(doc(db, "produtos", p.id), {
            estoqueContainerUnidades: totalCont,
            estoqueBagageiroUnidades: totalBaga
        });
    }

    const logId = Date.now().toString();
    batch.set(doc(db, "logs_ajuste_estoque", logId), {
        id: logId,
        timestamp: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        observacao: window.escapeHTML(obs) || "Ajuste manual geral"
    });

    await batch.commit();

    localStorage.removeItem('trem_draft_estoque');
    window.fecharModal('modal-confirma-estoque');
    window.mostrarToast("Estoques atualizados com sucesso!");
    window.abrirTelaEstoques();
};

// ================= CONTAGEM DE VAGÃO (APOIO COM MATEMÁTICA AUTOMÁTICA E RECEITAS) =================
window.abrirSetupContagem = function() {
    const selUser = document.getElementById('selectNomeApoio');
    if (selUser) {
        selUser.innerHTML = "";
        [...window.usuariosDB].sort((a,b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
        });
    }

    const selVagao = document.getElementById('selectVagaoApoio');
    if (selVagao) {
        selVagao.innerHTML = "";
        const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
        vagoesOrd.forEach(v => {
            const labelTipo = v.tipo ? `[${v.tipo.toUpperCase()}]` : '';
            selVagao.innerHTML += `<option value="${v.id}">Placa ${v.numero} &bull; ${v.nome} ${labelTipo}</option>`;
        });
    }

    const draftStr = localStorage.getItem('trem_draft_contagem');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = draft?.data || hj;
    document.getElementById('nomeGuiaApoio').value = draft?.guia || "";
    if (draft?.sentido) document.getElementById('selectSentidoApoio').value = draft.sentido;
    if (draft?.vagaoId && selVagao) selVagao.value = draft.vagaoId;
};

window.iniciarContagemVagao = function() {
    const guia = document.getElementById('nomeGuiaApoio').value.trim();
    if (!guia) { window.mostrarToast("Preencha o Nome do Guia!", true); return; }

    const vagaoId = document.getElementById('selectVagaoApoio').value;
    const dataSel = document.getElementById('dataContagemApoio').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    window.contagemTemp.apoio = document.getElementById('selectNomeApoio').value;
    window.contagemTemp.guia = window.escapeHTML(guia);
    window.contagemTemp.data = dataSel;
    window.contagemTemp.sentido = document.getElementById('selectSentidoApoio').value;
    window.contagemTemp.vagaoId = vagaoId;
    window.contagemTemp.vagaoNumero = vagaoObj?.numero || "S/N";
    window.contagemTemp.vagao = `Placa ${vagaoObj?.numero || ''} - ${vagaoObj?.nome || 'Vagão'}`;
    window.contagemTemp.vagaoTipo = vagaoObj?.tipo || 'turistico';

    document.getElementById('lblVagaoContagem').innerText = window.contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = window.contagemTemp.sentido;

    const cargaDoChefe = window.cargasVagoesDB.find(c => c.data === dataSel && c.vagaoId === vagaoId);
    
    const boxAviso = document.getElementById('avisoCargaCarregada');
    if (cargaDoChefe) {
        boxAviso.innerHTML = `<span style="background:#dcfce7; color:#15803d; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700;"><i class="ph ph-check-circle"></i> Carga oficial do chefe sincronizada!</span>`;
    } else {
        boxAviso.innerHTML = `<span style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700;"><i class="ph ph-warning"></i> Nenhuma carga lançada pelo chefe. Preencha manualmente.</span>`;
    }

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    const draftStr = localStorage.getItem('trem_draft_contagem');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    ordenarPorRegra(window.produtosDB);

    const permitidas = vagaoObj?.bebidasPermitidas || [];
    const produtosFiltrados = window.produtosDB.filter(p => !(p.nome || "").includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    produtosFiltrados.forEach(p => {
        let cargaBase = cargaDoChefe && cargaDoChefe.itens[p.id] ? cargaDoChefe.itens[p.id].qtd : 0;

        const valCarga = draft?.itens?.[p.id]?.carga !== undefined && draft?.itens?.[p.id]?.carga !== "" ? draft.itens[p.id].carga : cargaBase;
        const valSaldo = draft?.itens?.[p.id]?.saldo !== undefined && draft?.itens?.[p.id]?.saldo !== "" ? draft.itens[p.id].saldo : "";
        const valTrip = draft?.itens?.[p.id]?.trip !== undefined && draft?.itens?.[p.id]?.trip !== "" ? draft.itens[p.id].trip : 0;
        const valAva = draft?.itens?.[p.id]?.ava !== undefined && draft?.itens?.[p.id]?.ava !== "" ? draft.itens[p.id].ava : 0;

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (${p.id})</span></div>
                <div class="grid-inputs" style="grid-template-columns: repeat(3, 1fr);">
                    <div>
                        <label>Carga:</label>
                        <input type="number" id="carga_${p.id}" value="${valCarga}" data-carga-original="${cargaBase}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Sobra (Saldo):</label>
                        <input type="number" id="saldo_${p.id}" value="${valSaldo}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Pax (Auto):</label>
                        <input type="number" id="pax_${p.id}" class="input-pax" readonly value="${valCarga}">
                    </div>
                    <div>
                        <label>Tripulação:</label>
                        <input type="number" id="trip_${p.id}" value="${valTrip}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Avaria:</label>
                        <input type="number" id="ava_${p.id}" class="input-avaria" value="${valAva}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();">
                    </div>
                </div>
            </div>
        `;
    });

    produtosFiltrados.forEach(p => window.calcularConsumo(p.id));
    window.mostrarTela('tela-contagem-vagao');
};

window.calcularConsumo = function(id) {
    const carga = parseInt(document.getElementById(`carga_${id}`).value) || 0;
    const saldo = parseInt(document.getElementById(`saldo_${id}`).value) || 0;
    const trip = parseInt(document.getElementById(`trip_${id}`).value) || 0;
    const ava = parseInt(document.getElementById(`ava_${id}`).value) || 0;
    document.getElementById(`pax_${id}`).value = Math.max(0, carga - saldo - trip - ava);
};

window.gerarResumoContagem = function() {
    window.contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";

    let totalLanches = 0;
    let totalBebidas = 0;

    ordenarPorRegra(window.produtosDB);
    window.produtosDB.forEach(p => {
        const elCarga = document.getElementById(`carga_${p.id}`);
        if (!elCarga) return;

        const attrOrig = elCarga.getAttribute('data-carga-original');
        const cargaOriginalNum = attrOrig !== null && attrOrig !== "" ? parseInt(attrOrig) : (parseInt(elCarga.value) || 0);

        let obj = {
            id: p.id,
            nome: p.nome,
            cargaOriginal: cargaOriginalNum,
            carga: parseInt(elCarga.value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`)?.value) || 0,
            trip: parseInt(document.getElementById(`trip_${p.id}`)?.value) || 0,
            ava: parseInt(document.getElementById(`ava_${p.id}`)?.value) || 0,
            pax: parseInt(document.getElementById(`pax_${p.id}`)?.value) || 0
        };

        window.contagemTemp.itens[p.id] = obj;

        if (obj.carga > 0 || obj.saldo > 0 || obj.trip > 0 || obj.ava > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${obj.nome}</td>
                    <td>${obj.carga}</td>
                    <td style="color:var(--success); font-weight:bold;">${obj.pax}</td>
                    <td>${obj.trip > 0 ? obj.trip : '-'}</td>
                    <td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td>
                    <td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td>
                </tr>
            `;

            if (p.id === 'KL' || p.id === 'Kl') totalLanches += obj.pax;
            else totalBebidas += obj.pax;
        }
    });

    document.getElementById('resumoTotalLanches').innerText = totalLanches;
    document.getElementById('resumoTotalBebidas').innerText = totalBebidas;
    document.getElementById('boxStatusComparativoResumo').className = (totalLanches === totalBebidas) ? 'box-comparativo-status kpi-match' : 'box-comparativo-status kpi-divergent';
    document.getElementById('resumoApoio').innerText = window.contagemTemp.apoio;
    document.getElementById('resumoGuia').innerText = window.contagemTemp.guia;
    document.getElementById('resumoData').innerText = window.contagemTemp.data.split('-').reverse().join('/');
    document.getElementById('resumoVagao').innerText = window.contagemTemp.vagao;
    document.getElementById('resumoSentido').innerText = window.contagemTemp.sentido;

    window.mostrarTela('tela-resumo-contagem');
};

window.salvarContagemDefinitiva = async function() {
    window.contagemTemp.obs = window.escapeHTML(document.getElementById('obsFinalContagem').value);
    const contagemId = Date.now().toString();
    window.contagemTemp.id = contagemId;
    window.contagemTemp.timestamp = Date.now();

    const batch = writeBatch(db);

    for (let id in window.contagemTemp.itens) {
        const item = window.contagemTemp.itens[id];
        
        // MATEMÁTICA DO APOIO - SOBRAS E EXTRAS DO BAGAGEIRO
        const extraPego = Math.max(0, item.carga - item.cargaOriginal);
        const netBagageiro = item.saldo - extraPego;

        if (netBagageiro !== 0) {
            batch.update(doc(db, "produtos", id), {
                estoqueBagageiroUnidades: increment(netBagageiro)
            });
        }
    }

    batch.set(doc(db, "contagens", contagemId), window.contagemTemp);
    await batch.commit();

    localStorage.removeItem('trem_draft_contagem');
    window.mostrarToast("Contagem salva e Bagageiro atualizado!");
    window.contagemTemp = {};
    window.mostrarTela('tela-inicial');
};

// ================= CARRINHO DE VENDAS =================
window.abrirSetupCarrinho = function() {
    const selApoio = document.getElementById('selectApoioCarrinho');
    if (!selApoio) return;
    selApoio.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
        selApoio.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
    });

    const draftStr = localStorage.getItem('trem_draft_carrinho');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataCarrinho').value = draft?.data || hj;
    if (draft?.sentido) document.getElementById('sentidoCarrinho').value = draft.sentido;
};

window.iniciarAcertoCarrinho = function() {
    const sentido = document.getElementById('sentidoCarrinho').value;
    document.getElementById('lblCarrinhoSentido').innerText = sentido;

    const div = document.getElementById('listaItensCarrinho');
    div.innerHTML = "";

    const draftStr = localStorage.getItem('trem_draft_carrinho');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    window.produtosDB.filter(p => (p.nome || "").includes('(Venda)')).forEach(p => {
        const valSaiu = draft?.itens?.[p.id]?.saiu !== undefined ? draft.itens[p.id].saiu : 0;
        const valSobrou = draft?.itens?.[p.id]?.sobrou !== undefined ? draft.itens[p.id].sobrou : 0;

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</span></div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div><label>Saiu com:</label><input type="number" id="venda_saiu_${p.id}" value="${valSaiu}" onfocus="this.select()" oninput="window.calcularVendas(); window.salvarDraftCarrinho();"></div>
                    <div><label>Sobrou:</label><input type="number" id="venda_sobrou_${p.id}" value="${valSobrou}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="window.calcularVendas(); window.salvarDraftCarrinho();"></div>
                </div>
            </div>
        `;
    });

    const selExtra = document.getElementById('selectItemExtraCarrinho');
    selExtra.innerHTML = '<option value="">-- Selecione um item extra vendido --</option>';
    window.produtosDB.forEach(p => {
        selExtra.innerHTML += `<option value="${p.id}">${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</option>`;
    });

    window.itensExtrasCarrinhoTemp = draft?.extras || [];
    renderizarExtrasAdicionados();
    document.getElementById('carrinhoTroco').value = draft?.troco || 0;
    window.calcularVendas();
    window.mostrarTela('tela-acerto-carrinho');
};

window.adicionarItemExtraVenda = function() {
    const pId = document.getElementById('selectItemExtraCarrinho').value;
    const qtd = parseInt(document.getElementById('qtdItemExtraCarrinho').value) || 1;

    if (!pId) { window.mostrarToast("Selecione um produto extra da lista!", true); return; }
    const prod = window.produtosDB.find(x => x.id === pId);

    window.itensExtrasCarrinhoTemp.push({
        id: prod.id,
        nome: prod.nome,
        preco: prod.precoVenda || 0,
        qtd: qtd,
        total: (prod.precoVenda || 0) * qtd
    });

    document.getElementById('qtdItemExtraCarrinho').value = 1;
    document.getElementById('selectItemExtraCarrinho').value = "";
    renderizarExtrasAdicionados();
    window.calcularVendas();
    window.salvarDraftCarrinho();
};

function renderizarExtrasAdicionados() {
    const div = document.getElementById('listaExtrasAdicionados');
    div.innerHTML = "";
    window.itensExtrasCarrinhoTemp.forEach((item, idx) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px 12px; border:1.5px solid var(--border); border-radius:8px; margin-bottom:6px; font-size:14px;">
                <span><strong>${item.qtd}x</strong> ${item.nome} &bull; <span style="color:var(--success); font-weight:bold;">R$ ${window.formatarMoeda(item.total)}</span></span>
                <button class="btn btn-danger btn-pequeno" style="padding:4px 8px;" onclick="window.removerItemExtra(${idx})"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
}

window.removerItemExtra = function(idx) {
    window.itensExtrasCarrinhoTemp.splice(idx, 1);
    renderizarExtrasAdicionados();
    window.calcularVendas();
    window.salvarDraftCarrinho();
};

window.calcularVendas = function() {
    let totalVendas = 0;

    window.produtosDB.filter(p => (p.nome || "").includes('(Venda)')).forEach(p => {
        const saiu = parseInt(document.getElementById(`venda_saiu_${p.id}`)?.value) || 0;
        const sobrou = parseInt(document.getElementById(`venda_sobrou_${p.id}`)?.value) || 0;
        const vendidos = Math.max(0, saiu - sobrou);
        totalVendas += (vendidos * (p.precoVenda || 0));
    });

    window.itensExtrasCarrinhoTemp.forEach(ex => {
        totalVendas += ex.total;
    });

    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;

    document.getElementById('lblTotalVendasCarrinho').innerText = window.formatarMoeda(totalVendas);
    document.getElementById('lblTotalEntregar').innerText = 'R$ ' + window.formatarMoeda(totalVendas + troco);
};

window.salvarAcertoCarrinho = async function() {
    const data = document.getElementById('dataCarrinho').value;
    const sentido = document.getElementById('sentidoCarrinho').value;
    const apoio = document.getElementById('selectApoioCarrinho').value;
    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;
    const totalVendaTexto = document.getElementById('lblTotalVendasCarrinho').innerText;

    let itensVendidosBase = {};
    window.produtosDB.filter(p => (p.nome || "").includes('(Venda)')).forEach(p => {
        const saiu = parseInt(document.getElementById(`venda_saiu_${p.id}`)?.value) || 0;
        const sobrou = parseInt(document.getElementById(`venda_sobrou_${p.id}`)?.value) || 0;
        itensVendidosBase[p.id] = { saiu, sobrou, vendidos: Math.max(0, saiu - sobrou), nome: p.nome, preco: p.precoVenda };
    });

    const vendaId = Date.now().toString();
    await setDoc(doc(db, "vendas_carrinho", vendaId), {
        id: vendaId,
        data,
        sentido,
        apoio,
        troco,
        totalVendasR$: totalVendaTexto,
        itensBase: itensVendidosBase,
        extras: window.itensExtrasCarrinhoTemp,
        timestamp: Date.now()
    });

    localStorage.removeItem('trem_draft_carrinho');
    window.mostrarToast(`Acerto concluído e salvo!<br>Total apurado: R$ ${totalVendaTexto}`);
    window.mostrarTela('tela-inicial');
};

// ================= RELATÓRIOS DO CHEFE =================
window.setModoRelatorio = function(modo) {
    window.modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelBoutLito', 'btnRelVendas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('ativo');
    });
    const mapIds = {
        'todos': 'btnRelVagao',
        'turisticos': 'btnRelTur',
        'boutiques_litorinas': 'btnRelBoutLito',
        'vendas': 'btnRelVendas'
    };
    const atvEl = document.getElementById(mapIds[modo]);
    if(atvEl) atvEl.classList.add('ativo');
    
    window.renderizarRelatoriosAdmin();
};

window.setFiltroSentido = function(sentido) {
    window.filtroSentidoRelatorio = sentido;
    ['btnSentidoTodos', 'btnSentidoIda', 'btnSentidoVolta'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('ativo');
    });
    const mapIds = {
        'todos': 'btnSentidoTodos',
        'Ida': 'btnSentidoIda',
        'Volta': 'btnSentidoVolta'
    };
    const atvEl = document.getElementById(mapIds[sentido]);
    if(atvEl) atvEl.classList.add('ativo');

    window.renderizarRelatoriosAdmin();
};

window.renderizarRelatoriosAdmin = function() {
    const div = document.getElementById('listaRelatoriosAdmin');
    if (!div) return;
    div.innerHTML = "";

    const elFiltro = document.getElementById('filtroDataRelatorio');
    const dataFiltro = elFiltro.value || new Date().toISOString().split('T')[0];
    elFiltro.value = dataFiltro;

    if (window.modoRelatorioAdmin === 'vendas') {
        let vendas = window.vendasCarrinhoDB.filter(v => v.data === dataFiltro);
        if (window.filtroSentidoRelatorio !== 'todos') {
            vendas = vendas.filter(v => {
                if(!v.sentido) return false;
                return v.sentido.trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase();
            });
        }

        if (vendas.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda com estes filtros.</p>';
            return;
        }

        vendas.forEach(v => {
            let extrasHtml = (v.extras || []).map(e => `<li>${e.qtd}x ${e.nome}</li>`).join('');
            div.innerHTML += `
                <div class="card" style="border-left:5px solid #0f766e; padding:14px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="font-size:16px;">Carrinho: Viagem de ${v.sentido}</strong>
                        <span style="font-size:13px; color:var(--secondary);">${v.apoio}</span>
                    </div>
                    <p style="margin:6px 0; font-size:16px; color:var(--success); font-weight:bold;">Vendas: R$ ${v.totalVendasR$}</p>
                    ${extrasHtml ? `<small><b>Extras:</b></small><ul style="font-size:12px; padding-left:18px;">${extrasHtml}</ul>` : ''}
                </div>
            `;
        });
        return;
    }

    let filtrados = window.contagensDB.filter(c => c.data === dataFiltro);

    if (window.filtroSentidoRelatorio !== 'todos') {
        filtrados = filtrados.filter(c => {
            if(!c.sentido) return false;
            return c.sentido.trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase();
        });
    }

    if (window.modoRelatorioAdmin === 'turisticos') {
        filtrados = filtrados.filter(c => {
            if(!c.vagaoTipo) return false;
            const t = c.vagaoTipo.trim().toLowerCase();
            return t === 'turistico' || t === 'economico';
        });
    } else if (window.modoRelatorioAdmin === 'boutiques_litorinas') {
        filtrados = filtrados.filter(c => {
            if(!c.vagaoTipo) return false;
            const t = c.vagaoTipo.trim().toLowerCase();
            return t === 'boutique' || t === 'litorina';
        });
    }

    if (filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado para estes filtros.</p>';
        return;
    }

    filtrados.sort((a, b) => {
        const nA = parseInt(a.vagaoNumero) || 9999;
        const nB = parseInt(b.vagaoNumero) || 9999;
        if (nA !== nB) return nA - nB;
        return (a.sentido || "").localeCompare(b.sentido || "");
    });

    filtrados.forEach(c => {
        let linhas = gerarLinhasTabelaAdmin(c.itens);
        let totalLanches = 0;
        let totalBebidas = 0;
        
        for (let k in c.itens) {
            const it = c.itens[k];
            if (k === 'KL' || k === 'Kl') totalLanches += it.pax || 0;
            else totalBebidas += it.pax || 0;
        }

        const compClasse = (totalLanches === totalBebidas) ? 'kpi-match' : 'kpi-divergent';

        div.innerHTML += `
            <div class="card" style="border-left:5px solid var(--primary); padding:14px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:16px;">${c.vagao} (${c.sentido})</strong>
                        <br><span style="font-size:12px; color:var(--secondary);">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalEdicaoRelatorio('${c.id}')"><i class="ph ph-pencil-simple"></i> Corrigir</button>
                </div>

                <div class="box-comparativo-status ${compClasse}" style="padding:6px 12px; font-size:12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-around;">
                        <span>Lanches: <strong>${totalLanches}</strong></span>
                        <span>Bebidas: <strong>${totalBebidas}</strong></span>
                    </div>
                </div>

                <div class="tabela-container">
                    <table class="tabela-relatorio">
                        <thead>
                            <tr>
                                <th style="width:34%;">Bebida</th>
                                <th style="width:13%;">Carga</th>
                                <th style="width:13%;">Pax</th>
                                <th style="width:12%;">Trip</th>
                                <th style="width:12%;">Ava</th>
                                <th style="width:16%;">Sobra</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                ${c.obs ? `<div style="margin-top:8px; color:var(--danger); font-size:12px;"><b>Obs:</b> ${c.obs}</div>` : ''}
            </div>
        `;
    });
};

function gerarLinhasTabelaAdmin(itensObjeto) {
    let arr = Object.values(itensObjeto).map(item => {
        const prod = window.produtosDB.find(p => p.id === item.id) || { ordem: 9999 };
        return { ...item, ordem: prod.ordem };
    });

    ordenarPorRegra(arr);

    let html = "";
    arr.forEach(obj => {
        if (obj.carga > 0 || obj.saldo > 0 || obj.pax > 0 || obj.ava > 0) {
            html += `
                <tr>
                    <td>${obj.nome}</td>
                    <td>${obj.carga}</td>
                    <td style="color:var(--success); font-weight:bold;">${obj.pax}</td>
                    <td>${obj.trip > 0 ? obj.trip : '-'}</td>
                    <td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td>
                    <td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td>
                </tr>
            `;
        }
    });
    return html;
}

window.abrirModalEdicaoRelatorio = function(id) {
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    document.getElementById('editRelatorioIdOriginal').value = c.id;
    document.getElementById('subtituloModalEditaRelatorio').innerText = `${c.vagao} (${c.sentido}) \u2022 ${c.data.split('-').reverse().join('/')}`;
    document.getElementById('obsEdicaoChefeRelatorio').value = c.obs || "";

    const div = document.getElementById('listaItensEdicaoRelatorio');
    div.innerHTML = "";

    ordenarPorRegra(window.produtosDB);
    for (let pId in c.itens) {
        const item = c.itens[pId];
        div.innerHTML += `
            <div class="item-contagem" style="padding:10px; margin-bottom:8px;">
                <strong style="font-size:14px;">${item.nome} (${pId})</strong>
                <div class="grid-inputs" style="grid-template-columns: repeat(4, 1fr); margin-top:6px;">
                    <div><label>Carga:</label><input type="number" id="edit_rel_carga_${pId}" value="${item.carga}"></div>
                    <div><label>Sobra:</label><input type="number" id="edit_rel_saldo_${pId}" value="${item.saldo}"></div>
                    <div><label>Trip:</label><input type="number" id="edit_rel_trip_${pId}" value="${item.trip}"></div>
                    <div><label>Avaria:</label><input type="number" id="edit_rel_ava_${pId}" value="${item.ava}"></div>
                </div>
            </div>
        `;
    }

    window.abrirModal('modal-editar-relatorio');
};

window.salvarEdicaoRelatorioPeloChefe = async function() {
    const id = document.getElementById('editRelatorioIdOriginal').value;
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    const batch = writeBatch(db);
    let novosItens = {};

    for (let pId in c.itens) {
        const carga = parseInt(document.getElementById(`edit_rel_carga_${pId}`)?.value) || 0;
        const saldo = parseInt(document.getElementById(`edit_rel_saldo_${pId}`)?.value) || 0;
        const trip = parseInt(document.getElementById(`edit_rel_trip_${pId}`)?.value) || 0;
        const ava = parseInt(document.getElementById(`edit_rel_ava_${pId}`)?.value) || 0;
        const pax = Math.max(0, carga - saldo - trip - ava);

        const cargaOriginal = c.itens[pId].cargaOriginal !== undefined ? c.itens[pId].cargaOriginal : (c.itens[pId].carga || 0);

        novosItens[pId] = {
            id: pId,
            nome: c.itens[pId].nome,
            cargaOriginal,
            carga, saldo, trip, ava, pax
        };

        const difCarga = carga - (c.itens[pId].carga || 0);
        const difSaldo = saldo - (c.itens[pId].saldo || 0);
        const netAjusteBagageiro = difSaldo - difCarga;

        if (netAjusteBagageiro !== 0) {
            batch.update(doc(db, "produtos", pId), {
                estoqueBagageiroUnidades: increment(netAjusteBagageiro)
            });
        }
    }

    const obsChefe = document.getElementById('obsEdicaoChefeRelatorio').value.trim();
    batch.update(doc(db, "contagens", id), {
        itens: novosItens,
        obs: window.escapeHTML(obsChefe)
    });

    await batch.commit();
    window.fecharModal('modal-editar-relatorio');
    window.mostrarToast("Relatório corrigido com sucesso!");
    window.renderizarRelatoriosAdmin();
};

// INICIALIZAÇÃO OBRIGATÓRIA E BLINDADA
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
