// ================= IMPORTAÇÕES FIREBASE FIRESTORE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, 
    enableIndexedDbPersistence, increment 
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

// Ordem prioritária de bebidas
const ORDEM_FIXA = ['C', 'G', 'Z', 'Ac', 'KL', 'Cp', 'Zp', 'Gg', 'Gp', 'Fgp', 'Am', 'Acp', 'Agsp', 'Aggp', 'Chn', 'Chz', 'Su', 'Sp', 'Esp', 'Gelo'];

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
        let idxA = ORDEM_FIXA.indexOf(a.id);
        let idxB = ORDEM_FIXA.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.nome.localeCompare(b.nome);
    });
}

// ================= CONTROLE DE TELAS & SESSÃO PERSISTENTE =================
window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo(0, 0);

    // Salva a tela atual para restaurar no F5
    localStorage.setItem('trem_tela_ativa', id);
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

    // Salva sessão do Chefe
    localStorage.setItem('trem_chefe_sessao', 'ativo');
    window.mostrarTela('tela-admin');
    atualizarDashboardKPIs();
};

window.logout = function() {
    localStorage.removeItem('trem_chefe_sessao');
    localStorage.removeItem('trem_tela_ativa');
    window.mostrarTela('tela-inicial');
};

// ================= RESTAURAÇÃO NO F5 =================
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
    // Sincroniza produtos
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        window.produtosDB = snapshot.docs.map(d => d.data());
        atualizarDashboardKPIs();
        
        // Se a tela atual estiver aberta, re-renderiza imediatamente
        if (document.getElementById('tela-cadastro-produtos').classList.contains('ativa')) renderizarProdutosAdmin();
        if (document.getElementById('tela-estoques').classList.contains('ativa')) abrirTelaEstoques();
        if (document.getElementById('tela-carga-dia').classList.contains('ativa')) abrirCargaDoDia();
    });

    // Sincroniza usuários
    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        window.usuariosDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-usuarios').classList.contains('ativa')) renderizarUsuarios();
        if (document.getElementById('tela-setup-contagem').classList.contains('ativa')) abrirSetupContagem();
    });

    // Sincroniza contagens de vagões
    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-relatorios').classList.contains('ativa')) renderizarRelatoriosAdmin();
    });

    // Sincroniza cargas do dia
    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-ver-carga').classList.contains('ativa')) carregarManifestoPublico();
    });

    // Sincroniza vendas de carrinho
    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-relatorios').classList.contains('ativa')) renderizarRelatoriosAdmin();
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
window.abrirVerCargaPublico = function() {
    const hj = new Date().toISOString().split('T')[0];
    const elData = document.getElementById('filtroDataManifesto');
    if (!elData.value) elData.value = hj;

    carregarManifestoPublico();
    window.mostrarTela('tela-ver-carga');
};

