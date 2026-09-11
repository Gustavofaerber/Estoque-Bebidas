// ================= FIREBASE FIRESTORE SDK =================
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
const dbFirestore = getFirestore(app);

try {
    enableIndexedDbPersistence(dbFirestore);
} catch (err) {
    console.log("Persistência Offline já ativa ou navegador incompatível.");
}

// ================= DADOS LOCAIS EM MEMÓRIA =================
window.produtosDB = [];
window.usuariosDB = [];
window.contagensDB = [];
window.cargasDiaDB = [];
window.vendasCarrinhoDB = [];

window.contagemTemp = {};
window.itensExtrasCarrinhoTemp = [];
window.modoRelatorioAdmin = 'vagao';

// Ordem prioritária obrigatória: Coca, Guaraná, Coca Zero, Água Copo, Kit Lanche
const ORDEM_FIXA = ['C', 'G', 'Z', 'Ac', 'KL'];

// Catálogo Inicial Padrão com Preços de Venda Configurados
const catalogoInicial = [
    { id: 'C', nome: 'Coca Lata', unidadesPorFardo: 12, estoqueContainerFardos: 150, estoqueBagageiroUnidades: 35, precoVenda: 8 },
    { id: 'G', nome: 'Guaraná Kuat', unidadesPorFardo: 6, estoqueContainerFardos: 100, estoqueBagageiroUnidades: 18, precoVenda: 8 },
    { id: 'Z', nome: 'Coca Zero', unidadesPorFardo: 6, estoqueContainerFardos: 80, estoqueBagageiroUnidades: 14, precoVenda: 8 },
    { id: 'Ac', nome: 'Água Copo', unidadesPorFardo: 24, estoqueContainerFardos: 120, estoqueBagageiroUnidades: 40, precoVenda: 4 },
    { id: 'KL', nome: 'Kit Lanche', unidadesPorFardo: 1, estoqueContainerFardos: 400, estoqueBagageiroUnidades: 50, precoVenda: 15 },
    { id: 'AgGr', nome: 'Água c/ Gás (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 40, estoqueBagageiroUnidades: 12, precoVenda: 6 },
    { id: 'AgSr', nome: 'Água s/ Gás (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 40, estoqueBagageiroUnidades: 12, precoVenda: 6 },
    { id: 'Cerv', nome: 'Cerveja (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 50, estoqueBagageiroUnidades: 20, precoVenda: 10 }
];

const equipeInicial = [{ id: '1', nome: 'Gustavo' }, { id: '2', nome: 'Joel' }];

// Utilitários
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

function formatarEstoqueFardos(unidades, unPorFardo) {
    if (unPorFardo <= 1) return `${unidades} un`;
    const fardos = Math.floor(unidades / unPorFardo);
    const sobra = unidades % unPorFardo;
    if (fardos === 0) return `${sobra} un`;
    if (sobra === 0) return `${fardos} fd (${fardos * unPorFardo} un)`;
    return `${fardos} fd + ${sobra} un`;
}

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

window.mostrarTela = function(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
};

// ================= SINCRONIZAÇÃO EM TEMPO REAL COM FIREBASE =================
function iniciarSincronizacaoNuvem() {
    onSnapshot(collection(dbFirestore, "produtos"), (snapshot) => {
        if (snapshot.empty) {
            catalogoInicial.forEach(async p => await setDoc(doc(dbFirestore, "produtos", p.id), p));
        } else {
            window.produtosDB = snapshot.docs.map(d => d.data());
            atualizarDashboardKPIs();
            if (document.getElementById('tela-cadastro-produtos').classList.contains('ativa')) renderizarProdutosAdmin();
            if (document.getElementById('tela-estoques').classList.contains('ativa')) abrirTelaEstoques();
        }
    });

    onSnapshot(collection(dbFirestore, "usuarios"), (snapshot) => {
        if (snapshot.empty) {
            equipeInicial.forEach(async u => await setDoc(doc(dbFirestore, "usuarios", u.id), u));
        } else {
            window.usuariosDB = snapshot.docs.map(d => d.data());
            if (document.getElementById('tela-usuarios').classList.contains('ativa')) renderizarUsuarios();
        }
    });

    onSnapshot(collection(dbFirestore, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-relatorios').classList.contains('ativa')) renderizarRelatoriosAdmin();
    });

    onSnapshot(collection(dbFirestore, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => d.data());
    });

    onSnapshot(collection(dbFirestore, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => d.data());
        if (document.getElementById('tela-relatorios').classList.contains('ativa')) renderizarRelatoriosAdmin();
    });
}

function atualizarDashboardKPIs() {
    let totalUnBaga = 0;
    let totalFdContainer = 0;

    window.produtosDB.forEach(p => {
        totalUnBaga += (p.estoqueBagageiroUnidades || 0);
        totalFdContainer += (p.estoqueContainerFardos || 0);
    });

    const elBaga = document.getElementById('kpiBagageiroTotal');
    const elCont = document.getElementById('kpiContainerTotal');
    if(elBaga) elBaga.innerText = totalUnBaga + " un";
    if(elCont) elCont.innerText = totalFdContainer + " fd";
}

// ================= LOGIN DO CHEFE =================
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
    window.mostrarTela('tela-admin');
    atualizarDashboardKPIs();
};

