const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

const blocks = appJsContent.split('// ================= ');

const fileMapping = {
    'IMPORTAÇÕES FIREBASE FIRESTORE =================': 'src/firebase-config.js',
    'CSS E HTML DINÂMICOS =================': 'src/ui-utils.js',
    'NOTIFICAÇÕES E CONFIRMAÇÕES =================': 'src/ui-utils.js',
    'CACHE LOCAL SEGURO =================': 'src/globals.js',
    'MODAIS =================': 'src/ui-utils.js',
    'ROTEADOR =================': 'src/router.js',
    'SINCRONIZAÇÃO EM NUVEM E OFFLINE =================': 'src/sync.js',
    'MÓDULO: PRODUTOS & PREÇOS =================': 'src/produtos.js',
    'MÓDULO: USUÁRIOS =================': 'src/usuarios.js',
    'MÓDULO: SITUAÇÃO DOS ESTOQUES =================': 'src/estoque.js',
    'MÓDULO: RECEITAS DE CARGA =================': 'src/receitas.js',
    'FROTA DE VAGÕES =================': 'src/vagoes.js',
    'MÓDULO: ESTOQUE EM TRÂNSITO (NUVEM DO DIA) =================': 'src/nuvem.js',
    'CARGA POR VAGÃO (COM ABAS IDA / VOLTA & ATIVAÇÃO) =================': 'src/carga-vagao.js',
    'MODAL DETALHES RETORNO BOUTIQUE =================': 'src/boutiques-modal.js',
    'CARGA GERAL DO DIA =================': 'src/carga-dia.js',
    'ABA PÚBLICA: MANIFESTO =================': 'src/manifesto.js',
    'MONITOR DE VIAGEM =================': 'src/monitor.js',
    'BOUTIQUES HUB (SOBRAS & RETORNO INTUITIVO) =================': 'src/boutiques-hub.js',
    'CONTAGEM DE VAGÃO (APOIO - BLINDADA CONTRA DUPLICAÇÃO OFFLINE) =================': 'src/contagem.js',
    'CARRINHO DE VENDAS =================': 'src/carrinho.js',
    'RELATÓRIOS DO CHEFE =================': 'src/relatorios.js',
    'INICIALIZAÇÃO =================': 'src/init.js'
};

if (!fs.existsSync(path.join(__dirname, 'src'))) {
    fs.mkdirSync(path.join(__dirname, 'src'));
}

const fileContents = {};

blocks.forEach(block => {
    if (!block.trim()) return;
    const lines = block.split('\n');
    const header = lines[0].trim();
    const content = lines.slice(1).join('\n');
    
    if (fileMapping[header]) {
        const filePath = fileMapping[header];
        if (!fileContents[filePath]) fileContents[filePath] = '';
        fileContents[filePath] += '\n// ================= ' + header + '\n' + content;
    } else {
        console.log("Unmapped header:", header);
    }
});

// Write files
for (const [filePath, content] of Object.entries(fileContents)) {
    fs.writeFileSync(path.join(__dirname, filePath), content.trim() + '\n');
}

// Generate main.js
let mainContent = Object.keys(fileContents).map(fp => `import './${path.basename(fp)}';`).join('\n');
fs.writeFileSync(path.join(__dirname, 'src', 'main.js'), mainContent);

console.log("Splitting done!");
