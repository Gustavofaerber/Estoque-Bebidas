// ==========================================================================
// MÓDULO: MONITOR DE VIAGEM E REFORÇOS EM TRÂNSITO
// ==========================================================================
import { db, doc, setDoc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast, abrirModal, abrirConfirmacao } from '../utils/toast.js';

export function getEstadoViagemHoje(dataHoje) {
    if (!window.viagensStatusDB[dataHoje]) {
        return { etapa: 'preparacao', sentido: 'Ida', reforcos: {} };
    }
    if (!window.viagensStatusDB[dataHoje].reforcos) {
        window.viagensStatusDB[dataHoje].reforcos = {};
    }
    return window.viagensStatusDB[dataHoje];
}

export function carregarMonitorViagem() {
    const hj = getDataHojeLocal();
    const estado = getEstadoViagemHoje(hj);

    const elEtapa = document.getElementById('lblEtapaViagemTexto');
    const elSentido = document.getElementById('badgeSentidoAtivo');

    if (elEtapa && elSentido) {
        if (estado.etapa === 'preparacao') { elEtapa.innerText = "Em Preparação (Curitiba)"; elSentido.innerText = "Ida"; }
        else if (estado.etapa === 'ida') { elEtapa.innerText = "Viagem de IDA em Andamento"; elSentido.innerText = "Ida"; }
        else if (estado.etapa === 'morretes') { elEtapa.innerText = "Trem em Morretes (Preparando Retorno)"; elSentido.innerText = "Retorno"; }
        else if (estado.etapa === 'volta') { elEtapa.innerText = "Viagem de VOLTA em Andamento"; elSentido.innerText = "Volta"; }
        else { elEtapa.innerText = "Viagem Finalizada (Curitiba)"; elSentido.innerText = "Finalizado"; }
    }

    const grid = document.getElementById('gridVagoesOperacao');
    if (!grid) return;
    grid.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
    vagoesOrd.forEach(v => {
        const estaAberto = (estado.etapa === 'ida' || estado.etapa === 'volta');
        const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
        const qtdReforcos = (estado.reforcos?.[v.id] || []).length;

        const statusTexto = contagemFechada ? `✔ Fechado (${estado.sentido})` : (estaAberto ? `🟢 Em Aberto` : `Aguardando Início`);
        const classeCard = contagemFechada ? 'vagao-fechado' : (estaAberto ? 'vagao-aberto' : '');
        const badgeStatus = contagemFechada ? 'status-fechado' : (estaAberto ? 'status-aberto' : '');
        const idSafe = escapeHTML(v.id);

        grid.innerHTML += `
            <div class="card-vagao-status ${classeCard}" onclick="window.abrirModalVagaoOperacao('${idSafe}')">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                        <strong style="font-size:16px;">Placa ${escapeHTML(v.numero)} - ${escapeHTML(v.nome)}</strong>
                        <span class="badge-tag-status ${badgeStatus}">${statusTexto}</span>
                    </div>
                    <small style="color:var(--secondary); text-transform:uppercase; font-weight:700; font-size:12px;">[${escapeHTML(v.tipo)}]</small>
                    ${qtdReforcos > 0 ? `<span style="margin-inline-start:6px; font-size:11px; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:6px; font-weight:700;">+${qtdReforcos} reforço(s)</span>` : ''}
                </div>
                <div style="margin-top:10px; font-size:12px; color:var(--primary); font-weight:600;">
                    ${estaAberto ? '<i class="ph ph-arrows-left-right"></i> Ver / Adicionar Reforços' : '<i class="ph ph-info"></i> Consultar'}
                </div>
            </div>
        `;
    });
}

export async function iniciarViagemIda() {
    abrirConfirmacao("Iniciar oficialmente a Viagem de IDA?", async () => {
        const hj = getDataHojeLocal();
        const est = getEstadoViagemHoje(hj);
        est.etapa = 'ida';
        est.sentido = 'Ida';
        window.viagensStatusDB[hj] = est;
        setCache('trem_cache_viagens_status', window.viagensStatusDB);
        await setDoc(doc(db, "viagens_status", hj), est);
        carregarMonitorViagem();
    });
}

export async function prepararRetornoMorretes() {
    abrirConfirmacao("O trem chegou em Morretes?", async () => {
        const hj = getDataHojeLocal();
        const est = getEstadoViagemHoje(hj);
        est.etapa = 'morretes';
        est.sentido = 'Volta';
        window.viagensStatusDB[hj] = est;
        setCache('trem_cache_viagens_status', window.viagensStatusDB);
        await setDoc(doc(db, "viagens_status", hj), est);
        carregarMonitorViagem();
    });
}

export async function iniciarViagemVolta() {
    abrirConfirmacao("Iniciar oficialmente a Viagem de VOLTA?", async () => {
        const hj = getDataHojeLocal();
        const est = getEstadoViagemHoje(hj);
        est.etapa = 'volta';
        est.sentido = 'Volta';
        window.viagensStatusDB[hj] = est;
        setCache('trem_cache_viagens_status', window.viagensStatusDB);
        await setDoc(doc(db, "viagens_status", hj), est);
        carregarMonitorViagem();
    });
}

