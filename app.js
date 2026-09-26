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
    console.log("Persistência offline ativa.");
}

// ================= CSS E HTML DINÂMICOS =================
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

// ================= NOTIFICAÇÕES E CONFIRMAÇÕES =================
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

// ================= CACHE LOCAL SEGURO =================
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

// ================= DADOS INICIAIS =================
window.produtosDB = getCache('trem_cache_produtos', []);
window.usuariosDB = getCache('trem_cache_usuarios', []);
window.vagoesDB = getCache('trem_cache_vagoes', []);
window.receitasDB = getCache('trem_cache_receitas', []);
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
window.sentidoCargaVagao = 'Ida';

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
    if (fardos > 0 && sobra > 0) return `${fardos} Fd + ${sobra} Un`;
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

function ordenarPorRegra(lista) {
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

// ================= MODAIS =================
window.abrirModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};

window.fecharModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

// ================= ROTEADOR =================
window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo(0, 0);

    localStorage.setItem('trem_tela_ativa', id);

    const safeCall = (fn) => { if (typeof fn === 'function') fn(); };

    if (id === 'tela-admin') {
        const elDataOp = document.getElementById('dataOperacaoAdmin');
        if (elDataOp) {
            elDataOp.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        window.atualizarDashboardKPIs();
    }
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
        if (chefeLogado) window.mostrarTela(telaSalva);
        else window.mostrarTela('tela-login');
    } else if (telaSalva) {
        window.mostrarTela(telaSalva);
    } else {
        window.mostrarTela('tela-inicial');
    }
}

// ================= SINCRONIZAÇÃO EM NUVEM E OFFLINE =================
function iniciarSincronizacaoNuvem() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        if (snapshot.docs.length > 0) {
            window.produtosDB = snapshot.docs.map(d => {
                const data = d.data();
                if (data.ordem === undefined || data.ordem === null) {
                    const idx = ORDEM_PADRAO_CHEFE.indexOf(data.id);
                    data.ordem = idx !== -1 ? idx + 1 : 99;
                }
                return data;
            });
            localStorage.setItem('trem_cache_produtos', JSON.stringify(window.produtosDB));
        }
        window.atualizarDashboardKPIs();
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos') window.renderizarProdutosAdmin();
        if (telaAtiva === 'tela-estoques') window.renderizarApenasTabelasResumoEstoques();
        if (telaAtiva === 'tela-carga-vagao') window.renderizarPainelEstoqueTransito();
    });

    onSnapshot(collection(db, "receitas_carga"), (snapshot) => {
        if (snapshot.docs.length > 0) {
            window.receitasDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_receitas', JSON.stringify(window.receitasDB));
        }
        if (document.getElementById('tela-receitas')?.classList.contains('ativa')) window.renderizarReceitasAdmin();
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        if (snapshot.docs.length > 0) {
            window.usuariosDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_usuarios', JSON.stringify(window.usuariosDB));
        }
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-usuarios') window.renderizarUsuarios();
        if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
        if (telaAtiva === 'tela-setup-carrinho') window.abrirSetupCarrinho();
        if (telaAtiva === 'tela-boutiques-hub') window.carregarSelectBoutiqueHub();
    });

    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        if (snapshot.docs.length > 0) {
            window.vagoesDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_vagoes', JSON.stringify(window.vagoesDB));
        }
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-vagoes') window.renderizarVagoesAdmin();
        if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
        if (telaAtiva === 'tela-operacao-viagem') window.carregarMonitorViagem();
        if (telaAtiva === 'tela-carga-vagao') window.renderizarVagoesParaCarga();
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
        if (document.getElementById('tela-carga-vagao')?.classList.contains('ativa')) window.renderizarPainelEstoqueTransito();
    });

    onSnapshot(collection(db, "cargas_vagoes"), (snapshot) => {
        window.cargasVagoesDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas_vagoes', JSON.stringify(window.cargasVagoesDB));
        if (document.getElementById('tela-carga-vagao')?.classList.contains('ativa')) {
            window.renderizarVagoesParaCarga();
            window.renderizarPainelEstoqueTransito();
        }
        if (document.getElementById('tela-boutiques-hub')?.classList.contains('ativa')) {
            window.carregarFormularioBoutiqueHub();
        }
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

// ================= MÓDULO: PRODUTOS & PREÇOS =================
window.renderizarProdutosAdmin = function() {
    const div = document.getElementById('listaProdutosAdmin');
    if (!div) return;
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    if (!window.produtosDB || window.produtosDB.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum produto cadastrado no catálogo.</p>';
        return;
    }

    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const contFormatado = formatarEstoqueFardos(p.estoqueContainerUnidades, unFardo);
        const bagaFormatado = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unFardo);

        div.innerHTML += `
            <div class="card" style="padding:15px; margin-bottom:12px; border-left:5px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <span class="badge-ordem">#${p.ordem || '-'}</span>
                        <strong style="font-size:16px; color:var(--primary);">${p.nome} (${p.id})</strong>
                        <div style="font-size:13px; color:var(--secondary); margin-top:4px;">
                            <span>${unFardo} un/fardo</span> &bull; 
                            <span style="font-weight:700; color:var(--text);">R$ ${window.formatarMoeda(p.precoVenda)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalProduto('${p.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                        <button class="btn btn-danger btn-pequeno" onclick="window.excluirProduto('${p.id}')"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border); font-size:12px;">
                    <div style="background:var(--container-bg); padding:6px 10px; border-radius:6px; color:var(--container-color);">
                        <strong>Contêiner:</strong> ${contFormatado} (${p.estoqueContainerUnidades || 0} un)
                    </div>
                    <div style="background:var(--bagageiro-bg); padding:6px 10px; border-radius:6px; color:var(--bagageiro-color);">
                        <strong>Bagageiro:</strong> ${bagaFormatado} (${p.estoqueBagageiroUnidades || 0} un)
                    </div>
                </div>
            </div>
        `;
    });
};

window.abrirModalProduto = function(id = null) {
    if (id) {
        const p = window.produtosDB.find(x => x.id === id);
        if (!p) return;
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Produto';
        document.getElementById('modalProdIdOriginal').value = p.id;
        document.getElementById('modalProdOrdem').value = p.ordem || 99;
        document.getElementById('modalProdSigla').value = p.id;
        document.getElementById('modalProdSigla').disabled = true;
        document.getElementById('modalProdNome').value = p.nome;
        document.getElementById('modalProdUnFardo').value = p.unidadesPorFardo || 12;
        document.getElementById('modalProdPreco').value = p.precoVenda || 0;
    } else {
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Produto';
        document.getElementById('modalProdIdOriginal').value = "";
        document.getElementById('modalProdOrdem').value = (window.produtosDB.length + 1);
        document.getElementById('modalProdSigla').value = "";
        document.getElementById('modalProdSigla').disabled = false;
        document.getElementById('modalProdNome').value = "";
        document.getElementById('modalProdUnFardo').value = 12;
        document.getElementById('modalProdPreco').value = 6;
    }

    window.abrirModal('modal-produto');
    setTimeout(() => window.focarProximo(id ? 'modalProdNome' : 'modalProdSigla'), 100);
};

window.salvarProdutoModal = async function() {
    const idOriginal = document.getElementById('modalProdIdOriginal').value.trim();
    const sigla = document.getElementById('modalProdSigla').value.trim();
    const nome = document.getElementById('modalProdNome').value.trim();
    const ordem = parseInt(document.getElementById('modalProdOrdem').value) || 99;
    const unFardo = parseInt(document.getElementById('modalProdUnFardo').value) || 1;
    const preco = parseFloat(document.getElementById('modalProdPreco').value) || 0;

    if (!sigla || !nome) return window.mostrarToast("Preencha a Sigla e o Nome!", true);

    const finalId = idOriginal || sigla;

    if (!idOriginal && window.produtosDB.some(p => p.id.toLowerCase() === finalId.toLowerCase())) {
        return window.mostrarToast(`Já existe produto com a sigla "${finalId}"!`, true);
    }

    const prodExistente = window.produtosDB.find(p => p.id === finalId);
    const dados = {
        id: finalId,
        sigla: finalId,
        nome: window.escapeHTML(nome),
        ordem: ordem,
        unidadesPorFardo: unFardo,
        precoVenda: preco,
        estoqueContainerUnidades: prodExistente ? (prodExistente.estoqueContainerUnidades || 0) : 0,
        estoqueBagageiroUnidades: prodExistente ? (prodExistente.estoqueBagageiroUnidades || 0) : 0
    };

    await setDoc(doc(db, "produtos", finalId), dados, { merge: true });
    window.fecharModal('modal-produto');
    window.mostrarToast("Produto salvo com sucesso!");
};

window.excluirProduto = async function(id) {
    window.abrirConfirmacao(`Deseja excluir o produto "${id}"?`, async () => {
        await deleteDoc(doc(db, "produtos", id));
        window.mostrarToast("Produto excluído!");
    });
};

// ================= MÓDULO: USUÁRIOS =================
window.renderizarUsuarios = function() {
    const div = document.getElementById('listaUsuariosAdmin');
    if (!div) return;
    div.innerHTML = "";

    const usersOrd = [...window.usuariosDB].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    if (usersOrd.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum apoio cadastrado.</p>';
        return;
    }

    usersOrd.forEach(u => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 8px; border-bottom:1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-user-circle" style="font-size:24px; color:var(--primary);"></i>
                    <strong style="font-size:16px;">${u.nome}</strong>
                </div>
                <button class="btn btn-danger btn-pequeno" onclick="window.excluirUsuario('${u.id}')"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
};

window.adicionarUsuario = async function() {
    const input = document.getElementById('novoUsuarioNome');
    const nome = input.value.trim();
    if (!nome) return window.mostrarToast("Digite o nome do Apoio!", true);

    const id = "user_" + Date.now().toString();
    await setDoc(doc(db, "usuarios", id), { id, nome: window.escapeHTML(nome) });
    input.value = "";
    window.mostrarToast("Apoio adicionado!");
};

window.excluirUsuario = async function(id) {
    window.abrirConfirmacao("Deseja remover este apoio da equipa?", async () => {
        await deleteDoc(doc(db, "usuarios", id));
        window.mostrarToast("Apoio removido!");
    });
};

// ================= MÓDULO: SITUAÇÃO DOS ESTOQUES =================
window.renderizarApenasTabelasResumoEstoques = function() {
    const tbCont = document.getElementById('tabelaResumoContainer');
    const tbBaga = document.getElementById('tabelaResumoBagageiro');
    if (!tbCont || !tbBaga) return;

    tbCont.innerHTML = "";
    tbBaga.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        tbCont.innerHTML += `<tr><td>${p.nome} (${p.id})</td><td><strong>${formatarEstoqueFardos(p.estoqueContainerUnidades, unFardo)}</strong> (${p.estoqueContainerUnidades || 0} un)</td></tr>`;
        tbBaga.innerHTML += `<tr><td>${p.nome} (${p.id})</td><td><strong>${formatarEstoqueFardos(p.estoqueBagageiroUnidades, unFardo)}</strong> (${p.estoqueBagageiroUnidades || 0} un)</td></tr>`;
    });
};

