// Banco de Dados da V3
let db = {
    produtos: [
        { id: 'C', nome: 'Coca Lata', precoVenda: 0 },
        { id: 'Z', nome: 'Coca Zero', precoVenda: 0 },
        { id: 'G', nome: 'Guaraná Kuat', precoVenda: 0 },
        { id: 'Ac', nome: 'Água Copo', precoVenda: 0 }, // Alterado para 'Ac'
        { id: 'KL', nome: 'Kit Lanche', precoVenda: 0 },
        { id: 'AgGr', nome: 'Água c/ Gás (Venda)', precoVenda: 5 },
        { id: 'AgSr', nome: 'Água s/ Gás (Venda)', precoVenda: 5 },
        { id: 'Cerv', nome: 'Cerveja (Venda)', precoVenda: 10 }
    ],
    usuarios: [
        { nome: 'Gustavo' },
        { nome: 'Apoio 2' }
    ],
    contagens: []
};

let contagemTemp = {};
let modoRelatorioAdmin = 'vagao'; // 'vagao', 'turisticos', 'geral'

// ORDEM FIXA EXIGIDA PELO USUÁRIO (O que não estiver aqui, vai pro final)
const ORDEM_FIXA = ['C', 'G', 'Z', 'Ac', 'KL'];

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

window.onload = () => {
    const localDB = localStorage.getItem('tremBebidasDB_V3');
    if (localDB) db = JSON.parse(localDB);

    const hj = new Date().toISOString().split('T')[0];
    if(document.getElementById('dataOperacaoAdmin')) document.getElementById('dataOperacaoAdmin').innerText = hj.split('-').reverse().join('/');
    if(document.getElementById('filtroDataRelatorio')) document.getElementById('filtroDataRelatorio').value = hj;
};

function salvarDB() {
    localStorage.setItem('tremBebidasDB_V3', JSON.stringify(db));
}

function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
}

// === ORDENAÇÃO INTELIGENTE ===
// Essa função garante que a ordem sempre será: C, G, Z, Ac, KL. 
function ordenarPorRegra(lista) {
    return lista.sort((a, b) => {
        let idxA = ORDEM_FIXA.indexOf(a.id);
        let idxB = ORDEM_FIXA.indexOf(b.id);

        if (idxA !== -1 && idxB !== -1) return idxA - idxB; // Ambos na lista fixa
        if (idxA !== -1) return -1; // Só A na lista fixa (A sobe)
        if (idxB !== -1) return 1;  // Só B na lista fixa (B sobe)
        
        // Se nenhum estiver na lista fixa, ordem alfabética pelo nome
        return a.nome.localeCompare(b.nome);
    });
}

function ordenarUsuarios() {
    db.usuarios.sort((a, b) => a.nome.localeCompare(b.nome));
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
}

function logout() { 
    mostrarTela('tela-inicial'); 
}