window.logout = function() {
    window.mostrarTela('tela-inicial');
};

// ================= CARGA DO DIA (FÓRMULA DO CHEFE) =================
window.abrirCargaDoDia = function() {
    const div = document.getElementById('listaItensCargaDia');
    div.innerHTML = "";

    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const fardosNoBaga = Math.floor((p.estoqueBagageiroUnidades || 0) / unPorFardo);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--accent);">Bagageiro tem: ${fardosNoBaga} fd (${p.estoqueBagageiroUnidades || 0} un)</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr;">
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
            </div>
        `;
    });

    document.getElementById('boxFormulaGerada').style.display = 'none';
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
    const obs = document.getElementById('obsCargaDia').value;
    let resumoTexto = "";
    let itensSalvos = {};

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const total = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const baga = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const cont = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;

        if (total > 0) {
            itensSalvos[p.id] = { total, baga, cont };

            if (baga > 0) {
                resumoTexto += `<b>${p.id}</b> = ${total} - ${baga} = <b>${cont} contêiner</b><br>`;
            } else {
                resumoTexto += `<b>${p.id}</b> = ${total} (tudo do contêiner)<br>`;
            }

            // Baixa no Firestore
            const pRef = doc(dbFirestore, "produtos", p.id);
            await updateDoc(pRef, {
                estoqueContainerFardos: increment(-cont),
                estoqueBagageiroUnidades: increment(-(baga * (p.unidadesPorFardo || 1)))
            });
        }
    }

    if (obs) resumoTexto += `<br><i>Distribuição: ${window.escapeHTML(obs)}</i>`;

    const cargaId = Date.now().toString();
    await setDoc(doc(dbFirestore, "cargas_dia", cargaId), {
        id: cargaId, data, obs: window.escapeHTML(obs), itens: itensSalvos, texto: resumoTexto, timestamp: Date.now()
    });

    document.getElementById('conteudoFormulaGerada').innerHTML = resumoTexto || "Nenhum fardo preenchido.";
    document.getElementById('boxFormulaGerada').style.display = 'block';
    alert("Carga registrada e estoques atualizados com sucesso!");
};

// ================= SITUAÇÃO DOS ESTOQUES =================
window.abrirTelaEstoques = function() {
    const div = document.getElementById('listaEstoqueGeral');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--secondary);">${p.unidadesPorFardo} un/fd</small>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div>
                        <label>Contêiner (Fardos):</label>
                        <input type="number" id="est_cont_${p.id}" value="${p.estoqueContainerFardos || 0}">
                    </div>
                    <div>
                        <label>Bagageiro (Total Unidades):</label>
                        <input type="number" id="est_baga_${p.id}" value="${p.estoqueBagageiroUnidades || 0}">
                    </div>
                </div>
                <div style="font-size:11px; color:var(--primary); margin-top:6px; font-weight:bold;">
                    No Bagageiro equivale a: ${formatarEstoqueFardos(p.estoqueBagageiroUnidades || 0, p.unidadesPorFardo)}
                </div>
            </div>
        `;
    });

    window.mostrarTela('tela-estoques');
};

