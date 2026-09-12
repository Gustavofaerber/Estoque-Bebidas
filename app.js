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

// Catálogo padrão de segurança caso a nuvem esteja vazia
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

// Frota oficial com separação das bebidas de cada categoria
const frotaInicialPadrao = [
    { id: '11', numero: '11', nome: 'Turístico 11', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '12', numero: '12', nome: 'Turístico 12', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '13', numero: '13', nome: 'Turístico 13', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '14', numero: '14', nome: 'Turístico 14', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '15', numero: '15', nome: 'Turístico 15', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '16', numero: '16', nome: 'Turístico 16', tipo: 'turistico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '01', numero: '01', nome: 'Econômico 1', tipo: 'economico', bebidasPermitidas: ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'] },
    { id: '18', numero: '18', nome: 'Foz do Iguaçu', tipo: 'boutique', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '20', numero: '20', nome: 'Curitiba', tipo: 'boutique', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Cam', numero: 'Cam', nome: 'Camarote', tipo: 'boutique', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Imp', numero: 'Imp', nome: 'Imperial', tipo: 'boutique', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: 'Bar', numero: 'Bar', nome: 'Vagão Bar', tipo: 'boutique', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '7000', numero: '7000', nome: 'Litorina 7000', tipo: 'litorina', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] },
    { id: '7001', numero: '7001', nome: 'Litorina 7001', tipo: 'litorina', bebidasPermitidas: ['Cp', 'Zp', 'Gp', 'Fgp', 'Am', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Esp', 'Gelo'] }
];

window.produtosDB = getCache('trem_cache_produtos', catalogoInicial);
window.usuariosDB = getCache('trem_cache_usuarios', [{ id: '1', nome: 'Gustavo' }, { id: '2', nome: 'Joel' }]);
window.vagoesDB = getCache('trem_cache_vagoes', frotaInicialPadrao);
window.contagensDB = getCache('trem_cache_contagens', []);
window.cargasDiaDB = getCache('trem_cache_cargas', []);
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

    if (id === 'tela-cadastro-produtos') window.renderizarProdutosAdmin();
    if (id === 'tela-usuarios') window.renderizarUsuarios();
    if (id === 'tela-vagoes') window.renderizarVagoesAdmin();
    if (id === 'tela-estoques') window.abrirTelaEstoques();
    if (id === 'tela-carga-dia') window.abrirCargaDoDia();
    if (id === 'tela-ver-carga') window.carregarManifestoPublico(true);
    if (id === 'tela-relatorios') window.renderizarRelatoriosAdmin();
    if (id === 'tela-setup-contagem') window.abrirSetupContagem();
    if (id === 'tela-setup-carrinho') window.abrirSetupCarrinho();
    if (id === 'tela-operacao-viagem') window.carregarMonitorViagem();
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
    atualizarDashboardKPIs();
};

window.logout = function() {
    localStorage.removeItem('trem_chefe_sessao');
    localStorage.removeItem('trem_tela_ativa');
    window.mostrarTela('tela-inicial');
};

function restaurarSessaoOuTela() {
    const telaSalva = localStorage.getItem('trem_tela_ativa');
    const chefeLogado = localStorage.getItem('trem_chefe_sessao') === 'ativo';
    const telasAdmin = ['tela-admin', 'tela-carga-dia', 'tela-estoques', 'tela-vagoes', 'tela-usuarios', 'tela-cadastro-produtos', 'tela-relatorios'];

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
    // 1. Produtos
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        if (snapshot.empty) {
            catalogoInicial.forEach(async p => await setDoc(doc(db, "produtos", p.id), p));
            window.produtosDB = catalogoInicial;
        } else {
            window.produtosDB = snapshot.docs.map(d => {
                const data = d.data();
                if (data.ordem === undefined || data.ordem === null) {
                    const idx = ORDEM_PADRAO_CHEFE.indexOf(data.id);
                    data.ordem = idx !== -1 ? idx + 1 : 99;
                }
                return data;
            });
        }
        localStorage.setItem('trem_cache_produtos', JSON.stringify(window.produtosDB));
        atualizarDashboardKPIs();

        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos') window.renderizarProdutosAdmin();
        if (telaAtiva === 'tela-estoques') window.renderizarApenasTabelasResumoEstoques();
        if (telaAtiva === 'tela-ver-carga') window.carregarManifestoPublico(false);
        if (telaAtiva === 'tela-operacao-viagem') window.carregarMonitorViagem();
    });

    // 2. Usuários
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

    // 3. Vagões
    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        if (snapshot.empty) {
            frotaInicialPadrao.forEach(async v => await setDoc(doc(db, "vagoes", v.id), v));
            window.vagoesDB = frotaInicialPadrao;
        } else {
            window.vagoesDB = snapshot.docs.map(d => d.data());
        }
        localStorage.setItem('trem_cache_vagoes', JSON.stringify(window.vagoesDB));
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-vagoes') window.renderizarVagoesAdmin();
        if (telaAtiva === 'tela-setup-contagem') window.abrirSetupContagem();
        if (telaAtiva === 'tela-operacao-viagem') window.carregarMonitorViagem();
    });

    // 4. Contagens
    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_contagens', JSON.stringify(window.contagensDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) window.renderizarRelatoriosAdmin();
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });

    // 5. Cargas do Dia
    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas', JSON.stringify(window.cargasDiaDB));
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa')) window.carregarManifestoPublico(false);
        if (document.getElementById('tela-carga-dia')?.classList.contains('ativa')) verificarStatusEdicaoCarga();
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });

    // 6. Vendas Carrinho
    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_vendas', JSON.stringify(window.vendasCarrinhoDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) window.renderizarRelatoriosAdmin();
    });

    // 7. Status da Viagem
    onSnapshot(collection(db, "viagens_status"), (snapshot) => {
        snapshot.docs.forEach(d => {
            window.viagensStatusDB[d.id] = d.data();
        });
        localStorage.setItem('trem_cache_viagens_status', JSON.stringify(window.viagensStatusDB));
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa')) window.carregarMonitorViagem();
    });
}

