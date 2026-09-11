// BANCO DE DADOS PERSISTENTE (V4)
let db = {
    produtos: [
        { id: 'C', nome: 'Coca Lata', unidadesPorFardo: 12, estoqueContainerFardos: 150, estoqueBagageiroUnidades: 35, precoVenda: 0 },
        { id: 'G', nome: 'Guaraná Kuat', unidadesPorFardo: 6, estoqueContainerFardos: 100, estoqueBagageiroUnidades: 18, precoVenda: 0 },
        { id: 'Z', nome: 'Coca Zero', unidadesPorFardo: 6, estoqueContainerFardos: 80, estoqueBagageiroUnidades: 14, precoVenda: 0 },
        { id: 'Ac', nome: 'Água Copo', unidadesPorFardo: 24, estoqueContainerFardos: 120, estoqueBagageiroUnidades: 40, precoVenda: 0 },
        { id: 'KL', nome: 'Kit Lanche', unidadesPorFardo: 1, estoqueContainerFardos: 400, estoqueBagageiroUnidades: 50, precoVenda: 0 },
        { id: 'AgGr', nome: 'Água c/ Gás (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 40, estoqueBagageiroUnidades: 12, precoVenda: 5 },
        { id: 'AgSr', nome: 'Água s/ Gás (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 40, estoqueBagageiroUnidades: 12, precoVenda: 5 },
        { id: 'Cerv', nome: 'Cerveja (Venda)', unidadesPorFardo: 12, estoqueContainerFardos: 50, estoqueBagageiroUnidades: 20, precoVenda: 10 }
    ],
    usuarios: [
        { nome: 'Gustavo' },
        { nome: 'Apoio 2' },
        { nome: 'Joel' }
    ],
    cargasDoDia: [],
    contagens: []
};

let contagemTemp = {};
let modoRelatorioAdmin = 'vagao';

// Ordem prioritária mandatória: C, G, Z, Ac, KL
const ORDEM_FIXA = ['C', 'G', 'Z', 'Ac', 'KL'];

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// Converte unidades soltas em "X fardos (N un) + Y un"
function formatarEstoqueFardos(unidades, unPorFardo) {
    if (unPorFardo <= 1) return `${unidades} un`;
    const fardos = Math.floor(unidades / unPorFardo);
    const sobra = unidades % unPorFardo;
    if (fardos === 0) return `${sobra} un`;
    if (sobra === 0) return `${fardos} fd (${fardos * unPorFardo} un)`;
    return `${fardos} fd + ${sobra} un`;
}

window.onload = () => {
    const localDB = localStorage.getItem('tremBebidasDB_V4');
    if (localDB) db = JSON.parse(localDB);

    const hj = new Date().toISOString().split('T')[0];
    if(document.getElementById('dataOperacaoAdmin')) document.getElementById('dataOperacaoAdmin').innerText = hj.split('-').reverse().join('/');
    if(document.getElementById('filtroDataRelatorio')) document.getElementById('filtroDataRelatorio').value = hj;
    if(document.getElementById('dataCargaDia')) document.getElementById('dataCargaDia').value = hj;

    atualizarDashboardKPIs();
};

function salvarDB() {
    localStorage.setItem('tremBebidasDB_V4', JSON.stringify(db));
    atualizarDashboardKPIs();
}

function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
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

function atualizarDashboardKPIs() {
    let totalUnBaga = 0;
    let totalFdContainer = 0;

    db.produtos.forEach(p => {
        totalUnBaga += (p.estoqueBagageiroUnidades || 0);
        totalFdContainer += (p.estoqueContainerFardos || 0);
    });

    const elBaga = document.getElementById('kpiBagageiroTotal');
    const elCont = document.getElementById('kpiContainerTotal');
    if(elBaga) elBaga.innerText = totalUnBaga + " un";
    if(elCont) elCont.innerText = totalFdContainer + " fd";
}

// ==== ADMIN: LOGIN ====
function fazerLogin() {
    const pass = document.getElementById('loginSenha').value;
    if (pass !== '1234') {
        const msg = document.getElementById('msgLogin');
        msg.innerText = "Senha incorreta!";
        msg.style.display = 'block';
        return;
    }
    document.getElementById('loginSenha').value = "";
    document.getElementById('msgLogin').style.display = 'none';
    mostrarTela('tela-admin');
    atualizarDashboardKPIs();
}
function logout() { mostrarTela('tela-inicial'); }

// ==== CARGA DO DIA (FÓRMULA DO CHEFE) ====
function abrirCargaDoDia() {
    const div = document.getElementById('listaItensCargaDia');
    div.innerHTML = "";

    ordenarPorRegra(db.produtos);

    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        const fardosNoBaga = Math.floor(p.estoqueBagageiroUnidades / p.unidadesPorFardo);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--accent);">Bagageiro tem: ${formatEstoqueFardoSimples(p.estoqueBagageiroUnidades, p.unidadesPorFardo)}</small>
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
    mostrarTela('tela-carga-dia');
}

function formatEstoqueFardoSimples(unidades, unPorFardo) {
    if (unPorFardo <= 1) return `${unidades} un`;
    const f = Math.floor(unidades / unPorFardo);
    const s = unidades % unPorFardo;
    return `${f} fd (${s} un soltas)`;
}

function calcularFormulaLinha(id) {
    const total = parseInt(document.getElementById(`carga_total_${id}`).value) || 0;
    const baga = parseInt(document.getElementById(`carga_baga_${id}`).value) || 0;
    let cont = total - baga;
    if (cont < 0) cont = 0;
    document.getElementById(`carga_cont_${id}`).value = cont;
}

function salvarCargaDoDia() {
    const data = document.getElementById('dataCargaDia').value;
    const obs = document.getElementById('obsCargaDia').value;
    let resumoTexto = "";
    let itensSalvos = {};

    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        const total = parseInt(document.getElementById(`carga_total_${p.id}`).value) || 0;
        const baga = parseInt(document.getElementById(`carga_baga_${p.id}`).value) || 0;
        const cont = parseInt(document.getElementById(`carga_cont_${p.id}`).value) || 0;

        if (total > 0) {
            itensSalvos[p.id] = { total, baga, cont };
            
            // FÓRMULA NO FORMATO DO BLOCO DE NOTAS DO CHEFE:
            // Exemplo: C = 21 - 11 = 10 (1 eco, pls 11 e 12, 2 tur)
            if (baga > 0) {
                resumoTexto += `<b>${p.id}</b> = ${total} - ${baga} = <b>${cont} contêiner</b><br>`;
            } else {
                resumoTexto += `<b>${p.id}</b> = ${total} (tudo do contêiner)<br>`;
            }

            // BAIXA AUTOMÁTICA DOS ESTOQUES
            p.estoqueContainerFardos = Math.max(0, p.estoqueContainerFardos - cont);
            p.estoqueBagageiroUnidades = Math.max(0, p.estoqueBagageiroUnidades - (baga * p.unidadesPorFardo));
        }
    });

    if (obs) resumoTexto += `<br><i>Distribuição: ${escapeHTML(obs)}</i>`;

    db.cargasDoDia.push({ data, obs, itens: itensSalvos, texto: resumoTexto, timestamp: Date.now() });
    salvarDB();

    document.getElementById('conteudoFormulaGerada').innerHTML = resumoTexto || "Nenhum fardo selecionado.";
    document.getElementById('boxFormulaGerada').style.display = 'block';

    alert("Carga gerada com sucesso e estoques atualizados!");
}