function carregarManifestoPublico() {
    const div = document.getElementById('conteudoManifestoPublico');
    div.innerHTML = "";

    const dataSel = document.getElementById('filtroDataManifesto').value;
    const carga = window.cargasDiaDB.find(c => c.data === dataSel);

    if (!carga || !carga.itens || Object.keys(carga.itens).length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:var(--secondary);">
                <i class="ph ph-calendar-blank" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                <p>Nenhuma escala de carga registrada para o dia <strong>${dataSel.split('-').reverse().join('/')}</strong>.</p>
            </div>
        `;
        return;
    }

    let linhasHtml = "";
    for (let sigla in carga.itens) {
        const item = carga.itens[sigla];
        let formulaTexto = "";

        if (item.baga > 0) {
            formulaTexto = `${sigla} = ${item.total} - ${item.baga} = <strong>${item.cont} contêiner</strong>`;
        } else {
            formulaTexto = `${sigla} = ${item.total} (tudo do contêiner)`;
        }

        linhasHtml += `
            <div class="manifesto-linha">
                <span class="manifesto-formula">${formulaTexto}</span>
                <span class="manifesto-destino">${item.destino ? `(${item.destino})` : ''}</span>
            </div>
        `;
    }

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

// ================= CARGA DO DIA (MONTAGEM PELO CHEFE) =================
window.abrirCargaDoDia = function() {
    const div = document.getElementById('listaItensCargaDia');
    div.innerHTML = "";

    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const bagaDisponivel = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unPorFardo);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--accent); font-size:13px;">Bagageiro tem: ${bagaDisponivel}</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:8px;">
                    <div>
                        <label>Total Fardos:</label>
                        <input type="number" id="carga_total_${p.id}" value="0" min="0" oninput="calcularFormulaLinha('${p.id}')">
                    </div>
                    <div>
                        <label>Do Bagageiro:</label>
                        <input type="number" id="carga_baga_${p.id}" value="0" min="0" oninput="calcularFormulaLinha('${p.id}')">
                    </div>
                    <div>
                        <label>= Contêiner:</label>
                        <input type="number" id="carga_cont_${p.id}" readonly class="input-pax" value="0">
                    </div>
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:var(--secondary);">Distribuição / Vagões:</label>
                    <input type="text" id="carga_dest_${p.id}" placeholder="Ex: 1 eco, 2 tur, 3 pls 15 e 17" style="padding:8px 12px; font-size:13px;">
                </div>
            </div>
        `;
    });

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataCargaDia').value = hj;
    document.getElementById('obsEspeciaisCarga').value = "";
    window.mostrarTela('tela-carga-dia');
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
    let itensSalvos = {};

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const total = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const baga = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const cont = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;
        const destino = document.getElementById(`carga_dest_${p.id}`)?.value.trim() || "";
        const unFardo = p.unidadesPorFardo || 1;

        if (total > 0) {
            itensSalvos[p.id] = { total, baga, cont, destino };

            // Abate das unidades nos estoques da nuvem
            const pRef = doc(db, "produtos", p.id);
            await updateDoc(pRef, {
                estoqueContainerUnidades: increment(-(cont * unFardo)),
                estoqueBagageiroUnidades: increment(-(baga * unFardo))
            });
        }
    }

    const cargaId = data; // Indexa pela própria data para sobrepor se for o mesmo dia
    await setDoc(doc(db, "cargas_dia", cargaId), {
        id: cargaId,
        data,
        itens: itensSalvos,
        obsEspeciais,
        timestamp: Date.now()
    });

    alert("Carga do trem cadastrada e publicada com sucesso no banco de dados!");
    window.mostrarTela('tela-admin');
};

// ================= SITUAÇÃO DOS ESTOQUES (RESUMO & AJUSTE) =================
window.abrirTelaEstoques = function() {
    ordenarPorRegra(window.produtosDB);

    // 1. Tabela Contêiner
    const tbodyCont = document.getElementById('tabelaResumoContainer');
    tbodyCont.innerHTML = "";
    window.produtosDB.forEach(p => {
        tbodyCont.innerHTML += `
            <tr>
                <td><strong>${p.id}</strong> - ${p.nome}</td>
                <td style="color:var(--primary); font-weight:bold;">${formatarEstoqueFardos(p.estoqueContainerUnidades, p.unidadesPorFardo)}</td>
            </tr>
        `;
    });

    // 2. Tabela Bagageiro
    const tbodyBaga = document.getElementById('tabelaResumoBagageiro');
    tbodyBaga.innerHTML = "";
    window.produtosDB.forEach(p => {
        tbodyBaga.innerHTML += `
            <tr>
                <td><strong>${p.id}</strong> - ${p.nome}</td>
                <td style="color:var(--bagageiro-color); font-weight:bold;">${formatarEstoqueFardos(p.estoqueBagageiroUnidades, p.unidadesPorFardo)}</td>
            </tr>
        `;
    });

    // 3. Ajuste Manual
    const divManual = document.getElementById('listaEstoqueGeral');
    divManual.innerHTML = "";
    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const contFardos = Math.floor((p.estoqueContainerUnidades || 0) / unFardo);
        const contUnidades = (p.estoqueContainerUnidades || 0) % unFardo;
        const bagaFardos = Math.floor((p.estoqueBagageiroUnidades || 0) / unFardo);
        const bagaUnidades = (p.estoqueBagageiroUnidades || 0) % unFardo;

        divManual.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--secondary); font-size:13px;">Fardo: ${unFardo} un</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr; gap:12px;">
                    <div>
                        <label style="color:var(--container-color);"><i class="ph ph-archive"></i> Contêiner:</label>
                        <div style="display:flex; gap:4px;">
                            <input type="number" id="est_cont_fd_${p.id}" value="${contFardos}" placeholder="Fardos" onkeydown="if(event.key==='Enter') salvarAjustesEstoqueManual()">
                            <input type="number" id="est_cont_un_${p.id}" value="${contUnidades}" placeholder="Unidades" onkeydown="if(event.key==='Enter') salvarAjustesEstoqueManual()">
                        </div>
                    </div>
                    <div>
                        <label style="color:var(--bagageiro-color);"><i class="ph ph-bag"></i> Bagageiro:</label>
                        <div style="display:flex; gap:4px;">
                            <input type="number" id="est_baga_fd_${p.id}" value="${bagaFardos}" placeholder="Fardos" onkeydown="if(event.key==='Enter') salvarAjustesEstoqueManual()">
                            <input type="number" id="est_baga_un_${p.id}" value="${bagaUnidades}" placeholder="Unidades" onkeydown="if(event.key==='Enter') salvarAjustesEstoqueManual()">
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    window.mostrarTela('tela-estoques');
};