function atualizarDashboardKPIs() {
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
}

// ================= MONITOR DE OPERAÇÃO DE VIAGEM =================
function getEstadoViagemHoje(dataHoje) {
    if (!window.viagensStatusDB[dataHoje]) {
        window.viagensStatusDB[dataHoje] = {
            etapa: 'preparacao', // preparacao, ida, morretes, volta, finalizado
            sentido: 'Ida',
            reforcos: {} // { vagaoId: [ {bebidaId, qtd, hora} ] }
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
        elEtapa.innerText = "Em Preparação (Carregando Trem)";
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
        elEtapa.innerText = "Viagem do Dia Finalizada (Curitiba)";
        elSentido.innerText = "Finalizado";
    }

    const grid = document.getElementById('gridVagoesOperacao');
    grid.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesOrd.forEach(v => {
        // Verifica se já teve contagem fechada hoje para o sentido atual
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
                    ${estaAberto ? '<i class="ph ph-hand-pointing"></i> Clique para ver carga ou reforçar' : '<i class="ph ph-check"></i> Contagem auditada'}
                </div>
            </div>
        `;
    });
};

window.iniciarViagemIda = async function() {
    if (!confirm("Deseja iniciar oficialmente a Viagem de IDA? Todos os vagões ficarão ABERTOS para operação.")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'ida';
    estado.sentido = 'Ida';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

window.prepararRetornoMorretes = async function() {
    if (!confirm("O trem chegou em Morretes? Isso permitirá fechar os vagões que não voltam e preparar a carga das Boutiques que retornam.")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'morretes';
    estado.sentido = 'Volta';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

window.iniciarViagemVolta = async function() {
    if (!confirm("Iniciar oficialmente a Viagem de VOLTA para Curitiba? Os vagões que retornam ficarão ABERTOS.")) return;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);
    estado.etapa = 'volta';
    estado.sentido = 'Volta';
    await setDoc(doc(db, "viagens_status", hj), estado);
    window.carregarMonitorViagem();
};

// Modal de Operação do Vagão Aberto
window.abrirModalVagaoOperacao = function(vagaoId) {
    const v = window.vagoesDB.find(x => x.id === vagaoId);
    if (!v) return;

    window.vagaoOperacaoSelecionadoId = vagaoId;
    const hj = new Date().toISOString().split('T')[0];
    const estado = getEstadoViagemHoje(hj);

    document.getElementById('modalOpVagaoNome').innerText = `Placa ${v.numero} - ${v.nome} [${v.tipo.toUpperCase()}]`;

    const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
    const estaAberto = (estado.etapa === 'ida' || estado.etapa === 'volta') && !contagemFechada;

    const elStatus = document.getElementById('modalOpVagaoStatus');
    elStatus.innerText = contagemFechada ? `FECHADO NA ${estado.sentido.toUpperCase()}` : (estaAberto ? `ABERTO PARA OPERAÇÃO (${estado.sentido})` : `AGUARDANDO INÍCIO DA VIAGEM`);
    elStatus.style.color = estaAberto ? 'var(--success)' : 'var(--secondary)';

    // Lista as bebidas permitidas desse vagão
    const permitidas = v.bebidasPermitidas || [];
    const prodsVagao = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    const divItens = document.getElementById('modalOpListaItens');
    divItens.innerHTML = "";
    ordenarPorRegra(prodsVagao);

    prodsVagao.forEach(p => {
        divItens.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed var(--border); font-size:13px;">
                <strong>${p.id} - ${p.nome}</strong>
                <span style="color:var(--secondary);">${p.unidadesPorFardo} un/fd</span>
            </div>
        `;
    });

    // Select de reforço
    const selReforco = document.getElementById('modalOpSelectBebidaReforco');
    selReforco.innerHTML = "";
    prodsVagao.forEach(p => {
        selReforco.innerHTML += `<option value="${p.id}">${p.id} - ${p.nome} (Baga tem: ${p.estoqueBagageiroUnidades || 0} un)</option>`;
    });

    // Renderiza reforços já feitos em trânsito
    renderizarListaReforcosModal(vagaoId, hj);

    const btnContar = document.getElementById('btnModalIrContarVagao');
    btnContar.disabled = !estaAberto;
    btnContar.style.opacity = estaAberto ? '1' : '0.5';

    window.abrirModal('modal-vagao-operacao');
};

function renderizarListaReforcosModal(vagaoId, hj) {
    const div = document.getElementById('modalOpListaReforcosFeitos');
    div.innerHTML = "";
    const estado = getEstadoViagemHoje(hj);
    const lista = estado.reforcos?.[vagaoId] || [];

    if (lista.length === 0) {
        div.innerHTML = '<span style="color:var(--secondary); font-style:italic;">Nenhum reforço pego do Bagageiro durante esta viagem.</span>';
    } else {
        lista.forEach(r => {
            div.innerHTML += `<div style="color:var(--accent); font-weight:600;">+ ${r.qtd}x ${r.bebidaId} pego às ${r.hora}</div>`;
        });
    }
}

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

    // Abate direto do Bagageiro
    const pRef = doc(db, "produtos", bebidaId);
    await updateDoc(pRef, { estoqueBagageiroUnidades: increment(-qtd) });

    await setDoc(doc(db, "viagens_status", hj), estado);
    document.getElementById('modalOpQtdReforco').value = 1;
    renderizarListaReforcosModal(vagaoId, hj);
    alert(`Reforço de +${qtd} unidades de ${bebidaId} abatido do Bagageiro e lançado no vagão!`);
};