window.abrirTelaEstoques = function() {
    window.renderizarApenasTabelasResumoEstoques();
    const div = document.getElementById('listaEstoqueGeral');
    if (!div) return;
    div.innerHTML = "";

    const draft = JSON.parse(localStorage.getItem('trem_draft_estoque') || 'null');
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const curContTot = p.estoqueContainerUnidades || 0;
        const curBagaTot = p.estoqueBagageiroUnidades || 0;

        let valContFardos = draft?.[p.id]?.contFardos ?? (unFardo > 1 ? Math.floor(curContTot / unFardo) : 0);
        let valContAvulsas = draft?.[p.id]?.contAvulsas ?? (unFardo > 1 ? (curContTot % unFardo) : curContTot);
        let valBagaFardos = draft?.[p.id]?.bagaFardos ?? (unFardo > 1 ? Math.floor(curBagaTot / unFardo) : 0);
        let valBagaAvulsas = draft?.[p.id]?.bagaAvulsas ?? (unFardo > 1 ? (curBagaTot % unFardo) : curBagaTot);

        div.innerHTML += `
            <div class="card" style="padding:14px; margin-bottom:12px; border:1.5px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="font-size:15px; color:var(--primary);">${p.nome} (${p.id})</strong>
                    <span style="font-size:12px; color:var(--secondary); font-weight:700;">${unFardo} un/fardo</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="box-ajuste-col box-ajuste-cont">
                        <label><i class="ph ph-archive"></i> Contêiner</label>
                        <div class="input-unidade-group">
                            <div><span>Fardos:</span><input type="number" id="est_cont_fardo_${p.id}" value="${valContFardos}" min="0" oninput="window.calcularTotEstoqueLinha('${p.id}'); window.salvarDraftEstoque();"></div>
                            <div><span>Avulsas:</span><input type="number" id="est_cont_un_${p.id}" value="${valContAvulsas}" min="0" oninput="window.calcularTotEstoqueLinha('${p.id}'); window.salvarDraftEstoque();"></div>
                        </div>
                        <small id="est_cont_lbl_${p.id}" style="margin-top:6px; font-weight:700; color:var(--container-color); font-size:11px;"></small>
                    </div>
                    <div class="box-ajuste-col box-ajuste-baga">
                        <label><i class="ph ph-bag"></i> Bagageiro</label>
                        <div class="input-unidade-group">
                            <div><span>Fardos:</span><input type="number" id="est_baga_fardo_${p.id}" value="${valBagaFardos}" min="0" oninput="window.calcularTotEstoqueLinha('${p.id}'); window.salvarDraftEstoque();"></div>
                            <div><span>Avulsas:</span><input type="number" id="est_baga_un_${p.id}" value="${valBagaAvulsas}" min="0" oninput="window.calcularTotEstoqueLinha('${p.id}'); window.salvarDraftEstoque();"></div>
                        </div>
                        <small id="est_baga_lbl_${p.id}" style="margin-top:6px; font-weight:700; color:var(--bagageiro-color); font-size:11px;"></small>
                    </div>
                </div>
            </div>
        `;
    });
    window.produtosDB.forEach(p => window.calcularTotEstoqueLinha(p.id));
};

window.calcularTotEstoqueLinha = function(id) {
    const p = window.produtosDB.find(x => x.id === id);
    if (!p) return;
    const un = p.unidadesPorFardo || 1;
    const fCont = parseInt(document.getElementById(`est_cont_fardo_${id}`)?.value) || 0;
    const uCont = parseInt(document.getElementById(`est_cont_un_${id}`)?.value) || 0;
    const fBaga = parseInt(document.getElementById(`est_baga_fardo_${id}`)?.value) || 0;
    const uBaga = parseInt(document.getElementById(`est_baga_un_${id}`)?.value) || 0;

    const lblCont = document.getElementById(`est_cont_lbl_${id}`);
    const lblBaga = document.getElementById(`est_baga_lbl_${id}`);
    if (lblCont) lblCont.innerText = `= Total: ${(fCont * un) + uCont} un`;
    if (lblBaga) lblBaga.innerText = `= Total: ${(fBaga * un) + uBaga} un`;
};

window.salvarDraftEstoque = function() {
    let draft = {};
    window.produtosDB.forEach(p => {
        draft[p.id] = {
            contFardos: parseInt(document.getElementById(`est_cont_fardo_${p.id}`)?.value) || 0,
            contAvulsas: parseInt(document.getElementById(`est_cont_un_${p.id}`)?.value) || 0,
            bagaFardos: parseInt(document.getElementById(`est_baga_fardo_${p.id}`)?.value) || 0,
            bagaAvulsas: parseInt(document.getElementById(`est_baga_un_${p.id}`)?.value) || 0
        };
    });
    localStorage.setItem('trem_draft_estoque', JSON.stringify(draft));
};

window.limparDraftEstoque = function() {
    window.abrirConfirmacao("Descartar alterações manuais?", () => {
        localStorage.removeItem('trem_draft_estoque');
        window.abrirTelaEstoques();
        window.mostrarToast("Ajustes descartados.");
    });
};

window.abrirModalConfirmaEstoque = function() {
    document.getElementById('modalObsAjusteEstoque').value = "";
    window.abrirModal('modal-confirma-estoque');
};

window.confirmarAjustesEstoqueComObs = async function() {
    const batch = writeBatch(db);
    window.produtosDB.forEach(p => {
        const un = p.unidadesPorFardo || 1;
        const fCont = parseInt(document.getElementById(`est_cont_fardo_${p.id}`)?.value) || 0;
        const uCont = parseInt(document.getElementById(`est_cont_un_${p.id}`)?.value) || 0;
        const fBaga = parseInt(document.getElementById(`est_baga_fardo_${p.id}`)?.value) || 0;
        const uBaga = parseInt(document.getElementById(`est_baga_un_${p.id}`)?.value) || 0;

        batch.update(doc(db, "produtos", p.id), {
            estoqueContainerUnidades: (fCont * un) + uCont,
            estoqueBagageiroUnidades: (fBaga * un) + uBaga
        });
    });

    await batch.commit();
    localStorage.removeItem('trem_draft_estoque');
    window.fecharModal('modal-confirma-estoque');
    window.mostrarToast("Estoques atualizados!");
};

// ================= MÓDULO: RECEITAS DE CARGA =================
window.renderizarReceitasAdmin = function() {
    const div = document.getElementById('listaReceitasAdmin');
    if (!div) return;
    div.innerHTML = "";

    if (!window.receitasDB || window.receitasDB.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma receita criada.</p>';
        return;
    }

    window.receitasDB.forEach(r => {
        let resumoItens = [];
        for (let sigla in r.itens) {
            if (r.itens[sigla] > 0) resumoItens.push(`<b>${r.itens[sigla]}x</b> ${sigla}`);
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
                    ${resumoItens.join(' &bull; ') || 'Nenhum item configurado.'}
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
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Receita';
        document.getElementById('modalReceitaIdOriginal').value = recObj.id;
        document.getElementById('modalReceitaNome').value = recObj.nome;
    } else {
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Nova Receita';
        document.getElementById('modalReceitaIdOriginal').value = "";
        document.getElementById('modalReceitaNome').value = "";
    }

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
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
};

window.salvarReceitaModal = async function() {
    const idOriginal = document.getElementById('modalReceitaIdOriginal').value;
    const nome = document.getElementById('modalReceitaNome').value.trim();
    if (!nome) return window.mostrarToast("Digite o nome da Receita!", true);

    let itens = {};
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const q = parseInt(document.getElementById(`rec_input_${p.id}`)?.value) || 0;
        if (q > 0) itens[p.id] = q;
    });

    const idFinal = idOriginal || ("rec_" + Date.now().toString());
    await setDoc(doc(db, "receitas_carga", idFinal), { id: idFinal, nome: window.escapeHTML(nome), itens });
    window.fecharModal('modal-receita');
    window.mostrarToast("Receita salva!");
};

window.excluirReceita = async function(id) {
    window.abrirConfirmacao("Deseja excluir esta receita?", async () => {
        await deleteDoc(doc(db, "receitas_carga", id));
        window.mostrarToast("Receita excluída!");
    });
};

// ================= FROTA DE VAGÕES =================
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
        const nomeReceita = receitaObj ? receitaObj.nome : 'Nenhuma';

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
        const rTur = window.receitasDB.find(r => r.id === 'rec_turistico_48' || r.nome.toLowerCase().includes('turístico'));
        if (rTur) selRec.value = rTur.id;
    } else if (tipo === 'economico') {
        const rEco = window.receitasDB.find(r => r.id === 'rec_economico' || r.nome.toLowerCase().includes('econômico'));
        if (rEco) selRec.value = rEco.id;
    } else {
        const rBout = window.receitasDB.find(r => r.id === 'rec_boutique_padrao' || r.nome.toLowerCase().includes('boutique'));
        if (rBout) selRec.value = rBout.id;
    }
    window.atualizarCheckboxesBebidasPadrao();
};

window.abrirModalVagao = function(id = null) {
    const selRec = document.getElementById('modalVagaoReceitaPadrao');
    selRec.innerHTML = '<option value="">-- Nenhuma (Manual) --</option>';
    window.receitasDB.forEach(r => selRec.innerHTML += `<option value="${r.id}">${r.nome}</option>`);

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
        boxChecks.innerHTML += `<label class="item-chk-bebida"><input type="checkbox" value="${p.id}" ${checked}><span>${p.id} (${p.nome})</span></label>`;
    });

    window.abrirModal('modal-vagao');
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

    if (!numero || !nome) return window.mostrarToast("Preencha Número e Nome!", true);

    const selecionadas = [];
    document.querySelectorAll('#boxCheckboxesBebidasVagao input:checked').forEach(c => selecionadas.push(c.value));

    const idFinal = idOriginal || ("vagao_" + Date.now().toString());
    await setDoc(doc(db, "vagoes", idFinal), {
        id: idFinal, numero: window.escapeHTML(numero), nome: window.escapeHTML(nome),
        tipo: tipo, receitaId: receitaId || null, bebidasPermitidas: selecionadas
    }, { merge: true });

    window.fecharModal('modal-vagao');
    window.mostrarToast("Vagão salvo na frota!");
};

window.excluirVagao = async function(id) {
    window.abrirConfirmacao("Tem certeza que deseja excluir este vagão?", async () => {
        await deleteDoc(doc(db, "vagoes", id));
        window.mostrarToast("Vagão excluído!");
    });
};

// ================= MÓDULO: ESTOQUE EM TRÂNSITO (NUVEM DO DIA) =================
window.renderizarPainelEstoqueTransito = function() {
    const painel = document.getElementById('painelResumoEstoqueTransito');
    if (!painel) return;

    const elData = document.getElementById('dataCargaPorVagao');
    const dataSel = elData?.value || new Date().toISOString().split('T')[0];

    const cargaDia = window.cargasDiaDB.find(c => c.data === dataSel);
    if (!cargaDia || !cargaDia.itens) {
        painel.innerHTML = `<div style="font-size:13px; color:#0369a1;"><i class="ph ph-cloud-arrow-down"></i> <strong>Nuvem do Trem:</strong> Nenhuma carga geral lançada.</div>`;
        return;
    }

    const cargasVagoesDia = window.cargasVagoesDB.filter(c => c.data === dataSel && !c.inativo);

    let chipsHtml = "";
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const itemDia = cargaDia.itens[p.id];
        const totalEmbarcadoUn = (itemDia?.total || 0) * unFardo; // Total Nuvem Original

        if (totalEmbarcadoUn <= 0) return;

        let alocadoVagoesUn = 0;
        cargasVagoesDia.forEach(cv => {
            if (cv.itens && cv.itens[p.id]) alocadoVagoesUn += (cv.itens[p.id].qtd || 0);
        });

        const saldoTransito = totalEmbarcadoUn - alocadoVagoesUn;
        const corSaldo = saldoTransito < 0 ? 'color:var(--danger);' : (saldoTransito === 0 ? 'color:var(--success);' : 'color:#0369a1;');

        chipsHtml += `<div class="item-chip-transito"><strong>${p.id}:</strong><span style="${corSaldo} font-weight:bold;">${saldoTransito} un livres</span></div>`;
    });

    painel.innerHTML = `
        <div class="card-transito-header">
            <div><strong style="color:#0369a1; font-size:14px;"><i class="ph ph-cloud"></i> Bebidas Embarcadas (Nuvem em Trânsito)</strong></div>
            <span class="tag-transito">Livre para distribuir</span>
        </div>
        <div class="grade-transito-itens">${chipsHtml || '<span style="font-size:12px;">Nenhuma bebida na Nuvem.</span>'}</div>
    `;
};

// ================= CARGA POR VAGÃO (DEDUÇÃO DA NUVEM / BAGAGEIRO) =================
window.trocarSentidoCargaVagao = function(sentido) {
    window.sentidoCargaVagao = sentido;
    const btnIda = document.getElementById('btnCargaSentidoIda');
    const btnVolta = document.getElementById('btnCargaSentidoVolta');
    if (sentido === 'Ida') { btnIda?.classList.add('ativo'); btnVolta?.classList.remove('ativo'); }
    else { btnVolta?.classList.add('ativo'); btnIda?.classList.remove('ativo'); }
    window.renderizarVagoesParaCarga();
};

