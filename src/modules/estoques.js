// ==========================================================================
// MÓDULO: GESTÃO PROFISSIONAL DE ESTOQUES (CONTÊINER & BAGAGEIRO)
// ==========================================================================
import { db, doc, writeBatch, setDoc } from '../config/firebase.js';
import { formatarEstoqueFardos, ordenarPorRegra, escapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';

function getDraftEstoque() {
    try {
        return JSON.parse(localStorage.getItem('trem_draft_estoque') || '{}') || {};
    } catch (e) {
        return {};
    }
}

function setDraftEstoque(draft) {
    if (!draft || Object.keys(draft).length === 0) {
        localStorage.removeItem('trem_draft_estoque');
    } else {
        localStorage.setItem('trem_draft_estoque', JSON.stringify(draft));
    }
}

/**
 * Calcula fardos e avulsas padrão a partir do total de unidades salvo no banco.
 */
function decomporUnidades(totalUnidades, unPorFardo) {
    const tot = Math.max(0, parseInt(totalUnidades) || 0);
    const unFardo = Math.max(1, parseInt(unPorFardo) || 1);
    if (unFardo <= 1) {
        return { fardos: 0, avulsas: tot };
    }
    return {
        fardos: Math.floor(tot / unFardo),
        avulsas: tot % unFardo
    };
}

/**
 * Obtém o estado atual (em edição ou salvo) de um produto.
 */
export function obterEstadoEdicaoProduto(p, draft = null) {
    const d = draft || getDraftEstoque();
    const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
    const curContTot = parseInt(p.estoqueContainerUnidades) || 0;
    const curBagaTot = parseInt(p.estoqueBagageiroUnidades) || 0;

    const padraoCont = decomporUnidades(curContTot, unFardo);
    const padraoBaga = decomporUnidades(curBagaTot, unFardo);

    const elFCont = document.getElementById(`est_cont_fardo_${p.id}`);
    const elUCont = document.getElementById(`est_cont_un_${p.id}`);
    const elFBaga = document.getElementById(`est_baga_fardo_${p.id}`);
    const elUBaga = document.getElementById(`est_baga_un_${p.id}`);

    const contFardos = elFCont
        ? (Math.max(0, parseInt(elFCont.value) || 0))
        : (d[p.id]?.contFardos ?? padraoCont.fardos);
    const contAvulsas = elUCont
        ? (Math.max(0, parseInt(elUCont.value) || 0))
        : (d[p.id]?.contAvulsas ?? padraoCont.avulsas);
    const bagaFardos = elFBaga
        ? (Math.max(0, parseInt(elFBaga.value) || 0))
        : (d[p.id]?.bagaFardos ?? padraoBaga.fardos);
    const bagaAvulsas = elUBaga
        ? (Math.max(0, parseInt(elUBaga.value) || 0))
        : (d[p.id]?.bagaAvulsas ?? padraoBaga.avulsas);

    const novoContUn = (contFardos * unFardo) + contAvulsas;
    const novoBagaUn = (bagaFardos * unFardo) + bagaAvulsas;

    return {
        contFardos,
        contAvulsas,
        bagaFardos,
        bagaAvulsas,
        curContTot,
        curBagaTot,
        novoContUn,
        novoBagaUn,
        deltaCont: novoContUn - curContTot,
        deltaBaga: novoBagaUn - curBagaTot,
        modificado: (novoContUn !== curContTot) || (novoBagaUn !== curBagaTot)
    };
}

export function atualizarKPIsInternosEstoque() {
    let totalContUn = 0;
    let totalBagaUn = 0;
    let totalContFd = 0;
    let totalBagaFd = 0;

    if (Array.isArray(window.produtosDB)) {
        window.produtosDB.forEach(p => {
            const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
            const cUn = parseInt(p.estoqueContainerUnidades) || 0;
            const bUn = parseInt(p.estoqueBagageiroUnidades) || 0;
            totalContUn += cUn;
            totalBagaUn += bUn;
            if (unFardo > 1) {
                totalContFd += Math.floor(cUn / unFardo);
                totalBagaFd += Math.floor(bUn / unFardo);
            }
        });
    }

    const elContUn = document.getElementById('estKpiContUn');
    const elContFd = document.getElementById('estKpiContFd');
    const elBagaUn = document.getElementById('estKpiBagaUn');
    const elBagaFd = document.getElementById('estKpiBagaFd');
    const elGeralUn = document.getElementById('estKpiGeralUn');
    const elGeralFd = document.getElementById('estKpiGeralFd');

    if (elContUn) elContUn.innerText = `${totalContUn} un`;
    if (elContFd) elContFd.innerText = `~ ${totalContFd} fardos fechados`;
    if (elBagaUn) elBagaUn.innerText = `${totalBagaUn} un`;
    if (elBagaFd) elBagaFd.innerText = `~ ${totalBagaFd} fardos fechados`;
    if (elGeralUn) elGeralUn.innerText = `${totalContUn + totalBagaUn} un`;
    if (elGeralFd) elGeralFd.innerText = `${window.produtosDB?.length || 0} bebidas no catálogo`;
}

export function renderizarApenasTabelasResumoEstoques() {
    const tbCont = document.getElementById('tabelaResumoContainer');
    const tbBaga = document.getElementById('tabelaResumoBagageiro');
    if (!tbCont || !tbBaga) return;

    tbCont.innerHTML = "";
    tbBaga.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    if (!window.produtosDB || window.produtosDB.length === 0) {
        tbCont.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--secondary); padding:14px;">Sem produtos cadastrados.</td></tr>`;
        tbBaga.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--secondary); padding:14px;">Sem produtos cadastrados.</td></tr>`;
        return;
    }

    window.produtosDB.forEach(p => {
        const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
        const cUn = parseInt(p.estoqueContainerUnidades) || 0;
        const bUn = parseInt(p.estoqueBagageiroUnidades) || 0;

        const corCont = cUn === 0 ? 'color:var(--danger);' : (cUn < unFardo ? 'color:var(--accent);' : '');
        const corBaga = bUn === 0 ? 'color:var(--danger);' : (bUn < unFardo ? 'color:var(--accent);' : '');

        tbCont.innerHTML += `
            <tr>
                <td><span class="badge-ordem">#${p.ordem || '-'}</span>${escapeHTML(p.nome)} (${escapeHTML(p.id)})</td>
                <td style="${corCont}"><strong>${formatarEstoqueFardos(cUn, unFardo)}</strong> <small style="color:var(--secondary);">(${cUn} un)</small></td>
            </tr>
        `;
        tbBaga.innerHTML += `
            <tr>
                <td><span class="badge-ordem">#${p.ordem || '-'}</span>${escapeHTML(p.nome)} (${escapeHTML(p.id)})</td>
                <td style="${corBaga}"><strong>${formatarEstoqueFardos(bUn, unFardo)}</strong> <small style="color:var(--secondary);">(${bUn} un)</small></td>
            </tr>
        `;
    });
}

