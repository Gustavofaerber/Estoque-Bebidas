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

// ================= RECUPERAÇÃO BLINDADA DO CACHE LOCAL =================
function getCache(key, fallback = []) {
    try {
        const val = localStorage.getItem(key);
        if (!val || val === "undefined" || val === "null") return fallback;
        return JSON.parse(val);
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

// Receitas padrão prontas
const receitasIniciaisPadrao = [
    {
        id: 'rec_turistico_48',
        nome: 'Base Turístico (48 Lugares)',
        itens: { C: 24, Gg: 12, Zp: 6, Acp: 24, KL: 49 }
    },
    {
        id: 'rec_economico',
        nome: 'Base Econômico',
        itens: { C: 24, Gg: 12, Zp: 6, Acp: 24, KL: 49 }
    },
    {
        id: 'rec_boutique_padrao',
        nome: 'Boutique Padrão (Sem Coca Grande / Água Copo)',
        itens: { Cp: 12, Zp: 12, Gp: 12, Fgp: 6, Am: 12, Agsp: 12, Aggp: 12, Chn: 6, Chz: 6, Su: 6, Sp: 6, KL: 20, Esp: 6, Gelo: 2 }
    }
];

const frotaInicialPadrao = [
    { id: '11', numero: '11', nome: 'Turístico 11', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '12', numero: '12', nome: 'Turístico 12', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '13', numero: '13', nome: 'Turístico 13', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '14', numero: '14', nome: 'Turístico 14', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '15', numero: '15', nome: 'Turístico 15', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '16', numero: '16', nome: 'Turístico 16', tipo: 'turistico', receitaId: 'rec_turistico_48' },
    { id: '01', numero: '01', nome: 'Econômico 1', tipo: 'economico', receitaId: 'rec_economico' },
    { id: '18', numero: '18', nome: 'Foz do Iguaçu', tipo: 'boutique', receitaId: 'rec_boutique_padrao' },
    { id: '20', numero: '20', nome: 'Curitiba', tipo: 'boutique', receitaId: 'rec_boutique_padrao' },
    { id: '7000', numero: '7000', nome: 'Litorina Luxo', tipo: 'litorina', receitaId: 'rec_boutique_padrao' }
];

window.produtosDB = getCache('trem_cache_produtos', catalogoInicial);
window.usuariosDB = getCache('trem_cache_usuarios', [{ id: '1', nome: 'Gustavo' }]);
window.vagoesDB = getCache('trem_cache_vagoes', frotaInicialPadrao);
window.receitasDB = getCache('trem_cache_receitas', receitasIniciaisPadrao);
window.contagensDB = getCache('trem_cache_contagens', []);
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

// ================= ROTEADOR DE TELAS =================
window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo(0, 0);

    localStorage.setItem('trem_tela_ativa', id);

    // Call renders safely
    const safeCall = (fn) => { if (typeof fn === 'function') fn(); };

    if (id === 'tela-cadastro-produtos') safeCall(window.renderizarProdutosAdmin);
    if (id === 'tela-usuarios') safeCall(window.renderizarUsuarios);
    if (id === 'tela-receitas') safeCall(window.renderizarReceitasAdmin);
    if (id === 'tela-vagoes') safeCall(window.renderizarVagoesAdmin);
    if (id === 'tela-estoques') safeCall(window.abrirTelaEstoques);
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
    const telasAdmin = ['tela-admin', 'tela-carga-vagao', 'tela-receitas', 'tela-estoques', 'tela-vagoes', 'tela-usuarios', 'tela-cadastro-produtos', 'tela-relatorios'];

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
function iniciarSincronizacaoNuvem() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        if (!snapshot.empty) {
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
    });

    onSnapshot(collection(db, "receitas_carga"), (snapshot) => {
        if (!snapshot.empty) {
            window.receitasDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_receitas', JSON.stringify(window.receitasDB));
            if (document.getElementById('tela-receitas')?.classList.contains('ativa')) window.renderizarReceitasAdmin();
        }
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        if (!snapshot.empty) {
            window.usuariosDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_usuarios', JSON.stringify(window.usuariosDB));
            const telaAtiva = document.querySelector('.tela.ativa')?.id;
            if (telaAtiva === 'tela-usuarios') window.renderizarUsuarios();
            if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
            if (telaAtiva === 'tela-setup-carrinho') window.abrirSetupCarrinho();
        }
    });

    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        if (!snapshot.empty) {
            window.vagoesDB = snapshot.docs.map(d => d.data());
            localStorage.setItem('trem_cache_vagoes', JSON.stringify(window.vagoesDB));
            const telaAtiva = document.querySelector('.tela.ativa')?.id;
            if (telaAtiva === 'tela-vagoes') window.renderizarVagoesAdmin();
            if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
            if (telaAtiva === 'tela-operacao-viagem') window.carregarMonitorViagem();
        }
    });

    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_contagens', JSON.stringify(window.contagensDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) window.renderizarRelatoriosAdmin();
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });

    onSnapshot(collection(db, "cargas_vagoes"), (snapshot) => {
        window.cargasVagoesDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas_vagoes', JSON.stringify(window.cargasVagoesDB));
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa')) window.carregarManifestoPublico(false);
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
    window.produtosDB.forEach(p => {
        totalUnBaga += (p.estoqueBagageiroUnidades || 0);
        totalUnCont += (p.estoqueContainerUnidades || 0);
    });
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

    if (window.receitasDB.length === 0) {
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
                        <button class="btn btn-secondary btn-pequeno" onclick="abrirModalReceita('${r.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                        <button class="btn btn-danger btn-pequeno" onclick="excluirReceita('${r.id}')"><i class="ph ph-trash"></i></button>
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
    setTimeout(() => window.focarProximo('modalReceitaNome'), 100);
};

window.salvarReceitaModal = async function() {
    const idOriginal = document.getElementById('modalReceitaIdOriginal').value;
    const nome = document.getElementById('modalReceitaNome').value.trim();

    if (!nome) return alert("Digite o nome da Receita!");

    let itens = {};
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
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
    alert("Receita de carga salva com sucesso!");
    window.renderizarReceitasAdmin();
};

window.excluirReceita = async function(id) {
    if (confirm("Deseja realmente excluir esta receita de carga?")) {
        await deleteDoc(doc(db, "receitas_carga", id));
    }
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

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong style="font-size:16px;">Placa ${v.numero} - ${v.nome}</strong>
                    <br><span style="color:${corTipo}; font-weight:700; font-size:12px; text-transform:uppercase;">[${v.tipo}]</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-pequeno" onclick="abrirModalVagao('${v.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                    <button class="btn btn-danger btn-pequeno" onclick="excluirVagao('${v.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.abrirModalVagao = function(id = null) {
    const boxChecks = document.getElementById('boxCheckboxesBebidasVagao');
    boxChecks.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    let permitidas = [];
    if (id) {
        const v = window.vagoesDB.find(x => x.id === id);
        if (!v) return;
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Vagão';
        document.getElementById('modalVagaoIdOriginal').value = v.id;
        document.getElementById('modalVagaoNumero').value = v.numero;
        document.getElementById('modalVagaoNome').value = v.nome;
        document.getElementById('modalVagaoTipo').value = v.tipo || 'turistico';
        permitidas = v.bebidasPermitidas || [];
    } else {
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Vagão';
        document.getElementById('modalVagaoIdOriginal').value = "";
        document.getElementById('modalVagaoNumero').value = "";
        document.getElementById('modalVagaoNome').value = "";
        document.getElementById('modalVagaoTipo').value = "turistico";
        permitidas = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'];
    }

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

    const selecionadas = [];
    document.querySelectorAll('#boxCheckboxesBebidasVagao input:checked').forEach(c => selecionadas.push(c.value));

    if (!numero || !nome) return alert("Preencha a Placa/Número e o Nome do Vagão!");

    const idFinal = idOriginal || ("vagao_" + Date.now().toString());
    await setDoc(doc(db, "vagoes", idFinal), {
        id: idFinal,
        numero: window.escapeHTML(numero),
        nome: window.escapeHTML(nome),
        tipo: tipo,
        bebidasPermitidas: selecionadas
    }, { merge: true });

    window.fecharModal('modal-vagao');
    alert("Vagão salvo com sucesso!");
};

window.excluirVagao = async function(id) {
    if (confirm("Tem certeza que deseja excluir este vagão da frota?")) {
        await deleteDoc(doc(db, "vagoes", id));
    }
};

// ================= CARGA POR VAGÃO (SEPARADA & COM RECEITAS) =================
window.renderizarVagoesParaCarga = function() {
    const div = document.getElementById('listaVagoesParaCarga');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('dataCargaPorVagao');
    if (!elData.value) elData.value = new Date().toISOString().split('T')[0];
    const dataSel = elData.value;

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        // Verifica se já existe carga lançada hoje para este vagão
        const cargaExistente = window.cargasVagoesDB.find(c => c.data === dataSel && c.vagaoId === v.id);
        const corCard = cargaExistente ? 'border-left: 6px solid var(--success);' : 'border-left: 6px solid var(--secondary);';
        const txtStatus = cargaExistente ? '<span style="color:var(--success); font-weight:700; font-size:12px;">✔ Carga Lançada</span>' : '<span style="color:var(--secondary); font-size:12px;">Pendente</span>';

        div.innerHTML += `
            <div class="card" style="${corCard} padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="abrirModalMontarCargaVagao('${v.id}')">
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

    // Dropdown de receitas
    const selRec = document.getElementById('modalMcvReceitaSelect');
    selRec.innerHTML = '<option value="">-- Nenhuma (Preencher Manual) --</option>';
    window.receitasDB.forEach(r => {
        selRec.innerHTML += `<option value="${r.id}">${r.nome}</option>`;
    });

    if (cargaExistente) {
        document.getElementById('modalMcvObs').value = cargaExistente.obs || "";
        selRec.value = ""; // Se já tem carga, não aplica receita automática
    } else {
        // Se o vagão tem receita vinculada, seleciona e aplica
        if (vagao.receitaId) {
            selRec.value = vagao.receitaId;
        }
    }

    renderizarItensModalCargaVagao(cargaExistente);
    window.abrirModal('modal-montar-carga-vagao');
};

window.aplicarReceitaNaCargaModal = function() {
    renderizarItensModalCargaVagao(null); // Recarrega usando a receita do select
};

function renderizarItensModalCargaVagao(cargaExistente) {
    const div = document.getElementById('modalMcvListaItens');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    const receitaId = document.getElementById('modalMcvReceitaSelect').value;
    const receitaObj = window.receitasDB.find(r => r.id === receitaId);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        let valTotal = 0;
        let valBaga = 0;

        if (cargaExistente && cargaExistente.itens && cargaExistente.itens[p.id]) {
            valTotal = cargaExistente.itens[p.id].qtd || 0;
            valBaga = cargaExistente.itens[p.id].baga || 0;
        } else if (receitaObj && receitaObj.itens && receitaObj.itens[p.id]) {
            valTotal = receitaObj.itens[p.id];
        }

        if (receitaObj && valTotal === 0 && !cargaExistente) return; // Hide items not in recipe to keep it clean

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div>
                    <strong style="font-size:14px; color:var(--primary);">${p.id}</strong><br>
                    <span style="font-size:12px; color:var(--secondary);">${p.nome}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:10px; font-weight:bold; color:var(--secondary);">Total:</span>
                        <input type="number" id="mcv_tot_${p.id}" value="${valTotal}" min="0" style="width:65px; padding:6px; font-weight:700;">
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:10px; font-weight:bold; color:var(--bagageiro-color);">Do Baga:</span>
                        <input type="number" id="mcv_bag_${p.id}" value="${valBaga}" min="0" style="width:65px; padding:6px; font-weight:700;">
                    </div>
                </div>
            </div>
        `;
    });
}

window.salvarCargaVagaoModal = async function() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const data = document.getElementById('dataCargaPorVagao').value;
    const obs = document.getElementById('modalMcvObs').value.trim();
    const cargaAntiga = window.cargasVagoesDB.find(c => c.data === data && c.vagaoId === vagaoId);
    
    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const totEl = document.getElementById(`mcv_tot_${p.id}`);
        const bagEl = document.getElementById(`mcv_bag_${p.id}`);
        if (!totEl || !bagEl) continue;

        const total = parseInt(totEl.value) || 0;
        const baga = parseInt(bagEl.value) || 0;
        const cont = Math.max(0, total - baga);
        const unFardo = p.unidadesPorFardo || 1;

        if (total > 0 || (cargaAntiga && cargaAntiga.itens?.[p.id])) {
            itensSalvos[p.id] = { qtd: total, baga, cont };

            const antigoCont = cargaAntiga?.itens?.[p.id]?.cont || 0;
            const antigoBaga = cargaAntiga?.itens?.[p.id]?.baga || 0;

            const difCont = cont - antigoCont;
            const difBaga = baga - antigoBaga;

            if (difCont !== 0 || difBaga !== 0) {
                const pRef = doc(db, "produtos", p.id);
                batch.update(pRef, {
                    estoqueContainerUnidades: increment(-(difCont * unFardo)),
                    estoqueBagageiroUnidades: increment(-(difBaga * unFardo))
                });
            }
        }
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
    alert("Carga do vagão confirmada e estoques atualizados!");
    window.renderizarVagoesParaCarga();
};

// ================= MONITOR DE OPERAÇÃO DE VIAGEM =================
function getEstadoViagemHoje(dataHoje) {
    if (!window.viagensStatusDB[dataHoje]) {
        window.viagensStatusDB[dataHoje] = {
            etapa: 'preparacao',
            sentido: 'Ida',
            reforcos: {}
        };
    }
    return window.viagensStatusDB[dataHoje];
}

window.carregarMonitorViagem = function() {
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);

    const elEtapa = document.getElementById('lblEtapaViagemTexto');
    const elSentido = document.getElementById('badgeSentidoAtivo');
    
    if (estado.etapa === 'preparacao') {
        elEtapa.innerText = "Em Preparação (Curitiba)";
        elSentido.innerText = "Ida";
    } else if (estado.etapa === 'ida') {
        elEtapa.innerText = "Viagem de IDA em Andamento";
        elSentido.innerText = "Ida";
    } else if (estado.etapa === 'morretes') {
        elEtapa.innerText = "Trem em Morretes (Preparando Retorno)";
        elSentido.innerText = "Retorno";
    } else if (estado.etapa === 'volta') {
        elEtapa.innerText = "Viagem de VOLTA em Andamento";
        elSentido.innerText = "Volta";
    } else {
        elEtapa.innerText = "Viagem Finalizada (Curitiba)";
        elSentido.innerText = "Finalizado";
    }

    const grid = document.getElementById('gridVagoesOperacao');
    if (!grid) return;
    grid.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
        const estaAberto = (estado.etapa === 'ida' || estado.etapa === 'volta') && !contagemFechada;
        const statusTexto = contagemFechada ? `✔ Fechado (${estado.sentido})` : (estaAberto ? `🟢 Aberto (${estado.sentido})` : `Aguardando`);
        const classeCard = contagemFechada ? 'vagao-fechado' : (estaAberto ? 'vagao-aberto' : '');
        const badgeStatus = contagemFechada ? 'status-fechado' : (estaAberto ? 'status-aberto' : '');

        grid.innerHTML += `
            <div class="card-vagao-status ${classeCard}" onclick="abrirModalVagaoOperacao('${v.id}')">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <strong style="font-size:16px;">Placa ${v.numero} - ${v.nome}</strong>
                        <span class="badge-tag-status ${badgeStatus}">${statusTexto}</span>
                    </div>
                    <small style="color:var(--secondary); text-transform:uppercase; font-weight:700; font-size:12px;">[${v.tipo}]</small>
                </div>
                <div style="margin-top:10px; font-size:12px; color:var(--primary); font-weight:600;">
                    ${estaAberto ? '<i class="ph ph-hand-pointing"></i> Abrir e adicionar reforço' : '<i class="ph ph-check"></i> Contagem concluída'}
                </div>
            </div>
        `;
    });
};