window.renderizarVagoesParaCarga = function() {
    const div = document.getElementById('listaVagoesParaCarga');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('dataCargaPorVagao');
    if (!elData.value) elData.value = new Date().toISOString().split('T')[0];
    const dataSel = elData.value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';

    if(typeof window.renderizarPainelEstoqueTransito === 'function') window.renderizarPainelEstoqueTransito();

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        const cargaKey = `${dataSel}_${v.id}_${sentidoSel}`;
        const cargaExistente = window.cargasVagoesDB.find(c => (c.id === cargaKey) || (c.data === dataSel && c.vagaoId === v.id && (c.sentido === sentidoSel || (!c.sentido && sentidoSel === 'Ida'))));
        const isInativo = cargaExistente?.inativo === true;

        let badgeStatus = '<span style="color:var(--secondary); font-size:12px;">Pendente</span>';
        let corBorda = 'border-left: 6px solid var(--secondary);';

        if (isInativo) {
            badgeStatus = '<span style="color:#64748b; font-weight:700; font-size:12px;">✖ Vagão Vazio / Inativo</span>';
            corBorda = 'border-left: 6px solid #94a3b8;';
        } else if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
            const totalUn = Object.values(cargaExistente.itens).reduce((acc, it) => acc + (it.qtd || 0), 0);
            const tagMorretes = cargaExistente.tipoRegistro === 'retorno_boutique' ? '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:800; margin-left:4px;">Morretes</span>' : '';
            badgeStatus = `<span style="color:var(--success); font-weight:700; font-size:12px;">✔ Carga Lançada (${totalUn} un)</span> ${tagMorretes}`;
            corBorda = 'border-left: 6px solid var(--success);';
        }

        const isBoutiqueVolta = (v.tipo === 'boutique' || v.tipo === 'litorina') && sentidoSel === 'Volta' && cargaExistente?.tipoRegistro === 'retorno_boutique';

        div.innerHTML += `
            <div class="card-carga-vagao-item ${isInativo ? 'card-carga-vagao-inativo' : ''}" style="${corBorda}">
                <div style="flex:1;">
                    <strong style="font-size:15px;">Placa ${v.numero} - ${v.nome}</strong>
                    <div style="margin-top:2px;">${badgeStatus}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn btn-secondary btn-pequeno" onclick="window.alternarAtivacaoVagao('${v.id}')" title="Ativar ou desativar vagão para este trajeto">
                        ${isInativo ? '<i class="ph ph-eye"></i> Ativar' : '<i class="ph ph-eye-slash"></i> Vazio'}
                    </button>
                    ${isBoutiqueVolta ? `
                        <button class="btn btn-boutique btn-pequeno" onclick="window.abrirModalDetalhesRetornoBoutique('${v.id}')"><i class="ph ph-list-magnifying-glass"></i> Detalhes</button>
                    ` : `
                        <button class="btn btn-primary btn-pequeno" ${isInativo ? 'disabled' : ''} onclick="window.abrirModalMontarCargaVagao('${v.id}')"><i class="ph ph-truck"></i> Montar</button>
                    `}
                </div>
            </div>
        `;
    });
};

window.alternarAtivacaoVagao = async function(vagaoId) {
    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';
    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;

    const cargaExistente = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const novoStatusInativo = !(cargaExistente?.inativo === true);

    await setDoc(doc(db, "cargas_vagoes", cargaKey), {
        id: cargaKey, data: dataSel, vagaoId: vagaoId, sentido: sentidoSel,
        inativo: novoStatusInativo, timestamp: Date.now()
    }, { merge: true });

    window.mostrarToast(novoStatusInativo ? "Vagão marcado como Vazio!" : "Vagão Reativado!");
};

window.abrirModalMontarCargaVagao = function(vagaoId) {
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    if (!vagao) return;

    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';
    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;

    document.getElementById('modalMcvVagaoId').value = vagaoId;
    document.getElementById('modalMcvSentido').value = sentidoSel;
    document.getElementById('modalMcvTitulo').innerText = `Carga (${sentidoSel}): ${vagao.nome}`;

    const cargaExistente = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const selRec = document.getElementById('modalMcvReceitaSelect');
    selRec.innerHTML = '<option value="">-- Nenhuma (Manual) --</option>';
    window.receitasDB.forEach(r => selRec.innerHTML += `<option value="${r.id}">${r.nome}</option>`);

    if (cargaExistente) {
        document.getElementById('modalMcvObs').value = cargaExistente.obs || "";
        selRec.value = "";
    } else if (vagao.receitaId) {
        selRec.value = vagao.receitaId;
        document.getElementById('modalMcvObs').value = "";
    }

    const div = document.getElementById('modalMcvListaItens');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);
    const receitaObj = window.receitasDB.find(r => r.id === selRec.value);
    const permitidas = vagao?.bebidasPermitidas || [];

    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        let valTotal = 0;
        if (cargaExistente && cargaExistente.itens && cargaExistente.itens[p.id]) valTotal = cargaExistente.itens[p.id].qtd || 0;
        else if (receitaObj && receitaObj.itens && receitaObj.itens[p.id]) valTotal = receitaObj.itens[p.id];

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div>
                    <strong style="font-size:14px; color:var(--primary);">${p.id}</strong><br>
                    <span style="font-size:12px; color:var(--secondary);">${p.nome}</span>
                </div>
                <div style="display:flex; flex-direction:column; width:80px;">
                    <span style="font-size:10px; font-weight:bold; color:var(--secondary);">Total (Un):</span>
                    <input type="number" id="mcv_tot_${p.id}" value="${valTotal}" min="0" style="padding:6px; font-weight:700; text-align:center;">
                </div>
            </div>
        `;
    });

    window.abrirModal('modal-montar-carga-vagao');
};

window.copiarCargaVagaoAnteriorModal = function() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const dataAtual = document.getElementById('dataCargaPorVagao').value;
    const cargasVagao = window.cargasVagoesDB.filter(c => c.vagaoId === vagaoId && c.data !== dataAtual);
    if (cargasVagao.length === 0) return window.mostrarToast("Nenhuma carga anterior para este vagão.", true);
    
    cargasVagao.sort((a, b) => b.data.localeCompare(a.data));
    const cargaAnterior = cargasVagao[0];
    
    window.abrirConfirmacao(`Copiar carga do dia ${cargaAnterior.data.split('-').reverse().join('/')}?`, () => {
        window.produtosDB.forEach(p => {
            const elTot = document.getElementById(`mcv_tot_${p.id}`);
            if (elTot) elTot.value = (cargaAnterior.itens && cargaAnterior.itens[p.id]) ? (cargaAnterior.itens[p.id].qtd || 0) : 0;
        });
        document.getElementById('modalMcvObs').value = cargaAnterior.obs || "";
        document.getElementById('modalMcvReceitaSelect').value = "";
        window.mostrarToast("Carga copiada! Edite e Salve.");
    });
};

window.salvarCargaVagaoModal = async function() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const sentido = document.getElementById('modalMcvSentido').value || 'Ida';
    const data = document.getElementById('dataCargaPorVagao').value;
    const obs = document.getElementById('modalMcvObs').value.trim();
    const cargaKey = `${data}_${vagaoId}_${sentido}`;
    
    const cargaDia = window.cargasDiaDB.find(c => c.data === data);
    const outrasCargas = window.cargasVagoesDB.filter(c => c.data === data && c.id !== cargaKey && !c.inativo);
    
    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const totEl = document.getElementById(`mcv_tot_${p.id}`);
        if (!totEl) continue;

        const novaQtd = parseInt(totEl.value) || 0;
        const unFardo = p.unidadesPorFardo || 1;

        // LÓGICA DA NUVEM VS BAGAGEIRO
        const nuvemTotal = (cargaDia?.itens[p.id]?.cont || 0) * unFardo;
        let nuvemUsadaOutros = 0;
        outrasCargas.forEach(c => { nuvemUsadaOutros += (c.itens[p.id]?.qtd || 0); });
        
        const nuvemLivre = Math.max(0, nuvemTotal - nuvemUsadaOutros);
        let bagageiroExtraAtual = Math.max(0, novaQtd - nuvemLivre);

        // Subtração do valor anterior (para o caso de reedição do vagão)
        const cargaAnterior = window.cargasVagoesDB.find(c => c.id === cargaKey);
        let bagageiroExtraAnterior = 0;
        if (cargaAnterior && cargaAnterior.itens[p.id]) {
            const qtdAntiga = cargaAnterior.itens[p.id].qtd || 0;
            bagageiroExtraAnterior = Math.max(0, qtdAntiga - nuvemLivre);
        }

        const deltaBagageiro = bagageiroExtraAtual - bagageiroExtraAnterior;
        if (deltaBagageiro !== 0) {
            batch.update(doc(db, "produtos", p.id), {
                estoqueBagageiroUnidades: increment(-deltaBagageiro)
            });
        }

        if (novaQtd > 0) {
            itensSalvos[p.id] = { qtd: novaQtd, baga: bagageiroExtraAtual, cont: novaQtd - bagageiroExtraAtual };
        }
    }

    batch.set(doc(db, "cargas_vagoes", cargaKey), {
        id: cargaKey, data, vagaoId, sentido, inativo: false,
        itens: itensSalvos, obs: window.escapeHTML(obs), timestamp: Date.now()
    });

    await batch.commit();

    window.fecharModal('modal-montar-carga-vagao');
    window.mostrarToast(`Carga salva! (Abatimento da Nuvem e Bagageiro aplicado)`);
    window.renderizarVagoesParaCarga();
};

window.abrirModalDetalhesRetornoBoutique = function(vagaoId) {
    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const cargaKey = `${dataSel}_${vagaoId}_Volta`;
    const carga = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    if (!carga || !vagao) return;

    document.getElementById('modalRetornoBoutiqueTitulo').innerText = `Retorno: ${vagao.nome}`;
    const div = document.getElementById('listaDetalhesRetornoBoutique');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    for (let pId in carga.itens) {
        const it = carga.itens[pId];
        const p = window.produtosDB.find(x => x.id === pId) || { nome: pId };
        const sinal = it.operador || '+';
        const strAjuste = (it.ajusteQtd !== undefined && it.ajusteQtd !== 0) ? `(${it.sobra || 0} sobra ${sinal} ${it.ajusteQtd})` : '';

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div><strong>${p.nome} (${pId})</strong><br><small style="color:var(--secondary); font-size:12px;">${strAjuste}</small></div>
                <span style="font-weight:800; font-size:15px; color:var(--primary);">${it.qtd} un</span>
            </div>
        `;
    }
    window.abrirModal('modal-detalhes-retorno-boutique');
};

window.editarRetornoBoutiqueNaCarga = function() {
    window.fecharModal('modal-detalhes-retorno-boutique');
    window.mostrarTela('tela-boutiques-hub');
    const selEtapa = document.getElementById('etapaBoutiqueHub');
    if (selEtapa) { selEtapa.value = 'morretes_com_retorno'; window.carregarFormularioBoutiqueHub(); }
};

