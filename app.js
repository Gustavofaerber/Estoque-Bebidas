// ==========================================================================
// LOGÍSTICA DE BEBIDAS - PONTO DE ENTRADA DA APLICAÇÃO (ORQUESTRADOR)
// ==========================================================================
import { escapeHTML, formatarMoeda, focarProximo } from './src/utils/formatters.js';
import {
    garantirModalConfirmacao,
    mostrarToast,
    abrirModal,
    fecharModal,
    abrirConfirmacao,
    executarConfirmacao
} from './src/utils/toast.js';
import {
    inicializarEstadoGlobal,
    iniciarSincronizacaoNuvem,
    atualizarDashboardKPIs
} from './src/state/store.js';
import {
    mostrarTela,
    irParaPainelChefe,
    fazerLogin,
    logout,
    restaurarSessaoOuTela
} from './src/state/router.js';

// Módulos de Domínio
import {
    renderizarProdutosAdmin,
    abrirModalProduto,
    salvarProdutoModal,
    excluirProduto
} from './src/modules/produtos.js';
import {
    renderizarUsuarios,
    adicionarUsuario,
    excluirUsuario
} from './src/modules/usuarios.js';
import {
    atualizarKPIsInternosEstoque,
    renderizarApenasTabelasResumoEstoques,
    alternarVisaoEstoque,
    setFiltroRapidoEstoque,
    filtrarCardsEstoqueUI,
    abrirTelaEstoques,
    stepEstoqueInput,
    transferirFardoContParaBaga,
    restaurarItemEstoque,
    calcularTotEstoqueLinha,
    salvarDraftEstoque,
    limparDraftEstoque,
    salvarEstoqueProdutoIndividual,
    abrirModalConfirmaEstoque,
    confirmarAjustesEstoqueComObs
} from './src/modules/estoques.js';
import {
    renderizarReceitasAdmin,
    abrirModalReceita,
    salvarReceitaModal,
    excluirReceita
} from './src/modules/receitas.js';
import {
    renderizarVagoesAdmin,
    autoSugerirReceitaVagao,
    abrirModalVagao,
    atualizarCheckboxesBebidasPadrao,
    salvarVagaoModal,
    excluirVagao
} from './src/modules/vagoes.js';
import {
    verificarStatusEdicaoCarga,
    trocarDataCargaDia,
    copiarCargaDiaAnterior,
    abrirCargaDoDia,
    calcularFormulaLinha,
    salvarDraftCarga,
    limparDraftCarga,
    salvarCargaDoDia
} from './src/modules/carga-geral.js';
import {
    renderizarPainelEstoqueTransito,
    trocarSentidoCargaVagao,
    renderizarVagoesParaCarga,
    alternarAtivacaoVagao,
    abrirModalMontarCargaVagao,
    aplicarReceitaNaCargaModal,
    copiarCargaVagaoAnteriorModal,
    salvarCargaVagaoModal,
    abrirModalDetalhesRetornoBoutique,
    editarRetornoBoutiqueNaCarga
} from './src/modules/carga-vagao.js';
import {
    carregarManifestoPublico,
    copiarManifestoTexto
} from './src/modules/manifesto.js';
import {
    carregarMonitorViagem,
    iniciarViagemIda,
    prepararRetornoMorretes,
    iniciarViagemVolta,
    abrirModalVagaoOperacao,
    renderizarListaReforcosFeitos,
    adicionarReforcoVagao,
    removerReforcoVagao
} from './src/modules/monitor.js';
import {
    carregarSelectBoutiqueHub,
    carregarFormularioBoutiqueHub,
    atualizarPreviaRetorno,
    salvarSobrasBoutiqueDirect,
    salvarAjusteRetornoBoutique
} from './src/modules/boutiques.js';
import {
    abrirSetupContagem,
    iniciarContagemVagao,
    calcularConsumo,
    salvarDraftContagem,
    gerarResumoContagem,
    salvarContagemDefinitiva
} from './src/modules/contagem.js';
import {
    abrirSetupCarrinho,
    iniciarAcertoCarrinho,
    calcularVendas,
    adicionarItemExtraVenda,
    removerItemExtraVenda,
    renderizarExtrasAdicionados,
    salvarAcertoCarrinho
} from './src/modules/carrinho.js';
import {
    setModoRelatorio,
    setFiltroSentido,
    renderizarRelatoriosAdmin,
    abrirModalEdicaoVenda,
    salvarEdicaoVenda,
    abrirModalEdicaoRelatorio,
    salvarEdicaoRelatorioPeloChefe,
    excluirRelatorioPeloChefe
} from './src/modules/relatorios.js';

