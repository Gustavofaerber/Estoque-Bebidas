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
    console.log("Persistência Offline ativa no Firebase.");
}

// ================= ESTADO GLOBAL COM CACHE LOCAL =================
window.produtosDB = JSON.parse(localStorage.getItem('trem_cache_produtos') || '[]');
window.usuariosDB = JSON.parse(localStorage.getItem('trem_cache_usuarios') || '[]');
window.vagoesDB = JSON.parse(localStorage.getItem('trem_cache_vagoes') || '[]');
window.contagensDB = JSON.parse(localStorage.getItem('trem_cache_contagens') || '[]');
window.cargasDiaDB = JSON.parse(localStorage.getItem('trem_cache_cargas') || '[]');
window.vendasCarrinhoDB = JSON.parse(localStorage.getItem('trem_cache_vendas') || '[]');

window.contagemTemp = {};
window.itensExtrasCarrinhoTemp = [];
window.modoRelatorioAdmin = 'todos';
window.filtroSentidoRelatorio = 'todos';

// Ordem padrão tradicional do bloco de notas do chefe
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

    if (fardos > 0 && sobra > 0) {
        return `${fardos} Fardos + ${sobra} Un`;
    } else if (fardos > 0) {
        return `${fardos} Fardos`;
    } else {
        return `${sobra} Un`;
    }
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

    if (id === 'tela-cadastro-produtos') renderizarProdutosAdmin();
    if (id === 'tela-usuarios') renderizarUsuarios();
    if (id === 'tela-vagoes') renderizarVagoesAdmin();
    if (id === 'tela-estoques') abrirTelaEstoques();
    if (id === 'tela-carga-dia') abrirCargaDoDia();
    if (id === 'tela-ver-carga') carregarManifestoPublico(true);
    if (id === 'tela-relatorios') renderizarRelatoriosAdmin();
    if (id === 'tela-setup-contagem') abrirSetupContagem();
    if (id === 'tela-setup-carrinho') abrirSetupCarrinho();
    if (id === 'tela-boutiques-hub') abrirBoutiqueHub();
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
        atualizarDashboardKPIs();

        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos') renderizarProdutosAdmin();
        if (telaAtiva === 'tela-estoques') renderizarApenasTabelasResumoEstoques();
        if (telaAtiva === 'tela-ver-carga') carregarManifestoPublico(false);
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        window.usuariosDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_usuarios', JSON.stringify(window.usuariosDB));
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-usuarios') renderizarUsuarios();
        if (telaAtiva === 'tela-setup-contagem') abrirSetupContagem();
        if (telaAtiva === 'tela-setup-carrinho') abrirSetupCarrinho();
    });

    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        window.vagoesDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_vagoes', JSON.stringify(window.vagoesDB));
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-vagoes') renderizarVagoesAdmin();
        if (telaAtiva === 'tela-setup-contagem') abrirSetupContagem();
        if (telaAtiva === 'tela-boutiques-hub') carregarSelectBoutiqueHub();
    });

    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_contagens', JSON.stringify(window.contagensDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) renderizarRelatoriosAdmin();
    });

    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_cargas', JSON.stringify(window.cargasDiaDB));
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa')) carregarManifestoPublico(false);
        if (document.getElementById('tela-carga-dia')?.classList.contains('ativa')) verificarStatusEdicaoCarga();
    });

    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
        localStorage.setItem('trem_cache_vendas', JSON.stringify(window.vendasCarrinhoDB));
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) renderizarRelatoriosAdmin();
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

// ================= FROTA DE VAGÕES & BEBIDAS PERMITIDAS =================
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
        if (v.tipo === 'litorina') corTipo = "#9333ea";
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
        permitidas = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL']; // Padrão turístico
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
        chks.forEach(c => c.checked = true); // Boutiques e Litorinas carregam todo o cardápio
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

