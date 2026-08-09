// Banco de Dados Inicial em Memória
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

// Variável temporária para segurar os dados antes de "Confirmar e Enviar"
let contagemTemp = {};

window.onload = () => {
    const localDB = localStorage.getItem('tremBebidasDB_V1_1');
    if (localDB) db = JSON.parse(localDB);

    const hj = new Date().toLocaleDateString('pt-BR');
    if(document.getElementById('dataOperacaoAdmin')) document.getElementById('dataOperacaoAdmin').innerText = hj;
};

function salvarDB() {
    localStorage.setItem('tremBebidasDB_V1_1', JSON.stringify(db));
}

function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
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
    mostrarTela('tela-admin');
}
function logout() { mostrarTela('tela-inicial'); }

// ==== ADMIN: USUÁRIOS ====
function renderizarUsuarios() {
    const div = document.getElementById('listaUsuariosAdmin');
    div.innerHTML = "";
    db.usuarios.forEach((u, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid #ccc;">
                <div><i class="ph ph-user"></i> ${u.nome}</div>
                <button class="btn-danger" style="padding: 4px 8px; border-radius:4px; border:none;" onclick="removerUsuario(${index})"><i class="ph ph-trash"></i></button>
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
// Escuta de aberturas de tela para renderizar listas
document.querySelector('[onclick="mostrarTela(\'tela-usuarios\')"]').addEventListener('click', renderizarUsuarios);


// ==== ADMIN: PRODUTOS ====
function renderizarProdutosAdmin() {
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    db.produtos.forEach((p, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #ccc;">
                <div><strong>${p.id}</strong> - ${p.nome} ${p.precoVenda > 0 ? `(R$ ${p.precoVenda})` : ''}</div>
                <div>
                    <button class="btn-secondary" style="padding: 4px 8px; border-radius:4px; border:none; margin-right:5px;" onclick="editarProduto(${index})"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-danger" style="padding: 4px 8px; border-radius:4px; border:none;" onclick="removerProduto(${index})"><i class="ph ph-trash"></i></button>
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

// ==== APOIO: SETUP DE CONTAGEM ====
function abrirSetupContagem() {
    const selUser = document.getElementById('selectNomeApoio');
    selUser.innerHTML = "";
    db.usuarios.forEach(u => selUser.innerHTML += `<option value="${u.nome}">${u.nome}</option>`);
    
    const hj = new Date().toISOString().split('T')[0];
    document.getElementById('dataContagemApoio').value = hj;
    
    mostrarTela('tela-setup-contagem');
}

// ==== APOIO: CONTAGEM DE VAGÃO ====
function iniciarContagemVagao() {
    contagemTemp.apoio = document.getElementById('selectNomeApoio').value;
    contagemTemp.data = document.getElementById('dataContagemApoio').value;
    contagemTemp.sentido = document.getElementById('selectSentidoApoio').value;
    contagemTemp.vagao = document.getElementById('selectVagaoApoio').value;

    document.getElementById('lblVagaoContagem').innerText = contagemTemp.vagao;
    document.getElementById('lblSentidoContagem').innerText = contagemTemp.sentido;
    
    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    const produtosVagao = db.produtos.filter(p => p.precoVenda === 0);

    produtosVagao.forEach(p => {
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'AgCp' || p.id === 'C' ? 24 : 0);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">${p.id} - ${p.nome}</div>
                <div class="grid-inputs">
                    <div>
                        <label>Carga:</label>
                        <input type="number" id="carga_${p.id}" value="${cargaPadrao}" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Saldo (Sobra):</label>
                        <input type="number" id="saldo_${p.id}" class="destaque-input" placeholder="0" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Cons. Pax:</label>
                        <input type="number" id="pax_${p.id}" class="input-pax" readonly value="${cargaPadrao}">
                    </div>
                    <div>
                        <label>Tripulação:</label>
                        <input type="number" id="trip_${p.id}" value="0" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Avaria/Perda:</label>
                        <input type="number" id="ava_${p.id}" class="input-avaria" value="0" oninput="calcularConsumo('${p.id}')">
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

// ==== APOIO: RESUMO DA CONTAGEM (RELATÓRIO PAPEL) ====
function gerarResumoContagem() {
    contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";

    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        let obj = {
            nome: p.id,
            carga: parseInt(document.getElementById(`carga_${p.id}`).value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`).value) || 0,
            trip: parseInt(document.getElementById(`trip_${p.id}`).value) || 0,
            ava: parseInt(document.getElementById(`ava_${p.id}`).value) || 0,
            pax: parseInt(document.getElementById(`pax_${p.id}`).value) || 0
        };
        
        contagemTemp.itens[p.id] = obj;

        // Só exibe no resumo se teve carga > 0 ou movimento
        if(obj.carga > 0 || obj.saldo > 0 || obj.trip > 0 || obj.ava > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${obj.nome}</td>
                    <td>${obj.carga}</td>
                    <td style="color:var(--success); font-weight:bold;">${obj.pax}</td>
                    <td>${obj.trip > 0 ? obj.trip : '-'}</td>
                    <td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td>
                    <td style="font-weight:bold;">${obj.saldo}</td>
                </tr>
            `;
        }
    });

    document.getElementById('resumoApoio').innerText = contagemTemp.apoio;
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
    
    alert("Relatório Enviado com Sucesso!");
    contagemTemp = {}; // Limpa memória
    mostrarTela('tela-inicial');
}