// ==== GESTÃO DE ESTOQUES (CONTAINER & BAGAGEIRO) ====
function abrirTelaEstoques() {
    const div = document.getElementById('listaEstoqueGeral');
    div.innerHTML = "";
    ordenarPorRegra(db.produtos);

    db.produtos.forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                    <small style="color:var(--secondary);">${p.unidadesPorFardo} un/fardo</small>
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
                    No Bagageiro equivale a: ${formatarEstoqueFardos(p.estoqueBagageiroUnidades, p.unidadesPorFardo)}
                </div>
            </div>
        `;
    });

    mostrarTela('tela-estoques');
}

function salvarAjustesEstoqueManual() {
    db.produtos.forEach(p => {
        const c = parseInt(document.getElementById(`est_cont_${p.id}`).value) || 0;
        const b = parseInt(document.getElementById(`est_baga_${p.id}`).value) || 0;
        p.estoqueContainerFardos = c;
        p.estoqueBagageiroUnidades = b;
    });
    salvarDB();
    alert("Estoques ajustados com sucesso!");
    abrirTelaEstoques();
}

// ==== PRODUTOS & FARDOS ====
function salvarProduto() {
    const id = document.getElementById('novoProdSigla').value.trim();
    const nome = document.getElementById('novoProdNome').value.trim();
    const unFardo = parseInt(document.getElementById('novoProdUnFardo').value) || 12;
    const indexEdit = document.getElementById('editProdIndex').value;

    if (!id || !nome) return alert("Preencha sigla e nome.");

    if (indexEdit !== "") {
        db.produtos[indexEdit].id = id;
        db.produtos[indexEdit].nome = nome;
        db.produtos[indexEdit].unidadesPorFardo = unFardo;
    } else {
        db.produtos.push({ id, nome, unidadesPorFardo: unFardo, estoqueContainerFardos: 0, estoqueBagageiroUnidades: 0, precoVenda: 0 });
    }

    salvarDB();
    renderizarProdutosAdmin();
    document.getElementById('novoProdSigla').value = "";
    document.getElementById('novoProdNome').value = "";
    document.getElementById('novoProdUnFardo').value = "12";
    document.getElementById('editProdIndex').value = "";
}

function renderizarProdutosAdmin() {
    ordenarPorRegra(db.produtos);
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    db.produtos.forEach((p, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong>${p.id}</strong> - ${p.nome} 
                    <br><small style="color:var(--secondary);">${p.unidadesPorFardo} un/fardo</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-secondary btn-pequeno" onclick="editarProduto(${index})"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-danger btn-pequeno" onclick="removerProduto(${index})"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
}
document.querySelector('[onclick="mostrarTela(\'tela-cadastro-produtos\')"]').addEventListener('click', renderizarProdutosAdmin);

function editarProduto(index) {
    const p = db.produtos[index];
    document.getElementById('novoProdSigla').value = p.id;
    document.getElementById('novoProdNome').value = p.nome;
    document.getElementById('novoProdUnFardo').value = p.unidadesPorFardo;
    document.getElementById('editProdIndex').value = index;
}

function removerProduto(index) {
    if(confirm("Excluir produto?")) {
        db.produtos.splice(index, 1);
        salvarDB();
        renderizarProdutosAdmin();
    }
}

// ==== USUÁRIOS ====
function renderizarUsuarios() {
    const div = document.getElementById('listaUsuariosAdmin');
    div.innerHTML = "";
    db.usuarios.sort((a,b) => a.nome.localeCompare(b.nome)).forEach((u, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border); align-items:center;">
                <div><i class="ph ph-user"></i> ${u.nome}</div>
                <button class="btn btn-danger btn-pequeno" onclick="removerUsuario(${index})"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
}
document.querySelector('[onclick="mostrarTela(\'tela-usuarios\')"]').addEventListener('click', renderizarUsuarios);

function adicionarUsuario() {
    const nome = document.getElementById('novoUsuarioNome').value.trim();
    if(!nome) return;
    db.usuarios.push({ nome });
    salvarDB();
    renderizarUsuarios();
    document.getElementById('novoUsuarioNome').value = "";
}

function removerUsuario(index) {
    if(confirm("Remover apoio?")) {
        db.usuarios.splice(index, 1);
        salvarDB();
        renderizarUsuarios();
    }
}

// ==== APOIO: CONTAGEM DE VAGÃO ====
function abrirSetupContagem() {
    const selUser = document.getElementById('selectNomeApoio');
    selUser.innerHTML = "";
    db.usuarios.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(u => selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`);

    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = hj;
    document.getElementById('nomeGuiaApoio').value = "";
    mostrarTela('tela-setup-contagem');
}