window.salvarAjustesEstoqueManual = async function() {
    for (let p of window.produtosDB) {
        const unFardo = p.unidadesPorFardo || 1;
        
        const cFd = parseInt(document.getElementById(`est_cont_fd_${p.id}`)?.value) || 0;
        const cUn = parseInt(document.getElementById(`est_cont_un_${p.id}`)?.value) || 0;
        const bFd = parseInt(document.getElementById(`est_baga_fd_${p.id}`)?.value) || 0;
        const bUn = parseInt(document.getElementById(`est_baga_un_${p.id}`)?.value) || 0;

        const totalCont = (cFd * unFardo) + cUn;
        const totalBaga = (bFd * unFardo) + bUn;

        const pRef = doc(db, "produtos", p.id);
        await updateDoc(pRef, {
            estoqueContainerUnidades: totalCont,
            estoqueBagageiroUnidades: totalBaga
        });
    }
    alert("Estoques atualizados no banco de dados com sucesso!");
};

// ================= PRODUTOS, FARDOS & PREÇOS =================
window.salvarProduto = async function() {
    const id = document.getElementById('novoProdSigla').value.trim();
    const nome = document.getElementById('novoProdNome').value.trim();
    const unFardo = parseInt(document.getElementById('novoProdUnFardo').value) || 12;
    const preco = parseFloat(document.getElementById('novoProdPreco').value) || 0;
    const indexEdit = document.getElementById('editProdIndex').value;

    if (!id || !nome) return alert("Preencha Sigla e Nome!");

    const dados = { id, nome: window.escapeHTML(nome), unidadesPorFardo: unFardo, precoVenda: preco };

    if (!indexEdit) {
        dados.estoqueContainerUnidades = 0;
        dados.estoqueBagageiroUnidades = 0;
    }

    await setDoc(doc(db, "produtos", id), dados, { merge: true });

    document.getElementById('novoProdSigla').value = "";
    document.getElementById('novoProdNome').value = "";
    document.getElementById('novoProdUnFardo').value = "12";
    document.getElementById('novoProdPreco').value = "";
    document.getElementById('editProdIndex').value = "";
    alert("Produto salvo no banco de dados com sucesso!");
};

