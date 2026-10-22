// ==========================================================================
// MÓDULO: CONTAGEM DE VAGÃO (APOIO - TURÍSTICOS E ECONÔMICOS)
// ==========================================================================
import { db, doc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, formatarDataBR, ordenarPorRegra, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarTela } from '../state/router.js';

export function abrirSetupContagem() {
    const selUser = document.getElementById('selectNomeApoio');
    if (selUser) {
        const valAntigo = selUser.value;
        selUser.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            selUser.innerHTML += `<option value="${escapeHTML(u.nome)}">${escapeHTML(u.nome)}</option>`;
        });
        if (valAntigo) selUser.value = valAntigo;
    }

    const selVagao = document.getElementById('selectVagaoApoio');
    if (selVagao) {
        selVagao.innerHTML = '<option value="">-- Selecione o vagão --</option>';
        const vagoesOrd = [...window.vagoesDB]
            .filter(v => v.tipo === 'turistico' || v.tipo === 'economico')
            .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
        vagoesOrd.forEach(v => {
            selVagao.innerHTML += `<option value="${escapeHTML(v.id)}">Placa ${escapeHTML(v.numero)} &bull; ${escapeHTML(v.nome)} [${escapeHTML((v.tipo || '').toUpperCase())}]</option>`;
        });
    }

    const draftStr = localStorage.getItem('trem_draft_contagem');
    let draft = null;
    try { draft = draftStr ? JSON.parse(draftStr) : null; } catch (e) { draft = null; }

    const hj = getDataHojeLocal();
    document.getElementById('dataContagemApoio').value = draft?.data || hj;
    document.getElementById('nomeGuiaApoio').value = unescapeHTML(draft?.guia || "");
    if (draft?.sentido) document.getElementById('selectSentidoApoio').value = draft.sentido;
    if (draft?.apoio && selUser) selUser.value = draft.apoio;
    if (draft?.vagaoId && selVagao) selVagao.value = draft.vagaoId;
}

