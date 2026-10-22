// ==========================================================================
// MÓDULO: RELATÓRIOS OPERACIONAIS, BALANÇO DIÁRIO E CORREÇÕES DO CHEFE
// ==========================================================================
import { db, doc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, formatarDataBR, formatarMoeda, ordenarPorRegra, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';

export function setModoRelatorio(modo) {
    window.modoRelatorioAdmin = modo;
    ['btnRelVagao', 'btnRelTur', 'btnRelBoutLito', 'btnRelVendas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('ativo');
    });
    const mapIds = {
        'todos': 'btnRelVagao',
        'turisticos': 'btnRelTur',
        'boutiques_litorinas': 'btnRelBoutLito',
        'vendas': 'btnRelVendas'
    };
    const atvEl = document.getElementById(mapIds[modo]);
    if (atvEl) atvEl.classList.add('ativo');
    renderizarRelatoriosAdmin();
}

export function setFiltroSentido(sentido) {
    window.filtroSentidoRelatorio = sentido;
    ['btnSentidoTodos', 'btnSentidoIda', 'btnSentidoVolta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('ativo');
    });
    const mapIds = {
        'todos': 'btnSentidoTodos',
        'Ida': 'btnSentidoIda',
        'Volta': 'btnSentidoVolta'
    };
    const atvEl = document.getElementById(mapIds[sentido]);
    if (atvEl) atvEl.classList.add('ativo');
    renderizarRelatoriosAdmin();
}

function renderizarBalancoDiarioResumo(dataFiltro) {
    const box = document.getElementById('boxBalancoDiarioRelatorios');
    if (!box) return;

    const contagensDia = window.contagensDB.filter(c => c.data === dataFiltro);
    const vendasDia = window.vendasCarrinhoDB.filter(v => v.data === dataFiltro);

    let totPaxLanches = 0;
    let totPaxBebidas = 0;
    let totTrip = 0;
    let totAva = 0;

    contagensDia.forEach(c => {
        const isBoutique = c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique';
        if (isBoutique) return;
        for (let k in c.itens) {
            const it = c.itens[k];
            if (k === 'KL' || k === 'Kl') totPaxLanches += (it.pax || 0);
            else totPaxBebidas += (it.pax || 0);
            totTrip += (it.trip || 0);
            totAva += (it.ava || 0);
        }
    });

    let totReaisCarrinho = 0;
    vendasDia.forEach(v => {
        totReaisCarrinho += parseFloat((v.totalVendasR$ || '0').replace(',', '.')) || 0;
    });

    box.innerHTML = `
        <div class="balanco-diario-box">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <strong style="color:var(--primary); font-size:14px;"><i class="ph ph-chart-pie-slice"></i> Balanço Consolidado (${formatarDataBR(dataFiltro)})</strong>
                <span style="font-size:12px; color:var(--secondary); font-weight:700;">${contagensDia.length} vagão(ões) &bull; ${vendasDia.length} carrinho(s)</span>
            </div>
            <div class="balanco-diario-grid">
                <div class="balanco-mini-card">
                    <small>Lanches (Pax)</small>
                    <strong>${totPaxLanches}</strong>
                </div>
                <div class="balanco-mini-card">
                    <small>Bebidas (Pax)</small>
                    <strong>${totPaxBebidas}</strong>
                </div>
                <div class="balanco-mini-card">
                    <small>Tripulação / Ava</small>
                    <strong>${totTrip} / <span style="color:var(--danger);">${totAva}</span></strong>
                </div>
                <div class="balanco-mini-card">
                    <small>Vendas Carrinho</small>
                    <strong style="color:var(--success);">R$ ${formatarMoeda(totReaisCarrinho)}</strong>
                </div>
            </div>
        </div>
    `;
}

