// ==========================================================================
// MÓDULO: BOUTIQUES & LITORINAS HUB (SOBRAS E RETORNO MORRETES)
// ==========================================================================
import { db, doc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, ordenarPorRegra, escapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarTela } from '../state/router.js';

export function carregarSelectBoutiqueHub() {
    const selApoio = document.getElementById('selectApoioBoutiqueHub');
    if (selApoio) {
        const valorAntigo = selApoio.value;
        selApoio.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            selApoio.innerHTML += `<option value="${escapeHTML(u.nome)}">${escapeHTML(u.nome)}</option>`;
        });
        if (valorAntigo) selApoio.value = valorAntigo;
    }

    const sel = document.getElementById('selectVagaoBoutiqueHub');
    if (!sel) return;
    const vagaoAntigo = sel.value;
    sel.innerHTML = '<option value="">-- Selecione a Boutique/Litorina --</option>';

    const vagoesBoutLito = window.vagoesDB
        .filter(v => v.tipo === 'boutique' || v.tipo === 'litorina')
        .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
    vagoesBoutLito.forEach(v => {
        sel.innerHTML += `<option value="${escapeHTML(v.id)}">Placa ${escapeHTML(v.numero)} - ${escapeHTML(v.nome)} [${escapeHTML((v.tipo || '').toUpperCase())}]</option>`;
    });
    if (vagaoAntigo) sel.value = vagaoAntigo;

    const hj = getDataHojeLocal();
    const dtEl = document.getElementById('dataBoutiqueHub');
    if (dtEl && !dtEl.value) dtEl.value = hj;

    if (sel.value) {
        carregarFormularioBoutiqueHub();
    } else {
        const area = document.getElementById('areaFormBoutiqueHub');
        if (area) area.innerHTML = "";
    }
}

export function carregarFormularioBoutiqueHub() {
    const area = document.getElementById('areaFormBoutiqueHub');
    if (!area) return;
    area.innerHTML = "";

    const etapa = document.getElementById('etapaBoutiqueHub').value;
    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return;

    const dtEl = document.getElementById('dataBoutiqueHub');
    const dataSel = dtEl?.value || getDataHojeLocal();
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    ordenarPorRegra(window.produtosDB);
    const permitidas = vagaoObj?.bebidasPermitidas || [];

    const cargaKeyIda = `${dataSel}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c =>
        (c.id === cargaKeyIda) ||
        (c.data === dataSel && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido))
    );
    const itensCarregadosNaIda = cargaIda?.itens || {};

    const prods = window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id)));

    if (etapa === 'morretes_sem_retorno' || etapa === 'curitiba_final') {
        const titulo = etapa === 'morretes_sem_retorno'
            ? 'Baixar Sobras em Morretes (Sem Retorno)'
            : 'Fechamento Final das Sobras em Curitiba';
        let htmlItens = `<h4 style="color:var(--primary); margin-bottom:12px;">${titulo}</h4>`;

        prods.forEach(p => {
            const qtdIda = itensCarregadosNaIda[p.id]?.qtd || 0;
            const idSafe = escapeHTML(p.id);
            htmlItens += `
                <div class="item-contagem" style="padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div>
                        <strong>${idSafe} - ${escapeHTML(p.nome)}</strong><br>
                        ${qtdIda > 0 ? `<small style="color:var(--secondary); font-size:11px;">Carregou Ida: ${qtdIda} un</small>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:var(--secondary); font-weight:bold;">Sobrou:</span>
                        <input type="number" id="boutique_sobra_${idSafe}" placeholder="0" min="0" inputmode="numeric" onfocus="this.select()" style="width:82px; text-align:center; padding:8px; font-weight:bold;">
                    </div>
                </div>
            `;
        });
        htmlItens += `<button type="button" class="btn btn-success btn-lg" style="margin-top:15px;" onclick="window.salvarSobrasBoutiqueDirect()"><i class="ph ph-check-circle"></i> Creditar Sobras e Enviar Relatório</button>`;
        area.innerHTML = htmlItens;

    } else if (etapa === 'morretes_com_retorno') {
        let htmlItens = `
            <h4 style="color:var(--primary); margin-bottom:6px;">Ajuste de Carga para o Retorno (Volta)</h4>
            <p style="font-size:12px; color:var(--secondary); margin-bottom:12px;">
                Informe a sobra da ida e selecione <strong>+ (Reforçar do bagageiro)</strong> ou <strong>- (Devolver ao bagageiro)</strong>:
            </p>
        `;

        prods.forEach(p => {
            const qtdIda = itensCarregadosNaIda[p.id]?.qtd || 0;
            const idSafe = escapeHTML(p.id);
            htmlItens += `
                <div class="item-contagem" style="padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:6px;">
                        <strong style="color:var(--primary); font-size:15px;">${idSafe} - ${escapeHTML(p.nome)}</strong>
                        ${qtdIda > 0 ? `<span class="badge-carga-ida">Carga Ida: ${qtdIda} un</span>` : ''}
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1.3fr; gap:8px; align-items:center;">
                        <div>
                            <span style="font-size:11px; font-weight:700; color:var(--secondary);">Sobrou da Ida:</span>
                            <input type="number" id="boutique_ida_sobra_${idSafe}" placeholder="0" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.atualizarPreviaRetorno('${idSafe}')" style="padding:8px; font-weight:bold; text-align:center;">
                        </div>
                        <div>
                            <span style="font-size:11px; font-weight:700; color:var(--secondary);">Ajuste para Retorno:</span>
                            <div class="controles-ajuste-retorno">
                                <select id="boutique_operador_${idSafe}" class="select-operador-retorno" onchange="window.atualizarPreviaRetorno('${idSafe}')">
                                    <option value="+">+</option>
                                    <option value="-">-</option>
                                </select>
                                <input type="number" id="boutique_ajuste_qtd_${idSafe}" placeholder="Qtd" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.atualizarPreviaRetorno('${idSafe}')" style="padding:8px; font-weight:bold; text-align:center;">
                            </div>
                        </div>
                    </div>
                    <div id="previa_retorno_${idSafe}" style="margin-top:6px; font-size:12px; font-weight:700; color:var(--primary); text-align:end;">
                        = Carga da Volta: 0 un
                    </div>
                </div>
            `;
        });
        htmlItens += `<button type="button" class="btn btn-primary btn-lg" style="margin-top:15px;" onclick="window.salvarAjusteRetornoBoutique()"><i class="ph ph-check-circle"></i> Confirmar Carga do Retorno</button>`;
        area.innerHTML = htmlItens;
    }
}

