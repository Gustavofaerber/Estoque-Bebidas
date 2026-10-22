// ==========================================================================
// MÓDULO: CARGA POR VAGÃO E ESTOQUE EM TRÂNSITO (NUVEM DO DIA)
// ==========================================================================
import { db, doc, setDoc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, formatarDataBR, ordenarPorRegra, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';
import { mostrarTela } from '../state/router.js';

export function renderizarPainelEstoqueTransito() {
    const painel = document.getElementById('painelResumoEstoqueTransito');
    if (!painel) return;

    const elData = document.getElementById('dataCargaPorVagao');
    const dataSel = elData?.value || getDataHojeLocal();

    const cargaDia = window.cargasDiaDB.find(c => c.data === dataSel);
    if (!cargaDia || !cargaDia.itens) {
        painel.innerHTML = `<div style="font-size:13px; color:#0369a1;"><i class="ph ph-cloud-arrow-down"></i> <strong>Nuvem do Trem:</strong> Nenhuma carga geral lançada para ${formatarDataBR(dataSel)}.</div>`;
        return;
    }

    const cargasVagoesDia = window.cargasVagoesDB.filter(c => c.data === dataSel && !c.inativo);

    let chipsHtml = "";
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const itemDia = cargaDia.itens[p.id];
        const totalEmbarcadoUn = (itemDia?.total || 0) * unFardo;

        if (totalEmbarcadoUn <= 0) return;

        let alocadoVagoesUn = 0;
        cargasVagoesDia.forEach(cv => {
            if (cv.itens && cv.itens[p.id]) alocadoVagoesUn += (cv.itens[p.id].qtd || 0);
        });

        const saldoTransito = totalEmbarcadoUn - alocadoVagoesUn;
        const corSaldo = saldoTransito < 0
            ? 'color:var(--danger);'
            : (saldoTransito === 0 ? 'color:var(--success);' : 'color:#0369a1;');

        chipsHtml += `
            <div class="item-chip-transito">
                <strong>${escapeHTML(p.id)}:</strong>
                <span style="${corSaldo} font-weight:bold;">${saldoTransito} un livres</span>
            </div>
        `;
    });

    painel.innerHTML = `
        <div class="card-transito-header">
            <div><strong style="color:#0369a1; font-size:14px;"><i class="ph ph-cloud"></i> Bebidas Embarcadas (Nuvem em Trânsito)</strong></div>
            <span class="tag-transito">Livre para distribuir</span>
        </div>
        <div class="grade-transito-itens">${chipsHtml || '<span style="font-size:12px;">Nenhuma bebida na Nuvem.</span>'}</div>
    `;
}

export function trocarSentidoCargaVagao(sentido) {
    window.sentidoCargaVagao = sentido;
    const btnIda = document.getElementById('btnCargaSentidoIda');
    const btnVolta = document.getElementById('btnCargaSentidoVolta');
    if (sentido === 'Ida') {
        btnIda?.classList.add('ativo');
        btnVolta?.classList.remove('ativo');
    } else {
        btnVolta?.classList.add('ativo');
        btnIda?.classList.remove('ativo');
    }
    renderizarVagoesParaCarga();
}