window.irContarVagaoDoModal = function() {
    window.fecharModal('modal-vagao-operacao');
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    window.mostrarTela('tela-setup-contagem');
    const selVagao = document.getElementById('selectVagaoApoio');
    if (selVagao) selVagao.value = vagaoId;
};

// ================= ABA PÚBLICA: VER CARGA DO TREM =================
window.carregarManifestoPublico = function(forcarUltima = false) {
    const div = document.getElementById('conteudoManifestoPublico');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('filtroDataManifesto');

    if (!window.cargasDiaDB || window.cargasDiaDB.length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:35px 15px; color:var(--secondary);">
                <i class="ph ph-circle-notch ph-spin" style="font-size:36px; display:block; margin-bottom:10px; color:var(--primary);"></i>
                <p>Nenhuma carga registrada no momento.</p>
            </div>
        `;
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
        div.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:var(--secondary);">
                <i class="ph ph-calendar-blank" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                <p>Nenhuma escala registrada para <strong>${dataSel ? dataSel.split('-').reverse().join('/') : '--/--/----'}</strong>.</p>
                ${ultimaCarga ? `<button class="btn btn-secondary btn-pequeno" style="margin-top:10px;" onclick="document.getElementById('filtroDataManifesto').value='${ultimaCarga.data}'; carregarManifestoPublico(false);"><i class="ph ph-arrow-counter-clockwise"></i> Ver Carga de ${ultimaCarga.data.split('-').reverse().join('/')}</button>` : ''}
            </div>
        `;
        return;
    }

    let itensOrdenados = Object.keys(carga.itens).map(sigla => {
        const prod = window.produtosDB.find(p => p.id === sigla);
        return {
            sigla,
            ...carga.itens[sigla],
            ordem: carga.itens[sigla].ordem !== undefined ? carga.itens[sigla].ordem : (prod?.ordem ?? 9999)
        };
    });

    itensOrdenados.sort((a, b) => (parseInt(a.ordem) || 9999) - (parseInt(b.ordem) || 9999));

    let linhasHtml = "";
    itensOrdenados.forEach(item => {
        let formulaTexto = "";
        if (item.baga > 0) {
            formulaTexto = `${item.sigla} = ${item.total} - ${item.baga} = <strong>${item.cont} contêiner</strong>`;
        } else {
            formulaTexto = `${item.sigla} = ${item.total} (tudo do contêiner)`;
        }

        linhasHtml += `
            <div class="manifesto-linha">
                <span class="manifesto-formula">${formulaTexto}</span>
                <span class="manifesto-destino">${item.destino ? `(${item.destino})` : ''}</span>
            </div>
        `;
    });

    const isMaisRecente = ultimaCarga && ultimaCarga.data === carga.data;

    div.innerHTML = `
        <div class="manifesto-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:12px;">
                <div>
                    <h3 style="color:var(--primary); font-size:18px; margin:0;"><i class="ph ph-train"></i> Carga Oficial</h3>
                    ${isMaisRecente ? '<span style="background:#dcfce7; color:#15803d; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700;">Última Carga Lançada</span>' : ''}
                </div>
                <div style="text-align:right;">
                    <span style="font-size:12px; color:var(--secondary); display:block;">Para a Viagem:</span>
                    <span style="font-weight:800; color:var(--accent); font-size:16px;">${carga.data.split('-').reverse().join('/')}</span>
                </div>
            </div>
            ${linhasHtml}
            ${carga.obsEspeciais ? `
                <div class="manifesto-obs-box">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:15px;">
                        <i class="ph ph-star-fill"></i> Observações & Extras:
                    </div>
                    ${window.escapeHTML(carga.obsEspeciais)}
                </div>
            ` : ''}
        </div>
    `;
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
    if (confirm("Deseja restaurar os valores originais do estoque descartando o rascunho atual?")) {
        localStorage.removeItem('trem_draft_estoque');
        window.abrirTelaEstoques();
    }
};