// ================= REGISTRO DE HANDLERS GLOBAIS DA INTERFACE =================
Object.assign(window, {
    // Utilitários & UI
    escapeHTML,
    formatarMoeda,
    focarProximo,
    mostrarToast,
    abrirModal,
    fecharModal,
    abrirConfirmacao,
    executarConfirmacao,
    atualizarDashboardKPIs,

    // Roteador & Sessão
    mostrarTela,
    irParaPainelChefe,
    fazerLogin,
    logout,

    // Produtos
    renderizarProdutosAdmin,
    abrirModalProduto,
    salvarProdutoModal,
    excluirProduto,

    // Usuários (Apoios)
    renderizarUsuarios,
    adicionarUsuario,
    excluirUsuario,

    // Estoques (Novo Editor Profissional)
    atualizarKPIsInternosEstoque,
    renderizarApenasTabelasResumoEstoques,
    alternarVisaoEstoque,
    setFiltroRapidoEstoque,
    filtrarCardsEstoqueUI,
    abrirTelaEstoques,
    stepEstoqueInput,
    transferirFardoContParaBaga,
    restaurarItemEstoque,
    calcularTotEstoqueLinha,
    salvarDraftEstoque,
    limparDraftEstoque,
    salvarEstoqueProdutoIndividual,
    abrirModalConfirmaEstoque,
    confirmarAjustesEstoqueComObs,

    // Receitas (Kits)
    renderizarReceitasAdmin,
    abrirModalReceita,
    salvarReceitaModal,
    excluirReceita,

    // Frota de Vagões
    renderizarVagoesAdmin,
    autoSugerirReceitaVagao,
    abrirModalVagao,
    atualizarCheckboxesBebidasPadrao,
    salvarVagaoModal,
    excluirVagao,

    // Carga Geral do Dia
    verificarStatusEdicaoCarga,
    trocarDataCargaDia,
    copiarCargaDiaAnterior,
    abrirCargaDoDia,
    calcularFormulaLinha,
    salvarDraftCarga,
    limparDraftCarga,
    salvarCargaDoDia,

    // Carga por Vagão & Nuvem de Trânsito
    renderizarPainelEstoqueTransito,
    trocarSentidoCargaVagao,
    renderizarVagoesParaCarga,
    alternarAtivacaoVagao,
    abrirModalMontarCargaVagao,
    aplicarReceitaNaCargaModal,
    copiarCargaVagaoAnteriorModal,
    salvarCargaVagaoModal,
    abrirModalDetalhesRetornoBoutique,
    editarRetornoBoutiqueNaCarga,

    // Manifesto Público
    carregarManifestoPublico,
    copiarManifestoTexto,

    // Monitor da Viagem & Reforços
    carregarMonitorViagem,
    iniciarViagemIda,
    prepararRetornoMorretes,
    iniciarViagemVolta,
    abrirModalVagaoOperacao,
    renderizarListaReforcosFeitos,
    adicionarReforcoVagao,
    removerReforcoVagao,

    // Boutiques & Litorinas Hub
    carregarSelectBoutiqueHub,
    carregarFormularioBoutiqueHub,
    atualizarPreviaRetorno,
    salvarSobrasBoutiqueDirect,
    salvarAjusteRetornoBoutique,

    // Contagem de Vagão
    abrirSetupContagem,
    iniciarContagemVagao,
    calcularConsumo,
    salvarDraftContagem,
    gerarResumoContagem,
    salvarContagemDefinitiva,

    // Carrinho de Vendas
    abrirSetupCarrinho,
    iniciarAcertoCarrinho,
    calcularVendas,
    adicionarItemExtraVenda,
    removerItemExtraVenda,
    renderizarExtrasAdicionados,
    salvarAcertoCarrinho,

    // Relatórios & Correções
    setModoRelatorio,
    setFiltroSentido,
    renderizarRelatoriosAdmin,
    abrirModalEdicaoVenda,
    salvarEdicaoVenda,
    abrirModalEdicaoRelatorio,
    salvarEdicaoRelatorioPeloChefe,
    excluirRelatorioPeloChefe
});

// ================= INICIALIZAÇÃO DA APLICAÇÃO =================
inicializarEstadoGlobal();
garantirModalConfirmacao();
iniciarSincronizacaoNuvem();
restaurarSessaoOuTela();