export function alternarVisaoEstoque(modo) {
    window.abaEstoqueAtiva = modo;
    const secEditor = document.getElementById('secaoEstoqueEditor');
    const secTabelas = document.getElementById('secaoEstoqueTabelas');
    const btnEditor = document.getElementById('btnTabEstoqueEditor');
    const btnTabelas = document.getElementById('btnTabEstoqueTabelas');

    if (modo === 'tabelas') {
        if (secEditor) secEditor.style.display = 'none';
        if (secTabelas) secTabelas.style.display = 'grid';
        btnTabelas?.classList.add('ativo');
        btnEditor?.classList.remove('ativo');
        renderizarApenasTabelasResumoEstoques();
    } else {
        if (secEditor) secEditor.style.display = 'block';
        if (secTabelas) secTabelas.style.display = 'none';
        btnEditor?.classList.add('ativo');
        btnTabelas?.classList.remove('ativo');
    }
}

export function setFiltroRapidoEstoque(filtro) {
    window.filtroRapidoEstoque = filtro;
    ['todos', 'alterados', 'baixo', 'zerados'].forEach(f => {
        const btn = document.getElementById(`btnFiltroEst_${f}`);
        if (btn) btn.classList.toggle('ativo', f === filtro);
    });
    filtrarCardsEstoqueUI();
}