// ================= CARGA GERAL DO DIA =================
window.verificarStatusEdicaoCarga = function() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    const boxStatus = document.getElementById('statusCargaEdicao');
    if (!boxStatus || !dataSel) return;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
        boxStatus.innerHTML = `<div style="background:#fefce8; border:1.5px solid #fde68a; color:#92400e; padding:10px 14px; border-radius:8px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;"><i class="ph ph-pencil-simple-line"></i> Editando Carga Geral de ${dataSel.split('-').reverse().join('/')}. Ajustes entrarão na Nuvem do Trem.</div>`;
    } else {
        boxStatus.innerHTML = `<div style="background:#e0f2fe; border:1.5px solid #bae6fd; color:#0369a1; padding:10px 14px; border-radius:8px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px;"><i class="ph ph-plus-circle"></i> Criando Carga para ${dataSel.split('-').reverse().join('/')}. Ao salvar, sai do Contêiner e Bagageiro para a Nuvem.</div>`;
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
    
    if (!cargaAnterior) return window.mostrarToast("Nenhuma carga anterior.", true);
    
    window.abrirConfirmacao(`Deseja copiar a carga geral do dia ${cargaAnterior.data.split('-').reverse().join('/')}?`, () => {
        window.produtosDB.forEach(p => {
            if (cargaAnterior.itens && cargaAnterior.itens[p.id]) {
                const item = cargaAnterior.itens[p.id];
                if (document.getElementById(`carga_total_${p.id}`)) document.getElementById(`carga_total_${p.id}`).value = item.total || 0;
                if (document.getElementById(`carga_baga_${p.id}`)) document.getElementById(`carga_baga_${p.id}`).value = item.baga || 0;
                if (document.getElementById(`carga_dest_${p.id}`)) document.getElementById(`carga_dest_${p.id}`).value = item.destino || "";
                if (document.getElementById(`carga_ordem_${p.id}`) && item.ordem) document.getElementById(`carga_ordem_${p.id}`).value = item.ordem;
                window.calcularFormulaLinha(p.id);
            } else {
                if (document.getElementById(`carga_total_${p.id}`)) document.getElementById(`carga_total_${p.id}`).value = 0;
                if (document.getElementById(`carga_baga_${p.id}`)) document.getElementById(`carga_baga_${p.id}`).value = 0;
                if (document.getElementById(`carga_dest_${p.id}`)) document.getElementById(`carga_dest_${p.id}`).value = "";
                window.calcularFormulaLinha(p.id);
            }
        });
        const elObs = document.getElementById('obsEspeciaisCarga');
        if (elObs) elObs.value = cargaAnterior.obsEspeciais || "";
        window.salvarDraftCarga();
        window.mostrarToast("Carga copiada! Salve para confirmar.");
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

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const bagaDisponivel = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unPorFardo);

        let valTotal = 0, valBaga = 0, valDest = "", valOrdem = p.ordem || 99;

        if (draft && draft.data === dataSel && draft.itens?.[p.id]) {
            valTotal = draft.itens[p.id].total || 0; valBaga = draft.itens[p.id].baga || 0;
            valDest = draft.itens[p.id].dest || ""; valOrdem = draft.itens[p.id].ordem !== undefined ? draft.itens[p.id].ordem : valOrdem;
        } else if (cargaExistente && cargaExistente.itens?.[p.id]) {
            valTotal = cargaExistente.itens[p.id].total || 0; valBaga = cargaExistente.itens[p.id].baga || 0;
            valDest = cargaExistente.itens[p.id].destino || ""; valOrdem = cargaExistente.itens[p.id].ordem !== undefined ? cargaExistente.itens[p.id].ordem : valOrdem;
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
                    <div><label>Total (Fardos):</label><input type="number" id="carga_total_${p.id}" value="${valTotal}" min="0" oninput="window.calcularFormulaLinha('${p.id}'); window.salvarDraftCarga();"></div>
                    <div><label>Do Baga (Fardos):</label><input type="number" id="carga_baga_${p.id}" value="${valBaga}" min="0" oninput="window.calcularFormulaLinha('${p.id}'); window.salvarDraftCarga();"></div>
                    <div><label>= Contêiner:</label><input type="number" id="carga_cont_${p.id}" readonly class="input-pax" value="${valCont}"></div>
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
        if (draft && draft.data === dataSel) elObs.value = draft.obs || "";
        else if (cargaExistente) elObs.value = cargaExistente.obsEspeciais || "";
        else elObs.value = "";
    }
};

window.calcularFormulaLinha = function(id) {
    const total = parseInt(document.getElementById(`carga_total_${id}`).value) || 0;
    const baga = parseInt(document.getElementById(`carga_baga_${id}`).value) || 0;
    document.getElementById(`carga_cont_${id}`).value = Math.max(0, total - baga);
};

window.salvarDraftCarga = function() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    if (!dataSel) return;
    let draftItens = {};
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const tot = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const bag = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const dest = document.getElementById(`carga_dest_${p.id}`)?.value || "";
        const ord = parseInt(document.getElementById(`carga_ordem_${p.id}`)?.value) || p.ordem || 99;
        if (tot > 0 || bag > 0 || dest !== "") draftItens[p.id] = { total: tot, baga: bag, dest, ordem: ord };
    });
    localStorage.setItem('trem_draft_carga', JSON.stringify({ data: dataSel, itens: draftItens, obs: document.getElementById('obsEspeciaisCarga')?.value || "" }));
};

window.limparDraftCarga = function() {
    window.abrirConfirmacao("Deseja limpar o rascunho da carga geral?", () => {
        localStorage.removeItem('trem_draft_carga'); window.abrirCargaDoDia(); window.mostrarToast("Rascunho descartado.");
    });
};

window.salvarCargaDoDia = async function() {
    const data = document.getElementById('dataCargaDia').value;
    const obsEspeciais = document.getElementById('obsEspeciaisCarga').value.trim();
    const cargaAntiga = window.cargasDiaDB.find(c => c.data === data);
    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const totEl = document.getElementById(`carga_total_${p.id}`);
        if (!totEl) continue;

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

        if (totalFardos > 0 || bagaFardos > 0 || destino !== "" || (cargaAntiga && cargaAntiga.itens?.[p.id])) {
            itensSalvos[p.id] = { total: totalFardos, baga: bagaFardos, cont: contFardos, destino, ordem: novaOrdem };
            const antigoContFardos = cargaAntiga?.itens?.[p.id]?.cont || 0;
            const antigoBagaFardos = cargaAntiga?.itens?.[p.id]?.baga || 0;
            const difContFardos = contFardos - antigoContFardos;
            const difBagaFardos = bagaFardos - antigoBagaFardos;

            if (difContFardos !== 0 || difBagaFardos !== 0) {
                batch.update(doc(db, "produtos", p.id), {
                    estoqueContainerUnidades: increment(-(difContFardos * unFardo)),
                    estoqueBagageiroUnidades: increment(-(difBagaFardos * unFardo))
                });
            }
        }
    }

    batch.set(doc(db, "cargas_dia", data), { id: data, data, itens: itensSalvos, obsEspeciais, timestamp: Date.now() });
    await batch.commit();

    localStorage.removeItem('trem_draft_carga');
    window.mostrarToast("Carga Geral salva! Bebidas alocadas na Nuvem do Trem.");
    window.mostrarTela('tela-admin');
};

// ================= ABA PÚBLICA: MANIFESTO =================
window.carregarManifestoPublico = function(forcarUltima = false) {
    const div = document.getElementById('conteudoManifestoPublico');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('filtroDataManifesto');
    if (!window.cargasDiaDB || window.cargasDiaDB.length === 0) {
        div.innerHTML = `<div style="text-align:center; padding:35px 15px; color:var(--secondary);"><i class="ph ph-circle-notch ph-spin" style="font-size:36px; display:block; margin-bottom:10px; color:var(--primary);"></i><p>Nenhuma carga registrada no momento.</p></div>`;
        return;
    }

    const cargasOrdenadas = [...window.cargasDiaDB].sort((a, b) => {
        if (b.data !== a.data) return b.data.localeCompare(a.data);
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    const ultimaCarga = cargasOrdenadas[0];
    let dataSel = elData ? elData.value : "";
    if (forcarUltima || !dataSel) {
        dataSel = ultimaCarga ? ultimaCarga.data : new Date().toISOString().split('T')[0];
        if (elData) elData.value = dataSel;
    }

    const carga = window.cargasDiaDB.find(c => c.data === dataSel);
    if (!carga || !carga.itens || Object.keys(carga.itens).length === 0) {
        div.innerHTML = `<div style="text-align:center; padding:30px 15px; color:var(--secondary);"><i class="ph ph-calendar-blank" style="font-size:36px; display:block; margin-bottom:8px;"></i><p>Nenhuma escala para <strong>${dataSel ? dataSel.split('-').reverse().join('/') : '--/--/----'}</strong>.</p>${ultimaCarga ? `<button class="btn btn-secondary btn-pequeno" style="margin-top:10px;" onclick="document.getElementById('filtroDataManifesto').value='${ultimaCarga.data}'; window.carregarManifestoPublico(false);"><i class="ph ph-arrow-counter-clockwise"></i> Ver Carga de ${ultimaCarga.data.split('-').reverse().join('/')}</button>` : ''}</div>`;
        return;
    }

    let itensOrdenados = Object.keys(carga.itens).map(sigla => {
        const prod = window.produtosDB.find(p => p.id === sigla);
        return { sigla, ...carga.itens[sigla], ordem: carga.itens[sigla].ordem !== undefined ? carga.itens[sigla].ordem : (prod?.ordem ?? 9999) };
    });
    itensOrdenados.sort((a, b) => (parseInt(a.ordem) || 9999) - (parseInt(b.ordem) || 9999));

    let linhasHtml = "";
    itensOrdenados.forEach(item => {
        if (item.total <= 0 && item.baga <= 0 && (!item.destino || item.destino.trim() === '')) return;
        let strDestino = item.destino ? `<span class="manifesto-destino">(${item.destino})</span>` : '';
        let formulaTexto = item.baga > 0 ? `${item.sigla}=${item.total}-${item.baga}=<strong>${item.cont}</strong> <span style="font-size:13px; color:var(--secondary); font-style:italic;">${strDestino}</span>` : `${item.sigla}=<strong>${item.total}</strong> <span style="font-size:13px; color:var(--secondary); font-style:italic;">${strDestino}</span>`;
        linhasHtml += `<div class="manifesto-linha" style="justify-content:flex-start; gap:8px;"><span class="manifesto-formula" style="font-family: monospace; font-size:15px;">${formulaTexto}</span></div>`;
    });

    const isMaisRecente = ultimaCarga && ultimaCarga.data === carga.data;
    div.innerHTML = `
        <div class="manifesto-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:12px;">
                <div><h3 style="color:var(--primary); font-size:18px; margin:0;"><i class="ph ph-train"></i> Carga Oficial</h3>${isMaisRecente ? '<span style="background:#dcfce7; color:#15803d; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700;">Última Carga Lançada</span>' : ''}</div>
                <div style="text-align:right;"><span style="font-size:12px; color:var(--secondary); display:block;">Para a Viagem:</span><span style="font-weight:800; color:var(--accent); font-size:16px;">${carga.data.split('-').reverse().join('/')}</span></div>
            </div>
            ${linhasHtml}
            ${carga.obsEspeciais ? `<div class="manifesto-obs-box"><div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:15px;"><i class="ph ph-star-fill"></i> Observações & Extras:</div>${window.escapeHTML(carga.obsEspeciais)}</div>` : ''}
        </div>
    `;
};

// ================= MONITOR DE VIAGEM E REFORÇOS =================
function getEstadoViagemHoje(dataHoje) {
    if (!window.viagensStatusDB[dataHoje]) return { etapa: 'preparacao', sentido: 'Ida', reforcos: {} };
    return window.viagensStatusDB[dataHoje];
}

window.carregarMonitorViagem = function() {
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);

    const elEtapa = document.getElementById('lblEtapaViagemTexto');
    const elSentido = document.getElementById('badgeSentidoAtivo');
    
    if (estado.etapa === 'preparacao') { elEtapa.innerText = "Em Preparação (Curitiba)"; elSentido.innerText = "Ida"; }
    else if (estado.etapa === 'ida') { elEtapa.innerText = "Viagem de IDA em Andamento"; elSentido.innerText = "Ida"; }
    else if (estado.etapa === 'morretes') { elEtapa.innerText = "Trem em Morretes (Preparando Retorno)"; elSentido.innerText = "Retorno"; }
    else if (estado.etapa === 'volta') { elEtapa.innerText = "Viagem de VOLTA em Andamento"; elSentido.innerText = "Volta"; }
    else { elEtapa.innerText = "Viagem Finalizada (Curitiba)"; elSentido.innerText = "Finalizado"; }

    const grid = document.getElementById('gridVagoesOperacao');
    if (!grid) return;
    grid.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
    vagoesOrd.forEach(v => {
        const estaAberto = (estado.etapa === 'ida' || estado.etapa === 'volta');
        const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
        
        const statusTexto = contagemFechada ? `✔ Fechado (${estado.sentido})` : (estaAberto ? `🟢 Em Aberto` : `Aguardando Início`);
        const classeCard = contagemFechada ? 'vagao-fechado' : (estaAberto ? 'vagao-aberto' : '');
        const badgeStatus = contagemFechada ? 'status-fechado' : (estaAberto ? 'status-aberto' : '');

        grid.innerHTML += `
            <div class="card-vagao-status ${classeCard}" onclick="window.abrirModalVagaoOperacao('${v.id}')">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <strong style="font-size:16px;">Placa ${v.numero} - ${v.nome}</strong>
                        <span class="badge-tag-status ${badgeStatus}">${statusTexto}</span>
                    </div>
                    <small style="color:var(--secondary); text-transform:uppercase; font-weight:700; font-size:12px;">[${v.tipo}]</small>
                </div>
                <div style="margin-top:10px; font-size:12px; color:var(--primary); font-weight:600;">
                    ${estaAberto ? '<i class="ph ph-arrows-left-right"></i> Ver / Adicionar Reforços' : '<i class="ph ph-info"></i> Consultar'}
                </div>
            </div>
        `;
    });
};

window.iniciarViagemIda = async function() { window.abrirConfirmacao("Iniciar oficialmente a Viagem de IDA?", async () => { const hj = new Date().toISOString().split('T')[0]; const est = getEstadoViagemHoje(hj); est.etapa = 'ida'; est.sentido = 'Ida'; await setDoc(doc(db, "viagens_status", hj), est); window.carregarMonitorViagem(); }); };
window.prepararRetornoMorretes = async function() { window.abrirConfirmacao("O trem chegou em Morretes?", async () => { const hj = new Date().toISOString().split('T')[0]; const est = getEstadoViagemHoje(hj); est.etapa = 'morretes'; est.sentido = 'Volta'; await setDoc(doc(db, "viagens_status", hj), est); window.carregarMonitorViagem(); }); };
window.iniciarViagemVolta = async function() { window.abrirConfirmacao("Iniciar oficialmente a Viagem de VOLTA?", async () => { const hj = new Date().toISOString().split('T')[0]; const est = getEstadoViagemHoje(hj); est.etapa = 'volta'; est.sentido = 'Volta'; await setDoc(doc(db, "viagens_status", hj), est); window.carregarMonitorViagem(); }); };

window.abrirModalVagaoOperacao = function(vagaoId) {
    const v = window.vagoesDB.find(x => x.id === vagaoId);
    if (!v) return;

    window.vagaoOperacaoSelecionadoId = vagaoId;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);

    document.getElementById('modalOpVagaoNome').innerText = `Placa ${v.numero} - ${v.nome}`;
    const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
    const elStatus = document.getElementById('modalOpVagaoStatus');
    elStatus.innerText = contagemFechada ? `FECHADO` : ((estado.etapa === 'ida' || estado.etapa === 'volta') ? `EM ABERTO` : `AGUARDANDO`);

    const selReforco = document.getElementById('modalOpSelectBebidaReforco');
    selReforco.innerHTML = "";
    const permitidas = v.bebidasPermitidas || [];
    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        selReforco.innerHTML += `<option value="${p.id}">${p.id} - ${p.nome} (Bagageiro: ${p.estoqueBagageiroUnidades || 0} un)</option>`;
    });

    window.renderizarListaReforcosFeitos();
    window.abrirModal('modal-vagao-operacao');
};

window.renderizarListaReforcosFeitos = function() {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    const divReforcos = document.getElementById('modalOpListaReforcosFeitos');
    divReforcos.innerHTML = "";
    
    const lista = estado.reforcos?.[vagaoId] || [];
    if (lista.length === 0) {
        divReforcos.innerHTML = '<span style="color:var(--secondary); font-style:italic;">Nenhum reforço lançado.</span>';
    } else {
        lista.forEach((r, idx) => {
            divReforcos.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fefce8; border:1px solid #fde68a; padding:6px 10px; border-radius:6px;">
                    <div><span style="color:var(--accent); font-weight:700;">+ ${r.qtd}x ${r.bebidaId}</span> <span style="font-size:11px; color:var(--secondary);">às ${r.hora}</span></div>
                    <button class="btn btn-danger btn-pequeno" style="padding:4px 6px;" onclick="window.removerReforcoVagao(${idx})"><i class="ph ph-trash"></i></button>
                </div>
            `;
        });
    }
};

