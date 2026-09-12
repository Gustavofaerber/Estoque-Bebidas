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
    console.log("Persistência Offline ativa.");
}

// ================= ESTADO GLOBAL =================
window.produtosDB = [];
window.usuariosDB = [];
window.contagensDB = [];
window.cargasDiaDB = [];
window.vendasCarrinhoDB = [];

window.contagemTemp = {};
window.itensExtrasCarrinhoTemp = [];
window.modoRelatorioAdmin = 'vagao';

// Ordem padrão oficial com base na lista tradicional do chefe
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

// ================= ORDENAÇÃO CUSTOMIZÁVEL DAS BEBIDAS =================
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

// ================= MODAIS (POP-UPS) =================
window.abrirModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};

window.fecharModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

// ================= ROTEADOR DINÂMICO E TELAS (ZERO TELAS EM BRANCO) =================
window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo(0, 0);

    localStorage.setItem('trem_tela_ativa', id);

    // Renderiza os dados imediatamente na abertura da tela sem precisar de F5
    if (id === 'tela-cadastro-produtos') renderizarProdutosAdmin();
    if (id === 'tela-usuarios') renderizarUsuarios();
    if (id === 'tela-estoques') abrirTelaEstoques();
    if (id === 'tela-carga-dia') abrirCargaDoDia();
    if (id === 'tela-ver-carga') carregarManifestoPublico();
    if (id === 'tela-relatorios') renderizarRelatoriosAdmin();
    if (id === 'tela-setup-contagem') abrirSetupContagem();
    if (id === 'tela-setup-carrinho') abrirSetupCarrinho();
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
    const telasAdmin = ['tela-admin', 'tela-carga-dia', 'tela-estoques', 'tela-usuarios', 'tela-cadastro-produtos', 'tela-relatorios'];

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

// ================= SINCRONIZAÇÃO EM NUVEM (FIRESTORE) =================
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

        atualizarDashboardKPIs();

        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos') renderizarProdutosAdmin();
        if (telaAtiva === 'tela-estoques') renderizarApenasTabelasResumoEstoques();
        if (telaAtiva === 'tela-carga-dia') abrirCargaDoDia();
        if (telaAtiva === 'tela-ver-carga') carregarManifestoPublico();
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        window.usuariosDB = snapshot.docs.map(d => d.data());
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-usuarios') renderizarUsuarios();
        if (telaAtiva === 'tela-setup-contagem') abrirSetupContagem();
        if (telaAtiva === 'tela-setup-carrinho') abrirSetupCarrinho();
    });

    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa')) renderizarRelatoriosAdmin();
    });

    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa')) carregarManifestoPublico();
    });

    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
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

// ================= ABA PÚBLICA: VER CARGA DO TREM =================
function carregarManifestoPublico() {
    const div = document.getElementById('conteudoManifestoPublico');
    if (!div) return;
    div.innerHTML = "";

    const dataSel = document.getElementById('filtroDataManifesto').value;
    const carga = window.cargasDiaDB.find(c => c.data === dataSel);

    if (!carga || !carga.itens || Object.keys(carga.itens).length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:var(--secondary);">
                <i class="ph ph-calendar-blank" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                <p>Nenhuma escala de carga registrada para o dia <strong>${dataSel ? dataSel.split('-').reverse().join('/') : '--/--/----'}</strong>.</p>
            </div>
        `;
        return;
    }

    let itensOrdenados = Object.keys(carga.itens).map(sigla => ({
        sigla,
        ...carga.itens[sigla],
        prodObj: window.produtosDB.find(p => p.id === sigla) || { id: sigla, ordem: 9999 }
    }));

    itensOrdenados.sort((a, b) => {
        const ordA = a.prodObj.ordem !== undefined ? parseInt(a.prodObj.ordem) : 9999;
        const ordB = b.prodObj.ordem !== undefined ? parseInt(b.prodObj.ordem) : 9999;
        return ordA - ordB;
    });

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

    div.innerHTML = `
        <div class="manifesto-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:12px;">
                <h3 style="color:var(--primary); font-size:18px; margin:0;"><i class="ph ph-train"></i> Carga Prevista</h3>
                <span style="font-weight:700; color:var(--accent);">${dataSel.split('-').reverse().join('/')}</span>
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
}

// ================= GESTÃO DE RASCUNHOS (DRAFTS) =================
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
        abrirTelaEstoques();
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
            dest: document.getElementById(`carga_dest_${p.id}`)?.value || ""
        };
    });
    localStorage.setItem('trem_draft_carga', JSON.stringify(draft));
};