// ================= MÓDULO EXCLUSIVO: BOUTIQUES & LITORINAS =================
function carregarSelectBoutiqueHub() {
    const sel = document.getElementById('selectVagaoBoutiqueHub');
    if (!sel) return;
    sel.innerHTML = "";

    const vagoesBoutLito = window.vagoesDB.filter(v => v.tipo === 'boutique' || v.tipo === 'litorina')
        .sort((a,b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));

    vagoesBoutLito.forEach(v => {
        sel.innerHTML += `<option value="${v.numero}|${v.nome}">Placa ${v.numero} - ${v.nome} [${v.tipo.toUpperCase()}]</option>`;
    });

    const hj = new Date().toISOString().split('T')[0];
    const dtEl = document.getElementById('dataBoutiqueHub');
    if (dtEl && !dtEl.value) dtEl.value = hj;
}

function abrirBoutiqueHub() {
    carregarSelectBoutiqueHub();
    carregarFormularioBoutiqueHub();
}

window.carregarFormularioBoutiqueHub = function() {
    const area = document.getElementById('areaFormBoutiqueHub');
    if (!area) return;
    area.innerHTML = "";

    const etapa = document.getElementById('etapaBoutiqueHub').value;
    ordenarPorRegra(window.produtosDB);

    if (etapa === 'morretes_sem_retorno' || etapa === 'curitiba_final') {
        const titulo = etapa === 'morretes_sem_retorno' ? 'Contagem de Sobras (Morretes - Sem Retorno)' : 'Fechamento Final das Sobras (Chegada Curitiba)';
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">${titulo}</h4><p style="font-size:13px; color:var(--secondary); margin-bottom:12px;">Digite quantas unidades de cada bebida sobraram na boutique. Elas irão direto para o estoque do Bagageiro:</p>`;

        window.produtosDB.forEach(p => {
            htmlItens += `
                <div class="item-contagem" style="padding:10px 14px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${p.id} - ${p.nome}</strong>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:12px; color:var(--secondary);">Sobrou:</span>
                            <input type="number" id="boutique_sobra_${p.id}" placeholder="0" min="0" style="width:80px; text-align:center; padding:8px; font-weight:bold;">
                        </div>
                    </div>
                </div>
            `;
        });

        htmlItens += `<button class="btn btn-success btn-lg" style="margin-top:15px;" onclick="salvarSobrasBoutiqueDirect()"><i class="ph ph-check-circle"></i> Creditar Sobras no Bagageiro</button>`;
        area.innerHTML = htmlItens;

    } else if (etapa === 'morretes_com_retorno') {
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">Ajuste de Carga para a Viagem de Retorno</h4><p style="font-size:13px; color:var(--secondary); margin-bottom:12px;">Informe as sobras da ida e defina quantas unidades adicionar (+) do bagageiro ou retirar (-):</p>`;

        window.produtosDB.forEach(p => {
            htmlItens += `
                <div class="item-contagem">
                    <div class="item-contagem-header"><span>${p.id} - ${p.nome}</span></div>
                    <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                        <div>
                            <label>Sobrou da Ida (Un):</label>
                            <input type="number" id="boutique_ida_sobra_${p.id}" placeholder="0" min="0">
                        </div>
                        <div>
                            <label>Ajuste Retorno (+ ou - Un):</label>
                            <input type="number" id="boutique_ajuste_ret_${p.id}" placeholder="Ex: +6 ou -4">
                        </div>
                    </div>
                </div>
            `;
        });

        htmlItens += `<button class="btn btn-primary btn-lg" style="margin-top:15px;" onclick="salvarAjusteRetornoBoutique()"><i class="ph ph-check-circle"></i> Confirmar Carga do Retorno</button>`;
        area.innerHTML = htmlItens;

    } else if (etapa === 'reforco_trajeto') {
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">Reforço em Viagem (Faltou na Boutique)</h4><p style="font-size:13px; color:var(--secondary); margin-bottom:12px;">Pegou bebidas do Bagageiro no meio do caminho para abastecer a boutique? Informe abaixo:</p>`;

        window.produtosDB.forEach(p => {
            htmlItens += `
                <div class="item-contagem" style="padding:10px 14px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${p.id} - ${p.nome}</strong>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:12px; color:var(--secondary);">Pegou +:</span>
                            <input type="number" id="boutique_reforco_${p.id}" placeholder="0" min="0" style="width:80px; text-align:center; padding:8px; font-weight:bold;">
                        </div>
                    </div>
                </div>
            `;
        });

        htmlItens += `<button class="btn btn-primary btn-lg" style="margin-top:15px;" onclick="salvarReforcoBoutique()"><i class="ph ph-check-circle"></i> Abater do Bagageiro & Reforçar</button>`;
        area.innerHTML = htmlItens;
    }
};