export function filtrarCardsEstoqueUI() {
    const termo = (document.getElementById('inputBuscaEstoque')?.value || '').trim().toLowerCase();
    const filtro = window.filtroRapidoEstoque || 'todos';
    const draft = getDraftEstoque();

    if (!Array.isArray(window.produtosDB)) return;

    let visiveis = 0;
    window.produtosDB.forEach(p => {
        const card = document.getElementById(`estoque_card_${p.id}`);
        if (!card) return;

        const est = obterEstadoEdicaoProduto(p, draft);
        const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
        const totalNovo = est.novoContUn + est.novoBagaUn;

        const matchTexto = !termo
            || (p.nome || '').toLowerCase().includes(termo)
            || (p.id || '').toLowerCase().includes(termo);

        let matchFiltro = true;
        if (filtro === 'alterados') matchFiltro = est.modificado;
        else if (filtro === 'baixo') matchFiltro = totalNovo > 0 && (est.novoContUn < unFardo || est.novoBagaUn < unFardo);
        else if (filtro === 'zerados') matchFiltro = est.novoContUn === 0 || est.novoBagaUn === 0;

        const mostrar = matchTexto && matchFiltro;
        card.style.display = mostrar ? 'block' : 'none';
        if (mostrar) visiveis++;
    });

    const avisoVazio = document.getElementById('avisoFiltroEstoqueVazio');
    if (avisoVazio) {
        avisoVazio.style.display = visiveis === 0 ? 'block' : 'none';
    }
}

