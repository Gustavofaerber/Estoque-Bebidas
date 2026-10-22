// ==========================================================================
// GERENCIAMENTO CENTRAL DE ESTADO, CACHE LOCAL E SINCRONIZAÇÃO FIRESTORE
// ==========================================================================
import { db, collection, onSnapshot } from '../config/firebase.js';
import { ORDEM_PADRAO_CHEFE, formatarEstoqueFardos } from '../utils/formatters.js';

export function getCache(key, fallback = []) {
    try {
        const val = localStorage.getItem(key);
        if (!val || val === "undefined" || val === "null") return fallback;
        const parsed = JSON.parse(val);
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        return parsed;
    } catch (e) {
        return fallback;
    }
}

export function setCache(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn("Erro ao gravar cache local:", key, e);
    }
}

export function inicializarEstadoGlobal() {
    window.produtosDB = getCache('trem_cache_produtos', []);
    window.usuariosDB = getCache('trem_cache_usuarios', []);
    window.vagoesDB = getCache('trem_cache_vagoes', []);
    window.receitasDB = getCache('trem_cache_receitas', []);
    window.contagensDB = getCache('trem_cache_contagens', []);
    window.cargasDiaDB = getCache('trem_cache_cargas', []);
    window.cargasVagoesDB = getCache('trem_cache_cargas_vagoes', []);
    window.vendasCarrinhoDB = getCache('trem_cache_vendas', []);
    window.viagensStatusDB = getCache('trem_cache_viagens_status', {});

    window.contagemTemp = {};
    window.itensExtrasCarrinhoTemp = [];
    window.modoRelatorioAdmin = 'todos';
    window.filtroSentidoRelatorio = 'todos';
    window.vagaoOperacaoSelecionadoId = null;
    window.sentidoCargaVagao = 'Ida';
    window.abaEstoqueAtiva = 'editor';
    window.filtroRapidoEstoque = 'todos';
}

export function normalizarProdutoDoc(d) {
    const raw = typeof d.data === 'function' ? d.data() : d;
    const docId = d.id || raw._docId || raw.id;
    const id = (raw.id !== undefined && String(raw.id).trim() !== "") ? String(raw.id).trim() : String(docId);
    let ordem = raw.ordem;
    if (ordem === undefined || ordem === null || ordem === "") {
        const idx = ORDEM_PADRAO_CHEFE.indexOf(id);
        ordem = idx !== -1 ? idx + 1 : 99;
    } else {
        ordem = parseInt(ordem) || 99;
    }

    return {
        ...raw,
        id,
        sigla: raw.sigla || id,
        _docId: String(docId),
        ordem,
        unidadesPorFardo: Math.max(1, parseInt(raw.unidadesPorFardo) || 1),
        precoVenda: parseFloat(raw.precoVenda) || 0,
        estoqueContainerUnidades: parseInt(raw.estoqueContainerUnidades) || 0,
        estoqueBagageiroUnidades: parseInt(raw.estoqueBagageiroUnidades) || 0
    };
}

export function atualizarStatusRedeUI(online = navigator.onLine) {
    const pill = document.getElementById('syncStatusPill');
    const txt = document.getElementById('syncStatusTexto');
    if (!pill || !txt) return;
    if (online) {
        pill.classList.remove('offline');
        txt.innerText = 'Nuvem Sincronizada';
    } else {
        pill.classList.add('offline');
        txt.innerText = 'Modo Offline (Cache Ativo)';
    }
}

export function atualizarDashboardKPIs() {
    let totalUnBaga = 0;
    let totalUnCont = 0;
    let totalFardosBaga = 0;
    let totalFardosCont = 0;

    if (Array.isArray(window.produtosDB)) {
        window.produtosDB.forEach(p => {
            const unCont = parseInt(p.estoqueContainerUnidades) || 0;
            const unBaga = parseInt(p.estoqueBagageiroUnidades) || 0;
            const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);

            totalUnCont += unCont;
            totalUnBaga += unBaga;
            if (unFardo > 1) {
                totalFardosCont += Math.floor(unCont / unFardo);
                totalFardosBaga += Math.floor(unBaga / unFardo);
            }
        });
    }

    const elBaga = document.getElementById('kpiBagageiroTotal');
    const elCont = document.getElementById('kpiContainerTotal');
    const elBagaSub = document.getElementById('kpiBagageiroSub');
    const elContSub = document.getElementById('kpiContainerSub');

    if (elBaga) elBaga.innerText = `${totalUnBaga} un`;
    if (elCont) elCont.innerText = `${totalUnCont} un`;
    if (elBagaSub) elBagaSub.innerText = `~ ${totalFardosBaga} fardos fechados`;
    if (elContSub) elContSub.innerText = `~ ${totalFardosCont} fardos fechados`;
}

