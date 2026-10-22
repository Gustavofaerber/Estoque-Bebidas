// ==========================================================================
// MÓDULO: CARGA GERAL DO DIA (MANIFESTO & ALOCAÇÃO NA NUVEM DO TREM)
// ==========================================================================
import { db, doc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, formatarDataBR, formatarEstoqueFardos, ordenarPorRegra, escapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast, abrirConfirmacao } from '../utils/toast.js';
import { mostrarTela } from '../state/router.js';

export function verificarStatusEdicaoCarga() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    const boxStatus = document.getElementById('statusCargaEdicao');
    if (!boxStatus || !dataSel) return;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    if (cargaExistente && cargaExistente.itens && Object.keys(cargaExistente.itens).length > 0) {
        boxStatus.innerHTML = `
            <div style="background:#fefce8; border:1.5px solid #fde68a; color:#92400e; padding:10px 14px; border-radius:8px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-pencil-simple-line"></i> Editando Carga Geral de ${formatarDataBR(dataSel)}. Ajustes atualizarão a Nuvem do Trem.
            </div>
        `;
    } else {
        boxStatus.innerHTML = `
            <div style="background:#e0f2fe; border:1.5px solid #bae6fd; color:#0369a1; padding:10px 14px; border-radius:8px; font-weight:600; font-size:13px; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-plus-circle"></i> Criando Carga para ${formatarDataBR(dataSel)}. Ao salvar, sai do Contêiner e Bagageiro para a Nuvem.
            </div>
        `;
    }
}

export function trocarDataCargaDia() {
    localStorage.removeItem('trem_draft_carga');
    abrirCargaDoDia();
}

export function copiarCargaDiaAnterior() {
    if (!window.cargasDiaDB || window.cargasDiaDB.length === 0) {
        return mostrarToast("Nenhuma carga anterior encontrada.", true);
    }
    const cargasOrdenadas = [...window.cargasDiaDB].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const dataAtual = document.getElementById('dataCargaDia').value;
    const cargaAnterior = cargasOrdenadas.find(c => c.data !== dataAtual) || cargasOrdenadas[0];

    if (!cargaAnterior) return mostrarToast("Nenhuma carga anterior.", true);

    abrirConfirmacao(`Deseja copiar a carga geral do dia ${formatarDataBR(cargaAnterior.data)}?`, () => {
        window.produtosDB.forEach(p => {
            if (cargaAnterior.itens && cargaAnterior.itens[p.id]) {
                const item = cargaAnterior.itens[p.id];
                if (document.getElementById(`carga_total_${p.id}`)) document.getElementById(`carga_total_${p.id}`).value = item.total || 0;
                if (document.getElementById(`carga_baga_${p.id}`)) document.getElementById(`carga_baga_${p.id}`).value = item.baga || 0;
                if (document.getElementById(`carga_dest_${p.id}`)) document.getElementById(`carga_dest_${p.id}`).value = item.destino || "";
                if (document.getElementById(`carga_ordem_${p.id}`) && item.ordem) document.getElementById(`carga_ordem_${p.id}`).value = item.ordem;
                calcularFormulaLinha(p.id);
            } else {
                if (document.getElementById(`carga_total_${p.id}`)) document.getElementById(`carga_total_${p.id}`).value = 0;
                if (document.getElementById(`carga_baga_${p.id}`)) document.getElementById(`carga_baga_${p.id}`).value = 0;
                if (document.getElementById(`carga_dest_${p.id}`)) document.getElementById(`carga_dest_${p.id}`).value = "";
                calcularFormulaLinha(p.id);
            }
        });
        const elObs = document.getElementById('obsEspeciaisCarga');
        if (elObs) elObs.value = cargaAnterior.obsEspeciais || "";
        salvarDraftCarga();
        mostrarToast("Carga copiada! Revise e salve para confirmar.");
    });
}