window.renderizarProdutosAdmin = function() {
    ordenarPorRegra(window.produtosDB);
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    window.produtosDB.forEach((p) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong style="font-size:16px;">${p.id}</strong> - ${p.nome} 
                    <br><small style="color:var(--secondary); font-size:13px;">${p.unidadesPorFardo} un/fardo | Preço de Venda: <strong>R$ ${window.formatarMoeda(p.precoVenda)}</strong></small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-pequeno" onclick="editarProduto('${p.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-danger btn-pequeno" onclick="removerProduto('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.editarProduto = function(id) {
    const p = window.produtosDB.find(x => x.id === id);
    if (!p) return;
    document.getElementById('novoProdSigla').value = p.id;
    document.getElementById('novoProdNome').value = p.nome;
    document.getElementById('novoProdUnFardo').value = p.unidadesPorFardo;
    document.getElementById('novoProdPreco').value = p.precoVenda || 0;
    document.getElementById('editProdIndex').value = p.id;
    window.focarProximo('novoProdNome');
};

window.removerProduto = async function(id) {
    if (confirm("Excluir este produto definitivamente?")) {
        await deleteDoc(doc(db, "produtos", id));
    }
};

// ================= EQUIPE DE APOIOS =================
window.renderizarUsuarios = function() {
    const div = document.getElementById('listaUsuariosAdmin');
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

// ================= CONTAGEM DE VAGÃO (APOIOS) =================
window.abrirSetupContagem = function() {
    const selUser = document.getElementById('selectNomeApoio');
    selUser.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => {
        selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
    });

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = hj;
    document.getElementById('nomeGuiaApoio').value = "";
    window.mostrarTela('tela-setup-contagem');
};

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

    ordenarPorRegra(window.produtosDB);
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'Ac' || p.id === 'C' ? 24 : 0);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span>${p.nome} (${p.id})</span></div>
                <div class="grid-inputs" style="grid-template-columns: repeat(3, 1fr);">
                    <div>
                        <label>Carga:</label>
                        <input type="number" id="carga_${p.id}" value="${cargaPadrao}" onfocus="this.select()" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Sobra (Saldo):</label>
                        <input type="number" id="saldo_${p.id}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Pax (Auto):</label>
                        <input type="number" id="pax_${p.id}" class="input-pax" readonly value="${cargaPadrao}">
                    </div>
                    <div>
                        <label>Tripulação:</label>
                        <input type="number" id="trip_${p.id}" value="0" onfocus="this.select()" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Avaria:</label>
                        <input type="number" id="ava_${p.id}" class="input-avaria" value="0" onfocus="this.select()" oninput="calcularConsumo('${p.id}')">
                    </div>
                </div>
            </div>
        `;
    });

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

            if (p.id === 'KL') totalLanches += obj.pax;
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

    // Incrementa as sobras diretamente no Bagageiro no Firestore
    for (let id in window.contagemTemp.itens) {
        const item = window.contagemTemp.itens[id];
        if (item.saldo > 0) {
            const prodRef = doc(db, "produtos", id);
            await updateDoc(prodRef, {
                estoqueBagageiroUnidades: increment(item.saldo)
            });
        }
    }

    await setDoc(doc(db, "contagens", contagemId), window.contagemTemp);
    alert("Contagem registrada! As sobras foram creditadas no estoque do Bagageiro.");
    window.contagemTemp = {};
    window.mostrarTela('tela-inicial');
};

// ================= CARRINHO DE VENDAS =================
window.abrirSetupCarrinho = function() {
    const selApoio = document.getElementById('selectApoioCarrinho');
    selApoio.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => {
        selApoio.innerHTML += `<option value="${u.nome}">${u.nome}</option>`;
    });

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataCarrinho').value = hj;
    window.mostrarTela('tela-setup-carrinho');
};

window.iniciarAcertoCarrinho = function() {
    const sentido = document.getElementById('sentidoCarrinho').value;
    document.getElementById('lblCarrinhoSentido').innerText = sentido;

    const div = document.getElementById('listaItensCarrinho');
    div.innerHTML = "";

    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span>${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</span></div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div><label>Saiu com:</label><input type="number" id="venda_saiu_${p.id}" value="0" onfocus="this.select()" oninput="calcularVendas()"></div>
                    <div><label>Sobrou:</label><input type="number" id="venda_sobrou_${p.id}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularVendas()"></div>
                </div>
            </div>
        `;
    });

    const selExtra = document.getElementById('selectItemExtraCarrinho');
    selExtra.innerHTML = '<option value="">-- Selecione um item extra vendido --</option>';
    window.produtosDB.forEach(p => {
        selExtra.innerHTML += `<option value="${p.id}">${p.nome} (R$ ${window.formatarMoeda(p.precoVenda)})</option>`;
    });

    window.itensExtrasCarrinhoTemp = [];
    renderizarExtrasAdicionados();
    document.getElementById('carrinhoTroco').value = 0;
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

    alert(`Acerto concluído e salvo no banco de dados!\nTotal apurado: R$ ${totalVendaTexto}`);
    window.mostrarTela('tela-inicial');
};

// ================= RELATÓRIOS DO CHEFE =================
window.abrirRelatoriosAdmin = function() {
    const hj = new Date().toISOString().split('T')[0];
    if (!document.getElementById('filtroDataRelatorio').value) {
        document.getElementById('filtroDataRelatorio').value = hj;
    }
    window.setModoRelatorio('vagao');
    window.mostrarTela('tela-relatorios');
};

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

window.renderizarRelatoriosAdmin = function() {
    const div = document.getElementById('listaRelatoriosAdmin');
    div.innerHTML = "";

    const dataFiltro = document.getElementById('filtroDataRelatorio').value;

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
};

function gerarLinhasTabelaAdmin(itensObjeto) {
    let arr = Object.values(itensObjeto);
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