window.salvarAjustesEstoqueManual = async function() {
    for (let p of window.produtosDB) {
        const c = parseInt(document.getElementById(`est_cont_${p.id}`)?.value) || 0;
        const b = parseInt(document.getElementById(`est_baga_${p.id}`)?.value) || 0;
        const pRef = doc(dbFirestore, "produtos", p.id);
        await updateDoc(pRef, {
            estoqueContainerFardos: c,
            estoqueBagageiroUnidades: b
        });
    }
    alert("Estoques ajustados no Firestore!");
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
        dados.estoqueContainerFardos = 0;
        dados.estoqueBagageiroUnidades = 0;
    }

    await setDoc(doc(dbFirestore, "produtos", id), dados, { merge: true });

    document.getElementById('novoProdSigla').value = "";
    document.getElementById('novoProdNome').value = "";
    document.getElementById('novoProdUnFardo').value = "12";
    document.getElementById('novoProdPreco').value = "";
    document.getElementById('editProdIndex').value = "";
    alert("Produto salvo com sucesso!");
};

window.renderizarProdutosAdmin = function() {
    ordenarPorRegra(window.produtosDB);
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    window.produtosDB.forEach((p, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong>${p.id}</strong> - ${p.nome} 
                    <br><small style="color:var(--secondary);">${p.unidadesPorFardo} un/fd | Preço: R$ ${window.formatarMoeda(p.precoVenda)}</small>
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
    if (confirm("Excluir produto definitivamente?")) {
        await deleteDoc(doc(dbFirestore, "produtos", id));
    }
};

// ================= EQUIPE DE APOIOS =================
window.renderizarUsuarios = function() {
    const div = document.getElementById('listaUsuariosAdmin');
    div.innerHTML = "";
    [...window.usuariosDB].sort((a,b) => a.nome.localeCompare(b.nome)).forEach((u) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border); align-items:center;">
                <div><i class="ph ph-user"></i> ${u.nome}</div>
                <button class="btn btn-danger btn-pequeno" onclick="removerUsuario('${u.id}')"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
};

window.adicionarUsuario = async function() {
    const nome = document.getElementById('novoUsuarioNome').value.trim();
    if (!nome) return;
    const uid = Date.now().toString();
    await setDoc(doc(dbFirestore, "usuarios", uid), { id: uid, nome: window.escapeHTML(nome) });
    document.getElementById('novoUsuarioNome').value = "";
};

window.removerUsuario = async function(id) {
    if (confirm("Remover este apoio?")) {
        await deleteDoc(doc(dbFirestore, "usuarios", id));
    }
};

// ================= APOIO: CONTAGEM DE VAGÃO =================
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

    // Adiciona as sobras direto no Bagageiro no Firestore
    for (let id in window.contagemTemp.itens) {
        const item = window.contagemTemp.itens[id];
        if (item.saldo > 0) {
            const prodRef = doc(dbFirestore, "produtos", id);
            await updateDoc(prodRef, {
                estoqueBagageiroUnidades: increment(item.saldo)
            });
        }
    }

    await setDoc(doc(dbFirestore, "contagens", contagemId), window.contagemTemp);
    alert("Contagem registrada! As sobras foram creditadas no estoque do Bagageiro.");
    window.contagemTemp = {};
    window.mostrarTela('tela-inicial');
};

// ================= CARRINHO DE VENDAS (ÁGUAS, CERVEJA & EXTRAS) =================
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

    // Itens principais de venda
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

    // Dropdown de itens extras
    const selExtra = document.getElementById('selectItemExtraCarrinho');
    selExtra.innerHTML = '<option value="">-- Selecione o item extra vendido --</option>';
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

    if (!pId) return alert("Selecione um produto extra!");
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
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 10px; border:1px solid var(--border); border-radius:6px; margin-bottom:4px; font-size:13px;">
                <span><strong>${item.qtd}x</strong> ${item.nome} (R$ ${window.formatarMoeda(item.total)})</span>
                <button class="btn btn-danger btn-pequeno" style="padding:2px 6px;" onclick="removerItemExtra(${idx})">X</button>
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

    // Itens padrão de venda
    window.produtosDB.filter(p => p.nome.includes('(Venda)')).forEach(p => {
        const saiu = parseInt(document.getElementById(`venda_saiu_${p.id}`)?.value) || 0;
        const sobrou = parseInt(document.getElementById(`venda_sobrou_${p.id}`)?.value) || 0;
        const vendidos = Math.max(0, saiu - sobrou);
        totalVendas += (vendidos * (p.precoVenda || 0));
    });

    // Extras
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
    await setDoc(doc(dbFirestore, "vendas_carrinho", vendaId), {
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

    alert(`Acerto concluído e salvo no banco!\nTotal vendido: R$ ${totalVendaTexto}`);
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
    ['btnRelVagao', 'btnRelTur', 'btnRelGeral', 'btnRelVendas'].forEach(id => document.getElementById(id).style.background = '#e2e8f0');
    if (modo === 'vagao') document.getElementById('btnRelVagao').style.background = 'var(--primary)';
    if (modo === 'turisticos') document.getElementById('btnRelTur').style.background = 'var(--primary)';
    if (modo === 'geral') document.getElementById('btnRelGeral').style.background = 'var(--primary)';
    if (modo === 'vendas') document.getElementById('btnRelVendas').style.background = 'var(--primary)';
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
                <div class="card" style="border-left:4px solid var(--accent); padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>Carrinho: ${v.sentido}</strong>
                        <span style="font-size:12px; color:var(--secondary);">${v.apoio}</span>
                    </div>
                    <p style="margin:5px 0; font-size:14px; color:var(--success); font-weight:bold;">Total Vendas: R$ ${v.totalVendasR$}</p>
                    <small>Troco Inicial Pego: R$ ${window.formatarMoeda(v.troco)}</small>
                    ${extrasHtml ? `<hr class="divisor"><small><b>Extras Vendidos:</b></small><ul style="font-size:12px; padding-left:15px; margin-top:4px;">${extrasHtml}</ul>` : ''}
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
                <div class="card" style="border-left:4px solid var(--primary); padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <strong>${c.vagao} (${c.sentido})</strong>
                        <span style="font-size:12px; color:var(--secondary);">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <div class="tabela-container">
                        <table class="tabela-relatorio">
                            <thead><tr><th>Produto</th><th>Carga</th><th>Pax</th><th>Trip.</th><th>Avaria</th><th>Sobra</th></tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>
                    ${c.obs ? `<small style="color:var(--danger);">Obs: ${c.obs}</small>` : ''}
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

        const titulo = window.modoRelatorioAdmin === 'turisticos' ? 'Soma: Todos os Vagões Turísticos' : 'Balanço Geral de Bordo (Todos os Vagões)';
        let linhas = gerarLinhasTabelaAdmin(consolidados);

        div.innerHTML = `
            <div class="card" style="border-left:4px solid var(--accent); padding:12px;">
                <h4 style="margin-bottom:10px; color:var(--primary);">${titulo}</h4>
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

// Inicializa ouvinte do Firestore ao carregar
iniciarSincronizacaoNuvem();