function iniciarContagemVagao() {
    const guia = document.getElementById('nomeGuiaApoio').value.trim();
    if(!guia) return alert("Por favor, preencha o Nome do Guia.");

    contagemTemp.apoio = document.getElementById('selectNomeApoio').value;
    contagemTemp.guia = escapeHTML(guia);
    contagemTemp.data = document.getElementById('dataContagemApoio').value;
    contagemTemp.sentido = document.getElementById('selectSentidoApoio').value;
    contagemTemp.vagao = document.getElementById('selectVagaoApoio').value;

    document.getElementById('lblVagaoContagem').innerText = contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = contagemTemp.sentido;

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    ordenarPorRegra(db.produtos);
    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'Ac' || p.id === 'C' ? 24 : 0);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <span>${p.nome} (${p.id})</span>
                </div>
                <div class="grid-inputs">
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

    mostrarTela('tela-contagem-vagao');
}

function calcularConsumo(id) {
    const carga = parseInt(document.getElementById(`carga_${id}`).value) || 0;
    const saldo = parseInt(document.getElementById(`saldo_${id}`).value) || 0;
    const trip = parseInt(document.getElementById(`trip_${id}`).value) || 0;
    const ava = parseInt(document.getElementById(`ava_${id}`).value) || 0;

    let pax = carga - saldo - trip - ava;
    document.getElementById(`pax_${id}`).value = pax < 0 ? 0 : pax;
}