window.adicionarReforcoVagao = async function() {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const bebidaId = document.getElementById('modalOpSelectBebidaReforco').value;
    const qtd = parseInt(document.getElementById('modalOpQtdReforco').value) || 1;

    if (!bebidaId || qtd < 1) return window.mostrarToast("Selecione bebida e quantidade válida!", true);

    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    if (!estado.reforcos[vagaoId]) estado.reforcos[vagaoId] = [];

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    estado.reforcos[vagaoId].push({ bebidaId, qtd, hora: horaAtual });

    const batch = writeBatch(db);
    batch.update(doc(db, "produtos", bebidaId), { estoqueBagageiroUnidades: increment(-qtd) });
    batch.set(doc(db, "viagens_status", hj), estado);
    await batch.commit();

    document.getElementById('modalOpQtdReforco').value = 1;
    window.mostrarToast(`Reforço de +${qtd} abatido do Bagageiro!`);
    window.renderizarListaReforcosFeitos();
};

window.removerReforcoVagao = async function(idx) {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    const ref = estado.reforcos[vagaoId][idx];
    if(!ref) return;

    window.abrirConfirmacao(`Deseja desfazer o reforço de ${ref.qtd}x ${ref.bebidaId}? A bebida voltará ao Bagageiro.`, async () => {
        const batch = writeBatch(db);
        batch.update(doc(db, "produtos", ref.bebidaId), { estoqueBagageiroUnidades: increment(ref.qtd) });
        
        estado.reforcos[vagaoId].splice(idx, 1);
        batch.set(doc(db, "viagens_status", hj), estado);
        await batch.commit();

        window.mostrarToast("Reforço cancelado e saldo estornado!");
        window.renderizarListaReforcosFeitos();
    });
};

// ================= BOUTIQUES HUB (SOBRAS & RETORNO INTUITIVO) =================
window.carregarSelectBoutiqueHub = function() {
    const selApoio = document.getElementById('selectApoioBoutiqueHub');
    if (selApoio) {
        selApoio.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a,b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            selApoio.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
        });
    }
    const sel = document.getElementById('selectVagaoBoutiqueHub');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Selecione a Boutique/Litorina --</option>';

    const vagoesBoutLito = window.vagoesDB.filter(v => v.tipo === 'boutique' || v.tipo === 'litorina').sort((a,b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
    vagoesBoutLito.forEach(v => sel.innerHTML += `<option value="${v.id}">Placa ${v.numero} - ${v.nome} [${v.tipo.toUpperCase()}]</option>`);

    const hj = new Date().toISOString().split('T')[0];
    const dtEl = document.getElementById('dataBoutiqueHub');
    if (dtEl && !dtEl.value) dtEl.value = hj;

    const area = document.getElementById('areaFormBoutiqueHub');
    if (area) area.innerHTML = "";
};

window.carregarFormularioBoutiqueHub = function() {
    const area = document.getElementById('areaFormBoutiqueHub');
    if (!area) return;
    area.innerHTML = "";

    const etapa = document.getElementById('etapaBoutiqueHub').value;
    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return;

    const dtEl = document.getElementById('dataBoutiqueHub');
    const dataSel = dtEl?.value || new Date().toISOString().split('T')[0];
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);
    
    ordenarPorRegra(window.produtosDB);
    const permitidas = vagaoObj?.bebidasPermitidas || [];

    const cargaKeyIda = `${dataSel}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c => (c.id === cargaKeyIda) || (c.data === dataSel && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido)));
    const itensCarregadosNaIda = cargaIda?.itens || {};
    
    // MOSTRA O CATÁLOGO COMPLETO DAS PERMITIDAS MESMO SE A CARGA FOI ZERO
    const prods = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    if (etapa === 'morretes_sem_retorno' || etapa === 'curitiba_final') {
        const titulo = etapa === 'morretes_sem_retorno' ? 'Baixar Sobras em Morretes (Sem Retorno)' : 'Fechamento Final das Sobras em Curitiba';
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">${titulo}</h4>`;

        prods.forEach(p => {
            const qtdIda = itensCarregadosNaIda[p.id]?.qtd || 0;
            htmlItens += `
                <div class="item-contagem" style="padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${p.id} - ${p.nome}</strong><br>
                        ${qtdIda > 0 ? `<small style="color:var(--secondary); font-size:11px;">Carregou Ida: ${qtdIda} un</small>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:var(--secondary); font-weight:bold;">Sobrou:</span>
                        <input type="number" id="boutique_sobra_${p.id}" placeholder="0" min="0" style="width:80px; text-align:center; padding:8px; font-weight:bold;">
                    </div>
                </div>
            `;
        });
        htmlItens += `<button class="btn btn-success btn-lg" style="margin-top:15px;" onclick="window.salvarSobrasBoutiqueDirect()"><i class="ph ph-check-circle"></i> Creditar Sobras e Enviar Relatório</button>`;
        area.innerHTML = htmlItens;

    } else if (etapa === 'morretes_com_retorno') {
        let htmlItens = `
            <h4 style="color:var(--primary); margin-bottom:6px;">Ajuste de Carga para o Retorno (Volta)</h4>
            <p style="font-size:12px; color:var(--secondary); margin-bottom:12px;">
                Informe a sobra da ida e selecione <strong>+ (Reforçar do bagageiro)</strong> ou <strong>- (Devolver ao bagageiro)</strong>:
            </p>
        `;

        prods.forEach(p => {
            const qtdIda = itensCarregadosNaIda[p.id]?.qtd || 0;
            htmlItens += `
                <div class="item-contagem" style="padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:var(--primary); font-size:15px;">${p.id} - ${p.nome}</strong>
                        ${qtdIda > 0 ? `<span class="badge-carga-ida">Carga Ida: ${qtdIda} un</span>` : ''}
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1.3fr; gap:8px; align-items:center;">
                        <div>
                            <span style="font-size:11px; font-weight:700; color:var(--secondary);">Sobrou da Ida:</span>
                            <input type="number" id="boutique_ida_sobra_${p.id}" placeholder="0" min="0" oninput="window.atualizarPreviaRetorno('${p.id}')" style="padding:8px; font-weight:bold; text-align:center;">
                        </div>
                        <div>
                            <span style="font-size:11px; font-weight:700; color:var(--secondary);">Ajuste para Retorno:</span>
                            <div class="controles-ajuste-retorno">
                                <select id="boutique_operador_${p.id}" class="select-operador-retorno" onchange="window.atualizarPreviaRetorno('${p.id}')">
                                    <option value="+">+</option>
                                    <option value="-">-</option>
                                </select>
                                <input type="number" id="boutique_ajuste_qtd_${p.id}" placeholder="Qtd" min="0" oninput="window.atualizarPreviaRetorno('${p.id}')" style="padding:8px; font-weight:bold; text-align:center;">
                            </div>
                        </div>
                    </div>
                    <div id="previa_retorno_${p.id}" style="margin-top:6px; font-size:12px; font-weight:700; color:var(--primary); text-align:right;">
                        = Carga da Volta: 0 un
                    </div>
                </div>
            `;
        });
        htmlItens += `<button class="btn btn-primary btn-lg" style="margin-top:15px;" onclick="window.salvarAjusteRetornoBoutique()"><i class="ph ph-check-circle"></i> Confirmar Carga do Retorno</button>`;
        area.innerHTML = htmlItens;
    }
};

window.atualizarPreviaRetorno = function(id) {
    const sobra = parseInt(document.getElementById(`boutique_ida_sobra_${id}`)?.value) || 0;
    const op = document.getElementById(`boutique_operador_${id}`)?.value || '+';
    const aj = parseInt(document.getElementById(`boutique_ajuste_qtd_${id}`)?.value) || 0;

    let res = sobra;
    if (op === '+') res += aj;
    else res = Math.max(0, res - aj);

    const lbl = document.getElementById(`previa_retorno_${id}`);
    if (lbl) lbl.innerText = `= Carga da Volta: ${res} un (${sobra} sobras da ida ${op} ${aj})`;
};

window.salvarSobrasBoutiqueDirect = async function() {
    const apoio = document.getElementById('selectApoioBoutiqueHub').value;
    if (!apoio) return window.mostrarToast("Selecione o Apoio Responsável!", true);

    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return window.mostrarToast("Selecione a Boutique!", true);

    const data = document.getElementById('dataBoutiqueHub').value;
    const etapa = document.getElementById('etapaBoutiqueHub').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const cargaKeyIda = `${data}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c => (c.id === cargaKeyIda) || (c.data === data && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido)));
    const itensCarregadosNaIda = cargaIda?.itens || {};

    const batch = writeBatch(db);
    let totalSobras = 0;
    let itensRelatorio = {};

    window.produtosDB.forEach(p => {
        const qtd = parseInt(document.getElementById(`boutique_sobra_${p.id}`)?.value) || 0;
        if (qtd > 0) {
            totalSobras += qtd;
            batch.update(doc(db, "produtos", p.id), { estoqueBagageiroUnidades: increment(qtd) });
            const cargaIdaVagao = itensCarregadosNaIda[p.id]?.qtd || 0;
            // No report of Boutiques we use carga and saldo. Pax and Ava are kept 0 for the layout filter, but we omit the logic.
            itensRelatorio[p.id] = { id: p.id, nome: p.nome, sobra: qtd, saldo: qtd, cargaOriginal: cargaIdaVagao, carga: cargaIdaVagao, pax: 0, trip: 0, ava: 0 };
        }
    });

    if (totalSobras === 0) return window.mostrarToast("Informe as sobras para salvar!", true);

    const docId = `sobras_${etapa}_${data}_${vagaoId}`;
    const docData = {
        id: docId, data, vagaoId, vagao: vagaoObj?.nome || "Boutique", vagaoNumero: vagaoObj?.numero || "S/N", vagaoTipo: 'boutique', tipoRegistro: 'sobras_boutique',
        etapa: etapa, sentido: etapa === 'curitiba_final' ? 'Volta' : 'Ida', apoio: apoio, guia: 'Baixa de Sobras', itens: itensRelatorio,
        obs: etapa === 'morretes_sem_retorno' ? 'Baixa de Sobras em Morretes (Sem Retorno)' : 'Fechamento Final em Curitiba', timestamp: Date.now()
    };

    batch.set(doc(db, "contagens", docId), docData);
    await batch.commit();

    window.mostrarToast(`${totalSobras} unidades creditadas no Bagageiro e registradas nos relatórios!`);
    window.mostrarTela('tela-inicial');
};