export function abrirModalVagaoOperacao(vagaoId) {
    const v = window.vagoesDB.find(x => x.id === vagaoId);
    if (!v) return;

    window.vagaoOperacaoSelecionadoId = vagaoId;
    const hj = getDataHojeLocal();
    const estado = getEstadoViagemHoje(hj);

    document.getElementById('modalOpVagaoNome').innerText = `Placa ${unescapeHTML(v.numero)} - ${unescapeHTML(v.nome)}`;
    const contagemFechada = window.contagensDB.find(c => c.data === hj && c.vagaoId === v.id && c.sentido === estado.sentido);
    const elStatus = document.getElementById('modalOpVagaoStatus');
    elStatus.innerText = contagemFechada ? `FECHADO` : ((estado.etapa === 'ida' || estado.etapa === 'volta') ? `EM ABERTO` : `AGUARDANDO`);

    const selReforco = document.getElementById('modalOpSelectBebidaReforco');
    selReforco.innerHTML = "";
    const permitidas = v.bebidasPermitidas || [];
    window.produtosDB.filter(p => !p.nome.includes('(Venda)') && (permitidas.length === 0 || permitidas.includes(p.id))).forEach(p => {
        selReforco.innerHTML += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.id)} - ${escapeHTML(p.nome)} (Bagageiro: ${p.estoqueBagageiroUnidades || 0} un)</option>`;
    });

    renderizarListaReforcosFeitos();
    abrirModal('modal-vagao-operacao');
}

export function renderizarListaReforcosFeitos() {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const hj = getDataHojeLocal();
    const estado = getEstadoViagemHoje(hj);
    const divReforcos = document.getElementById('modalOpListaReforcosFeitos');
    divReforcos.innerHTML = "";

    const lista = estado.reforcos?.[vagaoId] || [];
    if (lista.length === 0) {
        divReforcos.innerHTML = '<span style="color:var(--secondary); font-style:italic;">Nenhum reforço lançado.</span>';
    } else {
        lista.forEach((r, idx) => {
            divReforcos.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fefce8; border:1px solid #fde68a; padding:6px 10px; border-radius:6px;">
                    <div><span style="color:var(--accent); font-weight:700;">+ ${r.qtd}x ${escapeHTML(r.bebidaId)}</span> <span style="font-size:11px; color:var(--secondary);">às ${escapeHTML(r.hora)}</span></div>
                    <button type="button" class="btn btn-danger btn-pequeno" style="padding:4px 6px;" onclick="window.removerReforcoVagao(${idx})"><i class="ph ph-trash"></i></button>
                </div>
            `;
        });
    }
}

export async function adicionarReforcoVagao() {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const bebidaId = document.getElementById('modalOpSelectBebidaReforco').value;
    const qtd = parseInt(document.getElementById('modalOpQtdReforco').value) || 1;

    if (!bebidaId || qtd < 1) return mostrarToast("Selecione bebida e quantidade válida!", true);

    const hj = getDataHojeLocal();
    const estado = getEstadoViagemHoje(hj);
    if (!estado.reforcos[vagaoId]) estado.reforcos[vagaoId] = [];

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    estado.reforcos[vagaoId].push({ bebidaId, qtd, hora: horaAtual, sentido: estado.sentido || 'Ida' });

    const prod = window.produtosDB.find(p => p.id === bebidaId);
    const docKey = prod?._docId || bebidaId;
    if (prod) {
        prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) - qtd;
        setCache('trem_cache_produtos', window.produtosDB);
    }
    window.viagensStatusDB[hj] = estado;
    setCache('trem_cache_viagens_status', window.viagensStatusDB);

    const batch = writeBatch(db);
    batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(-qtd) }, { merge: true });
    batch.set(doc(db, "viagens_status", hj), estado);
    await batch.commit();

    document.getElementById('modalOpQtdReforco').value = 1;
    atualizarDashboardKPIs();
    mostrarToast(`Reforço de +${qtd} abatido do Bagageiro!`);
    renderizarListaReforcosFeitos();
    carregarMonitorViagem();
}

export async function removerReforcoVagao(idx) {
    const vagaoId = window.vagaoOperacaoSelecionadoId;
    const hj = getDataHojeLocal();
    const estado = getEstadoViagemHoje(hj);
    const ref = estado.reforcos?.[vagaoId]?.[idx];
    if (!ref) return;

    abrirConfirmacao(`Deseja desfazer o reforço de ${ref.qtd}x ${ref.bebidaId}? A bebida voltará ao Bagageiro.`, async () => {
        const prod = window.produtosDB.find(p => p.id === ref.bebidaId);
        const docKey = prod?._docId || ref.bebidaId;
        if (prod) {
            prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) + ref.qtd;
            setCache('trem_cache_produtos', window.produtosDB);
        }

        estado.reforcos[vagaoId].splice(idx, 1);
        window.viagensStatusDB[hj] = estado;
        setCache('trem_cache_viagens_status', window.viagensStatusDB);

        const batch = writeBatch(db);
        batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(ref.qtd) }, { merge: true });
        batch.set(doc(db, "viagens_status", hj), estado);
        await batch.commit();

        atualizarDashboardKPIs();
        mostrarToast("Reforço cancelado e saldo estornado!");
        renderizarListaReforcosFeitos();
        carregarMonitorViagem();
    });
}