window.limparDraftCarga = function() {
    if (confirm("Deseja zerar os campos da carga do dia?")) {
        localStorage.removeItem('trem_draft_carga');
        abrirCargaDoDia();
    }
};

window.salvarDraftContagem = function() {
    const draft = {
        apoio: document.getElementById('selectNomeApoio')?.value || "",
        data: document.getElementById('dataContagemApoio')?.value || "",
        sentido: document.getElementById('selectSentidoApoio')?.value || "",
        vagao: document.getElementById('selectVagaoApoio')?.value || "",
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

// ================= CARGA DO DIA (MONTAGEM PELO CHEFE) =================
function abrirCargaDoDia() {
    const div = document.getElementById('listaItensCargaDia');
    if (!div) return;
    div.innerHTML = "";

    ordenarPorRegra(window.produtosDB);

    const draftStr = localStorage.getItem('trem_draft_carga');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const bagaDisponivel = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unPorFardo);

        const valTotal = draft?.itens?.[p.id]?.total !== undefined && draft?.itens?.[p.id]?.total !== "" ? draft.itens[p.id].total : 0;
        const valBaga = draft?.itens?.[p.id]?.baga !== undefined && draft?.itens?.[p.id]?.baga !== "" ? draft.itens[p.id].baga : 0;
        const valDest = draft?.itens?.[p.id]?.dest ?? "";
        const valCont = Math.max(0, valTotal - valBaga);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span><span class="badge-ordem">#${p.ordem || '-'}</span> ${p.nome} (${p.id})</span>
                    <small style="color:var(--accent); font-size:13px;">Bagageiro tem: ${bagaDisponivel}</small>
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
                    <label style="font-size:11px; font-weight:700; color:var(--secondary);">Distribuição / Vagões:</label>
                    <input type="text" id="carga_dest_${p.id}" value="${valDest}" placeholder="Ex: 1 eco, 2 tur, 3 pls 15 e 17" style="padding:8px 12px; font-size:13px;" oninput="salvarDraftCarga()">
                </div>
            </div>
        `;
    });

    const hj = new Date().toISOString().split('T')[0];
    const elData = document.getElementById('dataCargaDia');
    if (elData) elData.value = draft?.data || hj;
    const elObs = document.getElementById('obsEspeciaisCarga');
    if (elObs) elObs.value = draft?.obs || "";
}

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
    let itensSalvos = {};

    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const total = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const baga = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const cont = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;
        const destino = document.getElementById(`carga_dest_${p.id}`)?.value.trim() || "";
        const unFardo = p.unidadesPorFardo || 1;

        if (total > 0) {
            itensSalvos[p.id] = { total, baga, cont, destino };

            const pRef = doc(db, "produtos", p.id);
            batch.update(pRef, {
                estoqueContainerUnidades: increment(-(cont * unFardo)),
                estoqueBagageiroUnidades: increment(-(baga * unFardo))
            });
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
    alert("Carga do trem salva e publicada no banco de dados com sucesso!");
    window.mostrarTela('tela-admin');
};

// ================= SITUAÇÃO DOS ESTOQUES =================
function renderizarApenasTabelasResumoEstoques() {
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
}

function abrirTelaEstoques() {
    renderizarApenasTabelasResumoEstoques();

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
}

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
    abrirTelaEstoques();
};

// ================= PRODUTOS EM MODAL POP-UP COM ORDEM =================
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

function renderizarProdutosAdmin() {
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
}

window.removerProduto = async function(id) {
    if (confirm("Excluir este produto definitivamente?")) {
        await deleteDoc(doc(db, "produtos", id));
    }
};

// ================= EQUIPE DE APOIOS =================
function renderizarUsuarios() {
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
}

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

// ================= CONTAGEM DE VAGÃO (APOIOS) =================
function abrirSetupContagem() {
    const selUser = document.getElementById('selectNomeApoio');
    if (!selUser) return;
    selUser.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => {
        selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
    });

    const draftStr = localStorage.getItem('trem_draft_contagem');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = draft?.data || hj;
    document.getElementById('nomeGuiaApoio').value = draft?.guia || "";
    if (draft?.sentido) document.getElementById('selectSentidoApoio').value = draft.sentido;
    if (draft?.vagao) document.getElementById('selectVagaoApoio').value = draft.vagao;
}

window.iniciarContagemVagao = function() {
    const guia = document.getElementById('nomeGuiaApoio').value.trim();
    if (!guia) return alert("Por favor, preencha o Nome do Guia!");

    window.contagemTemp.apoio = document.getElementById('selectNomeApoio').value;
    window.contagemTemp.guia = window.escapeHTML(guia);
    window.contagemTemp.data = document.getElementById('dataContagemApoio').value;
    window.contagemTemp.sentido = document.getElementById('selectSentidoApoio').value;
    window.contagemTemp.vagao = document.getElementById('selectVagaoApoio').value;

    document.getElementById('lblVagaoContagem').innerText = window.contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = window.contagemTemp.sentido;

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    const draftStr = localStorage.getItem('trem_draft_contagem');
    const draft = draftStr ? JSON.parse(draftStr) : null;

    ordenarPorRegra(window.produtosDB);
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'Ac' || p.id === 'C' ? 24 : 0);

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

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => calcularConsumo(p.id));
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
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        let obj = {
            id: p.id,
            nome: p.nome,
            carga: parseInt(document.getElementById(`carga_${p.id}`)?.value) || 0,
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
function abrirSetupCarrinho() {
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
}

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
    ['btnRelVagao', 'btnRelTur', 'btnRelGeral', 'btnRelVendas'].forEach(id => {
        document.getElementById(id).classList.remove('ativo');
    });

    if (modo === 'vagao') document.getElementById('btnRelVagao').classList.add('ativo');
    if (modo === 'turisticos') document.getElementById('btnRelTur').classList.add('ativo');
    if (modo === 'geral') document.getElementById('btnRelGeral').classList.add('ativo');
    if (modo === 'vendas') document.getElementById('btnRelVendas').classList.add('ativo');

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
        const vendas = window.vendasCarrinhoDB.filter(v => v.data === dataFiltro);
        if (vendas.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda de carrinho registrada nesta data.</p>';
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

    const filtrados = window.contagensDB.filter(c => c.data === dataFiltro);

    if (filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma contagem de vagão para esta data.</p>';
        return;
    }

    if (window.modoRelatorioAdmin === 'vagao') {
        filtrados.sort((a,b) => b.timestamp - a.timestamp).forEach(c => {
            let linhas = gerarLinhasTabelaAdmin(c.itens);
            div.innerHTML += `
                <div class="card" style="border-left:5px solid var(--primary); padding:14px; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <strong style="font-size:16px;">${c.vagao} (${c.sentido})</strong>
                        <span style="font-size:13px; color:var(--secondary);">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <div class="tabela-container">
                        <table class="tabela-relatorio">
                            <thead><tr><th>Produto</th><th>Carga</th><th>Pax</th><th>Trip.</th><th>Avaria</th><th>Sobra</th></tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>
                    ${c.obs ? `<div style="margin-top:8px; color:var(--danger); font-size:13px;"><b>Obs:</b> ${c.obs}</div>` : ''}
                </div>
            `;
        });
    } else {
        let consolidados = {};
        filtrados.forEach(c => {
            if (window.modoRelatorioAdmin === 'turisticos' && !c.vagao.toLowerCase().includes('turístico')) return;

            for (let key in c.itens) {
                let item = c.itens[key];
                if (!consolidados[key]) consolidados[key] = { id: key, nome: item.nome, carga: 0, pax: 0, trip: 0, ava: 0, saldo: 0 };
                consolidados[key].carga += item.carga;
                consolidados[key].pax += item.pax;
                consolidados[key].trip += item.trip;
                consolidados[key].ava += item.ava;
                consolidados[key].saldo += item.saldo;
            }
        });

        const titulo = window.modoRelatorioAdmin === 'turisticos' ? 'Soma Total: Todos os Vagões Turísticos' : 'Balanço Geral de Bordo (Todos os Vagões)';
        let linhas = gerarLinhasTabelaAdmin(consolidados);

        div.innerHTML = `
            <div class="card" style="border-left:5px solid var(--accent); padding:14px;">
                <h4 style="margin-bottom:12px; color:var(--primary); font-size:16px;">${titulo}</h4>
                <div class="tabela-container">
                    <table class="tabela-relatorio">
                        <thead><tr><th>Produto</th><th>Carga</th><th>Pax</th><th>Trip.</th><th>Avaria</th><th>Sobra</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>
        `;
    }
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

// Inicializa ouvinte do Firestore e restaura sessão
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