window.salvarAjusteRetornoBoutique = async function() {
    const apoio = document.getElementById('selectApoioBoutiqueHub').value;
    if (!apoio) return window.mostrarToast("Selecione o Apoio Responsável!", true);

    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return window.mostrarToast("Selecione a Boutique!", true);

    const data = document.getElementById('dataBoutiqueHub').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const cargaKeyIda = `${data}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c => (c.id === cargaKeyIda) || (c.data === data && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido)));
    const itensCarregadosNaIda = cargaIda?.itens || {};

    const batch = writeBatch(db);
    let itensCargaRetorno = {};
    let itensRelatorio = {};

    window.produtosDB.forEach(p => {
        const sobra = parseInt(document.getElementById(`boutique_ida_sobra_${p.id}`)?.value) || 0;
        const op = document.getElementById(`boutique_operador_${p.id}`)?.value || '+';
        const ajusteQtd = parseInt(document.getElementById(`boutique_ajuste_qtd_${p.id}`)?.value) || 0;

        let qtdFinal = sobra;
        if (op === '+') qtdFinal += ajusteQtd;
        else qtdFinal = Math.max(0, qtdFinal - ajusteQtd);

        if (sobra > 0 || ajusteQtd > 0 || qtdFinal > 0) {
            itensCargaRetorno[p.id] = { qtd: qtdFinal, sobra: sobra, operador: op, ajusteQtd: ajusteQtd, baga: 0, cont: 0 }; // Espelho para carga_vagoes

            const netAjusteBagageiro = (op === '+') ? -ajusteQtd : ajusteQtd;
            if (netAjusteBagageiro !== 0) {
                batch.update(doc(db, "produtos", p.id), { estoqueBagageiroUnidades: increment(netAjusteBagageiro) });
            }

            const cargaIdaVagao = itensCarregadosNaIda[p.id]?.qtd || 0;
            itensRelatorio[p.id] = {
                id: p.id, nome: p.nome, sobra: sobra, ajusteQtd: ajusteQtd, operador: op, qtdFinal: qtdFinal,
                cargaOriginal: cargaIdaVagao, carga: cargaIdaVagao, saldo: sobra, pax: 0, trip: 0, ava: 0 // Relatório
            };
        }
    });

    const cargaKey = `${data}_${vagaoId}_Volta`;
    batch.set(doc(db, "cargas_vagoes", cargaKey), {
        id: cargaKey, data, vagaoId, sentido: 'Volta', inativo: false, tipoRegistro: 'retorno_boutique',
        itens: itensCargaRetorno, obs: `Carga de Retorno calculada em Morretes (Sobras + Ajuste)`, timestamp: Date.now()
    });

    const contagemKey = `retorno_${data}_${vagaoId}`;
    batch.set(doc(db, "contagens", contagemKey), {
        id: contagemKey, data, vagaoId, vagao: vagaoObj?.nome || "Boutique", vagaoNumero: vagaoObj?.numero || "S/N", vagaoTipo: 'boutique',
        tipoRegistro: 'retorno_boutique', sentido: 'Volta', apoio: apoio, guia: 'Ajuste de Retorno', itens: itensRelatorio,
        obs: `Carga da Volta gerada a partir das sobras de Morretes`, timestamp: Date.now()
    });

    await batch.commit();
    window.mostrarToast("Carga de Retorno salva no espelho da volta e nos relatórios!");
    window.mostrarTela('tela-inicial');
};

// ================= SETUP DE CONTAGEM (APOIO - TURÍSTICOS E ECONÔMICOS) =================
window.abrirSetupContagem = function() {
    const selUser = document.getElementById('selectNomeApoio');
    if (selUser) {
        selUser.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a,b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
        });
    }

    const selVagao = document.getElementById('selectVagaoApoio');
    if (selVagao) {
        selVagao.innerHTML = '<option value="">-- Selecione o vagão --</option>';
        const vagoesOrd = [...window.vagoesDB].filter(v => v.tipo === 'turistico' || v.tipo === 'economico').sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
        vagoesOrd.forEach(v => selVagao.innerHTML += `<option value="${v.id}">Placa ${v.numero} &bull; ${v.nome} [${v.tipo.toUpperCase()}]</option>`);
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
    const apoioNome = document.getElementById('selectNomeApoio').value;
    if (!apoioNome) return window.mostrarToast("Selecione o Apoio!", true);

    const vagaoId = document.getElementById('selectVagaoApoio').value;
    if (!vagaoId) return window.mostrarToast("Selecione o Vagão!", true);

    const guia = document.getElementById('nomeGuiaApoio').value.trim();
    if (!guia) return window.mostrarToast("Preencha o Nome do Guia!", true);

    const dataSel = document.getElementById('dataContagemApoio').value;
    const sentidoSel = document.getElementById('selectSentidoApoio').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const contagemId = `${dataSel}_${vagaoId}_${sentidoSel}`;
    if (window.contagensDB.some(c => c.id === contagemId)) {
        return window.mostrarToast(`Vagão Placa ${vagaoObj?.numero} já está fechado na ${sentidoSel}!`, true);
    }

    window.contagemTemp.apoio = apoioNome;
    window.contagemTemp.guia = window.escapeHTML(guia);
    window.contagemTemp.data = dataSel;
    window.contagemTemp.sentido = sentidoSel;
    window.contagemTemp.vagaoId = vagaoId;
    window.contagemTemp.vagaoNumero = vagaoObj?.numero || "S/N";
    window.contagemTemp.vagao = `Placa ${vagaoObj?.numero || ''} - ${vagaoObj?.nome || 'Vagão'}`;
    window.contagemTemp.vagaoTipo = vagaoObj?.tipo || 'turistico';

    document.getElementById('lblVagaoContagem').innerText = window.contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = window.contagemTemp.sentido;

    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;
    const cargaDoChefe = window.cargasVagoesDB.find(c => c.id === cargaKey || (c.data === dataSel && c.vagaoId === vagaoId && c.sentido === sentidoSel));
    
    const boxAviso = document.getElementById('avisoCargaCarregada');
    if (cargaDoChefe) boxAviso.innerHTML = `<span style="background:#dcfce7; color:#15803d; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700;"><i class="ph ph-check-circle"></i> Carga oficial sincronizada!</span>`;
    else boxAviso.innerHTML = `<span style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700;"><i class="ph ph-warning"></i> Carga não cadastrada. Preencha manualmente.</span>`;

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";
    const draft = JSON.parse(localStorage.getItem('trem_draft_contagem') || 'null');
    ordenarPorRegra(window.produtosDB);

    const permitidas = vagaoObj?.bebidasPermitidas || [];
    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        let cargaBase = cargaDoChefe && cargaDoChefe.itens[p.id] ? cargaDoChefe.itens[p.id].qtd : 0;
        const valCarga = draft?.itens?.[p.id]?.carga !== undefined && draft?.itens?.[p.id]?.carga !== "" ? draft.itens[p.id].carga : cargaBase;
        const valSaldo = draft?.itens?.[p.id]?.saldo !== undefined && draft?.itens?.[p.id]?.saldo !== "" ? draft.itens[p.id].saldo : "";
        const valTrip = draft?.itens?.[p.id]?.trip !== undefined && draft?.itens?.[p.id]?.trip !== "" ? draft.itens[p.id].trip : 0;
        const valAva = draft?.itens?.[p.id]?.ava !== undefined && draft?.itens?.[p.id]?.ava !== "" ? draft.itens[p.id].ava : 0;

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (${p.id})</span></div>
                <div class="grid-inputs" style="grid-template-columns: repeat(3, 1fr);">
                    <div><label>Carga:</label><input type="number" id="carga_${p.id}" value="${valCarga}" data-carga-original="${cargaBase}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();"></div>
                    <div><label>Sobra (Saldo):</label><input type="number" id="saldo_${p.id}" value="${valSaldo}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();"></div>
                    <div><label>Pax (Auto):</label><input type="number" id="pax_${p.id}" class="input-pax" readonly value="${valCarga}"></div>
                    <div><label>Tripulação:</label><input type="number" id="trip_${p.id}" value="${valTrip}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();"></div>
                    <div><label>Avaria:</label><input type="number" id="ava_${p.id}" class="input-avaria" value="${valAva}" onfocus="this.select()" oninput="window.calcularConsumo('${p.id}'); window.salvarDraftContagem();"></div>
                </div>
            </div>
        `;
    });

    window.produtosDB.forEach(p => window.calcularConsumo(p.id));
    window.mostrarTela('tela-contagem-vagao');
};

window.calcularConsumo = function(id) {
    const carga = parseInt(document.getElementById(`carga_${id}`)?.value) || 0;
    const saldo = parseInt(document.getElementById(`saldo_${id}`)?.value) || 0;
    const trip = parseInt(document.getElementById(`trip_${id}`)?.value) || 0;
    const ava = parseInt(document.getElementById(`ava_${id}`)?.value) || 0;
    const paxEl = document.getElementById(`pax_${id}`);
    if (paxEl) paxEl.value = Math.max(0, carga - saldo - trip - ava);
};

window.salvarDraftContagem = function() {
    if (!window.contagemTemp.vagaoId) return;
    let draftItens = {};
    window.produtosDB.forEach(p => {
        const c = document.getElementById(`carga_${p.id}`)?.value;
        const s = document.getElementById(`saldo_${p.id}`)?.value;
        const t = document.getElementById(`trip_${p.id}`)?.value;
        const a = document.getElementById(`ava_${p.id}`)?.value;
        if (c !== undefined || s !== undefined) draftItens[p.id] = { carga: c, saldo: s, trip: t, ava: a };
    });
    localStorage.setItem('trem_draft_contagem', JSON.stringify({ ...window.contagemTemp, itens: draftItens }));
};

window.gerarResumoContagem = function() {
    window.contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";
    let totalLanches = 0, totalBebidas = 0;

    ordenarPorRegra(window.produtosDB);
    window.produtosDB.forEach(p => {
        const elCarga = document.getElementById(`carga_${p.id}`);
        if (!elCarga) return;

        const attrOrig = elCarga.getAttribute('data-carga-original');
        let obj = {
            id: p.id, nome: p.nome,
            cargaOriginal: attrOrig !== null && attrOrig !== "" ? parseInt(attrOrig) : (parseInt(elCarga.value) || 0),
            carga: parseInt(elCarga.value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`)?.value) || 0,
            trip: parseInt(document.getElementById(`trip_${p.id}`)?.value) || 0,
            ava: parseInt(document.getElementById(`ava_${p.id}`)?.value) || 0,
            pax: parseInt(document.getElementById(`pax_${p.id}`)?.value) || 0
        };

        window.contagemTemp.itens[p.id] = obj;

        if (obj.carga > 0 || obj.saldo > 0 || obj.trip > 0 || obj.ava > 0) {
            tbody.innerHTML += `<tr><td>${obj.nome}</td><td>${obj.carga}</td><td style="color:var(--success); font-weight:bold;">${obj.pax}</td><td>${obj.trip > 0 ? obj.trip : '-'}</td><td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td><td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td></tr>`;
            if (p.id === 'KL' || p.id === 'Kl') totalLanches += obj.pax; else totalBebidas += obj.pax;
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
    const btnSalvar = document.getElementById('btnSalvarContagemDefinitiva');
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Gravando...'; }

    const contagemId = `${window.contagemTemp.data}_${window.contagemTemp.vagaoId}_${window.contagemTemp.sentido}`;
    window.contagemTemp.obs = window.escapeHTML(document.getElementById('obsFinalContagem').value);
    window.contagemTemp.id = contagemId;
    window.contagemTemp.timestamp = Date.now();

    const batch = writeBatch(db);
    for (let id in window.contagemTemp.itens) {
        const item = window.contagemTemp.itens[id];
        const extraPego = Math.max(0, item.carga - item.cargaOriginal);
        const netBagageiro = item.saldo - extraPego;

        if (netBagageiro !== 0) {
            batch.update(doc(db, "produtos", id), { estoqueBagageiroUnidades: increment(netBagageiro) });
        }
    }

    batch.set(doc(db, "contagens", contagemId), window.contagemTemp, { merge: true });
    await batch.commit().catch(e => console.log("Gravado offline:", e));

    localStorage.removeItem('trem_draft_contagem');
    window.mostrarToast(`Vagão ${window.contagemTemp.vagaoNumero} fechado!`);
    
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.innerHTML = '<i class="ph ph-paper-plane-right"></i> Confirmar e Fechar Vagão'; }
    window.contagemTemp = {};
    window.mostrarTela('tela-setup-contagem');
    window.abrirSetupContagem();
};

