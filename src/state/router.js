// ==========================================================================
// ROTEAMENTO DE TELAS E AUTENTICAÇÃO DO PAINEL DO CHEFE
// ==========================================================================
import { atualizarDashboardKPIs } from './store.js';

const TELAS_ADMIN = [
    'tela-admin',
    'tela-carga-dia',
    'tela-carga-vagao',
    'tela-receitas',
    'tela-estoques',
    'tela-vagoes',
    'tela-usuarios',
    'tela-cadastro-produtos',
    'tela-relatorios'
];

export function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    const tela = document.getElementById(id);
    if (tela) tela.classList.add('ativa');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    localStorage.setItem('trem_tela_ativa', id);

    const safeCall = (fn) => { if (typeof fn === 'function') fn(); };

    if (id === 'tela-admin') {
        const elDataOp = document.getElementById('dataOperacaoAdmin');
        if (elDataOp) {
            elDataOp.innerText = new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
        atualizarDashboardKPIs();
    }
    if (id === 'tela-cadastro-produtos') safeCall(window.renderizarProdutosAdmin);
    if (id === 'tela-usuarios') safeCall(window.renderizarUsuarios);
    if (id === 'tela-receitas') safeCall(window.renderizarReceitasAdmin);
    if (id === 'tela-vagoes') safeCall(window.renderizarVagoesAdmin);
    if (id === 'tela-estoques') safeCall(() => window.abrirTelaEstoques(false));
    if (id === 'tela-carga-dia') safeCall(window.abrirCargaDoDia);
    if (id === 'tela-carga-vagao') safeCall(window.renderizarVagoesParaCarga);
    if (id === 'tela-ver-carga') safeCall(() => window.carregarManifestoPublico(true));
    if (id === 'tela-relatorios') safeCall(window.renderizarRelatoriosAdmin);
    if (id === 'tela-setup-contagem') safeCall(window.abrirSetupContagem);
    if (id === 'tela-setup-carrinho') safeCall(window.abrirSetupCarrinho);
    if (id === 'tela-operacao-viagem') safeCall(window.carregarMonitorViagem);
    if (id === 'tela-boutiques-hub') safeCall(window.carregarSelectBoutiqueHub);
}

export function irParaPainelChefe() {
    if (localStorage.getItem('trem_chefe_sessao') === 'ativo') {
        mostrarTela('tela-admin');
    } else {
        mostrarTela('tela-login');
        setTimeout(() => document.getElementById('loginSenha')?.focus(), 100);
    }
}

export function fazerLogin() {
    const inputSenha = document.getElementById('loginSenha');
    const pass = inputSenha ? inputSenha.value : '';
    const msg = document.getElementById('msgLogin');

    if (pass !== '1234') {
        if (msg) {
            msg.innerText = "Senha incorreta! Verifique e tente novamente.";
            msg.style.display = 'block';
        }
        return;
    }
    if (inputSenha) inputSenha.value = "";
    if (msg) msg.style.display = 'none';

    localStorage.setItem('trem_chefe_sessao', 'ativo');
    mostrarTela('tela-admin');
}

export function logout() {
    localStorage.removeItem('trem_chefe_sessao');
    localStorage.removeItem('trem_tela_ativa');
    mostrarTela('tela-inicial');
}

export function restaurarSessaoOuTela() {
    const telaSalva = localStorage.getItem('trem_tela_ativa');
    const chefeLogado = localStorage.getItem('trem_chefe_sessao') === 'ativo';

    if (telaSalva && TELAS_ADMIN.includes(telaSalva)) {
        if (chefeLogado) mostrarTela(telaSalva);
        else mostrarTela('tela-login');
    } else if (telaSalva && document.getElementById(telaSalva)) {
        mostrarTela(telaSalva);
    } else {
        mostrarTela('tela-inicial');
    }
}