export function iniciarSincronizacaoNuvem() {
    window.addEventListener('online', () => atualizarStatusRedeUI(true));
    window.addEventListener('offline', () => atualizarStatusRedeUI(false));
    atualizarStatusRedeUI(navigator.onLine);

    onSnapshot(collection(db, "produtos"), (snapshot) => {
        if (snapshot.docs.length > 0 || !snapshot.metadata.fromCache) {
            window.produtosDB = snapshot.docs.map(d => normalizarProdutoDoc(d));
            setCache('trem_cache_produtos', window.produtosDB);
        }
        atualizarDashboardKPIs();
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-cadastro-produtos' && typeof window.renderizarProdutosAdmin === 'function') {
            window.renderizarProdutosAdmin();
        }
        if (telaAtiva === 'tela-estoques') {
            if (typeof window.renderizarApenasTabelasResumoEstoques === 'function') {
                window.renderizarApenasTabelasResumoEstoques();
            }
            if (typeof window.atualizarKPIsInternosEstoque === 'function') {
                window.atualizarKPIsInternosEstoque();
            }
            // Se a lista de edição ainda estiver vazia ou nenhum input de estoque estiver focado, sincroniza os cards
            const listaEl = document.getElementById('listaEstoqueGeral');
            const inputFocado = document.activeElement && document.activeElement.id && document.activeElement.id.startsWith('est_');
            if (listaEl && (!listaEl.children.length || !inputFocado) && typeof window.abrirTelaEstoques === 'function') {
                window.abrirTelaEstoques(true);
            }
        }
        if (telaAtiva === 'tela-carga-vagao' && typeof window.renderizarPainelEstoqueTransito === 'function') {
            window.renderizarPainelEstoqueTransito();
        }
    });

    onSnapshot(collection(db, "receitas_carga"), (snapshot) => {
        if (snapshot.docs.length > 0 || !snapshot.metadata.fromCache) {
            window.receitasDB = snapshot.docs.map(d => {
                const data = d.data();
                return { ...data, id: data.id || d.id, _docId: d.id };
            });
            setCache('trem_cache_receitas', window.receitasDB);
        }
        if (document.getElementById('tela-receitas')?.classList.contains('ativa') && typeof window.renderizarReceitasAdmin === 'function') {
            window.renderizarReceitasAdmin();
        }
    });

    onSnapshot(collection(db, "usuarios"), (snapshot) => {
        if (snapshot.docs.length > 0 || !snapshot.metadata.fromCache) {
            window.usuariosDB = snapshot.docs.map(d => {
                const data = d.data();
                return { ...data, id: data.id || d.id, _docId: d.id };
            });
            setCache('trem_cache_usuarios', window.usuariosDB);
        }
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-usuarios' && typeof window.renderizarUsuarios === 'function') window.renderizarUsuarios();
        if (telaAtiva === 'tela-setup-contagem' && typeof window.abrirSetupContagem === 'function') window.abrirSetupContagem();
        if (telaAtiva === 'tela-setup-carrinho' && typeof window.abrirSetupCarrinho === 'function') window.abrirSetupCarrinho();
        if (telaAtiva === 'tela-boutiques-hub' && typeof window.carregarSelectBoutiqueHub === 'function') window.carregarSelectBoutiqueHub();
    });

    onSnapshot(collection(db, "vagoes"), (snapshot) => {
        if (snapshot.docs.length > 0 || !snapshot.metadata.fromCache) {
            window.vagoesDB = snapshot.docs.map(d => {
                const data = d.data();
                return { ...data, id: data.id || d.id, _docId: d.id };
            });
            setCache('trem_cache_vagoes', window.vagoesDB);
        }
        const telaAtiva = document.querySelector('.tela.ativa')?.id;
        if (telaAtiva === 'tela-vagoes' && typeof window.renderizarVagoesAdmin === 'function') window.renderizarVagoesAdmin();
        if (telaAtiva === 'tela-setup-contagem' && typeof window.abrirSetupContagem === 'function') window.abrirSetupContagem();
        if (telaAtiva === 'tela-operacao-viagem' && typeof window.carregarMonitorViagem === 'function') window.carregarMonitorViagem();
        if (telaAtiva === 'tela-carga-vagao' && typeof window.renderizarVagoesParaCarga === 'function') window.renderizarVagoesParaCarga();
    });

    onSnapshot(collection(db, "contagens"), (snapshot) => {
        window.contagensDB = snapshot.docs.map(d => {
            const data = d.data();
            return { ...data, id: data.id || d.id, _docId: d.id };
        });
        setCache('trem_cache_contagens', window.contagensDB);
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa') && typeof window.renderizarRelatoriosAdmin === 'function') {
            window.renderizarRelatoriosAdmin();
        }
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa') && typeof window.carregarMonitorViagem === 'function') {
            window.carregarMonitorViagem();
        }
    });

    onSnapshot(collection(db, "cargas_dia"), (snapshot) => {
        window.cargasDiaDB = snapshot.docs.map(d => {
            const data = d.data();
            return { ...data, id: data.id || d.id, _docId: d.id };
        });
        setCache('trem_cache_cargas', window.cargasDiaDB);
        if (document.getElementById('tela-ver-carga')?.classList.contains('ativa') && typeof window.carregarManifestoPublico === 'function') {
            window.carregarManifestoPublico(false);
        }
        if (document.getElementById('tela-carga-dia')?.classList.contains('ativa') && typeof window.verificarStatusEdicaoCarga === 'function') {
            window.verificarStatusEdicaoCarga();
        }
        if (document.getElementById('tela-carga-vagao')?.classList.contains('ativa') && typeof window.renderizarPainelEstoqueTransito === 'function') {
            window.renderizarPainelEstoqueTransito();
        }
    });

    onSnapshot(collection(db, "cargas_vagoes"), (snapshot) => {
        window.cargasVagoesDB = snapshot.docs.map(d => {
            const data = d.data();
            return { ...data, id: data.id || d.id, _docId: d.id };
        });
        setCache('trem_cache_cargas_vagoes', window.cargasVagoesDB);
        if (document.getElementById('tela-carga-vagao')?.classList.contains('ativa')) {
            if (typeof window.renderizarVagoesParaCarga === 'function') window.renderizarVagoesParaCarga();
            if (typeof window.renderizarPainelEstoqueTransito === 'function') window.renderizarPainelEstoqueTransito();
        }
        if (document.getElementById('tela-boutiques-hub')?.classList.contains('ativa') && typeof window.carregarFormularioBoutiqueHub === 'function') {
            window.carregarFormularioBoutiqueHub();
        }
    });

    onSnapshot(collection(db, "vendas_carrinho"), (snapshot) => {
        window.vendasCarrinhoDB = snapshot.docs.map(d => {
            const data = d.data();
            return { ...data, id: data.id || d.id, _docId: d.id };
        });
        setCache('trem_cache_vendas', window.vendasCarrinhoDB);
        if (document.getElementById('tela-relatorios')?.classList.contains('ativa') && typeof window.renderizarRelatoriosAdmin === 'function') {
            window.renderizarRelatoriosAdmin();
        }
    });

    onSnapshot(collection(db, "viagens_status"), (snapshot) => {
        snapshot.docs.forEach(d => {
            window.viagensStatusDB[d.id] = d.data();
        });
        setCache('trem_cache_viagens_status', window.viagensStatusDB);
        if (document.getElementById('tela-operacao-viagem')?.classList.contains('ativa') && typeof window.carregarMonitorViagem === 'function') {
            window.carregarMonitorViagem();
        }
    });
}