window.salvarDraftCarga = function() {
    const draft = {
        data: document.getElementById('dataCargaDia')?.value || "",
        obs: document.getElementById('obsEspeciaisCarga')?.value || "",
        itens: {}
    };
    window.produtosDB.forEach(p => {
        draft.itens[p.id] = {
            total: document.getElementById(`carga_total_${p.id}`)?.value || "",
            baga: document.getElementById(`carga_baga_${p.id}`)?.value || "",
            dest: document.getElementById(`carga_dest_${p.id}`)?.value || "",
            ordem: document.getElementById(`carga_ordem_${p.id}`)?.value || ""
        };
    });
    localStorage.setItem('trem_draft_carga', JSON.stringify(draft));
};

window.limparDraftCarga = function() {
    if (confirm("Deseja zerar os campos da carga do dia?")) {
        localStorage.removeItem('trem_draft_carga');
        window.abrirCargaDoDia();
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

window.salvarDraftCarrinho = function() {
    const draft = {
        data: document.getElementById('dataCarrinho')?.value || "",
        sentido: document.getElementById('sentidoCarrinho')?.value || "",
        apoio: document.getElementById('selectApoioCarrinho')?.value || "",
        troco: document.getElementById('carrinhoTroco')?.value || "",
        itens: {},
        extras: window.itensExtrasCarrinhoTemp || []
    };
    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
        draft.itens[p.id] = {
            saiu: document.getElementById(`venda_saiu_${p.id}`)?.value || "",
            sobrou: document.getElementById(`venda_sobrou_${p.id}`)?.value || ""
        };
    });
    localStorage.setItem('trem_draft_carrinho', JSON.stringify(draft));
};

// ================= CARGA DO DIA (MONTAGEM E EDIÇÃO) =================
window.trocarDataCargaDia = function() {
    localStorage.removeItem('trem_draft_carga');
    window.abrirCargaDoDia();
};