export function abrirTelaEstoques(preservarBusca = false) {
    atualizarKPIsInternosEstoque();
    renderizarApenasTabelasResumoEstoques();

    const div = document.getElementById('listaEstoqueGeral');
    if (!div) return;

    const buscaAnterior = preservarBusca ? (document.getElementById('inputBuscaEstoque')?.value || '') : '';
    div.innerHTML = "";

    const draft = getDraftEstoque();
    ordenarPorRegra(window.produtosDB);

    if (!window.produtosDB || window.produtosDB.length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:var(--secondary);">
                <i class="ph ph-package" style="font-size:40px; display:block; margin-bottom:8px; color:var(--primary);"></i>
                <p>Nenhum produto cadastrado ainda.</p>
                <button type="button" class="btn btn-primary btn-pequeno" style="margin-top:10px;" onclick="window.mostrarTela('tela-cadastro-produtos')">
                    <i class="ph ph-plus-circle"></i> Cadastrar Produtos
                </button>
            </div>
        `;
        atualizarBarraFlutuanteEstoque();
        return;
    }

    let htmlCards = "";
    window.produtosDB.forEach(p => {
        const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
        const curContTot = parseInt(p.estoqueContainerUnidades) || 0;
        const curBagaTot = parseInt(p.estoqueBagageiroUnidades) || 0;

        const padraoCont = decomporUnidades(curContTot, unFardo);
        const padraoBaga = decomporUnidades(curBagaTot, unFardo);

        const valContFardos = draft?.[p.id]?.contFardos ?? padraoCont.fardos;
        const valContAvulsas = draft?.[p.id]?.contAvulsas ?? padraoCont.avulsas;
        const valBagaFardos = draft?.[p.id]?.bagaFardos ?? padraoBaga.fardos;
        const valBagaAvulsas = draft?.[p.id]?.bagaAvulsas ?? padraoBaga.avulsas;

        const idSafe = escapeHTML(p.id);
        const nomeSafe = escapeHTML(p.nome);

        htmlCards += `
            <div class="estoque-card-pro" id="estoque_card_${idSafe}">
                <div class="estoque-card-top">
                    <div class="estoque-prod-title">
                        <span class="badge-ordem">#${p.ordem || '-'}</span>
                        <strong>${nomeSafe} (${idSafe})</strong>
                        <span class="badge-fardo-info"><i class="ph ph-package"></i> ${unFardo} un/fardo</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge-modificado" id="est_badge_mod_${idSafe}">
                            <i class="ph ph-pencil-simple"></i> Alterado
                        </span>
                        <button type="button" class="btn btn-success btn-pequeno" id="est_btn_save_item_${idSafe}" style="display:none; padding:5px 10px; font-size:12px; min-block-size:30px;" onclick="window.salvarEstoqueProdutoIndividual('${idSafe}')">
                            <i class="ph ph-check"></i> Salvar Item
                        </button>
                    </div>
                </div>

                <div class="estoque-paineis-grid">
                    <!-- PAINEL CONTÊINER -->
                    <div class="box-ajuste-col box-ajuste-cont">
                        <div class="box-ajuste-header">
                            <label><i class="ph ph-archive"></i> Contêiner</label>
                            <span class="saldo-anterior-pill" id="est_cont_atual_${idSafe}">Salvo: ${formatarEstoqueFardos(curContTot, unFardo)} (${curContTot} un)</span>
                        </div>
                        <div class="input-unidade-group">
                            <div class="stepper-field">
                                <span>Fardos (${unFardo} un):</span>
                                <div class="stepper-control">
                                    <button type="button" class="btn-step" aria-label="Diminuir fardos do contêiner" onclick="window.stepEstoqueInput('${idSafe}', 'cont_fardo', -1)">−</button>
                                    <input type="number" id="est_cont_fardo_${idSafe}" value="${valContFardos}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularTotEstoqueLinha('${idSafe}'); window.salvarDraftEstoque();">
                                    <button type="button" class="btn-step" aria-label="Aumentar fardos do contêiner" onclick="window.stepEstoqueInput('${idSafe}', 'cont_fardo', 1)">+</button>
                                </div>
                            </div>
                            <div class="stepper-field">
                                <span>Un. Avulsas:</span>
                                <div class="stepper-control">
                                    <button type="button" class="btn-step" aria-label="Diminuir avulsas do contêiner" onclick="window.stepEstoqueInput('${idSafe}', 'cont_un', -1)">−</button>
                                    <input type="number" id="est_cont_un_${idSafe}" value="${valContAvulsas}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularTotEstoqueLinha('${idSafe}'); window.salvarDraftEstoque();">
                                    <button type="button" class="btn-step" aria-label="Aumentar avulsas do contêiner" onclick="window.stepEstoqueInput('${idSafe}', 'cont_un', 1)">+</button>
                                </div>
                            </div>
                        </div>
                        <div class="box-ajuste-footer">
                            <span id="est_cont_lbl_${idSafe}" style="color:var(--container-color);">= Total: 0 un</span>
                            <span id="est_cont_delta_${idSafe}" class="delta-badge delta-zero">Sem alteração</span>
                        </div>
                    </div>

                    <!-- PAINEL BAGAGEIRO -->
                    <div class="box-ajuste-col box-ajuste-baga">
                        <div class="box-ajuste-header">
                            <label><i class="ph ph-bag"></i> Bagageiro</label>
                            <span class="saldo-anterior-pill" id="est_baga_atual_${idSafe}">Salvo: ${formatarEstoqueFardos(curBagaTot, unFardo)} (${curBagaTot} un)</span>
                        </div>
                        <div class="input-unidade-group">
                            <div class="stepper-field">
                                <span>Fardos (${unFardo} un):</span>
                                <div class="stepper-control">
                                    <button type="button" class="btn-step" aria-label="Diminuir fardos do bagageiro" onclick="window.stepEstoqueInput('${idSafe}', 'baga_fardo', -1)">−</button>
                                    <input type="number" id="est_baga_fardo_${idSafe}" value="${valBagaFardos}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularTotEstoqueLinha('${idSafe}'); window.salvarDraftEstoque();">
                                    <button type="button" class="btn-step" aria-label="Aumentar fardos do bagageiro" onclick="window.stepEstoqueInput('${idSafe}', 'baga_fardo', 1)">+</button>
                                </div>
                            </div>
                            <div class="stepper-field">
                                <span>Un. Avulsas:</span>
                                <div class="stepper-control">
                                    <button type="button" class="btn-step" aria-label="Diminuir avulsas do bagageiro" onclick="window.stepEstoqueInput('${idSafe}', 'baga_un', -1)">−</button>
                                    <input type="number" id="est_baga_un_${idSafe}" value="${valBagaAvulsas}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularTotEstoqueLinha('${idSafe}'); window.salvarDraftEstoque();">
                                    <button type="button" class="btn-step" aria-label="Aumentar avulsas do bagageiro" onclick="window.stepEstoqueInput('${idSafe}', 'baga_un', 1)">+</button>
                                </div>
                            </div>
                        </div>
                        <div class="box-ajuste-footer">
                            <span id="est_baga_lbl_${idSafe}" style="color:var(--bagageiro-color);">= Total: 0 un</span>
                            <span id="est_baga_delta_${idSafe}" class="delta-badge delta-zero">Sem alteração</span>
                        </div>
                    </div>
                </div>

                <div class="estoque-card-actions">
                    <button type="button" class="btn-transferir-fardo" onclick="window.transferirFardoContParaBaga('${idSafe}')" title="Transfere 1 fardo do Contêiner para o Bagageiro">
                        <i class="ph ph-arrows-left-right"></i> Transferir 1 Fardo (Contêiner ➔ Bagageiro)
                    </button>
                    <button type="button" class="btn-transferir-fardo" id="est_btn_reset_item_${idSafe}" style="display:none; color:var(--danger); border-color:var(--danger-border);" onclick="window.restaurarItemEstoque('${idSafe}')">
                        <i class="ph ph-arrow-counter-clockwise"></i> Desfazer Item
                    </button>
                </div>
            </div>
        `;
    });

    htmlCards += `
        <div id="avisoFiltroEstoqueVazio" style="display:none; text-align:center; padding:24px; color:var(--secondary); background:#ffffff; border-radius:12px; border:1px dashed var(--border);">
            <i class="ph ph-magnifying-glass" style="font-size:32px; display:block; margin-bottom:6px;"></i>
            Nenhuma bebida encontrada para este filtro.
        </div>
    `;

    div.innerHTML = htmlCards;

    if (preservarBusca && buscaAnterior) {
        const inputBusca = document.getElementById('inputBuscaEstoque');
        if (inputBusca) inputBusca.value = buscaAnterior;
    }

    window.produtosDB.forEach(p => calcularTotEstoqueLinha(p.id));
    atualizarBarraFlutuanteEstoque();
    filtrarCardsEstoqueUI();
}

export function stepEstoqueInput(id, campo, delta) {
    const input = document.getElementById(`est_${campo}_${id}`);
    if (!input) return;
    const atual = parseInt(input.value) || 0;
    input.value = Math.max(0, atual + delta);
    calcularTotEstoqueLinha(id);
    salvarDraftEstoque();
}

export function transferirFardoContParaBaga(id) {
    const p = window.produtosDB.find(x => x.id === id);
    if (!p) return;

    const elFCont = document.getElementById(`est_cont_fardo_${id}`);
    const elFBaga = document.getElementById(`est_baga_fardo_${id}`);
    const elUCont = document.getElementById(`est_cont_un_${id}`);
    const elUBaga = document.getElementById(`est_baga_un_${id}`);
    if (!elFCont || !elFBaga) return;

    const fContAtual = parseInt(elFCont.value) || 0;
    const uContAtual = parseInt(elUCont?.value) || 0;
    const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);

    if (fContAtual >= 1) {
        elFCont.value = fContAtual - 1;
        elFBaga.value = (parseInt(elFBaga.value) || 0) + 1;
        calcularTotEstoqueLinha(id);
        salvarDraftEstoque();
        mostrarToast(`1 fardo (${unFardo} un) de ${p.id} movido para o Bagageiro! Revise e salve.`);
    } else if (uContAtual >= unFardo && unFardo > 1) {
        elUCont.value = uContAtual - unFardo;
        elFBaga.value = (parseInt(elFBaga.value) || 0) + 1;
        calcularTotEstoqueLinha(id);
        salvarDraftEstoque();
        mostrarToast(`${unFardo} un de ${p.id} movidas para o Bagageiro!`);
    } else {
        mostrarToast(`O Contêiner não possui 1 fardo completo de ${p.nome} para transferir.`, true);
    }
}

export function restaurarItemEstoque(id) {
    const p = window.produtosDB.find(x => x.id === id);
    if (!p) return;

    const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
    const padraoCont = decomporUnidades(p.estoqueContainerUnidades, unFardo);
    const padraoBaga = decomporUnidades(p.estoqueBagageiroUnidades, unFardo);

    const elFCont = document.getElementById(`est_cont_fardo_${id}`);
    const elUCont = document.getElementById(`est_cont_un_${id}`);
    const elFBaga = document.getElementById(`est_baga_fardo_${id}`);
    const elUBaga = document.getElementById(`est_baga_un_${id}`);

    if (elFCont) elFCont.value = padraoCont.fardos;
    if (elUCont) elUCont.value = padraoCont.avulsas;
    if (elFBaga) elFBaga.value = padraoBaga.fardos;
    if (elUBaga) elUBaga.value = padraoBaga.avulsas;

    calcularTotEstoqueLinha(id);
    salvarDraftEstoque();
}

export function calcularTotEstoqueLinha(id) {
    const p = window.produtosDB.find(x => x.id === id);
    if (!p) return;

    const un = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
    const fCont = Math.max(0, parseInt(document.getElementById(`est_cont_fardo_${id}`)?.value) || 0);
    const uCont = Math.max(0, parseInt(document.getElementById(`est_cont_un_${id}`)?.value) || 0);
    const fBaga = Math.max(0, parseInt(document.getElementById(`est_baga_fardo_${id}`)?.value) || 0);
    const uBaga = Math.max(0, parseInt(document.getElementById(`est_baga_un_${id}`)?.value) || 0);

    const novoContTot = (fCont * un) + uCont;
    const novoBagaTot = (fBaga * un) + uBaga;
    const curContTot = parseInt(p.estoqueContainerUnidades) || 0;
    const curBagaTot = parseInt(p.estoqueBagageiroUnidades) || 0;

    const deltaCont = novoContTot - curContTot;
    const deltaBaga = novoBagaTot - curBagaTot;
    const modificado = (deltaCont !== 0) || (deltaBaga !== 0);

    const lblCont = document.getElementById(`est_cont_lbl_${id}`);
    const lblBaga = document.getElementById(`est_baga_lbl_${id}`);
    if (lblCont) lblCont.innerText = `= Novo: ${formatarEstoqueFardos(novoContTot, un)} (${novoContTot} un)`;
    if (lblBaga) lblBaga.innerText = `= Novo: ${formatarEstoqueFardos(novoBagaTot, un)} (${novoBagaTot} un)`;

    const dElCont = document.getElementById(`est_cont_delta_${id}`);
    if (dElCont) {
        if (deltaCont > 0) {
            dElCont.className = 'delta-badge delta-pos';
            dElCont.innerText = `+${deltaCont} un`;
        } else if (deltaCont < 0) {
            dElCont.className = 'delta-badge delta-neg';
            dElCont.innerText = `${deltaCont} un`;
        } else {
            dElCont.className = 'delta-badge delta-zero';
            dElCont.innerText = 'Mantido';
        }
    }

    const dElBaga = document.getElementById(`est_baga_delta_${id}`);
    if (dElBaga) {
        if (deltaBaga > 0) {
            dElBaga.className = 'delta-badge delta-pos';
            dElBaga.innerText = `+${deltaBaga} un`;
        } else if (deltaBaga < 0) {
            dElBaga.className = 'delta-badge delta-neg';
            dElBaga.innerText = `${deltaBaga} un`;
        } else {
            dElBaga.className = 'delta-badge delta-zero';
            dElBaga.innerText = 'Mantido';
        }
    }

    const card = document.getElementById(`estoque_card_${id}`);
    const btnSaveItem = document.getElementById(`est_btn_save_item_${id}`);
    const btnResetItem = document.getElementById(`est_btn_reset_item_${id}`);

    if (card) card.classList.toggle('modificado', modificado);
    if (btnSaveItem) btnSaveItem.style.display = modificado ? 'inline-flex' : 'none';
    if (btnResetItem) btnResetItem.style.display = modificado ? 'inline-flex' : 'none';
}

export function atualizarBarraFlutuanteEstoque() {
    const draft = getDraftEstoque();
    let qtdModificados = 0;

    if (Array.isArray(window.produtosDB)) {
        window.produtosDB.forEach(p => {
            const est = obterEstadoEdicaoProduto(p, draft);
            if (est.modificado) qtdModificados++;
        });
    }

    const bar = document.getElementById('barraFlutuanteEstoque');
    const lbl = document.getElementById('lblQtdModificadosEstoque');
    const badgeFiltro = document.getElementById('badgeCountAlteradosEstoque');

    if (bar) bar.classList.toggle('visivel', qtdModificados > 0);
    if (lbl) lbl.innerText = `${qtdModificados} ${qtdModificados === 1 ? 'bebida alterada' : 'bebidas alteradas'}`;
    if (badgeFiltro) badgeFiltro.innerText = qtdModificados > 0 ? `(${qtdModificados})` : '';
}

export function salvarDraftEstoque() {
    const draftAtual = getDraftEstoque();
    const novoDraft = {};

    window.produtosDB.forEach(p => {
        const est = obterEstadoEdicaoProduto(p, draftAtual);
        if (est.modificado) {
            novoDraft[p.id] = {
                contFardos: est.contFardos,
                contAvulsas: est.contAvulsas,
                bagaFardos: est.bagaFardos,
                bagaAvulsas: est.bagaAvulsas
            };
        }
    });

    setDraftEstoque(novoDraft);
    atualizarBarraFlutuanteEstoque();
}

export function limparDraftEstoque() {
    abrirConfirmacao("Descartar todas as alterações manuais não salvas?", () => {
        localStorage.removeItem('trem_draft_estoque');
        abrirTelaEstoques(true);
        mostrarToast("Alterações manuais descartadas.");
    });
}

/**
 * Salva imediatamente o ajuste de um único produto (botão "Salvar Item" no card).
 */
export async function salvarEstoqueProdutoIndividual(prodId) {
    const p = window.produtosDB.find(x => x.id === prodId);
    if (!p) return;

    const btn = document.getElementById(`est_btn_save_item_${prodId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i>';
    }

    try {
        const est = obterEstadoEdicaoProduto(p);
        const docKey = p._docId || p.id;

        // Atualiza memória e cache local imediatamente
        p.estoqueContainerUnidades = est.novoContUn;
        p.estoqueBagageiroUnidades = est.novoBagaUn;
        setCache('trem_cache_produtos', window.produtosDB);

        // Remove este item do rascunho
        const draft = getDraftEstoque();
        delete draft[p.id];
        setDraftEstoque(draft);

        // Persiste no Firestore usando setDoc com merge: true (evita falha caso ID divirja)
        await setDoc(doc(db, "produtos", docKey), {
            id: p.id,
            estoqueContainerUnidades: est.novoContUn,
            estoqueBagageiroUnidades: est.novoBagaUn
        }, { merge: true });

        // Normaliza os campos fardos/avulsas na tela
        restaurarItemEstoque(p.id);
        const pillCont = document.getElementById(`est_cont_atual_${p.id}`);
        const pillBaga = document.getElementById(`est_baga_atual_${p.id}`);
        const unFardo = Math.max(1, parseInt(p.unidadesPorFardo) || 1);
        if (pillCont) pillCont.innerText = `Salvo: ${formatarEstoqueFardos(est.novoContUn, unFardo)} (${est.novoContUn} un)`;
        if (pillBaga) pillBaga.innerText = `Salvo: ${formatarEstoqueFardos(est.novoBagaUn, unFardo)} (${est.novoBagaUn} un)`;

        atualizarKPIsInternosEstoque();
        renderizarApenasTabelasResumoEstoques();
        atualizarDashboardKPIs();
        mostrarToast(`Estoque de ${p.nome} (${p.id}) salvo com sucesso!`);
    } catch (err) {
        console.error("Erro ao salvar item de estoque:", err);
        mostrarToast("Salvo no cache local (sincronizará quando online).", false);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-check"></i> Salvar Item';
        }
    }
}