// ================= CARRINHO DE VENDAS (ABATE IMEDIATO) =================
window.abrirSetupCarrinho = function() {
    const sel = document.getElementById('selectApoioCarrinho');
    if (sel) {
        sel.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a,b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => sel.innerHTML += `<option value="${u.nome}">${u.nome}</option>`);
    }
    const dt = document.getElementById('dataCarrinho');
    if (dt && !dt.value) dt.value = new Date().toISOString().split('T')[0];
};

window.iniciarAcertoCarrinho = function() {
    const apoio = document.getElementById('selectApoioCarrinho')?.value;
    const data = document.getElementById('dataCarrinho')?.value;
    const sentido = document.getElementById('sentidoCarrinho')?.value || 'Ida';
    if (!apoio) return window.mostrarToast("Selecione o apoio responsável!", true);

    document.getElementById('lblCarrinhoSentido').innerText = `${apoio} - ${sentido}`;
    const selExtra = document.getElementById('selectItemExtraCarrinho');
    if (selExtra) {
        selExtra.innerHTML = "";
        ordenarPorRegra(window.produtosDB);
        window.produtosDB.forEach(p => selExtra.innerHTML += `<option value="${p.id}">${p.id} - ${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</option>`);
    }

    window.itensExtrasCarrinhoTemp = [];
    document.getElementById('listaExtrasAdicionados').innerHTML = "";
    document.getElementById('carrinhoTroco').value = "0";

    const divItens = document.getElementById('listaItensCarrinho');
    divItens.innerHTML = "";
    ordenarPorRegra(window.produtosDB);
    
    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        divItens.innerHTML += `
            <div class="item-contagem" style="margin-bottom:10px; padding:12px;">
                <div class="item-contagem-header" style="margin-bottom:8px; padding-bottom:6px;">
                    <span><strong>${p.nome} (${p.id})</strong> &bull; R$ ${window.formatarMoeda(p.precoVenda)}</span>
                    <span id="carrinho_sub_${p.id}" style="color:var(--success); font-weight:800; font-size:13px;">R$ 0,00</span>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr;">
                    <div><label>Saiu (Un):</label><input type="number" id="carrinho_saiu_${p.id}" value="0" min="0" onfocus="this.select()" oninput="window.calcularVendas()"></div>
                    <div><label>Voltou (Un):</label><input type="number" id="carrinho_voltou_${p.id}" value="0" min="0" onfocus="this.select()" oninput="window.calcularVendas()"></div>
                    <div><label>Vendeu (Un):</label><input type="number" id="carrinho_vendeu_${p.id}" value="0" readonly class="input-pax" style="font-weight:bold;"></div>
                </div>
            </div>
        `;
    });

    window.calcularVendas();
    window.mostrarTela('tela-acerto-carrinho');
};

window.calcularVendas = function() {
    let totalLiquido = 0;
    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        const saiu = parseInt(document.getElementById(`carrinho_saiu_${p.id}`)?.value) || 0;
        const voltou = parseInt(document.getElementById(`carrinho_voltou_${p.id}`)?.value) || 0;
        const vendeu = Math.max(0, saiu - voltou);

        if (document.getElementById(`carrinho_vendeu_${p.id}`)) document.getElementById(`carrinho_vendeu_${p.id}`).value = vendeu;
        const sub = vendeu * (p.precoVenda || 0);
        totalLiquido += sub;
        if (document.getElementById(`carrinho_sub_${p.id}`)) document.getElementById(`carrinho_sub_${p.id}`).innerText = `R$ ${window.formatarMoeda(sub)}`;
    });

    window.itensExtrasCarrinhoTemp.forEach(extra => totalLiquido += (extra.total || 0));
    const troco = parseFloat(document.getElementById('carrinhoTroco')?.value) || 0;
    
    if (document.getElementById('lblTotalVendasCarrinho')) document.getElementById('lblTotalVendasCarrinho').innerText = window.formatarMoeda(totalLiquido);
    if (document.getElementById('lblTotalEntregar')) document.getElementById('lblTotalEntregar').innerText = `R$ ${window.formatarMoeda(totalLiquido + troco)}`;
};

window.adicionarItemExtraVenda = function() {
    const pId = document.getElementById('selectItemExtraCarrinho').value;
    const qtd = parseInt(document.getElementById('qtdItemExtraCarrinho').value) || 1;
    const prod = window.produtosDB.find(x => x.id === pId);

    if (!prod || qtd < 1) return;

    window.itensExtrasCarrinhoTemp.push({ id: pId, nome: prod.nome, qtd, preco: prod.precoVenda || 0, total: qtd * (prod.precoVenda || 0) });
    window.renderizarExtrasAdicionados();
    window.calcularVendas();
    document.getElementById('qtdItemExtraCarrinho').value = 1;
};

window.removerItemExtraVenda = function(index) {
    window.itensExtrasCarrinhoTemp.splice(index, 1);
    window.renderizarExtrasAdicionados();
    window.calcularVendas();
};

window.renderizarExtrasAdicionados = function() {
    const div = document.getElementById('listaExtrasAdicionados');
    if (!div) return;
    div.innerHTML = "";
    window.itensExtrasCarrinhoTemp.forEach((item, idx) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid var(--border); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
                <span><strong>${item.qtd}x</strong> ${item.nome} &bull; R$ ${window.formatarMoeda(item.total)}</span>
                <button class="btn btn-danger btn-pequeno" style="padding:4px 8px;" onclick="window.removerItemExtraVenda(${idx})"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
};

window.salvarAcertoCarrinho = async function() {
    const apoio = document.getElementById('selectApoioCarrinho').value;
    const data = document.getElementById('dataCarrinho').value;
    const sentido = document.getElementById('sentidoCarrinho').value;
    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;

    let totalVendasR$ = 0;
    let itensVendidos = {};
    const batch = writeBatch(db);

    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        const saiu = parseInt(document.getElementById(`carrinho_saiu_${p.id}`)?.value) || 0;
        const voltou = parseInt(document.getElementById(`carrinho_voltou_${p.id}`)?.value) || 0;
        const vendeu = Math.max(0, saiu - voltou);

        if (saiu > 0 || voltou > 0 || vendeu > 0) {
            const sub = vendeu * (p.precoVenda || 0);
            totalVendasR$ += sub;
            itensVendidos[p.id] = { saiu, voltou, vendeu, subtotal: sub };
            if (vendeu > 0) batch.update(doc(db, "produtos", p.id), { estoqueBagageiroUnidades: increment(-vendeu) });
        }
    });

    window.itensExtrasCarrinhoTemp.forEach(ex => {
        totalVendasR$ += ex.total;
        batch.update(doc(db, "produtos", ex.id), { estoqueBagageiroUnidades: increment(-ex.qtd) });
    });

    const acertoId = `carrinho_${data}_${sentido}_${Date.now()}`;
    batch.set(doc(db, "vendas_carrinho", acertoId), {
        id: acertoId, data, apoio, sentido, trocoInicial: troco,
        totalVendasR$: window.formatarMoeda(totalVendasR$), totalEntregarR$: window.formatarMoeda(totalVendasR$ + troco),
        itens: itensVendidos, extras: window.itensExtrasCarrinhoTemp, timestamp: Date.now()
    });

    await batch.commit();
    window.mostrarToast("Acerto concluído e bebidas descontadas do Bagageiro!");
    window.mostrarTela('tela-inicial');
};

// ================= RELATÓRIOS DO CHEFE E EXCLUSÕES =================
window.setModoRelatorio = function(modo) {
    window.modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelBoutLito', 'btnRelVendas'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('ativo'); });
    const mapIds = { 'todos': 'btnRelVagao', 'turisticos': 'btnRelTur', 'boutiques_litorinas': 'btnRelBoutLito', 'vendas': 'btnRelVendas' };
    const atvEl = document.getElementById(mapIds[modo]);
    if(atvEl) atvEl.classList.add('ativo');
    window.renderizarRelatoriosAdmin();
};