export function renderizarRelatoriosAdmin() {
    const div = document.getElementById('listaRelatoriosAdmin');
    if (!div) return;
    div.innerHTML = "";

    const elFiltro = document.getElementById('filtroDataRelatorio');
    const dataFiltro = elFiltro.value || getDataHojeLocal();
    elFiltro.value = dataFiltro;

    renderizarBalancoDiarioResumo(dataFiltro);

    if (window.modoRelatorioAdmin === 'vendas') {
        let vendas = window.vendasCarrinhoDB.filter(v => v.data === dataFiltro);
        if (window.filtroSentidoRelatorio !== 'todos') {
            vendas = vendas.filter(v => (v.sentido || "").trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase());
        }

        if (vendas.length === 0) {
            div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma venda encontrada.</p>';
            return;
        }

        vendas.forEach(v => {
            const extrasHtml = (v.extras || []).map(e => `<li>${e.qtd}x ${escapeHTML(e.nome)} (R$ ${formatarMoeda(e.total)})</li>`).join('');
            let itensBaseHtml = "";
            for (let k in v.itens) {
                const it = v.itens[k];
                const nomeProd = window.produtosDB.find(x => x.id === k)?.nome || k;
                if (it.vendeu > 0) itensBaseHtml += `<li>${it.vendeu}x ${escapeHTML(nomeProd)} (R$ ${formatarMoeda(it.subtotal)})</li>`;
            }

            div.innerHTML += `
                <div class="card" style="border-inline-start:5px solid #0f766e; padding:14px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div>
                            <strong style="font-size:16px;">Carrinho: Viagem de ${escapeHTML(v.sentido)}</strong><br>
                            <span style="font-size:13px; color:var(--secondary);">${escapeHTML(v.apoio)}</span>
                        </div>
                        <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.abrirModalEdicaoVenda('${escapeHTML(v.id)}')"><i class="ph ph-pencil-simple"></i> Editar Bebidas</button>
                    </div>
                    <p style="margin:8px 0; font-size:16px; color:var(--success); font-weight:bold;">Total Vendas: R$ ${escapeHTML(v.totalVendasR$)}</p>
                    <div style="font-size:12px; color:var(--secondary);">
                        ${itensBaseHtml ? `<b>Itens Base:</b><ul style="padding-inline-start:18px; margin-bottom:6px;">${itensBaseHtml}</ul>` : ''}
                        ${extrasHtml ? `<b>Extras Adicionados:</b><ul style="padding-inline-start:18px;">${extrasHtml}</ul>` : ''}
                    </div>
                </div>
            `;
        });
        return;
    }

    let filtrados = window.contagensDB.filter(c => c.data === dataFiltro);
    if (window.filtroSentidoRelatorio !== 'todos') {
        filtrados = filtrados.filter(c => (c.sentido || "").trim().toLowerCase() === window.filtroSentidoRelatorio.toLowerCase());
    }

    if (window.modoRelatorioAdmin === 'turisticos') {
        filtrados = filtrados.filter(c => ['turistico', 'economico'].includes((c.vagaoTipo || "").trim().toLowerCase()));
    } else if (window.modoRelatorioAdmin === 'boutiques_litorinas') {
        filtrados = filtrados.filter(c => ['boutique', 'litorina'].includes((c.vagaoTipo || "").trim().toLowerCase()));
    }

    if (filtrados.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum relatório encontrado para estes filtros.</p>';
        return;
    }

    filtrados.sort((a, b) => {
        const nA = parseInt(a.vagaoNumero) || 9999;
        const nB = parseInt(b.vagaoNumero) || 9999;
        if (nA !== nB) return nA - nB;
        return (a.sentido || "").localeCompare(b.sentido || "");
    });

    filtrados.forEach(c => {
        const linhas = gerarLinhasTabelaAdmin(c.itens, c.tipoRegistro);
        let totalLanches = 0, totalBebidas = 0;

        for (let k in c.itens) {
            const it = c.itens[k];
            if (k === 'KL' || k === 'Kl') totalLanches += it.pax || 0;
            else totalBebidas += it.pax || 0;
        }

        const isBoutiqueFechamento = c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique';
        const compClasse = (totalLanches === totalBebidas) ? 'kpi-match' : 'kpi-divergent';

        div.innerHTML += `
            <div class="card" style="border-inline-start:5px solid ${isBoutiqueFechamento ? 'var(--accent)' : 'var(--primary)'}; padding:14px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                    <div>
                        <strong style="font-size:16px;">${escapeHTML(c.vagao)} (${escapeHTML(c.sentido)})</strong>
                        ${isBoutiqueFechamento ? '<span style="font-size:11px; font-weight:bold; color:var(--accent); background:#fef3c7; padding:2px 6px; border-radius:6px; margin-inline-start:6px;">Morretes / Sobras</span>' : ''}
                        <br><span style="font-size:12px; color:var(--secondary);">${escapeHTML(c.apoio)} | Guia: ${escapeHTML(c.guia || '-')}</span>
                    </div>
                    <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.abrirModalEdicaoRelatorio('${escapeHTML(c.id)}')"><i class="ph ph-pencil-simple"></i> Corrigir</button>
                </div>

                ${!isBoutiqueFechamento ? `
                    <div class="box-comparativo-status ${compClasse}" style="padding:6px 12px; font-size:12px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-around;">
                            <span>Lanches: <strong>${totalLanches}</strong></span>
                            <span>Bebidas: <strong>${totalBebidas}</strong></span>
                        </div>
                    </div>
                ` : ''}

                <div class="tabela-container" tabindex="0" role="region" aria-label="Relatório do vagão ${escapeHTML(c.vagao)}">
                    <table class="tabela-relatorio">
                        <thead>
                            <tr>
                                <th style="width:34%;">Bebida</th>
                                <th style="width:13%;">Carga</th>
                                ${!isBoutiqueFechamento
                                    ? `<th style="width:13%;">Pax</th><th style="width:12%;">Trip</th><th style="width:12%;">Ava</th>`
                                    : `<th style="width:37%;">Ajuste Volta</th>`}
                                <th style="width:16%;">Sobra</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                ${c.obs ? `<div style="margin-top:8px; color:var(--danger); font-size:12px;"><b>Obs:</b> ${escapeHTML(c.obs)}</div>` : ''}
            </div>
        `;
    });
}