// ==== ADMIN: USUÁRIOS ====
function renderizarUsuarios() {
    ordenarUsuarios();
    const div = document.getElementById('listaUsuariosAdmin');
    div.innerHTML = "";
    db.usuarios.forEach((u, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border); align-items: center;">
                <div><i class="ph ph-user"></i> ${u.nome}</div>
                <button class="btn-danger btn-pequeno" onclick="removerUsuario(${index})"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
}

function adicionarUsuario() {
    const nome = document.getElementById('novoUsuarioNome').value.trim();
    if(!nome) return;
    db.usuarios.push({ nome });
    salvarDB();
    renderizarUsuarios();
    document.getElementById('novoUsuarioNome').value = "";
}

function removerUsuario(index) {
    if(confirm("Remover este apoio?")) {
        db.usuarios.splice(index, 1);
        salvarDB();
        renderizarUsuarios();
    }
}
document.querySelector('[onclick="mostrarTela(\'tela-usuarios\')"]').addEventListener('click', renderizarUsuarios);

// ==== ADMIN: PRODUTOS ====
function renderizarProdutosAdmin() {
    ordenarPorRegra(db.produtos);
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    db.produtos.forEach((p, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <div style="font-size:14px;"><strong>${p.id}</strong> - ${p.nome} ${p.precoVenda > 0 ? `(R$ ${p.precoVenda})` : ''}</div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-secondary btn-pequeno" onclick="editarProduto(${index})"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-danger btn-pequeno" onclick="removerProduto(${index})"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
}
document.querySelector('[onclick="mostrarTela(\'tela-cadastro-produtos\')"]').addEventListener('click', renderizarProdutosAdmin);

function salvarProduto() {
    const id = document.getElementById('novoProdSigla').value;
    const nome = document.getElementById('novoProdNome').value;
    const indexEdit = document.getElementById('editProdIndex').value;
    
    if(!id || !nome) return alert("Preencha sigla e nome.");
    
    if (indexEdit !== "") {
        db.produtos[indexEdit].id = id;
        db.produtos[indexEdit].nome = nome;
    } else {
        db.produtos.push({ id, nome, precoVenda: 0 });
    }
    
    salvarDB();
    renderizarProdutosAdmin();
    
    document.getElementById('novoProdSigla').value = "";
    document.getElementById('novoProdNome').value = "";
    document.getElementById('editProdIndex').value = "";
    document.getElementById('btnSalvarProd').innerHTML = '<i class="ph ph-plus"></i>';
}

function editarProduto(index) {
    const p = db.produtos[index];
    document.getElementById('novoProdSigla').value = p.id;
    document.getElementById('novoProdNome').value = p.nome;
    document.getElementById('editProdIndex').value = index;
    document.getElementById('btnSalvarProd').innerHTML = '<i class="ph ph-check"></i>';
}

function removerProduto(index) {
    if(confirm("Excluir produto?")) {
        db.produtos.splice(index, 1);
        salvarDB();
        renderizarProdutosAdmin();
    }
}

// ==== ADMIN: RELATÓRIOS SALVOS (AGORA EM TABELA) ====
function abrirRelatoriosAdmin() {
    // Seta a data de hoje ao abrir
    const hj = new Date().toISOString().split('T')[0];
    if(!document.getElementById('filtroDataRelatorio').value) {
        document.getElementById('filtroDataRelatorio').value = hj;
    }
    setModoRelatorio('vagao');
    mostrarTela('tela-relatorios');
}

function setModoRelatorio(modo) {
    modoRelatorioAdmin = modo;
    // Estilo dos botões
    ['btnRelVagao', 'btnRelTur', 'btnRelGeral'].forEach(id => {
        document.getElementById(id).style.background = 'var(--secondary)';
    });
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
        div.innerHTML = '<p style="text-align:center; color:var(--secondary);">Nenhum relatório para esta data.</p>';
        return;
    }

    if (modoRelatorioAdmin === 'vagao') {
        // Mostra uma tabela para cada vagão
        filtrados.sort((a, b) => b.timestamp - a.timestamp).forEach(c => {
            let linhasTabela = gerarLinhasTabelaAdmin(c.itens);
            div.innerHTML += `
                <div class="box-relatorio-admin">
                    <div class="box-relatorio-header">
                        <strong>${c.vagao} (${c.sentido})</strong>
                        <span style="font-size:12px;">${c.apoio} | Guia: ${c.guia || '-'}</span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="tabela-relatorio" style="margin-top:0; border:none;">
                            <thead><tr><th>Produto</th><th>Carga</th><th>Pax</th><th>Trip.</th><th>Avaria</th><th>Sobra</th></tr></thead>
                            <tbody>${linhasTabela}</tbody>
                        </table>
                    </div>
                    ${c.obs ? `<div style="padding:8px; font-size:12px; color:var(--danger); background:#fdfdfd;"><i>Obs: ${c.obs}</i></div>` : ''}
                </div>
            `;
        });

    } else {
        // MODO CONSOLIDADO (Turísticos ou Geral)
        let consolidados = {};
        
        filtrados.forEach(c => {
            if(modoRelatorioAdmin === 'turisticos' && !c.vagao.toLowerCase().includes('turístico')) return;
            
            for(let key in c.itens) {
                let item = c.itens[key];
                if(!consolidados[key]) {
                    consolidados[key] = { id: key, nome: item.nome, carga: 0, pax: 0, trip: 0, ava: 0, saldo: 0 };
                }
                consolidados[key].carga += item.carga;
                consolidados[key].pax += item.pax;
                consolidados[key].trip += item.trip;
                consolidados[key].ava += item.ava;
                consolidados[key].saldo += item.saldo;
            }
        });

        const titulo = modoRelatorioAdmin === 'turisticos' ? 'Soma Total: Apenas Turísticos' : 'Soma Total: Todos os Estoques (Geral)';
        let linhasTabela = gerarLinhasTabelaAdmin(consolidados);

        if(linhasTabela === "") {
            div.innerHTML = '<p style="text-align:center; color:var(--secondary);">Nenhum dado encontrado para este filtro.</p>';
        } else {
            div.innerHTML = `
                <div class="box-relatorio-admin">
                    <div class="box-relatorio-header" style="background:var(--accent); color:var(--primary);">
                        <strong>${titulo}</strong>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="tabela-relatorio" style="margin-top:0; border:none;">
                            <thead><tr><th>Produto</th><th>Carga</th><th>Pax</th><th>Trip.</th><th>Avaria</th><th>Sobra</th></tr></thead>
                            <tbody>${linhasTabela}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }
}

// Função auxiliar para gerar o HTML das linhas da tabela ordenadas
function gerarLinhasTabelaAdmin(itensObjeto) {
    let arrayItens = Object.values(itensObjeto);
    ordenarPorRegra(arrayItens);
    let html = "";
    
    arrayItens.forEach(obj => {
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

// ==== APOIO: SETUP DE CONTAGEM ====
function abrirSetupContagem() {
    ordenarUsuarios();
    const selUser = document.getElementById('selectNomeApoio');
    selUser.innerHTML = "";
    db.usuarios.forEach(u => selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`);
    
    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = hj;
    document.getElementById('nomeGuiaApoio').value = ""; 
    
    mostrarTela('tela-setup-contagem');
}

// ==== APOIO: CONTAGEM DE VAGÃO ====
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
    const produtosVagao = db.produtos.filter(p => p.precoVenda === 0);

    produtosVagao.forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'Ac' || p.id === 'C' ? 24 : 0);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">${p.nome} (${p.id})</div>
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
                        <label>Cons. Pax:</label>
                        <input type="number" id="pax_${p.id}" class="input-pax" readonly value="${cargaPadrao}">
                    </div>
                    <div>
                        <label>Tripulação:</label>
                        <input type="number" id="trip_${p.id}" value="0" onfocus="this.select()" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Avaria/Perda:</label>
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

// ==== APOIO: RESUMO DA CONTAGEM ====
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

        if(obj.carga > 0 || obj.saldo > 0 || obj.trip > 0 || obj.ava > 0) {
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

            // Cálculo dos totalizadores (apenas o que foi para o PAX)
            if(p.id === 'KL') {
                totalLanches += obj.pax;
            } else {
                totalBebidas += obj.pax;
            }
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
    
    db.contagens.push(contagemTemp);
    salvarDB();
    
    alert("Relatório salvo e armazenado com sucesso!");
    contagemTemp = {};
    mostrarTela('tela-inicial');
}

// ==== APOIO: ACERTO DE CARRINHO DE VENDAS ====
function iniciarAcertoCarrinho() {
    const div = document.getElementById('listaItensCarrinho');
    div.innerHTML = "";

    const produtosVenda = db.produtos.filter(p => p.precoVenda > 0);

    produtosVenda.forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">${p.nome} (R$ ${p.precoVenda})</div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div>
                        <label>Saiu com:</label>
                        <input type="number" id="venda_saiu_${p.id}" value="0" onfocus="this.select()" oninput="calcularVendas()">
                    </div>
                    <div>
                        <label>Sobrou (Voltou):</label>
                        <input type="number" id="venda_sobrou_${p.id}" class="destaque-input" placeholder="0" onfocus="this.select()" oninput="calcularVendas()">
                    </div>
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
    const produtosVenda = db.produtos.filter(p => p.precoVenda > 0);

    produtosVenda.forEach(p => {
        const saiu = parseInt(document.getElementById(`venda_saiu_${p.id}`).value) || 0;
        const sobrou = parseInt(document.getElementById(`venda_sobrou_${p.id}`).value) || 0;
        const vendidos = saiu - sobrou;
        
        if (vendidos > 0) {
            totalR$ += (vendidos * p.precoVenda);
        }
    });

    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;
    
    document.getElementById('lblTotalVendasCarrinho').innerText = totalR$.toFixed(2).replace('.', ',');
    document.getElementById('lblTotalEntregar').innerText = 'R$ ' + (totalR$ + troco).toFixed(2).replace('.', ',');
}

function salvarAcertoCarrinho() {
    const totalVendaText = document.getElementById('lblTotalVendasCarrinho').innerText;
    alert(`Acerto salvo!\nTotal de vendas registrado: R$ ${totalVendaText}`);
    mostrarTela('tela-setup-contagem'); 
}