export function atualizarPreviaRetorno(id) {
    const sobra = parseInt(document.getElementById(`boutique_ida_sobra_${id}`)?.value) || 0;
    const op = document.getElementById(`boutique_operador_${id}`)?.value || '+';
    const aj = parseInt(document.getElementById(`boutique_ajuste_qtd_${id}`)?.value) || 0;

    let res = sobra;
    if (op === '+') res += aj;
    else res = Math.max(0, res - aj);

    const lbl = document.getElementById(`previa_retorno_${id}`);
    if (lbl) lbl.innerText = `= Carga da Volta: ${res} un (${sobra} sobras da ida ${op} ${aj})`;
}

export async function salvarSobrasBoutiqueDirect() {
    const apoio = document.getElementById('selectApoioBoutiqueHub').value;
    if (!apoio) return mostrarToast("Selecione o Apoio Responsável!", true);

    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return mostrarToast("Selecione a Boutique!", true);

    const data = document.getElementById('dataBoutiqueHub').value;
    const etapa = document.getElementById('etapaBoutiqueHub').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const cargaKeyIda = `${data}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c =>
        (c.id === cargaKeyIda) ||
        (c.data === data && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido))
    );
    const itensCarregadosNaIda = cargaIda?.itens || {};

    const batch = writeBatch(db);
    let totalSobras = 0;
    let itensRelatorio = {};

    window.produtosDB.forEach(p => {
        const qtd = parseInt(document.getElementById(`boutique_sobra_${p.id}`)?.value) || 0;
        if (qtd > 0) {
            totalSobras += qtd;
            const docKey = p._docId || p.id;
            p.estoqueBagageiroUnidades = (parseInt(p.estoqueBagageiroUnidades) || 0) + qtd;
            batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(qtd) }, { merge: true });
            const cargaIdaVagao = itensCarregadosNaIda[p.id]?.qtd || 0;
            itensRelatorio[p.id] = {
                id: p.id,
                nome: p.nome,
                sobra: qtd,
                saldo: qtd,
                cargaOriginal: cargaIdaVagao,
                carga: cargaIdaVagao,
                pax: 0,
                trip: 0,
                ava: 0
            };
        }
    });

    if (totalSobras === 0) return mostrarToast("Informe as sobras para salvar!", true);

    const docId = `sobras_${etapa}_${data}_${vagaoId}`;
    const docData = {
        id: docId,
        data,
        vagaoId,
        vagao: vagaoObj?.nome || "Boutique",
        vagaoNumero: vagaoObj?.numero || "S/N",
        vagaoTipo: vagaoObj?.tipo || 'boutique',
        tipoRegistro: 'sobras_boutique',
        etapa: etapa,
        sentido: etapa === 'curitiba_final' ? 'Volta' : 'Ida',
        apoio: apoio,
        guia: 'Baixa de Sobras',
        itens: itensRelatorio,
        obs: etapa === 'morretes_sem_retorno' ? 'Baixa de Sobras em Morretes (Sem Retorno)' : 'Fechamento Final em Curitiba',
        timestamp: Date.now()
    };

    const idx = window.contagensDB.findIndex(c => c.id === docId);
    if (idx !== -1) window.contagensDB[idx] = docData;
    else window.contagensDB.push(docData);

    setCache('trem_cache_contagens', window.contagensDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "contagens", docId), docData);
    await batch.commit();

    atualizarDashboardKPIs();
    mostrarToast(`${totalSobras} unidades creditadas no Bagageiro e registradas nos relatórios!`);
    mostrarTela('tela-inicial');
}

export async function salvarAjusteRetornoBoutique() {
    const apoio = document.getElementById('selectApoioBoutiqueHub').value;
    if (!apoio) return mostrarToast("Selecione o Apoio Responsável!", true);

    const vagaoId = document.getElementById('selectVagaoBoutiqueHub').value;
    if (!vagaoId) return mostrarToast("Selecione a Boutique!", true);

    const data = document.getElementById('dataBoutiqueHub').value;
    const vagaoObj = window.vagoesDB.find(v => v.id === vagaoId);

    const cargaKeyIda = `${data}_${vagaoId}_Ida`;
    const cargaIda = window.cargasVagoesDB.find(c =>
        (c.id === cargaKeyIda) ||
        (c.data === data && c.vagaoId === vagaoId && (c.sentido === 'Ida' || !c.sentido))
    );
    const itensCarregadosNaIda = cargaIda?.itens || {};

    const batch = writeBatch(db);
    let itensCargaRetorno = {};
    let itensRelatorio = {};

    window.produtosDB.forEach(p => {
        const sobra = parseInt(document.getElementById(`boutique_ida_sobra_${p.id}`)?.value) || 0;
        const op = document.getElementById(`boutique_operador_${p.id}`)?.value || '+';
        const ajusteQtd = parseInt(document.getElementById(`boutique_ajuste_qtd_${p.id}`)?.value) || 0;

        let qtdFinal = sobra;
        if (op === '+') qtdFinal += ajusteQtd;
        else qtdFinal = Math.max(0, qtdFinal - ajusteQtd);

        if (sobra > 0 || ajusteQtd > 0 || qtdFinal > 0) {
            itensCargaRetorno[p.id] = { qtd: qtdFinal, sobra: sobra, operador: op, ajusteQtd: ajusteQtd, baga: 0, cont: 0 };

            const netAjusteBagageiro = (op === '+') ? -ajusteQtd : ajusteQtd;
            if (netAjusteBagageiro !== 0) {
                const docKey = p._docId || p.id;
                p.estoqueBagageiroUnidades = (parseInt(p.estoqueBagageiroUnidades) || 0) + netAjusteBagageiro;
                batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(netAjusteBagageiro) }, { merge: true });
            }

            const cargaIdaVagao = itensCarregadosNaIda[p.id]?.qtd || 0;
            itensRelatorio[p.id] = {
                id: p.id,
                nome: p.nome,
                sobra: sobra,
                ajusteQtd: ajusteQtd,
                operador: op,
                qtdFinal: qtdFinal,
                cargaOriginal: cargaIdaVagao,
                carga: cargaIdaVagao,
                saldo: sobra,
                pax: 0,
                trip: 0,
                ava: 0
            };
        }
    });

    const cargaKey = `${data}_${vagaoId}_Volta`;
    const docCargaVolta = {
        id: cargaKey,
        data,
        vagaoId,
        sentido: 'Volta',
        inativo: false,
        tipoRegistro: 'retorno_boutique',
        itens: itensCargaRetorno,
        obs: `Carga de Retorno calculada em Morretes (Sobras + Ajuste)`,
        timestamp: Date.now()
    };

    const contagemKey = `retorno_${data}_${vagaoId}`;
    const docContagemRetorno = {
        id: contagemKey,
        data,
        vagaoId,
        vagao: vagaoObj?.nome || "Boutique",
        vagaoNumero: vagaoObj?.numero || "S/N",
        vagaoTipo: vagaoObj?.tipo || 'boutique',
        tipoRegistro: 'retorno_boutique',
        sentido: 'Volta',
        apoio: apoio,
        guia: 'Ajuste de Retorno',
        itens: itensRelatorio,
        obs: `Carga da Volta gerada a partir das sobras de Morretes`,
        timestamp: Date.now()
    };

    batch.set(doc(db, "cargas_vagoes", cargaKey), docCargaVolta);
    batch.set(doc(db, "contagens", contagemKey), docContagemRetorno);
    setCache('trem_cache_produtos', window.produtosDB);

    await batch.commit();
    atualizarDashboardKPIs();
    mostrarToast("Carga de Retorno salva no espelho da volta e nos relatórios!");
    mostrarTela('tela-inicial');
}