export function abrirCargaDoDia() {
    const div = document.getElementById('listaItensCargaDia');
    if (!div) return;
    div.innerHTML = "";

    const hj = getDataHojeLocal();
    const elData = document.getElementById('dataCargaDia');
    if (!elData.value) elData.value = hj;
    const dataSel = elData.value;

    const cargaExistente = window.cargasDiaDB.find(c => c.data === dataSel);
    const draftStr = localStorage.getItem('trem_draft_carga');
    let draft = null;
    try { draft = draftStr ? JSON.parse(draftStr) : null; } catch (e) { draft = null; }

    verificarStatusEdicaoCarga();
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const unPorFardo = p.unidadesPorFardo || 1;
        const bagaDisponivel = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unPorFardo);
        const contDisponivel = formatarEstoqueFardos(p.estoqueContainerUnidades, unPorFardo);

        let valTotal = 0, valBaga = 0, valDest = "", valOrdem = p.ordem || 99;

        if (draft && draft.data === dataSel && draft.itens?.[p.id]) {
            valTotal = draft.itens[p.id].total || 0;
            valBaga = draft.itens[p.id].baga || 0;
            valDest = draft.itens[p.id].dest || "";
            valOrdem = draft.itens[p.id].ordem !== undefined ? draft.itens[p.id].ordem : valOrdem;
        } else if (cargaExistente && cargaExistente.itens?.[p.id]) {
            valTotal = cargaExistente.itens[p.id].total || 0;
            valBaga = cargaExistente.itens[p.id].baga || 0;
            valDest = cargaExistente.itens[p.id].destino || "";
            valOrdem = cargaExistente.itens[p.id].ordem !== undefined ? cargaExistente.itens[p.id].ordem : valOrdem;
        }

        const valCont = Math.max(0, valTotal - valBaga);
        const idSafe = escapeHTML(p.id);

        div.innerHTML += `
            <div class="item-contagem">
                <div class="item-contagem-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; font-weight:700; color:var(--secondary);">Ordem:</span>
                        <input type="number" id="carga_ordem_${idSafe}" value="${valOrdem}" style="width:58px; padding:4px 6px; font-size:14px; text-align:center; border-radius:6px; min-block-size:34px;" oninput="window.salvarDraftCarga()">
                        <strong>${escapeHTML(p.nome)} (${idSafe})</strong>
                    </div>
                    <div style="display:flex; gap:8px; font-size:12px;">
                        <small style="color:var(--container-color); font-weight:700;">Cont: ${contDisponivel}</small>
                        <small style="color:var(--bagageiro-color); font-weight:700;">Baga: ${bagaDisponivel}</small>
                    </div>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:8px;">
                    <div><label>Total (Fardos):</label><input type="number" id="carga_total_${idSafe}" value="${valTotal}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularFormulaLinha('${idSafe}'); window.salvarDraftCarga();"></div>
                    <div><label>Do Baga (Fardos):</label><input type="number" id="carga_baga_${idSafe}" value="${valBaga}" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularFormulaLinha('${idSafe}'); window.salvarDraftCarga();"></div>
                    <div><label>= Contêiner:</label><input type="number" id="carga_cont_${idSafe}" readonly class="input-pax" value="${valCont}"></div>
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:var(--secondary);">Distribuição / Destino:</label>
                    <input type="text" id="carga_dest_${idSafe}" value="${escapeHTML(valDest)}" placeholder="Ex: 1 eco, 2 tur, 3 pls 15 e 17" style="padding:8px 12px; font-size:14px; min-block-size:40px;" oninput="window.salvarDraftCarga()">
                </div>
            </div>
        `;
    });

    const elObs = document.getElementById('obsEspeciaisCarga');
    if (elObs) {
        if (draft && draft.data === dataSel) elObs.value = draft.obs || "";
        else if (cargaExistente) elObs.value = cargaExistente.obsEspeciais || "";
        else elObs.value = "";
    }
}

export function calcularFormulaLinha(id) {
    const total = parseInt(document.getElementById(`carga_total_${id}`)?.value) || 0;
    const baga = parseInt(document.getElementById(`carga_baga_${id}`)?.value) || 0;
    const contEl = document.getElementById(`carga_cont_${id}`);
    if (contEl) contEl.value = Math.max(0, total - baga);
}