window.salvarSobrasBoutiqueDirect = async function() {
    const vagaoStr = document.getElementById('selectVagaoBoutiqueHub').value;
    const data = document.getElementById('dataBoutiqueHub').value;
    const etapa = document.getElementById('etapaBoutiqueHub').value;

    const batch = writeBatch(db);
    let totalSobras = 0;
    let itensSobra = {};

    window.produtosDB.forEach(p => {
        const qtd = parseInt(document.getElementById(`boutique_sobra_${p.id}`)?.value) || 0;
        if (qtd > 0) {
            totalSobras += qtd;
            itensSobra[p.id] = qtd;
            const pRef = doc(db, "produtos", p.id);
            batch.update(pRef, { estoqueBagageiroUnidades: increment(qtd) });
        }
    });

    const regId = Date.now().toString();
    batch.set(doc(db, "boutiques_movimentos", regId), {
        id: regId,
        data,
        vagao: vagaoStr,
        tipo: etapa,
        itens: itensSobra,
        timestamp: Date.now()
    });

    await batch.commit();
    alert(`Sucesso! ${totalSobras} unidades foram creditadas no estoque do Bagageiro.`);
    window.mostrarTela('tela-inicial');
};

window.salvarAjusteRetornoBoutique = async function() {
    const vagaoStr = document.getElementById('selectVagaoBoutiqueHub').value;
    const data = document.getElementById('dataBoutiqueHub').value;

    const batch = writeBatch(db);
    let itensAjuste = {};

    window.produtosDB.forEach(p => {
        const sobraIda = parseInt(document.getElementById(`boutique_ida_sobra_${p.id}`)?.value) || 0;
        const ajuste = parseInt(document.getElementById(`boutique_ajuste_ret_${p.id}`)?.value) || 0;

        if (sobraIda > 0 || ajuste !== 0) {
            itensAjuste[p.id] = { sobraIda, ajuste, cargaRetorno: Math.max(0, sobraIda + ajuste) };
            if (ajuste !== 0) {
                // Se ajuste é positivo (pegou do bagageiro): abate do bagageiro (-ajuste)
                // Se ajuste é negativo (devolveu pro bagageiro): soma no bagageiro (- (-X) = +X)
                const pRef = doc(db, "produtos", p.id);
                batch.update(pRef, { estoqueBagageiroUnidades: increment(-ajuste) });
            }
        }
    });

    const regId = Date.now().toString();
    batch.set(doc(db, "boutiques_movimentos", regId), {
        id: regId,
        data,
        vagao: vagaoStr,
        tipo: 'ajuste_retorno',
        itens: itensAjuste,
        timestamp: Date.now()
    });

    await batch.commit();
    alert("Carga de retorno configurada e Bagageiro atualizado com sucesso!");
    window.mostrarTela('tela-inicial');
};

window.salvarReforcoBoutique = async function() {
    const vagaoStr = document.getElementById('selectVagaoBoutiqueHub').value;
    const data = document.getElementById('dataBoutiqueHub').value;

    const batch = writeBatch(db);
    let itensReforco = {};

    window.produtosDB.forEach(p => {
        const qtd = parseInt(document.getElementById(`boutique_reforco_${p.id}`)?.value) || 0;
        if (qtd > 0) {
            itensReforco[p.id] = qtd;
            const pRef = doc(db, "produtos", p.id);
            batch.update(pRef, { estoqueBagageiroUnidades: increment(-qtd) });
        }
    });

    const regId = Date.now().toString();
    batch.set(doc(db, "boutiques_movimentos", regId), {
        id: regId,
        data,
        vagao: vagaoStr,
        tipo: 'reforco_trajeto',
        itens: itensReforco,
        timestamp: Date.now()
    });

    await batch.commit();
    alert("Reforço registrado! As unidades foram abatidas do estoque do Bagageiro.");
    window.mostrarTela('tela-inicial');
};