export function iniciarContagemVagao() {
    const apoioNome = document.getElementById('selectNomeApoio').value;
    if (!apoioNome) return mostrarToast("Selecione o Apoio!", true);

    const vagaoId = document.getElementById('selectVagaoApoio').value;
    if (!vagaoId) return mostrarToast("Selecione o Vagão!", true);

    const guia = document.getElementById('nomeGuiaApoio').value.trim();
    if (!guia) return mostrarToast("Preencha o Nome do Guia!", true);

    const dataSel = document.getElementById('dataContagemApoio').value || getDataHojeLocal();
    const sentidoSel = document.getElementById('selectSentidoApoio').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const contagemId = `${dataSel}_${vagaoId}_${sentidoSel}`;
    if (window.contagensDB.some(c => c.id === contagemId)) {
        return mostrarToast(`Vagão Placa ${vagaoObj?.numero} já está fechado na ${sentidoSel}!`, true);
    }

    window.contagemTemp = {
        apoio: apoioNome,
        guia: escapeHTML(guia),
        data: dataSel,
        sentido: sentidoSel,
        vagaoId: vagaoId,
        vagaoNumero: vagaoObj?.numero || "S/N",
        vagao: `Placa ${vagaoObj?.numero || ''} - ${vagaoObj?.nome || 'Vagão'}`,
        vagaoTipo: vagaoObj?.tipo || 'turistico'
    };

    document.getElementById('lblVagaoContagem').innerText = unescapeHTML(window.contagemTemp.vagao);
    document.getElementById('lblSentidoContagem').innerText = window.contagemTemp.sentido;

    const cargaKey = `${dataSel}_${vagaoId}_${sentidoSel}`;
    const cargaDoChefe = window.cargasVagoesDB.find(c =>
        c.id === cargaKey ||
        (c.data === dataSel && c.vagaoId === vagaoId && c.sentido === sentidoSel)
    );

    const boxAviso = document.getElementById('avisoCargaCarregada');
    if (cargaDoChefe) {
        boxAviso.innerHTML = `<span style="background:#dcfce7; color:#15803d; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"><i class="ph ph-check-circle"></i> Carga oficial sincronizada!</span>`;
    } else {
        boxAviso.innerHTML = `<span style="background:#fee2e2; color:#b91c1c; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"><i class="ph ph-warning"></i> Carga não cadastrada. Preencha manualmente.</span>`;
    }

    const div = document.getElementById('listaItensContagem');
    div.innerHTML = "";
    let draftRaw = null;
    try { draftRaw = JSON.parse(localStorage.getItem('trem_draft_contagem') || 'null'); } catch (e) { draftRaw = null; }

    // CORREÇÃO DE BUG CRÍTICO: Só usa o rascunho se for exatamente do mesmo vagão, data e sentido!
    const draft = (draftRaw && draftRaw.vagaoId === vagaoId && draftRaw.data === dataSel && draftRaw.sentido === sentidoSel)
        ? draftRaw
        : null;

    ordenarPorRegra(window.produtosDB);

    const permitidas = vagaoObj?.bebidasPermitidas || [];
    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        const cargaBase = (cargaDoChefe && cargaDoChefe.itens && cargaDoChefe.itens[p.id]) ? (cargaDoChefe.itens[p.id].qtd || 0) : 0;
        const valCarga = draft?.itens?.[p.id]?.carga !== undefined && draft?.itens?.[p.id]?.carga !== "" ? draft.itens[p.id].carga : cargaBase;
        const valSaldo = draft?.itens?.[p.id]?.saldo !== undefined && draft?.itens?.[p.id]?.saldo !== "" ? draft.itens[p.id].saldo : "";
        const valTrip = draft?.itens?.[p.id]?.trip !== undefined && draft?.itens?.[p.id]?.trip !== "" ? draft.itens[p.id].trip : 0;
        const valAva = draft?.itens?.[p.id]?.ava !== undefined && draft?.itens?.[p.id]?.ava !== "" ? draft.itens[p.id].ava : 0;
        const idSafe = escapeHTML(p.id);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header"><span><span class="badge-ordem">#${p.ordem || '-'}</span> ${escapeHTML(p.nome)} (${idSafe})</span></div>
                <div class="grid-inputs" style="grid-template-columns: repeat(3, 1fr);">
                    <div><label>Carga:</label><input type="number" id="carga_${idSafe}" value="${valCarga}" data-carga-original="${cargaBase}" inputmode="numeric" onfocus="this.select()" oninput="window.calcularConsumo('${idSafe}'); window.salvarDraftContagem();"></div>
                    <div><label>Sobra (Saldo):</label><input type="number" id="saldo_${idSafe}" value="${valSaldo}" class="destaque-input" placeholder="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularConsumo('${idSafe}'); window.salvarDraftContagem();"></div>
                    <div><label>Pax (Auto):</label><input type="number" id="pax_${idSafe}" class="input-pax" readonly value="${valCarga}"></div>
                    <div><label>Tripulação:</label><input type="number" id="trip_${idSafe}" value="${valTrip}" inputmode="numeric" onfocus="this.select()" oninput="window.calcularConsumo('${idSafe}'); window.salvarDraftContagem();"></div>
                    <div><label>Avaria:</label><input type="number" id="ava_${idSafe}" class="input-avaria" value="${valAva}" inputmode="numeric" onfocus="this.select()" oninput="window.calcularConsumo('${idSafe}'); window.salvarDraftContagem();"></div>
                </div>
            </div>
        `;
    });

    window.produtosDB.forEach(p => calcularConsumo(p.id));
    atualizarComparativoContagemAoVivo();
    mostrarTela('tela-contagem-vagao');
}

export function atualizarComparativoContagemAoVivo() {
    let totalLanches = 0;
    let totalBebidas = 0;

    window.produtosDB.forEach(p => {
        const paxEl = document.getElementById(`pax_${p.id}`);
        if (!paxEl) return;
        const pax = parseInt(paxEl.value) || 0;
        if (p.id === 'KL' || p.id === 'Kl') totalLanches += pax;
        else totalBebidas += pax;
    });

    const bar = document.getElementById('liveBarContagemComparativo');
    const lblLanches = document.getElementById('liveContagemLanches');
    const lblBebidas = document.getElementById('liveContagemBebidas');
    if (lblLanches) lblLanches.innerText = totalLanches;
    if (lblBebidas) lblBebidas.innerText = totalBebidas;
    if (bar) {
        bar.className = 'contagem-live-bar ' + (totalLanches === totalBebidas ? 'kpi-match' : 'kpi-divergent');
    }
}

export function calcularConsumo(id) {
    const carga = parseInt(document.getElementById(`carga_${id}`)?.value) || 0;
    const saldo = parseInt(document.getElementById(`saldo_${id}`)?.value) || 0;
    const trip = parseInt(document.getElementById(`trip_${id}`)?.value) || 0;
    const ava = parseInt(document.getElementById(`ava_${id}`)?.value) || 0;
    const paxEl = document.getElementById(`pax_${id}`);
    if (paxEl) paxEl.value = Math.max(0, carga - saldo - trip - ava);
    atualizarComparativoContagemAoVivo();
}

export function salvarDraftContagem() {
    if (!window.contagemTemp.vagaoId) return;
    let draftItens = {};
    window.produtosDB.forEach(p => {
        const c = document.getElementById(`carga_${p.id}`)?.value;
        const s = document.getElementById(`saldo_${p.id}`)?.value;
        const t = document.getElementById(`trip_${p.id}`)?.value;
        const a = document.getElementById(`ava_${p.id}`)?.value;
        if (c !== undefined || s !== undefined) draftItens[p.id] = { carga: c, saldo: s, trip: t, ava: a };
    });
    localStorage.setItem('trem_draft_contagem', JSON.stringify({ ...window.contagemTemp, itens: draftItens }));
}

export function gerarResumoContagem() {
    window.contagemTemp.itens = {};
    const tbody = document.getElementById('tabelaResumoCorpo');
    tbody.innerHTML = "";
    let totalLanches = 0, totalBebidas = 0;

    ordenarPorRegra(window.produtosDB);
    window.produtosDB.forEach(p => {
        const elCarga = document.getElementById(`carga_${p.id}`);
        if (!elCarga) return;

        const attrOrig = elCarga.getAttribute('data-carga-original');
        const obj = {
            id: p.id,
            nome: p.nome,
            cargaOriginal: attrOrig !== null && attrOrig !== "" ? parseInt(attrOrig) : (parseInt(elCarga.value) || 0),
            carga: parseInt(elCarga.value) || 0,
            saldo: parseInt(document.getElementById(`saldo_${p.id}`)?.value) || 0,
            trip: parseInt(document.getElementById(`trip_${p.id}`)?.value) || 0,
            ava: parseInt(document.getElementById(`ava_${p.id}`)?.value) || 0,
            pax: parseInt(document.getElementById(`pax_${p.id}`)?.value) || 0
        };

        window.contagemTemp.itens[p.id] = obj;

        if (obj.carga > 0 || obj.saldo > 0 || obj.trip > 0 || obj.ava > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${escapeHTML(obj.nome)}</td>
                    <td>${obj.carga}</td>
                    <td style="color:var(--success); font-weight:bold;">${obj.pax}</td>
                    <td>${obj.trip > 0 ? obj.trip : '-'}</td>
                    <td style="color:var(--danger);">${obj.ava > 0 ? obj.ava : '-'}</td>
                    <td style="font-weight:bold; color:var(--primary);">${obj.saldo}</td>
                </tr>
            `;
            if (p.id === 'KL' || p.id === 'Kl') totalLanches += obj.pax;
            else totalBebidas += obj.pax;
        }
    });

    document.getElementById('resumoTotalLanches').innerText = totalLanches;
    document.getElementById('resumoTotalBebidas').innerText = totalBebidas;
    document.getElementById('boxStatusComparativoResumo').className = (totalLanches === totalBebidas)
        ? 'box-comparativo-status kpi-match'
        : 'box-comparativo-status kpi-divergent';
    document.getElementById('resumoApoio').innerText = window.contagemTemp.apoio;
    document.getElementById('resumoGuia').innerText = unescapeHTML(window.contagemTemp.guia);
    document.getElementById('resumoData').innerText = formatarDataBR(window.contagemTemp.data);
    document.getElementById('resumoVagao').innerText = unescapeHTML(window.contagemTemp.vagao);
    document.getElementById('resumoSentido').innerText = window.contagemTemp.sentido;

    mostrarTela('tela-resumo-contagem');
}