window.setFiltroSentido = function(sentido) {
    window.filtroSentidoRelatorio = sentido;
    ['btnSentidoTodos', 'btnSentidoIda', 'btnSentidoVolta'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('ativo'); });
    const mapIds = { 'todos': 'btnSentidoTodos', 'Ida': 'btnSentidoIda', 'Volta': 'btnSentidoVolta' };
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
        if (window.filtroSentidoRelatorio !== 'todos') vendas = vendas.filter(v => (v.sentido || "").trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase());

        if (vendas.length === 0) return div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda encontrada.</p>';

        vendas.forEach(v => {
            let extrasHtml = (v.extras || []).map(e => `<li>${e.qtd}x ${e.nome} (R$ ${window.formatarMoeda(e.total)})</li>`).join('');
            
            // Renderiza total de itens vendidos base
            let itensBaseHtml = "";
            for (let k in v.itens) {
                const it = v.itens[k];
                const nomeProd = window.produtosDB.find(x => x.id === k)?.nome || k;
                if(it.vendeu > 0) itensBaseHtml += `<li>${it.vendeu}x ${nomeProd} (R$ ${window.formatarMoeda(it.subtotal)})</li>`;
            }

            div.innerHTML += `
                <div class="card" style="border-left:5px solid #0f766e; padding:14px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:16px;">Carrinho: Viagem de ${v.sentido}</strong><br>
                            <span style="font-size:13px; color:var(--secondary);">${v.apoio}</span>
                        </div>
                        <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalEdicaoVenda('${v.id}')"><i class="ph ph-pencil-simple"></i> Editar Bebidas</button>
                    </div>
                    <p style="margin:8px 0; font-size:16px; color:var(--success); font-weight:bold;">Total Vendas: R$ ${v.totalVendasR$}</p>
                    <div style="font-size:12px; color:var(--secondary);">
                        ${itensBaseHtml ? `<b>Itens Base:</b><ul style="padding-left:18px; margin-bottom:6px;">${itensBaseHtml}</ul>` : ''}
                        ${extrasHtml ? `<b>Extras Adicionados:</b><ul style="padding-left:18px;">${extrasHtml}</ul>` : ''}
                    </div>
                </div>
            `;
        });
        return;
    }

    let filtrados = window.contagensDB.filter(c => c.data === dataFiltro);
    if (window.filtroSentidoRelatorio !== 'todos') filtrados = filtrados.filter(c => (c.sentido || "").trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase());

    if (window.modoRelatorioAdmin === 'turisticos') filtrados = filtrados.filter(c => ['turistico', 'economico'].includes((c.vagaoTipo || "").trim().toLowerCase()));
    else if (window.modoRelatorioAdmin === 'boutiques_litorinas') filtrados = filtrados.filter(c => ['boutique', 'litorina'].includes((c.vagaoTipo || "").trim().toLowerCase()));

    if (filtrados.length === 0) return div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado para estes filtros.</p>';

    filtrados.sort((a, b) => {
        const nA = parseInt(a.vagaoNumero) || 9999;
        const nB = parseInt(b.vagaoNumero) || 9999;
        if (nA !== nB) return nA - nB;
        return (a.sentido || "").localeCompare(b.sentido || "");
    });

    filtrados.forEach(c => {
        let linhas = gerarLinhasTabelaAdmin(c.itens, c.tipoRegistro);
        let totalLanches = 0, totalBebidas = 0;
        
        for (let k in c.itens) {
            const it = c.itens[k];
            if (k === 'KL' || k === 'Kl') totalLanches += it.pax || 0; else totalBebidas += it.pax || 0;
        }

        const isBoutiqueFechamento = c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique';
        const compClasse = (totalLanches === totalBebidas) ? 'kpi-match' : 'kpi-divergent';

        div.innerHTML += `
            <div class="card" style="border-left:5px solid ${isBoutiqueFechamento ? 'var(--accent)' : 'var(--primary)'}; padding:14px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:16px;">${c.vagao} (${c.sentido})</strong>
                        ${isBoutiqueFechamento ? '<span style="font-size:11px; font-weight:bold; color:var(--accent); background:#fef3c7; padding:2px 6px; border-radius:6px; margin-left:6px;">Morretes / Sobras</span>' : ''}
                        <br><span style="font-size:12px; color:var(--secondary);">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <button class="btn btn-secondary btn-pequeno" onclick="window.abrirModalEdicaoRelatorio('${c.id}')"><i class="ph ph-pencil-simple"></i> Corrigir</button>
                </div>

                ${!isBoutiqueFechamento ? `
                    <div class="box-comparativo-status ${compClasse}" style="padding:6px 12px; font-size:12px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-around;">
                            <span>Lanches: <strong>${totalLanches}</strong></span>
                            <span>Bebidas: <strong>${totalBebidas}</strong></span>
                        </div>
                    </div>
                ` : ''}

                <div class="tabela-container">
                    <table class="tabela-relatorio">
                        <thead>
                            <tr>
                                <th style="width:34%;">Bebida</th>
                                <th style="width:13%;">Carga</th>
                                ${!isBoutiqueFechamento ? `<th style="width:13%;">Pax</th><th style="width:12%;">Trip</th><th style="width:12%;">Ava</th>` : `<th style="width:37%;">Ajuste Volta</th>`}
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

function gerarLinhasTabelaAdmin(itensObjeto, tipoRegistro) {
    if (!itensObjeto) return "";
    let arr = Object.values(itensObjeto).map(item => {
        const prod = window.produtosDB.find(p => p.id === item.id) || { ordem: 9999 };
        return { ...item, ordem: prod.ordem };
    });
    ordenarPorRegra(arr);

    let html = "";
    const isBoutiqueFechamento = tipoRegistro === 'retorno_boutique' || tipoRegistro === 'sobras_boutique';

    arr.forEach(obj => {
        if (obj.carga > 0 || obj.saldo > 0 || obj.pax > 0 || obj.ava > 0 || obj.ajusteQtd > 0) {
            if (isBoutiqueFechamento) {
                const txtAjuste = (obj.ajusteQtd !== undefined && obj.ajusteQtd > 0) ? `${obj.operador || '+'} ${obj.ajusteQtd} baga` : '-';
                html += `<tr><td>${obj.nome}</td><td>${obj.cargaOriginal || obj.carga || 0}</td><td style="color:var(--accent); font-weight:bold;">${txtAjuste}</td><td style="font-weight:bold; color:var(--primary);">${obj.saldo || obj.sobra}</td></tr>`;
            } else {
                html += `<tr><td>${obj.nome}</td><td>${obj.carga}</td><td style="color:var(--success); font-weight:bold;">${obj.pax}</td><td>${obj.trip > 0 ? obj.trip : '-'}</td><td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td><td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td></tr>`;
            }
        }
    });
    return html;
}

window.abrirModalEdicaoVenda = function(id) {
    const v = window.vendasCarrinhoDB.find(x => x.id === id);
    if (!v) return;
    document.getElementById('editVendaIdOriginal').value = v.id;
    document.getElementById('subtituloModalEditaVenda').innerText = `Venda ${v.apoio} (${v.sentido})`;
    
    let html = '';
    const permitidas = ['Am', 'Acp', 'Agsp', 'Aggp']; // Cerveja e Águas
    
    permitidas.forEach(pId => {
        const item = v.itens[pId] || { vendeu: 0 };
        const prod = window.produtosDB.find(x => x.id === pId);
        if (prod) {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
                    <strong style="font-size:14px;">${prod.nome}</strong>
                    <input type="number" id="edit_venda_${pId}" value="${item.vendeu}" data-old="${item.vendeu}" style="width:80px; padding:6px; text-align:center;">
                </div>
            `;
        }
    });
    document.getElementById('listaItensEdicaoVenda').innerHTML = html;
    window.abrirModal('modal-editar-venda');
};

window.salvarEdicaoVenda = async function() {
    const id = document.getElementById('editVendaIdOriginal').value;
    const v = window.vendasCarrinhoDB.find(x => x.id === id);
    if (!v) return;

    const batch = writeBatch(db);
    let novasVendas = { ...v.itens };
    let deltaFinanceiro = 0;

    ['Am', 'Acp', 'Agsp', 'Aggp'].forEach(pId => {
        const el = document.getElementById(`edit_venda_${pId}`);
        if (!el) return;
        const newVal = parseInt(el.value) || 0;
        const oldVal = parseInt(el.getAttribute('data-old')) || 0;
        const deltaVenda = newVal - oldVal;

        if (deltaVenda !== 0) {
            batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(-deltaVenda) });
            const prod = window.produtosDB.find(x => x.id === pId);
            const preco = prod ? (prod.precoVenda || 0) : 0;
            if (!novasVendas[pId]) novasVendas[pId] = { saiu: 0, voltou: 0, subtotal: 0 };
            novasVendas[pId].vendeu = newVal;
            novasVendas[pId].subtotal = newVal * preco;
            deltaFinanceiro += (deltaVenda * preco);
        }
    });

    const numAtualR = parseFloat(v.totalVendasR$.replace(',', '.')) || 0;
    const novoTotal = numAtualR + deltaFinanceiro;
    const troco = parseFloat(v.trocoInicial) || 0;
    const novoEntregar = novoTotal + troco;

    batch.update(doc(db, "vendas_carrinho", id), {
        itens: novasVendas,
        totalVendasR$: window.formatarMoeda(novoTotal),
        totalEntregarR$: window.formatarMoeda(novoEntregar)
    });

    await batch.commit();
    window.fecharModal('modal-editar-venda');
    window.mostrarToast("Vendas corrigidas e Bagageiro reajustado!");
};

window.abrirModalEdicaoRelatorio = function(id) {
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    document.getElementById('editRelatorioIdOriginal').value = c.id;
    document.getElementById('subtituloModalEditaRelatorio').innerText = `${c.vagao} (${c.sentido}) \u2022 ${c.data.split('-').reverse().join('/')}`;
    document.getElementById('obsEdicaoChefeRelatorio').value = c.obs || "";

    const div = document.getElementById('listaItensEdicaoRelatorio');
    div.innerHTML = "";

    if (c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique') {
        div.innerHTML = `<div style="padding:15px; color:var(--accent); font-weight:bold; text-align:center;">Edição em massa indisponível para Hub Boutiques. Para corrigir, exclua o relatório e lance novamente em Morretes.</div>`;
    } else {
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
    }
    window.abrirModal('modal-editar-relatorio');
};

window.salvarEdicaoRelatorioPeloChefe = async function() {
    const id = document.getElementById('editRelatorioIdOriginal').value;
    const c = window.contagensDB.find(x => x.id === id);
    if (!c || c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique') return window.fecharModal('modal-editar-relatorio');

    const batch = writeBatch(db);
    let novosItens = {};

    for (let pId in c.itens) {
        const carga = parseInt(document.getElementById(`edit_rel_carga_${pId}`)?.value) || 0;
        const saldo = parseInt(document.getElementById(`edit_rel_saldo_${pId}`)?.value) || 0;
        const trip = parseInt(document.getElementById(`edit_rel_trip_${pId}`)?.value) || 0;
        const ava = parseInt(document.getElementById(`edit_rel_ava_${pId}`)?.value) || 0;
        const pax = Math.max(0, carga - saldo - trip - ava);

        const cargaOriginal = c.itens[pId].cargaOriginal !== undefined ? c.itens[pId].cargaOriginal : (c.itens[pId].carga || 0);

        novosItens[pId] = { id: pId, nome: c.itens[pId].nome, cargaOriginal, carga, saldo, trip, ava, pax };

        const difCarga = carga - (c.itens[pId].carga || 0);
        const difSaldo = saldo - (c.itens[pId].saldo || 0);
        const netAjusteBagageiro = difSaldo - difCarga;

        if (netAjusteBagageiro !== 0) batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(netAjusteBagageiro) });
    }

    const obsChefe = document.getElementById('obsEdicaoChefeRelatorio').value.trim();
    batch.update(doc(db, "contagens", id), { itens: novosItens, obs: window.escapeHTML(obsChefe) });

    await batch.commit();
    window.fecharModal('modal-editar-relatorio');
    window.mostrarToast("Relatório corrigido com sucesso!");
};

window.excluirRelatorioPeloChefe = async function() {
    const id = document.getElementById('editRelatorioIdOriginal').value;
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    window.abrirConfirmacao("Deseja EXCLUIR este relatório e estornar o bagageiro?", async () => {
        const batch = writeBatch(db);

        for (let pId in c.itens) {
            const item = c.itens[pId];
            if (c.tipoRegistro === 'retorno_boutique') {
                 if (item.operador === '+') batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(item.ajusteQtd || 0) });
                 else if (item.operador === '-') batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(-(item.ajusteQtd || 0)) });
            } else if (c.tipoRegistro === 'sobras_boutique') {
                 batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(-(item.sobra || 0)) });
            } else {
                const extraPego = Math.max(0, (item.carga || 0) - (item.cargaOriginal || 0));
                const netBagageiro = (item.saldo || 0) - extraPego;
                if (netBagageiro !== 0) batch.update(doc(db, "produtos", pId), { estoqueBagageiroUnidades: increment(-netBagageiro) });
            }
        }

        batch.delete(doc(db, "contagens", id));
        await batch.commit();

        window.fecharModal('modal-editar-relatorio');
        window.mostrarToast("Relatório excluído e estoques estornados!");
    });
};

// ================= INICIALIZAÇÃO =================
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