export function abrirModalConfirmaEstoque() {
    const obsEl = document.getElementById('modalObsAjusteEstoque');
    if (obsEl) obsEl.value = "";

    const boxResumo = document.getElementById('resumoAlteracoesEstoqueModal');
    if (boxResumo) {
        const draft = getDraftEstoque();
        const alterados = [];

        window.produtosDB.forEach(p => {
            const est = obterEstadoEdicaoProduto(p, draft);
            if (est.modificado) {
                alterados.push({ p, est });
            }
        });

        if (alterados.length === 0) {
            boxResumo.innerHTML = `
                <div style="background:#f8fafc; border:1px solid var(--border); padding:10px 12px; border-radius:8px; font-size:13px; color:var(--secondary); margin-bottom:12px;">
                    <i class="ph ph-info"></i> Nenhuma diferença detectada em relação ao saldo atual, mas você pode confirmar para forçar a sincronização completa do estoque.
                </div>
            `;
        } else {
            let linhas = alterados.map(({ p, est }) => {
                const partes = [];
                if (est.deltaCont !== 0) {
                    const s = est.deltaCont > 0 ? `+${est.deltaCont}` : `${est.deltaCont}`;
                    partes.push(`<span style="color:var(--container-color);">Contêiner: ${est.curContTot} ➔ <b>${est.novoContUn} un</b> (${s})</span>`);
                }
                if (est.deltaBaga !== 0) {
                    const s = est.deltaBaga > 0 ? `+${est.deltaBaga}` : `${est.deltaBaga}`;
                    partes.push(`<span style="color:var(--bagageiro-color);">Bagageiro: ${est.curBagaTot} ➔ <b>${est.novoBagaUn} un</b> (${s})</span>`);
                }
                return `
                    <div style="padding:7px 0; border-bottom:1px dashed var(--border); font-size:13px;">
                        <strong>${escapeHTML(p.nome)} (${escapeHTML(p.id)})</strong><br>
                        ${partes.join(' &bull; ')}
                    </div>
                `;
            }).join('');

            boxResumo.innerHTML = `
                <div style="max-height:200px; overflow-y:auto; background:#f8fafc; border:1.5px solid var(--border); border-radius:8px; padding:8px 12px; margin-bottom:12px;">
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--secondary); margin-bottom:4px;">
                        Resumo das Alterações (${alterados.length} ${alterados.length === 1 ? 'item' : 'itens'}):
                    </div>
                    ${linhas}
                </div>
            `;
        }
    }

    abrirModal('modal-confirma-estoque');
}

