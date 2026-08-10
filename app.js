// Banco de Dados da V2
let db = {
    produtos: [
        { id: 'C', nome: 'Coca Lata', precoVenda: 0 },
        { id: 'Z', nome: 'Coca Zero (Pq)', precoVenda: 0 },
        { id: 'G', nome: 'Guaraná Kuat', precoVenda: 0 },
        { id: 'AgCp', nome: 'Água Copo', precoVenda: 0 },
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

// Função auxiliar simples para prevenir quebra de layout no HTML
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

window.onload = () => {
    const localDB = localStorage.getItem('tremBebidasDB_V2');
    if (localDB) db = JSON.parse(localDB);

    // Forçar ordenação alfabética no primeiro carregamento
    ordenarTudo();

    const hj = new Date().toLocaleDateString('pt-BR');
    if(document.getElementById('dataOperacaoAdmin')) document.getElementById('dataOperacaoAdmin').innerText = hj;
};

function salvarDB() {
    localStorage.setItem('tremBebidasDB_V2', JSON.stringify(db));
}

function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
}

// Ordenação Alfabética Universal
function ordenarTudo() {
    db.produtos.sort((a, b) => a.nome.localeCompare(b.nome));
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
    document.getElementById('loginSenha').value = ""; // limpa a senha
    document.getElementById('msgLogin').style.display = 'none';
    mostrarTela('tela-admin');
}

function logout() { 
    mostrarTela('tela-inicial'); 
}

// ==== ADMIN: USUÁRIOS ====
function renderizarUsuarios() {
    ordenarTudo();
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
    ordenarTudo();
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
    ordenarTudo();
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
    
    ordenarTudo();
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

// ==== ADMIN: RELATÓRIOS SALVOS ====
function abrirRelatoriosAdmin() {
    const div = document.getElementById('listaRelatoriosAdmin');
    div.innerHTML = "";
    
    // Organiza do mais novo pro mais velho
    const contagensOrdenadas = [...db.contagens].sort((a, b) => b.timestamp - a.timestamp);

    if(contagensOrdenadas.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary);">Nenhum relatório salvo ainda.</p>';
    } else {
        contagensOrdenadas.forEach(c => {
            let htmlItens = "";
            for(let key in c.itens) {
                let i = c.itens[key];
                if(i.carga > 0 || i.saldo > 0 || i.pax > 0 || i.ava > 0) {
                    htmlItens += `<li style="padding: 3px 0; border-bottom: 1px dashed #eee;"><strong>${i.nome}</strong>: Carga ${i.carga} | Sobrou <b style="color:var(--primary);">${i.saldo}</b> | Pax <span style="color:var(--success);">${i.pax}</span></li>`;
                }
            }
            
            div.innerHTML += `
                <div class="card" style="border-left: 5px solid var(--accent); padding: 15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                        <strong>${c.vagao} (${c.sentido})</strong>
                        <span style="color:var(--secondary); font-size:12px;">${c.data.split('-').reverse().join('/')}</span>
                    </div>
                    <div style="font-size:12px; color:var(--secondary); margin-bottom: 10px;">
                        Apoio: <strong>${c.apoio}</strong> | Guia: <strong>${c.guia || 'N/I'}</strong>
                    </div>
                    <ul style="font-size:13px; padding:0; list-style:none; margin:0;">${htmlItens}</ul>
                    ${c.obs ? `<div style="font-size:12px; color:var(--danger); margin-top:8px;"><i>Obs: ${c.obs}</i></div>` : ''}
                </div>
            `;
        });
    }
    mostrarTela('tela-relatorios');
}

// ==== APOIO: SETUP DE CONTAGEM ====
function abrirSetupContagem() {
    ordenarTudo();
    const selUser = document.getElementById('selectNomeApoio');
    selUser.innerHTML = "";
    db.usuarios.forEach(u => selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`);
    
    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = hj;
    document.getElementById('nomeGuiaApoio').value = ""; // Reseta o guia
    
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

    ordenarTudo(); // Garante ordem alfabética na hora de contar
    const produtosVagao = db.produtos.filter(p => p.precoVenda === 0);

    produtosVagao.forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'AgCp' || p.id === 'C' ? 24 : 0);

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

// ==== APOIO: RESUMO DA CONTAGEM (RELATÓRIO) ====
function gerarResumoContagem() {
    contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";

    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        let obj = {
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
        }
    });

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
    mostrarTela('tela-setup-contagem'); // Volta para o setup
}