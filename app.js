// Dados Iniciais em Memória (Na V2, isso vai pro Firebase)
let db = {
    produtos: [
        { id: 'C', nome: 'Refrigerante (Coca)', precoVenda: 0 },
        { id: 'Z', nome: 'Coca Zero (Pq)', precoVenda: 0 },
        { id: 'G', nome: 'Guaraná Kuat', precoVenda: 0 },
        { id: 'AgCp', nome: 'Água Copo', precoVenda: 0 },
        { id: 'KL', nome: 'Kit Lanche', precoVenda: 0 },
        { id: 'AgGr', nome: 'Água G (Venda)', precoVenda: 5 }, // Preço fictício
        { id: 'Cerv', nome: 'Cerveja (Venda)', precoVenda: 10 }
    ],
    contagens: [],
    acertosCarrinho: []
};

let userLogado = null;

// Inicialização
window.onload = () => {
    // Carregar dados salvos (se houver)
    const localDB = localStorage.getItem('tremBebidasDB');
    if (localDB) db = JSON.parse(localDB);

    // Setar data de hoje no painel admin
    const hj = new Date().toLocaleDateString('pt-BR');
    if(document.getElementById('dataOperacaoAdmin')) document.getElementById('dataOperacaoAdmin').innerText = hj;
};

function salvarDB() {
    localStorage.setItem('tremBebidasDB', JSON.stringify(db));
}

function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo(0,0);
}

// ==== LOGIN FAKE ====
function fazerLogin() {
    const user = document.getElementById('loginUser').value.toLowerCase();
    const pass = document.getElementById('loginSenha').value;

    if (pass !== '1234') {
        const msg = document.getElementById('msgLogin');
        msg.innerText = "Senha incorreta!";
        msg.style.display = 'block';
        return;
    }

    userLogado = { nome: user, role: user === 'admin' ? 'admin' : 'apoio' };
    
    if (userLogado.role === 'admin') {
        mostrarTela('tela-admin');
        renderizarProdutosAdmin();
    } else {
        document.getElementById('lblNomeApoio').innerText = "Olá, " + userLogado.nome;
        mostrarTela('tela-apoio');
    }
}

function logout() {
    userLogado = null;
    mostrarTela('tela-login');
}

// ==== ADMIN: PRODUTOS ====
function renderizarProdutosAdmin() {
    const div = document.getElementById('listaProdutosAdmin');
    div.innerHTML = "";
    db.produtos.forEach((p, index) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid #ccc;">
                <div><strong>${p.id}</strong> - ${p.nome} ${p.precoVenda > 0 ? `(R$ ${p.precoVenda})` : ''}</div>
                <button onclick="removerProduto(${index})" style="background:red; color:white; border:none; border-radius:4px;">X</button>
            </div>
        `;
    });
}

function adicionarProduto() {
    const id = document.getElementById('novoProdSigla').value;
    const nome = document.getElementById('novoProdNome').value;
    if(!id || !nome) return alert("Preencha sigla e nome.");
    db.produtos.push({ id, nome, precoVenda: 0 });
    salvarDB();
    renderizarProdutosAdmin();
    document.getElementById('novoProdSigla').value = "";
    document.getElementById('novoProdNome').value = "";
}

function removerProduto(index) {
    if(confirm("Excluir produto?")) {
        db.produtos.splice(index, 1);
        salvarDB();
        renderizarProdutosAdmin();
    }
}

// ==== APOIO: CONTAGEM DE VAGÃO ====
function iniciarContagemVagao() {
    const vagao = document.getElementById('selectVagaoApoio').value;
    document.getElementById('lblVagaoContagem').innerText = vagao;
    
    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";

    // Filtra apenas produtos que não são exclusivos de venda
    const produtosVagao = db.produtos.filter(p => p.precoVenda === 0);

    produtosVagao.forEach(p => {
        // Carga padrão fictícia para Turístico
        let cargaPadrao = p.id === 'KL' ? 49 : (p.id === 'C' ? 24 : 0);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">${p.id} - ${p.nome}</div>
                <div class="grid-inputs">
                    <div>
                        <label>Carga Inicial:</label>
                        <input type="number" id="carga_${p.id}" value="${cargaPadrao}" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Saldo Atual (Sobrou):</label>
                        <input type="number" id="saldo_${p.id}" class="destaque-input" placeholder="0" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Cons. Trip/Guias:</label>
                        <input type="number" id="trip_${p.id}" value="0" oninput="calcularConsumo('${p.id}')">
                    </div>
                    <div>
                        <label>Consumo PAX (Auto):</label>
                        <input type="number" id="pax_${p.id}" readonly style="background:#e8f8f5; color:#27ae60;">
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('obsContagemVagao').value = "";
    mostrarTela('tela-contagem-vagao');
}

function calcularConsumo(id) {
    const carga = parseInt(document.getElementById(`carga_${id}`).value) || 0;
    const saldo = parseInt(document.getElementById(`saldo_${id}`).value) || 0;
    const trip = parseInt(document.getElementById(`trip_${id}`).value) || 0;
    
    // Matemática: Consumo Pax = Carga - Sobras - Consumo da Tripulação
    let pax = carga - saldo - trip;
    document.getElementById(`pax_${id}`).value = pax < 0 ? 0 : pax;
}

function salvarContagemVagao() {
    const vagao = document.getElementById('lblVagaoContagem').innerText;
    const obs = document.getElementById('obsContagemVagao').value;
    let dados = {};

    db.produtos.filter(p => p.precoVenda === 0).forEach(p => {
        dados[p.id] = {
            carga: parseInt(document.getElementById(`carga_${p.id}`).value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`).value) || 0,
            consTrip: parseInt(document.getElementById(`trip_${p.id}`).value) || 0,
            consPax: parseInt(document.getElementById(`pax_${p.id}`).value) || 0
        };
    });

    db.contagens.push({
        data: new Date().toISOString(),
        apoio: userLogado.nome,
        vagao: vagao,
        itens: dados,
        observacoes: obs
    });

    salvarDB();
    alert("Contagem do vagão salva com sucesso!");
    mostrarTela('tela-apoio');
}

// ==== APOIO: ACERTO DE CARRINHO ====
function iniciarAcertoCarrinho() {
    const div = document.getElementById('listaItensCarrinho');
    div.innerHTML = "";

    const produtosVenda = db.produtos.filter(p => p.precoVenda > 0);

    produtosVenda.forEach(p => {
        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">${p.nome} (R$ ${p.precoVenda})</div>
                <div class="grid-inputs">
                    <div>
                        <label>Saiu com:</label>
                        <input type="number" id="venda_saiu_${p.id}" value="0" oninput="calcularVendas()">
                    </div>
                    <div>
                        <label>Sobrou (Voltou):</label>
                        <input type="number" id="venda_sobrou_${p.id}" class="destaque-input" placeholder="0" oninput="calcularVendas()">
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('carrinhoTroco').value = 0;
    document.getElementById('carrinhoTroco').addEventListener('input', calcularVendas);
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
    mostrarTela('tela-apoio');
}