function verificarStatusEdicaoCarga() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    const boxStatus = document.getElementById('statusCargaEdicao');
    if (!boxStatus || !dataSel) return;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
        boxStatus.innerHTML = `
            <div style="background:#fef3c7; border:1.5px solid #fde68a; color:#92400e; padding:10px 14px; border-radius:8px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-pencil-simple-line"></i> Editando Carga Existente de ${dataSel.split('-').reverse().join('/')}.
            </div>
        `;
    } else {
        boxStatus.innerHTML = `
            <div style="background:#e0f2fe; border:1.5px solid #bae6fd; color:#0369a1; padding:10px 14px; border-radius:8px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-plus-circle"></i> Criando Nova Carga para ${dataSel.split('-').reverse().join('/')}.
            </div>
        `;
    }
}

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

    verificarStatusEdicaoCarga();
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
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
                        <input type="number" id="carga_ordem_${p.id}" value="${valOrdem}" style="width:55px; padding:4px 6px; font-size:13px; text-align:center; border-radius:6px;" oninput="salvarDraftCarga()">
                        <strong>${p.nome} (${p.id})</strong>
                    </div>
                    <small style="color:var(--accent); font-size:13px;">Bagageiro: ${bagaDisponivel}</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:8px;">
                    <div>
                        <label>Total Fardos:</label>
                        <input type="number" id="carga_total_${p.id}" value="${valTotal}" min="0" oninput="calcularFormulaLinha('${p.id}'); salvarDraftCarga();">
                    </div>
                    <div>
                        <label>Do Bagageiro:</label>
                        <input type="number" id="carga_baga_${p.id}" value="${valBaga}" min="0" oninput="calcularFormulaLinha('${p.id}'); salvarDraftCarga();">
                    </div>
                    <div>
                        <label>= Contêiner:</label>
                        <input type="number" id="carga_cont_${p.id}" readonly class="input-pax" value="${valCont}">
                    </div>
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:var(--secondary);">Distribuição / Destino:</label>
                    <input type="text" id="carga_dest_${p.id}" value="${valDest}" placeholder="Ex: 1 eco, 2 tur, 3 pls 15 e 17" style="padding:8px 12px; font-size:13px;" oninput="salvarDraftCarga()">
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

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const total = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const baga = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const cont = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;
        const destino = document.getElementById(`carga_dest_${p.id}`)?.value.trim() || "";
        const novaOrdem = parseInt(document.getElementById(`carga_ordem_${p.id}`)?.value) || p.ordem || 99;
        const unFardo = p.unidadesPorFardo || 1;

        if (p.ordem !== novaOrdem) {
            p.ordem = novaOrdem;
            batch.update(doc(db, "produtos", p.id), { ordem: novaOrdem });
        }

        if (total > 0 || (cargaAntiga && cargaAntiga.itens?.[p.id])) {
            itensSalvos[p.id] = { total, baga, cont, destino, ordem: novaOrdem };

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
    alert("Carga do trem salva e atualizada com sucesso no banco de dados!");
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
                                <input type="number" id="est_cont_fd_${p.id}" value="${valCFd}" min="0" oninput="salvarDraftEstoque()">
                            </div>
                            <div>
                                <span>[ + Unidades ]</span>
                                <input type="number" id="est_cont_un_${p.id}" value="${valCUn}" min="0" oninput="salvarDraftEstoque()">
                            </div>
                        </div>
                    </div>
                    <div class="box-ajuste-col box-ajuste-baga">
                        <label style="color:var(--bagageiro-color);"><i class="ph ph-bag"></i> Bagageiro:</label>
                        <div class="input-unidade-group">
                            <div>
                                <span>[ Fardos ]</span>
                                <input type="number" id="est_baga_fd_${p.id}" value="${valBFd}" min="0" oninput="salvarDraftEstoque()">
                            </div>
                            <div>
                                <span>[ + Unidades ]</span>
                                <input type="number" id="est_baga_un_${p.id}" value="${valBUn}" min="0" oninput="salvarDraftEstoque()">
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

        const pRef = doc(db, "produtos", p.id);
        batch.update(pRef, {
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
    alert("Todos os estoques foram atualizados no banco de dados com sucesso!");
    window.abrirTelaEstoques();
};

// ================= PRODUTOS EM MODAL POP-UP =================
window.abrirModalProduto = function(id = null) {
    if (id) {
        const p = window.produtosDB.find(x => x.id === id);
        if (!p) return;
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Produto';
        document.getElementById('modalProdIdOriginal').value = p.id;
        document.getElementById('modalProdSigla').value = p.id;
        document.getElementById('modalProdSigla').disabled = true;
        document.getElementById('modalProdNome').value = p.nome;
        document.getElementById('modalProdUnFardo').value = p.unidadesPorFardo || 12;
        document.getElementById('modalProdPreco').value = p.precoVenda || 0;
        document.getElementById('modalProdOrdem').value = p.ordem !== undefined ? p.ordem : "";
    } else {
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Produto';
        document.getElementById('modalProdIdOriginal').value = "";
        document.getElementById('modalProdSigla').value = "";
        document.getElementById('modalProdSigla').disabled = false;
        document.getElementById('modalProdNome').value = "";
        document.getElementById('modalProdUnFardo').value = "12";
        document.getElementById('modalProdPreco').value = "";
        document.getElementById('modalProdOrdem').value = window.produtosDB.length + 1;
    }

    window.abrirModal('modal-produto');
    setTimeout(() => window.focarProximo(id ? 'modalProdNome' : 'modalProdOrdem'), 100);
};

window.salvarProdutoModal = async function() {
    const idOriginal = document.getElementById('modalProdIdOriginal').value;
    const sigla = document.getElementById('modalProdSigla').value.trim();
    const nome = document.getElementById('modalProdNome').value.trim();
    const unFardo = parseInt(document.getElementById('modalProdUnFardo').value) || 12;
    const preco = parseFloat(document.getElementById('modalProdPreco').value) || 0;
    const ordem = parseInt(document.getElementById('modalProdOrdem').value) || 99;

    if (!sigla || !nome) return alert("Preencha Sigla e Nome!");

    const idFinal = idOriginal || sigla;
    const dados = { id: idFinal, nome: window.escapeHTML(nome), unidadesPorFardo: unFardo, precoVenda: preco, ordem };

    if (!idOriginal) {
        dados.estoqueContainerUnidades = 0;
        dados.estoqueBagageiroUnidades = 0;
    }

    await setDoc(doc(db, "produtos", idFinal), dados, { merge: true });
    window.fecharModal('modal-produto');
    alert("Produto salvo no banco de dados com sucesso!");
};

window.renderizarProdutosAdmin = function() {
    ordenarPorRegra(window.produtosDB);
    const div = document.getElementById('listaProdutosAdmin');
    if (!div) return;
    div.innerHTML = "";
    window.produtosDB.forEach((p) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <span class="badge-ordem">#${p.ordem || '-'}</span>
                    <strong style="font-size:16px;">${p.id}</strong> - ${p.nome} 
                    <br><small style="color:var(--secondary); font-size:13px;">${p.unidadesPorFardo} un/fardo &bull; Preço Venda: <strong>R$ ${window.formatarMoeda(p.precoVenda)}</strong></small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-pequeno" onclick="abrirModalProduto('${p.id}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                    <button class="btn btn-danger btn-pequeno" onclick="removerProduto('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.removerProduto = async function(id) {
    if (confirm("Excluir este produto definitivamente?")) {
        await deleteDoc(doc(db, "produtos", id));
    }
};

// ================= FROTA DE VAGÕES =================
window.renderizarVagoesAdmin = function() {
    const div = document.getElementById('listaVagoesAdmin');
    if (!div) return;
    div.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => {
        const nA = parseInt(a.numero) || 0;
        const nB = parseInt(b.numero) || 0;
        if (nA !== nB) return nA - nB;
        return (a.numero || "").localeCompare(b.numero || "");
    });

    vagoesOrd.forEach(v => {
        let corTipo = "var(--primary)";
        if (v.tipo === 'boutique') corTipo = "var(--accent)";
        if (v.tipo === 'litorina') corTipo = "#862ccb";
        if (v.tipo === 'economico') corTipo = "#475569";

        const qtdBebidas = (v.bebidasPermitidas && v.bebidasPermitidas.length > 0) ? `${v.bebidasPermitidas.length} bebidas ativas` : 'Todas as bebidas';

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong style="font-size:16px;">Nº ${v.numero} - ${v.nome}</strong>
                    <br><span style="color:${corTipo}; font-weight:700; font-size:12px; text-transform:uppercase;">[${v.tipo}]</span>
                    <small style="color:var(--secondary); font-size:12px; margin-left:6px;">&bull; ${qtdBebidas}</small>
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
        // Boutiques e Litorinas: NUNCA carregam Coca Lata grande (C), Guaraná grande (Gg) e Água copo (Acp)
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
    alert("Vagão e lista de bebidas salvas com sucesso!");
};

window.excluirVagao = async function(id) {
    if (confirm("Tem certeza que deseja excluir este vagão da frota?")) {
        await deleteDoc(doc(db, "vagoes", id));
    }
};

// ================= EQUIPE DE APOIOS =================
window.renderizarUsuarios = function() {
    const div = document.getElementById('listaUsuariosAdmin');
    if (!div) return;
    div.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach((u) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 12px 0; border-bottom: 1px solid var(--border); align-items:center;">
                <div style="font-size:15px; font-weight:600;"><i class="ph ph-user"></i> ${u.nome}</div>
                <button class="btn btn-danger btn-pequeno" onclick="removerUsuario('${u.id}')"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
};

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsuarioNome').value.trim();
    if (!nome) return;
    const uid = Date.now().toString();
    await setDoc(doc(db, "usuarios", uid), { id: uid, nome: window.escapeHTML(nome) });
    document.getElementById('novoUsuarioNome').value = "";
};

window.removerUsuario = async function(id) {
    if (confirm("Remover este apoio?")) {
        await deleteDoc(doc(db, "usuarios", id));
    }
};

// ================= CONTAGEM DE VAGÃO =================
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
        const vagoesOrd = [...window.vagoesDB].sort((a, b) => {
            const nA = parseInt(a.numero) || 0;
            const nB = parseInt(b.numero) || 0;
            if (nA !== nB) return nA - nB;
            return (a.numero || "").localeCompare(b.numero || "");
        });

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
    if (!guia) return alert("Por favor, preencha o Nome do Guia!");

    const vagaoId = document.getElementById('selectVagaoApoio').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    window.contagemTemp.apoio = document.getElementById('selectNomeApoio').value;
    window.contagemTemp.guia = window.escapeHTML(guia);
    window.contagemTemp.data = document.getElementById('dataContagemApoio').value;
    window.contagemTemp.sentido = document.getElementById('selectSentidoApoio').value;
    window.contagemTemp.vagaoId = vagaoId;
    window.contagemTemp.vagaoNumero = vagaoObj?.numero || "S/N";
    window.contagemTemp.vagao = `Placa ${vagaoObj?.numero || ''} - ${vagaoObj?.nome || 'Vagão'}`;
    window.contagemTemp.vagaoTipo = vagaoObj?.tipo || 'turistico';

    document.getElementById('lblVagaoContagem').innerText = window.contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = window.contagemTemp.sentido;

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    const draftStr = localStorage.getItem('trem_draft_contagem');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    ordenarPorRegra(window.produtosDB);

    const permitidas = vagaoObj?.bebidasPermitidas || [];
    const produtosFiltrados = window.produtosDB.filter(p => {
        if (p.nome.includes('(Venda)')) return false;
        if (permitidas.length > 0) return permitidas.includes(p.id);
        return true;
    });

    produtosFiltrados.forEach(p => {
        let cargaPadrao = (p.id === 'KL' || p.id === 'Kl') ? 49 : (p.id === 'Ac' || p.id === 'Acp' || p.id === 'C' ? 24 : 0);

        const valCarga = draft?.itens?.[p.id]?.carga !== undefined && draft?.itens?.[p.id]?.carga !== "" ? draft.itens[p.id].carga : cargaPadrao;
        const valSaldo = draft?.itens?.[p.id]?.saldo !== undefined && draft?.itens?.[p.id]?.saldo !== "" ? draft.itens[p.id].saldo : "";
        const valTrip = draft?.itens?.[p.id]?.trip !== undefined && draft?.itens?.[p.id]?.trip !== "" ? draft.itens[p.id].trip : 0;
        const valAva = draft?.itens?.[p.id]?.ava !== undefined && draft?.itens?.[p.id]?.ava !== "" ? draft.itens[p.id].ava : 0;

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (${p.id})</span></div>
                <div class="grid-inputs" style="grid-template-columns: repeat(3, 1fr);">
                    <div>
                        <label>Carga:</label>
                        <input type="number" id="carga_${p.id}" value="${valCarga}" onfocus="this.select()" oninput="calcularConsumo('${p.id}'); salvarDraftContagem();">
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

    let pax = carga - saldo - trip - ava;
    document.getElementById(`pax_${id}`).value = pax < 0 ? 0 : pax;
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

    const boxComparativo = document.getElementById('boxStatusComparativoResumo');
    if (totalLanches === totalBebidas) {
        boxComparativo.className = 'box-comparativo-status kpi-match';
    } else {
        boxComparativo.className = 'box-comparativo-status kpi-divergent';
    }

    document.getElementById('resumoApoio').innerText = window.contagemTemp.apoio;
    document.getElementById('resumoGuia').innerText = window.contagemTemp.guia;
    document.getElementById('resumoData').innerText = window.contagemTemp.data.split('-').reverse().join('/');
    document.getElementById('resumoVagao').innerText = window.contagemTemp.vagao;
    document.getElementById('resumoSentido').innerText = window.contagemTemp.sentido;
    document.getElementById('obsFinalContagem').value = "";

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
        if (item.saldo > 0) {
            const prodRef = doc(db, "produtos", id);
            batch.update(prodRef, {
                estoqueBagageiroUnidades: increment(item.saldo)
            });
        }
    }

    batch.set(doc(db, "contagens", contagemId), window.contagemTemp);
    await batch.commit();

    localStorage.removeItem('trem_draft_contagem');
    alert("Contagem registrada! As sobras foram creditadas no estoque do Bagageiro.");
    window.contagemTemp = {};
    window.mostrarTela('tela-inicial');
};

// ================= CARRINHO DE VENDAS =================
window.abrirSetupCarrinho = function() {
    const selApoio = document.getElementById('selectApoioCarrinho');
    if (!selApoio) return;
    selApoio.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => {
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

    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
        const valSaiu = draft?.itens?.[p.id]?.saiu !== undefined ? draft.itens[p.id].saiu : 0;
        const valSobrou = draft?.itens?.[p.id]?.sobrou !== undefined ? draft.itens[p.id].sobrou : 0;

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</span></div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div><label>Saiu com:</label><input type="number" id="venda_saiu_${p.id}" value="${valSaiu}" onfocus="this.select()" oninput="calcularVendas(); salvarDraftCarrinho();"></div>
                    <div><label>Sobrou:</label><input type="number" id="venda_sobrou_${p.id}" value="${valSobrou}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularVendas(); salvarDraftCarrinho();"></div>
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

    if (!pId) return alert("Selecione um produto extra da lista!");
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
                <button class="btn btn-danger btn-pequeno" style="padding:4px 8px;" onclick="removerItemExtra(${idx})"><i class="ph ph-trash"></i></button>
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

    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
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
    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
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
    alert(`Acerto concluído e salvo no banco de dados!\nTotal apurado: R$ ${totalVendaTexto}`);
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
            div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda de carrinho registrada com estes filtros.</p>';
            return;
        }

        vendas.forEach(v => {
            let extrasHtml = (v.extras || []).map(e => `<li>${e.qtd}x ${e.nome} (R$ ${window.formatarMoeda(e.total)})</li>`).join('');
            div.innerHTML += `
                <div class="card" style="border-left:5px solid #0f766e; padding:14px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="font-size:16px;">Carrinho: Viagem de ${v.sentido}</strong>
                        <span style="font-size:13px; color:var(--secondary);">${v.apoio}</span>
                    </div>
                    <p style="margin:6px 0; font-size:16px; color:var(--success); font-weight:bold;">Total Vendas: R$ ${v.totalVendasR$}</p>
                    <small style="font-size:13px;">Troco Inicial Pego: R$ ${window.formatarMoeda(v.troco)}</small>
                    ${extrasHtml ? `<hr class="divisor"><small><b>Extras Vendidos no Trajeto:</b></small><ul style="font-size:13px; padding-left:18px; margin-top:6px;">${extrasHtml}</ul>` : ''}
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
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado para os filtros selecionados.</p>';
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

        const comparativoClasse = (totalLanches === totalBebidas) ? 'kpi-match' : 'kpi-divergent';

        div.innerHTML += `
            <div class="card" style="border-left:5px solid var(--primary); padding:14px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:16px;">${c.vagao} (${c.sentido})</strong>
                        <br><span style="font-size:12px; color:var(--secondary);">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <button class="btn btn-secondary btn-pequeno" onclick="abrirModalEdicaoRelatorio('${c.id}')"><i class="ph ph-pencil-simple"></i> Corrigir</button>
                </div>

                <div class="box-comparativo-status ${comparativoClasse}" style="padding:6px 12px; font-size:12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-around;">
                        <span>Lanches: <strong>${totalLanches}</strong></span>
                        <span>Bebidas: <strong>${totalBebidas}</strong></span>
                    </div>
                </div>

                <div class="tabela-container">
                    <table class="tabela-relatorio">
                        <thead>
                            <tr>
                                <th style="width:32%;">Bebida</th>
                                <th style="width:14%;">Carga</th>
                                <th style="width:14%;">Pax</th>
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

// ================= CHEFE EDITAR RELATÓRIO DO APOIO =================
window.abrirModalEdicaoRelatorio = function(id) {
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    document.getElementById('editRelatorioIdOriginal').value = c.id;
    document.getElementById('subtituloModalEditaRelatorio').innerText = `${c.vagao} (${c.sentido}) &bull; ${c.data.split('-').reverse().join('/')}`;
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

        novosItens[pId] = {
            id: pId,
            nome: c.itens[pId].nome,
            carga, saldo, trip, ava, pax
        };

        const difSaldo = saldo - (c.itens[pId].saldo || 0);
        if (difSaldo !== 0) {
            batch.update(doc(db, "produtos", pId), {
                estoqueBagageiroUnidades: increment(difSaldo)
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
    alert("Relatório corrigido com sucesso pelo Chefe!");
    window.renderizarRelatoriosAdmin();
};

// ================= INICIALIZAÇÃO SEGURA =================
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