export function renderizarVagoesParaCarga() {
    const div = document.getElementById('listaVagoesParaCarga');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('dataCargaPorVagao');
    if (!elData.value) elData.value = getDataHojeLocal();
    const dataSel = elData.value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';

    renderizarPainelEstoqueTransito();

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

    vagoesOrd.forEach(v => {
        const cargaKey = `${dataSel}_${v.id}_${sentidoSel}`;
        const cargaExistente = window.cargasVagoesDB.find(c =>
            (c.id === cargaKey) ||
            (c.data === dataSel && c.vagaoId === v.id && (c.sentido === sentidoSel || (!c.sentido && sentidoSel === 'Ida')))
        );
        const isInativo = cargaExistente?.inativo === true;

        let badgeStatus = '<span style="color:var(--secondary); font-size:12px;">Pendente</span>';
        let corBorda = 'border-inline-start: 6px solid var(--secondary);';

        if (isInativo) {
            badgeStatus = '<span style="color:#64748b; font-weight:700; font-size:12px;">✖ Vagão Vazio / Inativo</span>';
            corBorda = 'border-inline-start: 6px solid #94a3b8;';
        } else if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
            const totalUn = Object.values(cargaExistente.itens).reduce((acc, it) => acc + (it.qtd || 0), 0);
            const tagMorretes = cargaExistente.tipoRegistro === 'retorno_boutique'
                ? '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:800; margin-inline-start:4px;">Morretes</span>'
                : '';
            badgeStatus = `<span style="color:var(--success); font-weight:700; font-size:12px;">✔ Carga Lançada (${totalUn} un)</span> ${tagMorretes}`;
            corBorda = 'border-inline-start: 6px solid var(--success);';
        }

        const isBoutiqueVolta = (v.tipo === 'boutique' || v.tipo === 'litorina') && sentidoSel === 'Volta' && cargaExistente?.tipoRegistro === 'retorno_boutique';
        const idSafe = escapeHTML(v.id);

        div.innerHTML += `
            <div class="card-carga-vagao-item ${isInativo ? 'card-carga-vagao-inativo' : ''}" style="${corBorda}">
                <div style="flex:1;">
                    <strong style="font-size:15px;">Placa ${escapeHTML(v.numero)} - ${escapeHTML(v.nome)}</strong>
                    <div style="margin-top:2px;">${badgeStatus}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.alternarAtivacaoVagao('${idSafe}')" title="Ativar ou desativar vagão para este trajeto">
                        ${isInativo ? '<i class="ph ph-eye"></i> Ativar' : '<i class="ph ph-eye-slash"></i> Vazio'}
                    </button>
                    ${isBoutiqueVolta ? `
                        <button type="button" class="btn btn-boutique btn-pequeno" onclick="window.abrirModalDetalhesRetornoBoutique('${idSafe}')"><i class="ph ph-list-magnifying-glass"></i> Detalhes</button>
                    ` : `
                        <button type="button" class="btn btn-primary btn-pequeno" ${isInativo ? 'disabled' : ''} onclick="window.abrirModalMontarCargaVagao('${idSafe}')"><i class="ph ph-truck"></i> Montar</button>
                    `}
                </div>
            </div>
        `;
    });
}

export async function alternarAtivacaoVagao(vagaoId) {
    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';
    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;

    const cargaExistente = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const novoStatusInativo = !(cargaExistente?.inativo === true);

    await setDoc(doc(db, "cargas_vagoes", cargaKey), {
        id: cargaKey,
        data: dataSel,
        vagaoId: vagaoId,
        sentido: sentidoSel,
        inativo: novoStatusInativo,
        timestamp: Date.now()
    }, { merge: true });

    mostrarToast(novoStatusInativo ? "Vagão marcado como Vazio!" : "Vagão Reativado!");
}