window.iniciarViagemIda = async function() {
    if (!confirm("Iniciar oficialmente a Viagem de IDA?")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'ida';
    estado.sentido = 'Ida';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

window.prepararRetornoMorretes = async function() {
    if (!confirm("O trem chegou em Morretes?")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'morretes';
    estado.sentido = 'Volta';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

window.iniciarViagemVolta = async function() {
    if (!confirm("Iniciar oficialmente a Viagem de VOLTA para Curitiba?")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'volta';
    estado.sentido = 'Volta';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

window.abrirModalVagaoOperacao = function(vagaoId) {
    const v = window.vagoesDB.find(x => x.id === vagaoId);
    if (!v) return;

    window.vagaoOperacaoSelecionadoId = vagaoId;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);

    document.getElementById('modalOpVagaoNome').innerText = `Placa ${v.numero} - ${v.nome}`;

    const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
    const estaAberto = (estado.etapa === 'ida' || estado.etapa === 'volta') && !contagemFechada;

    const elStatus = document.getElementById('modalOpVagaoStatus');
    elStatus.innerText = contagemFechada ? `FECHADO` : (estaAberto ? `ABERTO` : `AGUARDANDO`);
    elStatus.style.color = estaAberto ? 'var(--success)' : 'var(--secondary)';

    // Select de reforço
    const selReforco = document.getElementById('modalOpSelectBebidaReforco');
    selReforco.innerHTML = "";
    
    const permitidas = v.bebidasPermitidas || [];
    const prodsVagao = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    prodsVagao.forEach(p => {
        selReforco.innerHTML += `<option value="${p.id}">${p.id} - ${p.nome} (Bagageiro: ${p.estoqueBagageiroUnidades || 0} un)</option>`;
    });

    const divReforcos = document.getElementById('modalOpListaReforcosFeitos');
    divReforcos.innerHTML = "";
    const lista = estado.reforcos?.[vagaoId] || [];
    if (lista.length === 0) {
        divReforcos.innerHTML = '<span style="color:var(--secondary); font-style:italic;">Nenhum reforço pego.</span>';
    } else {
        lista.forEach(r => {
            divReforcos.innerHTML += `<div style="color:var(--accent); font-weight:700;">+ ${r.qtd}x ${r.bebidaId} às ${r.hora}</div>`;
        });
    }

    window.abrirModal('modal-vagao-operacao');
};

window.adicionarReforcoVagao = async function() {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const bebidaId = document.getElementById('modalOpSelectBebidaReforco').value;
    const qtd = parseInt(document.getElementById('modalOpQtdReforco').value) || 1;

    if (!bebidaId || qtd < 1) return alert("Selecione uma bebida e quantidade válida!");

    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    if (!estado.reforcos[vagaoId]) estado.reforcos[vagaoId] = [];

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    estado.reforcos[vagaoId].push({ bebidaId, qtd, hora: horaAtual });

    const pRef = doc(db, "produtos", bebidaId);
    await updateDoc(pRef, { estoqueBagageiroUnidades: increment(-qtd) });

    await setDoc(doc(db, "viagens_status", hj), estado);
    document.getElementById('modalOpQtdReforco').value = 1;
    
    alert(`Reforço de +${qtd} unidades abatido do Bagageiro com sucesso!`);
    window.fecharModal('modal-vagao-operacao');
};

// ================= BOUTIQUES HUB (SOBRAS & RETORNO) =================
window.carregarSelectBoutiqueHub = function() {
    const sel = document.getElementById('selectVagaoBoutiqueHub');
    if (!sel) return;
    sel.innerHTML = "";

    const vagoesBoutLito = window.vagoesDB.filter(v => v.tipo === 'boutique' || v.tipo === 'litorina')
        .sort((a,b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesBoutLito.forEach(v => {
        sel.innerHTML += `<option value="${v.id}">Placa ${v.numero} - ${v.nome} [${v.tipo.toUpperCase()}]</option>`;
    });

    const hj = new Date().toISOString().split('T')[0];
    const dtEl = document.getElementById('dataBoutiqueHub');
    if (dtEl && !dtEl.value) dtEl.value = hj;
};

window.carregarFormularioBoutiqueHub = function() {
    const area = document.getElementById('areaFormBoutiqueHub');
    if (!area) return;
    area.innerHTML = "";

    const etapa = document.getElementById('etapaBoutiqueHub').value;
    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);
    
    ordenarPorRegra(window.produtosDB);
    const permitidas = vagaoObj?.bebidasPermitidas || [];
    const prods = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    if (etapa === 'morretes_sem_retorno' || etapa === 'curitiba_final') {
        const titulo = etapa === 'morretes_sem_retorno' ? 'Baixar Sobras (Sem Retorno)' : 'Fechamento Final das Sobras';
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">${titulo}</h4>`;

        prods.forEach(p => {
            htmlItens += `
                <div class="item-contagem" style="padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.id} - ${p.nome}</strong>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:var(--secondary);">Sobrou:</span>
                        <input type="number" id="boutique_sobra_${p.id}" placeholder="0" min="0" style="width:80px; text-align:center; padding:8px; font-weight:bold;">
                    </div>
                </div>
            `;
        });
        htmlItens += `<button class="btn btn-success btn-lg" style="margin-top:15px;" onclick="salvarSobrasBoutiqueDirect()"><i class="ph ph-check-circle"></i> Creditar Sobras no Bagageiro</button>`;
        area.innerHTML = htmlItens;

    } else if (etapa === 'morretes_com_retorno') {
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">Ajuste de Carga (Retorno)</h4>`;

        prods.forEach(p => {
            htmlItens += `
                <div class="item-contagem">
                    <div class="item-contagem-header"><span>${p.id} - ${p.nome}</span></div>
                    <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                        <div>
                            <label>Sobrou da Ida:</label>
                            <input type="number" id="boutique_ida_sobra_${p.id}" placeholder="0" min="0">
                        </div>
                        <div>
                            <label>Ajuste (+ ou -):</label>
                            <input type="number" id="boutique_ajuste_ret_${p.id}" placeholder="Ex: +6 ou -4">
                        </div>
                    </div>
                </div>
            `;
        });
        htmlItens += `<button class="btn btn-primary btn-lg" style="margin-top:15px;" onclick="salvarAjusteRetornoBoutique()"><i class="ph ph-check-circle"></i> Confirmar Carga do Retorno</button>`;
        area.innerHTML = htmlItens;
    }
};

window.salvarSobrasBoutiqueDirect = async function() {
    const data = document.getElementById('dataBoutiqueHub').value;
    const batch = writeBatch(db);
    let totalSobras = 0;

    window.produtosDB.forEach(p => {
        const qtd = parseInt(document.getElementById(`boutique_sobra_${p.id}`)?.value) || 0;
        if (qtd > 0) {
            totalSobras += qtd;
            batch.update(doc(db, "produtos", p.id), { estoqueBagageiroUnidades: increment(qtd) });
        }
    });

    await batch.commit();
    alert(`Sucesso! ${totalSobras} unidades creditadas no Bagageiro.`);
    window.mostrarTela('tela-inicial');
};

window.salvarAjusteRetornoBoutique = async function() {
    const batch = writeBatch(db);
    
    window.produtosDB.forEach(p => {
        const ajuste = parseInt(document.getElementById(`boutique_ajuste_ret_${p.id}`)?.value) || 0;
        if (ajuste !== 0) {
            // Se ajuste > 0: pegou do bagageiro (-ajuste). Se < 0: devolveu pro bagageiro (+ |ajuste|).
            batch.update(doc(db, "produtos", p.id), { estoqueBagageiroUnidades: increment(-ajuste) });
        }
    });

    await batch.commit();
    alert("Carga de retorno configurada e Bagageiro atualizado!");
    window.mostrarTela('tela-inicial');
};

// ================= ABA PÚBLICA: VER CARGA DO TREM =================
window.carregarManifestoPublico = function(forcarUltima = false) {
    const div = document.getElementById('conteudoManifestoPublico');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('filtroDataManifesto');

    if (!window.cargasVagoesDB || window.cargasVagoesDB.length === 0) {
        div.innerHTML = `<div style="text-align:center; padding:35px 15px; color:var(--secondary);"><p>Nenhuma carga registrada.</p></div>`;
        return;
    }

    const cargasOrd = [...window.cargasVagoesDB].sort((a, b) => b.data.localeCompare(a.data) || (b.timestamp||0) - (a.timestamp||0));
    let dataSel = elData ? elData.value : "";
    if (forcarUltima || !dataSel) {
        dataSel = cargasOrd[0] ? cargasOrd[0].data : new Date().toISOString().split('T')[0];
        if (elData) elData.value = dataSel;
    }

    const cargasDoDia = window.cargasVagoesDB.filter(c => c.data === dataSel);

    if (cargasDoDia.length === 0) {
        div.innerHTML = `<div style="text-align:center; padding:30px 15px; color:var(--secondary);"><p>Nenhuma escala para <strong>${dataSel.split('-').reverse().join('/')}</strong>.</p></div>`;
        return;
    }

    div.innerHTML = `<h3 style="color:var(--primary); font-size:18px; margin-bottom:12px;"><i class="ph ph-train"></i> Escala Oficial (${dataSel.split('-').reverse().join('/')})</h3>`;

    cargasDoDia.forEach(carga => {
        const vObj = window.vagoesDB.find(v => v.id === carga.vagaoId) || { numero: '?', nome: 'Desconhecido' };
        
        let itensList = [];
        for(let sigla in carga.itens) {
            if(carga.itens[sigla].qtd > 0) {
                itensList.push(`<b>${carga.itens[sigla].qtd}x</b> ${sigla}`);
            }
        }

        div.innerHTML += `
            <div class="manifesto-card">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:12px;">
                    <span style="font-weight:800; font-size:16px;">Placa ${vObj.numero} - ${vObj.nome}</span>
                </div>
                <div style="font-size:14px; line-height:1.6; color:var(--text);">
                    ${itensList.join(' &bull; ')}
                </div>
                ${carga.obs ? `<div class="manifesto-obs-box"><i class="ph ph-star-fill"></i> ${window.escapeHTML(carga.obs)}</div>` : ''}
            </div>
        `;
    });
};

// ================= GESTÃO DE RASCUNHOS =================
window.salvarDraftEstoque = function() {
    const draft = {};
    window.produtosDB.forEach(p => {
        draft[p.id] = {
            cFd: document.getElementById(`est_cont_fd_${p.id}`)?.value || "",
            cUn: document.getElementById(`est_cont_un_${p.id}`)?.value || "",
            bFd: document.getElementById(`est_baga_fd_${p.id}`)?.value || "",
            bUn: document.getElementById(`est_baga_un_${p.id}`)?.value || ""
        };
    });
    localStorage.setItem('trem_draft_estoque', JSON.stringify(draft));
};

window.limparDraftEstoque = function() {
    if (confirm("Deseja descartar o rascunho atual?")) {
        localStorage.removeItem('trem_draft_estoque');
        window.abrirTelaEstoques();
    }
};

window.salvarDraftContagem = function() {
    const draft = {
        apoio: document.getElementById('selectNomeApoio')?.value || "",
        data: document.getElementById('dataContagemApoio')?.value || "",
        sentido: document.getElementById('selectSentidoApoio')?.value || "",
        vagaoId: document.getElementById('selectVagaoApoio')?.value || "",
        guia: document.getElementById('nomeGuiaApoio')?.value || "",
        itens: {}
    };
    window.produtosDB.forEach(p => {
        draft.itens[p.id] = {
            carga: document.getElementById(`carga_${p.id}`)?.value || "",
            saldo: document.getElementById(`saldo_${p.id}`)?.value || "",
            trip: document.getElementById(`trip_${p.id}`)?.value || "",
            ava: document.getElementById(`ava_${p.id}`)?.value || ""
        };
    });
    localStorage.setItem('trem_draft_contagem', JSON.stringify(draft));
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
                            <div><span>[ Fardos ]</span><input type="number" id="est_cont_fd_${p.id}" value="${valCFd}" min="0" oninput="salvarDraftEstoque()"></div>
                            <div><span>[ + Unidades ]</span><input type="number" id="est_cont_un_${p.id}" value="${valCUn}" min="0" oninput="salvarDraftEstoque()"></div>
                        </div>
                    </div>
                    <div class="box-ajuste-col box-ajuste-baga">
                        <label style="color:var(--bagageiro-color);"><i class="ph ph-bag"></i> Bagageiro:</label>
                        <div class="input-unidade-group">
                            <div><span>[ Fardos ]</span><input type="number" id="est_baga_fd_${p.id}" value="${valBFd}" min="0" oninput="salvarDraftEstoque()"></div>
                            <div><span>[ + Unidades ]</span><input type="number" id="est_baga_un_${p.id}" value="${valBUn}" min="0" oninput="salvarDraftEstoque()"></div>
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

    await batch.commit();
    localStorage.removeItem('trem_draft_estoque');
    window.fecharModal('modal-confirma-estoque');
    alert("Estoques atualizados!");
    window.abrirTelaEstoques();
};

// ================= CONTAGEM DE VAGÃO (APOIO COM MATEMÁTICA AUTOMÁTICA) =================
window.abrirSetupContagem = function() {
    const selUser = document.getElementById('selectNomeApoio');
    if (selUser) {
        selUser.innerHTML = "";
        [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => {
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
    if (!guia) return alert("Preencha o Nome do Guia!");

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

    // Procura a carga que o chefe lançou para este vagão nesta data
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
    const produtosFiltrados = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    produtosFiltrados.forEach(p => {
        // Carga padrão vem da Carga do Chefe, se não houver, vem 0.
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
                        <input type="number" id="carga_${p.id}" value="${valCarga}" data-carga-original="${cargaBase}" onfocus="this.select()" oninput="calcularConsumo('${p.id}'); salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Sobra (Saldo):</label>
                        <input type="number" id="saldo_${p.id}" value="${valSaldo}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularConsumo('${p.id}'); salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Pax (Auto):</label>
                        <input type="number" id="pax_${p.id}" class="input-pax" readonly value="${valCarga}">
                    </div>
                    <div>
                        <label>Tripulação:</label>
                        <input type="number" id="trip_${p.id}" value="${valTrip}" onfocus="this.select()" oninput="calcularConsumo('${p.id}'); salvarDraftContagem();">
                    </div>
                    <div>
                        <label>Avaria:</label>
                        <input type="number" id="ava_${p.id}" class="input-avaria" value="${valAva}" onfocus="this.select()" oninput="calcularConsumo('${p.id}'); salvarDraftContagem();">
                    </div>
                </div>
            </div>
        `;
    });

    produtosFiltrados.forEach(p => calcularConsumo(p.id));
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

        let obj = {
            id: p.id,
            nome: p.nome,
            cargaOriginal: parseInt(elCarga.getAttribute('data-carga-original')) || parseInt(elCarga.value) || 0,
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
        
        // MATEMÁTICA DE BAGAGEIRO DO APOIO:
        // Se a carga atual é maior que a oficial do chefe, a diferença foi pega do bagageiro.
        const extraPego = Math.max(0, item.carga - item.cargaOriginal);
        // O que o bagageiro ganha é o que sobrou menos o que foi pego extra
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
    alert("Contagem registrada! O estoque do Bagageiro foi atualizado (Sobra - Extras pegos).");
    window.contagemTemp = {};
    window.mostrarTela('tela-inicial');
};

// ================= RELATÓRIOS DO CHEFE =================
window.setModoRelatorio = function(modo) {
    window.modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelBoutLito', 'btnRelVendas'].forEach(id => {
        document.getElementById(id)?.classList.remove('ativo');
    });
    if (modo === 'todos') document.getElementById('btnRelVagao')?.classList.add('ativo');
    if (modo === 'turisticos') document.getElementById('btnRelTur')?.classList.add('ativo');
    if (modo === 'boutiques_litorinas') document.getElementById('btnRelBoutLito')?.classList.add('ativo');
    if (modo === 'vendas') document.getElementById('btnRelVendas')?.classList.add('ativo');
    window.renderizarRelatoriosAdmin();
};

window.setFiltroSentido = function(sentido) {
    window.filtroSentidoRelatorio = sentido;
    ['btnSentidoTodos', 'btnSentidoIda', 'btnSentidoVolta'].forEach(id => {
        document.getElementById(id)?.classList.remove('ativo');
    });
    if (sentido === 'todos') document.getElementById('btnSentidoTodos')?.classList.add('ativo');
    if (sentido === 'Ida') document.getElementById('btnSentidoIda')?.classList.add('ativo');
    if (sentido === 'Volta') document.getElementById('btnSentidoVolta')?.classList.add('ativo');
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
            vendas = vendas.filter(v => v.sentido === window.filtroSentidoRelatorio);
        }

        if (vendas.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda de carrinho com estes filtros.</p>';
            return;
        }

        vendas.forEach(v => {
            let extrasHtml = (v.extras || []).map(e => `<li>${e.qtd}x ${e.nome}</li>`).join('');
            div.innerHTML += `
                <div class="card" style="border-left:5px solid #0e7068; padding:14px; margin-bottom:12px;">
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
        filtrados = filtrados.filter(c => c.sentido === window.filtroSentidoRelatorio);
    }

    if (window.modoRelatorioAdmin === 'turisticos') {
        filtrados = filtrados.filter(c => c.vagaoTipo === 'turistico' || c.vagaoTipo === 'economico');
    } else if (window.modoRelatorioAdmin === 'boutiques_litorinas') {
        filtrados = filtrados.filter(c => c.vagaoTipo === 'boutique' || c.vagaoTipo === 'litorina');
    }

    if (filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado.</p>';
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
                    <button class="btn btn-secondary btn-pequeno" onclick="abrirModalEdicaoRelatorio('${c.id}')"><i class="ph ph-pencil-simple"></i> Corrigir</button>
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

// INICIALIZAÇÃO OBRIGATÓRIA E BLINDADA
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