export async function confirmarAjustesEstoqueComObs() {
    const btnSalvar = document.getElementById('btnConfirmarSalvarEstoqueModal');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Salvando Estoque...';
    }

    try {
        const draft = getDraftEstoque();
        const batch = writeBatch(db);
        const obs = (document.getElementById('modalObsAjusteEstoque')?.value || '').trim();

        window.produtosDB.forEach(p => {
            const est = obterEstadoEdicaoProduto(p, draft);
            const docKey = p._docId || p.id;

            // Atualiza estado em memória imediatamente
            p.estoqueContainerUnidades = est.novoContUn;
            p.estoqueBagageiroUnidades = est.novoBagaUn;

            // Usa batch.set com { merge: true } para nunca falhar caso o documento tenha ID divergente
            batch.set(doc(db, "produtos", docKey), {
                id: p.id,
                estoqueContainerUnidades: est.novoContUn,
                estoqueBagageiroUnidades: est.novoBagaUn
            }, { merge: true });
        });

        // Atualiza cache local antes mesmo do retorno de rede (suporte offline total)
        setCache('trem_cache_produtos', window.produtosDB);
        localStorage.removeItem('trem_draft_estoque');

        if (obs) {
            localStorage.setItem('trem_ultimo_ajuste_estoque', JSON.stringify({
                obs,
                dataHora: new Date().toLocaleString('pt-BR')
            }));
        }

        await batch.commit();

        fecharModal('modal-confirma-estoque');
        abrirTelaEstoques(true);
        atualizarDashboardKPIs();
        mostrarToast("Estoques salvos e sincronizados com sucesso!");
    } catch (err) {
        console.error("Erro ao gravar lote de estoque:", err);
        fecharModal('modal-confirma-estoque');
        abrirTelaEstoques(true);
        atualizarDashboardKPIs();
        mostrarToast("Estoque salvo localmente! Sincronizará ao reconectar.", false);
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="ph ph-check"></i> Salvar Tudo';
        }
    }
}