export async function salvarContagemDefinitiva() {
    const btnSalvar = document.getElementById('btnSalvarContagemDefinitiva');
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Gravando...';
    }

    const contagemId = `${window.contagemTemp.data}_${window.contagemTemp.vagaoId}_${window.contagemTemp.sentido}`;
    window.contagemTemp.obs = escapeHTML(document.getElementById('obsFinalContagem').value);
    window.contagemTemp.id = contagemId;
    window.contagemTemp.timestamp = Date.now();

    const batch = writeBatch(db);
    for (let id in window.contagemTemp.itens) {
        const item = window.contagemTemp.itens[id];
        const extraPego = Math.max(0, item.carga - item.cargaOriginal);
        const netBagageiro = item.saldo - extraPego;

        if (netBagageiro !== 0) {
            const prod = window.produtosDB.find(p => p.id === id);
            const docKey = prod?._docId || id;
            if (prod) {
                prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) + netBagageiro;
            }
            batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(netBagageiro) }, { merge: true });
        }
    }

    window.contagensDB.push({ ...window.contagemTemp });
    setCache('trem_cache_contagens', window.contagensDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "contagens", contagemId), window.contagemTemp, { merge: true });
    await batch.commit().catch(e => console.info("Gravado offline:", e));

    localStorage.removeItem('trem_draft_contagem');
    atualizarDashboardKPIs();
    mostrarToast(`Vagão ${window.contagemTemp.vagaoNumero} fechado!`);

    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="ph ph-paper-plane-right"></i> Confirmar e Fechar Vagão';
    }
    window.contagemTemp = {};
    document.getElementById('obsFinalContagem').value = "";
    mostrarTela('tela-setup-contagem');
    abrirSetupContagem();
}