function gerarLinhasTabelaAdmin(itensObjeto, tipoRegistro) {
    if (!itensObjeto) return "";
    let arr = Object.values(itensObjeto).map(item => {
        const prod = window.produtosDB.find(p => p.id === item.id) || { ordem: 9999 };
        return { ...item, ordem: prod.ordem };
    });
    ordenarPorRegra(arr);

    let html = "";
    const isBoutiqueFechamento = tipoRegistro === 'retorno_boutique' || tipoRegistro === 'sobras_boutique';

    arr.forEach(obj => {
        if (obj.carga > 0 || obj.saldo > 0 || obj.pax > 0 || obj.ava > 0 || obj.ajusteQtd > 0) {
            if (isBoutiqueFechamento) {
                const txtAjuste = (obj.ajusteQtd !== undefined && obj.ajusteQtd > 0)
                    ? `${obj.operador || '+'} ${obj.ajusteQtd} baga`
                    : '-';
                html += `
                    <tr>
                        <td>${escapeHTML(obj.nome)}</td>
                        <td>${obj.cargaOriginal || obj.carga || 0}</td>
                        <td style="color:var(--accent); font-weight:bold;">${escapeHTML(txtAjuste)}</td>
                        <td style="font-weight:bold; color:var(--primary);">${obj.saldo || obj.sobra}</td>
                    </tr>
                `;
            } else {
                html += `
                    <tr>
                        <td>${escapeHTML(obj.nome)}</td>
                        <td>${obj.carga}</td>
                        <td style="color:var(--success); font-weight:bold;">${obj.pax}</td>
                        <td>${obj.trip > 0 ? obj.trip : '-'}</td>
                        <td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td>
                        <td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td>
                    </tr>
                `;
            }
        }
    });
    return html;
}