export function abrirModalMontarCargaVagao(vagaoId) {
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    if (!vagao) return;

    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const sentidoSel = window.sentidoCargaVagao || 'Ida';
    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;

    document.getElementById('modalMcvVagaoId').value = vagaoId;
    document.getElementById('modalMcvSentido').value = sentidoSel;
    document.getElementById('modalMcvTitulo').innerText = `Carga (${sentidoSel}): ${unescapeHTML(vagao.nome)}`;

    const cargaExistente = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const selRec = document.getElementById('modalMcvReceitaSelect');
    selRec.innerHTML = '<option value="">-- Nenhuma (Manual) --</option>';
    window.receitasDB.forEach(r => selRec.innerHTML += `<option value="${escapeHTML(r.id)}">${escapeHTML(r.nome)}</option>`);

    if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
        document.getElementById('modalMcvObs').value = unescapeHTML(cargaExistente.obs || "");
        selRec.value = "";
    } else if (vagao.receitaId) {
        selRec.value = vagao.receitaId;
        document.getElementById('modalMcvObs').value = "";
    } else {
        selRec.value = "";
        document.getElementById('modalMcvObs').value = "";
    }

    const div = document.getElementById('modalMcvListaItens');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);
    const receitaObj = window.receitasDB.find(r => r.id === selRec.value);
    const permitidas = vagao?.bebidasPermitidas || [];

    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        let valTotal = 0;
        if (cargaExistente && cargaExistente.itens && cargaExistente.itens[p.id]) {
            valTotal = cargaExistente.itens[p.id].qtd || 0;
        } else if (receitaObj && receitaObj.itens && receitaObj.itens[p.id]) {
            valTotal = receitaObj.itens[p.id];
        }
        const idSafe = escapeHTML(p.id);

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div>
                    <strong style="font-size:14px; color:var(--primary);">${idSafe}</strong><br>
                    <span style="font-size:12px; color:var(--secondary);">${escapeHTML(p.nome)}</span>
                </div>
                <div style="display:flex; flex-direction:column; width:110px;">
                    <span style="font-size:10px; font-weight:bold; color:var(--secondary); text-align:center;">Total (Un):</span>
                    <div class="stepper-control">
                        <button type="button" class="btn-step" onclick="const el=document.getElementById('mcv_tot_${idSafe}'); if(el) el.value=Math.max(0,(parseInt(el.value)||0)-1);">−</button>
                        <input type="number" id="mcv_tot_${idSafe}" value="${valTotal}" min="0" inputmode="numeric" onfocus="this.select()" style="padding:6px 2px; font-weight:700; text-align:center;">
                        <button type="button" class="btn-step" onclick="const el=document.getElementById('mcv_tot_${idSafe}'); if(el) el.value=(parseInt(el.value)||0)+1;">+</button>
                    </div>
                </div>
            </div>
        `;
    });

    abrirModal('modal-montar-carga-vagao');
}

/**
 * Corrige a função ausente quando o usuário seleciona uma Receita no modal de Carga do Vagão!
 */
export function aplicarReceitaNaCargaModal() {
    const recId = document.getElementById('modalMcvReceitaSelect')?.value;
    const receitaObj = window.receitasDB.find(r => r.id === recId);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const elTot = document.getElementById(`mcv_tot_${p.id}`);
        if (!elTot) return;
        if (receitaObj && receitaObj.itens && receitaObj.itens[p.id] !== undefined) {
            elTot.value = receitaObj.itens[p.id] || 0;
        } else if (recId === "") {
            elTot.value = 0;
        } else {
            elTot.value = 0;
        }
    });

    if (receitaObj) {
        mostrarToast(`Receita "${unescapeHTML(receitaObj.nome)}" aplicada!`);
    }
}

export function copiarCargaVagaoAnteriorModal() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const dataAtual = document.getElementById('dataCargaPorVagao').value;
    const cargasVagao = window.cargasVagoesDB.filter(c => c.vagaoId === vagaoId && c.data !== dataAtual);
    if (cargasVagao.length === 0) return mostrarToast("Nenhuma carga anterior para este vagão.", true);

    cargasVagao.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const cargaAnterior = cargasVagao[0];

    abrirConfirmacao(`Copiar carga do dia ${formatarDataBR(cargaAnterior.data)}?`, () => {
        window.produtosDB.forEach(p => {
            const elTot = document.getElementById(`mcv_tot_${p.id}`);
            if (elTot) elTot.value = (cargaAnterior.itens && cargaAnterior.itens[p.id]) ? (cargaAnterior.itens[p.id].qtd || 0) : 0;
        });
        document.getElementById('modalMcvObs').value = unescapeHTML(cargaAnterior.obs || "");
        document.getElementById('modalMcvReceitaSelect').value = "";
        mostrarToast("Carga copiada! Edite e Salve.");
    });
}

export async function salvarCargaVagaoModal() {
    const vagaoId = document.getElementById('modalMcvVagaoId').value;
    const sentido = document.getElementById('modalMcvSentido').value || 'Ida';
    const data = document.getElementById('dataCargaPorVagao').value;
    const obs = document.getElementById('modalMcvObs').value.trim();
    const cargaKey = `${data}_${vagaoId}_${sentido}`;

    const cargaDia = window.cargasDiaDB.find(c => c.data === data);
    const outrasCargas = window.cargasVagoesDB.filter(c => c.data === data && c.id !== cargaKey && !c.inativo);

    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const totEl = document.getElementById(`mcv_tot_${p.id}`);
        if (!totEl) continue;

        const novaQtd = parseInt(totEl.value) || 0;
        const unFardo = p.unidadesPorFardo || 1;
        const docKey = p._docId || p.id;

        // Nuvem total embarcada = total de fardos lançados na Carga Geral * unidadesPorFardo
        const nuvemTotal = (cargaDia?.itens?.[p.id]?.total || 0) * unFardo;
        let nuvemUsadaOutros = 0;
        outrasCargas.forEach(c => {
            nuvemUsadaOutros += (c.itens?.[p.id]?.qtd || 0);
        });

        const nuvemLivre = Math.max(0, nuvemTotal - nuvemUsadaOutros);
        const bagageiroExtraAtual = Math.max(0, novaQtd - nuvemLivre);

        const cargaAnterior = window.cargasVagoesDB.find(c => c.id === cargaKey);
        let bagageiroExtraAnterior = 0;
        if (cargaAnterior && cargaAnterior.itens?.[p.id]) {
            const qtdAntiga = cargaAnterior.itens[p.id].qtd || 0;
            bagageiroExtraAnterior = Math.max(0, qtdAntiga - nuvemLivre);
        }

        const deltaBagageiro = bagageiroExtraAtual - bagageiroExtraAnterior;
        if (deltaBagageiro !== 0) {
            p.estoqueBagageiroUnidades = (parseInt(p.estoqueBagageiroUnidades) || 0) - deltaBagageiro;
            batch.set(doc(db, "produtos", docKey), {
                estoqueBagageiroUnidades: increment(-deltaBagageiro)
            }, { merge: true });
        }

        if (novaQtd > 0) {
            itensSalvos[p.id] = { qtd: novaQtd, baga: bagageiroExtraAtual, cont: novaQtd - bagageiroExtraAtual };
        }
    }

    const docCargaVagao = {
        id: cargaKey,
        data,
        vagaoId,
        sentido,
        inativo: false,
        itens: itensSalvos,
        obs: escapeHTML(obs),
        timestamp: Date.now()
    };

    const idx = window.cargasVagoesDB.findIndex(c => c.id === cargaKey);
    if (idx !== -1) window.cargasVagoesDB[idx] = docCargaVagao;
    else window.cargasVagoesDB.push(docCargaVagao);

    setCache('trem_cache_cargas_vagoes', window.cargasVagoesDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "cargas_vagoes", cargaKey), docCargaVagao);
    await batch.commit();

    fecharModal('modal-montar-carga-vagao');
    atualizarDashboardKPIs();
    mostrarToast(`Carga salva! (Abatimento da Nuvem e Bagageiro aplicado)`);
    renderizarVagoesParaCarga();
}

export function abrirModalDetalhesRetornoBoutique(vagaoId) {
    const dataSel = document.getElementById('dataCargaPorVagao').value;
    const cargaKey = `${dataSel}_${vagaoId}_Volta`;
    const carga = window.cargasVagoesDB.find(c => c.id === cargaKey);
    const vagao = window.vagoesDB.find(v => v.id === vagaoId);
    if (!carga || !vagao) return;

    document.getElementById('modalRetornoBoutiqueTitulo').innerText = `Retorno: ${unescapeHTML(vagao.nome)}`;
    const div = document.getElementById('listaDetalhesRetornoBoutique');
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    for (let pId in carga.itens) {
        const it = carga.itens[pId];
        const p = window.produtosDB.find(x => x.id === pId) || { nome: pId };
        const sinal = it.operador || '+';
        const strAjuste = (it.ajusteQtd !== undefined && it.ajusteQtd !== 0)
            ? `(${it.sobra || 0} sobra ${sinal} ${it.ajusteQtd})`
            : '';

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">
                <div><strong>${escapeHTML(p.nome)} (${escapeHTML(pId)})</strong><br><small style="color:var(--secondary); font-size:12px;">${escapeHTML(strAjuste)}</small></div>
                <span style="font-weight:800; font-size:15px; color:var(--primary);">${it.qtd} un</span>
            </div>
        `;
    }
    abrirModal('modal-detalhes-retorno-boutique');
}

export function editarRetornoBoutiqueNaCarga() {
    fecharModal('modal-detalhes-retorno-boutique');
    mostrarTela('tela-boutiques-hub');
    const selEtapa = document.getElementById('etapaBoutiqueHub');
    if (selEtapa) {
        selEtapa.value = 'morretes_com_retorno';
        if (typeof window.carregarFormularioBoutiqueHub === 'function') {
            window.carregarFormularioBoutiqueHub();
        }
    }
}