// ==== RESUMO & SALVAMENTO COM RETORNO PRO BAGAGEIRO ====
function gerarResumoContagem() {
    contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";

    let totalLanches = 0;
    let totalBebidas = 0;

    ordenarPorRegra(db.produtos);
    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        let obj = {
            id: p.id,
            nome: p.nome,
            carga: parseInt(document.getElementById(`carga_${p.id}`).value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`).value) || 0,
            trip: parseInt(document.getElementById(`trip_${p.id}`).value) || 0,
            ava: parseInt(document.getElementById(`ava_${p.id}`).value) || 0,
            pax: parseInt(document.getElementById(`pax_${p.id}`).value) || 0
        };

        contagemTemp.itens[p.id] = obj;

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

            if(p.id === 'KL') totalLanches += obj.pax;
            else totalBebidas += obj.pax;
        }
    });

    document.getElementById('resumoTotalLanches').innerText = totalLanches;
    document.getElementById('resumoTotalBebidas').innerText = totalBebidas;
    document.getElementById('resumoApoio').innerText = contagemTemp.apoio;
    document.getElementById('resumoGuia').innerText = contagemTemp.guia;
    document.getElementById('resumoData').innerText = contagemTemp.data.split('-').reverse().join('/');
    document.getElementById('resumoVagao').innerText = contagemTemp.vagao;
    document.getElementById('resumoSentido').innerText = contagemTemp.sentido;
    document.getElementById('obsFinalContagem').value = "";

    mostrarTela('tela-resumo-contagem');
}

function salvarContagemDefinitiva() {
    contagemTemp.obs = document.getElementById('obsFinalContagem').value;
    contagemTemp.timestamp = Date.now();

    // RETORNO AUTOMÁTICO DAS SOBRAS PARA O BAGAGEIRO
    for (let id in contagemTemp.itens) {
        const item = contagemTemp.itens[id];
        const prod = db.produtos.find(p => p.id === id);
        if (prod && item.saldo > 0) {
            prod.estoqueBagageiroUnidades = (prod.estoqueBagageiroUnidades || 0) + item.saldo;
        }
    }

    db.contagens.push(contagemTemp);
    salvarDB();

    alert("Relatório enviado e sobras adicionadas ao estoque do Bagageiro!");
    contagemTemp = {};
    mostrarTela('tela-inicial');
}

// ==== RELATÓRIOS DO CHEFE ====
function abrirRelatoriosAdmin() {
    const hj = new Date().toISOString().split('T')[0];
    if(!document.getElementById('filtroDataRelatorio').value) {
        document.getElementById('filtroDataRelatorio').value = hj;
    }
    setModoRelatorio('vagao');
    mostrarTela('tela-relatorios');
}

function setModoRelatorio(modo) {
    modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelGeral'].forEach(id => document.getElementById(id).style.background = '#e2e8f0');
    if(modo === 'vagao') document.getElementById('btnRelVagao').style.background = 'var(--primary)';
    if(modo === 'turisticos') document.getElementById('btnRelTur').style.background = 'var(--primary)';
    if(modo === 'geral') document.getElementById('btnRelGeral').style.background = 'var(--primary)';
    renderizarRelatoriosAdmin();
}

function renderizarRelatoriosAdmin() {
    const div = document.getElementById('listaRelatoriosAdmin');
    div.innerHTML = "";

    const dataFiltro = document.getElementById('filtroDataRelatorio').value;
    const filtrados = db.contagens.filter(c => c.data === dataFiltro);

    if(filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum registro para esta data.</p>';
        return;
    }

    if (modoRelatorioAdmin === 'vagao') {
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
            if(modoRelatorioAdmin === 'turisticos' && !c.vagao.toLowerCase().includes('turístico')) return;

            for(let key in c.itens) {
                let item = c.itens[key];
                if(!consolidados[key]) consolidados[key] = { id: key, nome: item.nome, carga: 0, pax: 0, trip: 0, ava: 0, saldo: 0 };
                consolidados[key].carga += item.carga;
                consolidados[key].pax += item.pax;
                consolidados[key].trip += item.trip;
                consolidados[key].ava += item.ava;
                consolidados[key].saldo += item.saldo;
            }
        });

        const titulo = modoRelatorioAdmin === 'turisticos' ? 'Soma: Todos os Vagões Turísticos' : 'Balanço Geral de Bordo (Todos os Vagões)';
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
}

function gerarLinhasTabelaAdmin(itensObjeto) {
    let arr = Object.values(itensObjeto);
    ordenarPorRegra(arr);
    let html = "";
    arr.forEach(obj => {
        if(obj.carga > 0 || obj.saldo > 0 || obj.pax > 0 || obj.ava > 0) {
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

// ==== CARRINHO DE VENDAS ====
function iniciarAcertoCarrinho() {
    const div = document.getElementById('listaItensCarrinho');
    div.innerHTML = "";
    db.produtos.filter(p => p.precoVenda > 0).forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span>${p.nome} (R$ ${p.precoVenda})</span></div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div><label>Saiu com:</label><input type="number" id="venda_saiu_${p.id}" value="0" onfocus="this.select()" oninput="calcularVendas()"></div>
                    <div><label>Sobrou:</label><input type="number" id="venda_sobrou_${p.id}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularVendas()"></div>
                </div>
            </div>
        `;
    });
    document.getElementById('carrinhoTroco').value = 0;
    calcularVendas();
    mostrarTela('tela-acerto-carrinho');
}

function calcularVendas() {
    let totalR$ = 0;
    db.produtos.filter(p => p.precoVenda > 0).forEach(p => {
        const saiu = parseInt(document.getElementById(`venda_saiu_${p.id}`).value) || 0;
        const sobrou = parseInt(document.getElementById(`venda_sobrou_${p.id}`).value) || 0;
        const vendidos = Math.max(0, saiu - sobrou);
        totalR$ += (vendidos * p.precoVenda);
    });
    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;
    document.getElementById('lblTotalVendasCarrinho').innerText = totalR$.toFixed(2).replace('.', ',');
    document.getElementById('lblTotalEntregar').innerText = 'R$ ' + (totalR$ + troco).toFixed(2).replace('.', ',');
}

function salvarAcertoCarrinho() {
    alert(`Acerto concluído! Total vendido: R$ ${document.getElementById('lblTotalVendasCarrinho').innerText}`);
    mostrarTela('tela-setup-contagem');
}

function resetarDadosTeste() {
    if(confirm("Deseja restaurar os estoques e zerar as contagens de teste?")) {
        localStorage.removeItem('tremBebidasDB_V4');
        location.reload();
    }
}