export function abrirModalEdicaoVenda(id) {
    const v = window.vendasCarrinhoDB.find(x => x.id === id);
    if (!v) return;
    document.getElementById('editVendaIdOriginal').value = v.id;
    document.getElementById('subtituloModalEditaVenda').innerText = `Venda ${unescapeHTML(v.apoio)} (${v.sentido})`;

    let html = '';
    ordenarPorRegra(window.produtosDB);

    // Inclui todos os produtos vendáveis (precoVenda > 0) + qualquer produto que já esteja na venda
    const prodsVendaveis = window.produtosDB.filter(p =>
        ((p.precoVenda || 0) > 0 && p.id !== 'Gelo') || (v.itens && v.itens[p.id])
    );

    prodsVendaveis.forEach(prod => {
        const pId = prod.id;
        const item = v.itens?.[pId] || { vendeu: 0 };
        const idSafe = escapeHTML(pId);
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
                <strong style="font-size:14px;">${escapeHTML(prod.nome)} (${idSafe})</strong>
                <input type="number" id="edit_venda_${idSafe}" value="${item.vendeu || 0}" data-old="${item.vendeu || 0}" min="0" inputmode="numeric" onfocus="this.select()" style="width:85px; padding:6px; text-align:center;">
            </div>
        `;
    });
    document.getElementById('listaItensEdicaoVenda').innerHTML = html;
    abrirModal('modal-editar-venda');
}

export async function salvarEdicaoVenda() {
    const id = document.getElementById('editVendaIdOriginal').value;
    const v = window.vendasCarrinhoDB.find(x => x.id === id);
    if (!v) return;

    const batch = writeBatch(db);
    let novasVendas = { ...(v.itens || {}) };
    let deltaFinanceiro = 0;

    window.produtosDB.forEach(prod => {
        const pId = prod.id;
        const el = document.getElementById(`edit_venda_${pId}`);
        if (!el) return;
        const newVal = parseInt(el.value) || 0;
        const oldVal = parseInt(el.getAttribute('data-old')) || 0;
        const deltaVenda = newVal - oldVal;

        if (deltaVenda !== 0) {
            const docKey = prod._docId || pId;
            prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) - deltaVenda;
            batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(-deltaVenda) }, { merge: true });
            const preco = prod.precoVenda || 0;
            if (!novasVendas[pId]) novasVendas[pId] = { saiu: 0, voltou: 0, subtotal: 0 };
            novasVendas[pId].vendeu = newVal;
            novasVendas[pId].subtotal = newVal * preco;
            deltaFinanceiro += (deltaVenda * preco);
        }
    });

    const numAtualR = parseFloat((v.totalVendasR$ || '0').replace(',', '.')) || 0;
    const novoTotal = numAtualR + deltaFinanceiro;
    const troco = parseFloat(v.trocoInicial) || 0;
    const novoEntregar = novoTotal + troco;

    v.itens = novasVendas;
    v.totalVendasR$ = formatarMoeda(novoTotal);
    v.totalEntregarR$ = formatarMoeda(novoEntregar);
    setCache('trem_cache_vendas', window.vendasCarrinhoDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "vendas_carrinho", v._docId || id), {
        itens: novasVendas,
        totalVendasR$: formatarMoeda(novoTotal),
        totalEntregarR$: formatarMoeda(novoEntregar)
    }, { merge: true });

    await batch.commit();
    fecharModal('modal-editar-venda');
    atualizarDashboardKPIs();
    renderizarRelatoriosAdmin();
    mostrarToast("Vendas corrigidas e Bagageiro reajustado!");
}

export function abrirModalEdicaoRelatorio(id) {
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    document.getElementById('editRelatorioIdOriginal').value = c.id;
    document.getElementById('subtituloModalEditaRelatorio').innerText = `${unescapeHTML(c.vagao)} (${c.sentido}) • ${formatarDataBR(c.data)}`;
    document.getElementById('obsEdicaoChefeRelatorio').value = unescapeHTML(c.obs || "");

    const div = document.getElementById('listaItensEdicaoRelatorio');
    div.innerHTML = "";

    if (c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique') {
        div.innerHTML = `<div style="padding:15px; color:var(--accent); font-weight:bold; text-align:center;">Edição em massa indisponível para Hub Boutiques. Para corrigir, exclua o relatório e lance novamente em Morretes.</div>`;
    } else {
        ordenarPorRegra(window.produtosDB);
        for (let pId in c.itens) {
            const item = c.itens[pId];
            const idSafe = escapeHTML(pId);
            div.innerHTML += `
                <div class="item-contagem" style="padding:10px; margin-bottom:8px;">
                    <strong style="font-size:14px;">${escapeHTML(item.nome)} (${idSafe})</strong>
                    <div class="grid-inputs" style="grid-template-columns: repeat(4, 1fr); margin-top:6px;">
                        <div><label>Carga:</label><input type="number" id="edit_rel_carga_${idSafe}" value="${item.carga}" inputmode="numeric" onfocus="this.select()"></div>
                        <div><label>Sobra:</label><input type="number" id="edit_rel_saldo_${idSafe}" value="${item.saldo}" inputmode="numeric" onfocus="this.select()"></div>
                        <div><label>Trip:</label><input type="number" id="edit_rel_trip_${idSafe}" value="${item.trip}" inputmode="numeric" onfocus="this.select()"></div>
                        <div><label>Avaria:</label><input type="number" id="edit_rel_ava_${idSafe}" value="${item.ava}" inputmode="numeric" onfocus="this.select()"></div>
                    </div>
                </div>
            `;
        }
    }
    abrirModal('modal-editar-relatorio');
}

export async function salvarEdicaoRelatorioPeloChefe() {
    const id = document.getElementById('editRelatorioIdOriginal').value;
    const c = window.contagensDB.find(x => x.id === id);
    if (!c || c.tipoRegistro === 'retorno_boutique' || c.tipoRegistro === 'sobras_boutique') {
        return fecharModal('modal-editar-relatorio');
    }

    const batch = writeBatch(db);
    let novosItens = {};

    for (let pId in c.itens) {
        const carga = parseInt(document.getElementById(`edit_rel_carga_${pId}`)?.value) || 0;
        const saldo = parseInt(document.getElementById(`edit_rel_saldo_${pId}`)?.value) || 0;
        const trip = parseInt(document.getElementById(`edit_rel_trip_${pId}`)?.value) || 0;
        const ava = parseInt(document.getElementById(`edit_rel_ava_${pId}`)?.value) || 0;
        const pax = Math.max(0, carga - saldo - trip - ava);

        const cargaOriginal = c.itens[pId].cargaOriginal !== undefined ? c.itens[pId].cargaOriginal : (c.itens[pId].carga || 0);

        novosItens[pId] = { id: pId, nome: c.itens[pId].nome, cargaOriginal, carga, saldo, trip, ava, pax };

        const difCarga = carga - (c.itens[pId].carga || 0);
        const difSaldo = saldo - (c.itens[pId].saldo || 0);
        const netAjusteBagageiro = difSaldo - difCarga;

        if (netAjusteBagageiro !== 0) {
            const prod = window.produtosDB.find(p => p.id === pId);
            const docKey = prod?._docId || pId;
            if (prod) {
                prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) + netAjusteBagageiro;
            }
            batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(netAjusteBagageiro) }, { merge: true });
        }
    }

    const obsChefe = document.getElementById('obsEdicaoChefeRelatorio').value.trim();
    c.itens = novosItens;
    c.obs = escapeHTML(obsChefe);
    setCache('trem_cache_contagens', window.contagensDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "contagens", c._docId || id), { itens: novosItens, obs: escapeHTML(obsChefe) }, { merge: true });

    await batch.commit();
    fecharModal('modal-editar-relatorio');
    atualizarDashboardKPIs();
    renderizarRelatoriosAdmin();
    mostrarToast("Relatório corrigido com sucesso!");
}

export async function excluirRelatorioPeloChefe() {
    const id = document.getElementById('editRelatorioIdOriginal').value;
    const c = window.contagensDB.find(x => x.id === id);
    if (!c) return;

    abrirConfirmacao("Deseja EXCLUIR este relatório e estornar o bagageiro?", async () => {
        const batch = writeBatch(db);

        for (let pId in c.itens) {
            const item = c.itens[pId];
            const prod = window.produtosDB.find(p => p.id === pId);
            const docKey = prod?._docId || pId;
            let estorno = 0;

            if (c.tipoRegistro === 'retorno_boutique') {
                if (item.operador === '+') estorno = (item.ajusteQtd || 0);
                else if (item.operador === '-') estorno = -(item.ajusteQtd || 0);
            } else if (c.tipoRegistro === 'sobras_boutique') {
                estorno = -(item.sobra || 0);
            } else {
                const extraPego = Math.max(0, (item.carga || 0) - (item.cargaOriginal || 0));
                const netBagageiro = (item.saldo || 0) - extraPego;
                estorno = -netBagageiro;
            }

            if (estorno !== 0) {
                if (prod) {
                    prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) + estorno;
                }
                batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(estorno) }, { merge: true });
            }
        }

        window.contagensDB = window.contagensDB.filter(x => x.id !== id);
        setCache('trem_cache_contagens', window.contagensDB);
        setCache('trem_cache_produtos', window.produtosDB);

        batch.delete(doc(db, "contagens", c._docId || id));
        await batch.commit();

        fecharModal('modal-editar-relatorio');
        atualizarDashboardKPIs();
        renderizarRelatoriosAdmin();
        mostrarToast("Relatório excluído e estoques estornados!");
    });
}