export function salvarDraftCarga() {
    const dataSel = document.getElementById('dataCargaDia')?.value;
    if (!dataSel) return;
    let draftItens = {};
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const tot = parseInt(document.getElementById(`carga_total_${p.id}`)?.value) || 0;
        const bag = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const dest = document.getElementById(`carga_dest_${p.id}`)?.value || "";
        const ord = parseInt(document.getElementById(`carga_ordem_${p.id}`)?.value) || p.ordem || 99;
        if (tot > 0 || bag > 0 || dest !== "") draftItens[p.id] = { total: tot, baga: bag, dest, ordem: ord };
    });
    localStorage.setItem('trem_draft_carga', JSON.stringify({
        data: dataSel,
        itens: draftItens,
        obs: document.getElementById('obsEspeciaisCarga')?.value || ""
    }));
}

export function limparDraftCarga() {
    abrirConfirmacao("Deseja limpar o rascunho da carga geral?", () => {
        localStorage.removeItem('trem_draft_carga');
        abrirCargaDoDia();
        mostrarToast("Rascunho descartado.");
    });
}

export async function salvarCargaDoDia() {
    const data = document.getElementById('dataCargaDia').value;
    const obsEspeciais = document.getElementById('obsEspeciaisCarga').value.trim();
    const cargaAntiga = window.cargasDiaDB.find(c => c.data === data);
    let itensSalvos = {};
    const batch = writeBatch(db);

    for (let p of window.produtosDB.filter(x => !x.nome.includes('(Venda)'))) {
        const totEl = document.getElementById(`carga_total_${p.id}`);
        if (!totEl) continue;

        const totalFardos = parseInt(totEl.value) || 0;
        const bagaFardos = parseInt(document.getElementById(`carga_baga_${p.id}`)?.value) || 0;
        const contFardos = parseInt(document.getElementById(`carga_cont_${p.id}`)?.value) || 0;
        const destino = document.getElementById(`carga_dest_${p.id}`)?.value.trim() || "";
        const novaOrdem = parseInt(document.getElementById(`carga_ordem_${p.id}`)?.value) || p.ordem || 99;
        const unFardo = p.unidadesPorFardo || 1;
        const docKey = p._docId || p.id;

        if (p.ordem !== novaOrdem) {
            p.ordem = novaOrdem;
            batch.set(doc(db, "produtos", docKey), { ordem: novaOrdem }, { merge: true });
        }

        if (totalFardos > 0 || bagaFardos > 0 || destino !== "" || (cargaAntiga && cargaAntiga.itens?.[p.id])) {
            itensSalvos[p.id] = { total: totalFardos, baga: bagaFardos, cont: contFardos, destino, ordem: novaOrdem };
            const antigoContFardos = cargaAntiga?.itens?.[p.id]?.cont || 0;
            const antigoBagaFardos = cargaAntiga?.itens?.[p.id]?.baga || 0;
            const difContFardos = contFardos - antigoContFardos;
            const difBagaFardos = bagaFardos - antigoBagaFardos;

            if (difContFardos !== 0 || difBagaFardos !== 0) {
                const deltaContUn = -(difContFardos * unFardo);
                const deltaBagaUn = -(difBagaFardos * unFardo);
                p.estoqueContainerUnidades = (parseInt(p.estoqueContainerUnidades) || 0) + deltaContUn;
                p.estoqueBagageiroUnidades = (parseInt(p.estoqueBagageiroUnidades) || 0) + deltaBagaUn;

                batch.set(doc(db, "produtos", docKey), {
                    estoqueContainerUnidades: increment(deltaContUn),
                    estoqueBagageiroUnidades: increment(deltaBagaUn)
                }, { merge: true });
            }
        }
    }

    const novaCargaDoc = { id: data, data, itens: itensSalvos, obsEspeciais, timestamp: Date.now() };
    const idxAntiga = window.cargasDiaDB.findIndex(c => c.data === data);
    if (idxAntiga !== -1) window.cargasDiaDB[idxAntiga] = novaCargaDoc;
    else window.cargasDiaDB.push(novaCargaDoc);

    setCache('trem_cache_cargas', window.cargasDiaDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "cargas_dia", data), novaCargaDoc);
    await batch.commit();

    localStorage.removeItem('trem_draft_carga');
    atualizarDashboardKPIs();
    mostrarToast("Carga Geral salva! Bebidas alocadas na Nuvem do Trem.");
    mostrarTela('tela-admin');
}