// ================= CONTAGEM DE VAGÃO (FILTRO DAS BEBIDAS DO VAGÃO) =================
function abrirSetupContagem() {
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
}

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

    // FILTRO DINÂMICO: Exibe apenas as bebidas que foram autorizadas para este vagão!
    const permitidas = vagaoObj?.bebidasPermitidas || [];
    const produtosFiltrados = window.produtosDB.filter(p => {
        if (p.nome.includes('(Venda)')) return false;
        if (permitidas.length > 0) return permitidas.includes(p.id);
        return true; // Se não houver restrição, carrega todas
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
        if (!elCarga) return; // Se a bebida não fazia parte deste vagão, ignora

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

    // Atualiza a cor de fundo do comparativo: verde pastel se bater, vermelho pastel se divergir
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

// ================= RELATÓRIOS DO CHEFE COM EDIÇÃO E FILTROS =================
window.setModoRelatorio = function(modo) {
    window.modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelBoutLito', 'btnRelVendas'].forEach(id => {
        document.getElementById(id)?.classList.remove('ativo');
    });

    if (modo === 'todos') document.getElementById('btnRelVagao')?.classList.add('ativo');
    if (modo === 'turisticos') document.getElementById('btnRelTur')?.classList.add('ativo');
    if (modo === 'boutiques_litorinas') document.getElementById('btnRelBoutLito')?.classList.add('ativo');
    if (modo === 'vendas') document.getElementById('btnRelVendas')?.classList.add('ativo');

    renderizarRelatoriosAdmin();
};

window.setFiltroSentido = function(sentido) {
    window.filtroSentidoRelatorio = sentido;
    ['btnSentidoTodos', 'btnSentidoIda', 'btnSentidoVolta'].forEach(id => {
        document.getElementById(id)?.classList.remove('ativo');
    });

    if (sentido === 'todos') document.getElementById('btnSentidoTodos')?.classList.add('ativo');
    if (sentido === 'Ida') document.getElementById('btnSentidoIda')?.classList.add('ativo');
    if (sentido === 'Volta') document.getElementById('btnSentidoVolta')?.classList.add('ativo');

    renderizarRelatoriosAdmin();
};

function renderizarRelatoriosAdmin() {
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

    // Filtro por Sentido
    if (window.filtroSentidoRelatorio !== 'todos') {
        filtrados = filtrados.filter(c => c.sentido === window.filtroSentidoRelatorio);
    }

    // Filtro por Categoria (Turístico / Boutique e Litorina)
    if (window.modoRelatorioAdmin === 'turisticos') {
        filtrados = filtrados.filter(c => c.vagaoTipo === 'turistico' || c.vagaoTipo === 'economico');
    } else if (window.modoRelatorioAdmin === 'boutiques_litorinas') {
        filtrados = filtrados.filter(c => c.vagaoTipo === 'boutique' || c.vagaoTipo === 'litorina');
    }

    if (filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado para os filtros selecionados.</p>';
        return;
    }

    // ORDENAÇÃO DOS VAGÕES POR NÚMERO DE PLACA CRESCENTE (Placa 1, Placa 2...)
    filtrados.sort((a, b) => {
        const nA = parseInt(a.vagaoNumero) || 9999;
        const nB = parseInt(b.vagaoNumero) || 9999;
        if (nA !== nB) return nA - nB;
        return (a.sentido || "").localeCompare(b.sentido || "");
    });

    filtrados.forEach(c => {
        let linhas = gerarLinhasTabelaAdmin(c.itens);

        // Calcula total de lanches e bebidas
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

                <!-- COMPARATIVO VISUAL SUAVE (VERDE OU VERMELHO PASTEL) -->
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
}

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

        // Ajusta o saldo de sobras que entrou no bagageiro
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
    renderizarRelatoriosAdmin();
};

// ================= INICIALIZAÇÃO =================
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
