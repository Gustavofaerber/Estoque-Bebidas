// ==========================================================================
// MÓDULO: FROTA DE VAGÕES
// ==========================================================================
import { db, doc, setDoc, deleteDoc } from '../config/firebase.js';
import { ordenarPorRegra, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';

export function renderizarVagoesAdmin() {
    const div = document.getElementById('listaVagoesAdmin');
    if (!div) return;
    div.innerHTML = "";

    const vagoesOrd = [...window.vagoesDB].sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

    if (vagoesOrd.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum vagão cadastrado na frota.</p>';
        return;
    }

    vagoesOrd.forEach(v => {
        let corTipo = "var(--primary)";
        if (v.tipo === 'boutique') corTipo = "var(--accent)";
        if (v.tipo === 'litorina') corTipo = "var(--boutique-color)";
        if (v.tipo === 'economico') corTipo = "#475569";

        const receitaObj = window.receitasDB.find(r => r.id === v.receitaId);
        const nomeReceita = receitaObj ? receitaObj.nome : 'Nenhuma';
        const idSafe = escapeHTML(v.id);

        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border); gap:8px;">
                <div>
                    <strong style="font-size:16px;">Placa ${escapeHTML(v.numero)} - ${escapeHTML(v.nome)}</strong>
                    <br><span style="color:${corTipo}; font-weight:700; font-size:12px; text-transform:uppercase;">[${escapeHTML(v.tipo)}]</span>
                    <small style="color:var(--secondary); font-size:12px; margin-inline-start:6px;"><i class="ph ph-receipt"></i> ${escapeHTML(nomeReceita)}</small>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.abrirModalVagao('${idSafe}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                    <button type="button" class="btn btn-danger btn-pequeno" aria-label="Excluir vagão" onclick="window.excluirVagao('${idSafe}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        `;
    });
}

export function autoSugerirReceitaVagao() {
    const tipo = document.getElementById('modalVagaoTipo').value;
    const selRec = document.getElementById('modalVagaoReceitaPadrao');

    if (tipo === 'turistico') {
        const rTur = window.receitasDB.find(r => r.id === 'rec_turistico_48' || (r.nome || '').toLowerCase().includes('turístico'));
        if (rTur) selRec.value = rTur.id;
    } else if (tipo === 'economico') {
        const rEco = window.receitasDB.find(r => r.id === 'rec_economico' || (r.nome || '').toLowerCase().includes('econômico'));
        if (rEco) selRec.value = rEco.id;
    } else {
        const rBout = window.receitasDB.find(r => r.id === 'rec_boutique_padrao' || (r.nome || '').toLowerCase().includes('boutique'));
        if (rBout) selRec.value = rBout.id;
    }
    atualizarCheckboxesBebidasPadrao();
}

export function abrirModalVagao(id = null) {
    const selRec = document.getElementById('modalVagaoReceitaPadrao');
    selRec.innerHTML = '<option value="">-- Nenhuma (Manual) --</option>';
    window.receitasDB.forEach(r => selRec.innerHTML += `<option value="${escapeHTML(r.id)}">${escapeHTML(r.nome)}</option>`);

    let permitidas = [];
    if (id) {
        const v = window.vagoesDB.find(x => x.id === id);
        if (!v) return;
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Vagão';
        document.getElementById('modalVagaoIdOriginal').value = v.id;
        document.getElementById('modalVagaoNumero').value = unescapeHTML(v.numero);
        document.getElementById('modalVagaoNome').value = unescapeHTML(v.nome);
        document.getElementById('modalVagaoTipo').value = v.tipo || 'turistico';
        selRec.value = v.receitaId || "";
        permitidas = v.bebidasPermitidas || [];
    } else {
        document.getElementById('modalVagaoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Vagão';
        document.getElementById('modalVagaoIdOriginal').value = "";
        document.getElementById('modalVagaoNumero').value = "";
        document.getElementById('modalVagaoNome').value = "";
        document.getElementById('modalVagaoTipo').value = "turistico";
        autoSugerirReceitaVagao();
        permitidas = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'];
    }

    const boxChecks = document.getElementById('boxCheckboxesBebidasVagao');
    boxChecks.innerHTML = "";
    ordenarPorRegra(window.produtosDB);
    window.produtosDB.forEach(p => {
        const checked = (permitidas.length === 0 || permitidas.includes(p.id)) ? 'checked' : '';
        boxChecks.innerHTML += `<label class="item-chk-bebida"><input type="checkbox" value="${escapeHTML(p.id)}" ${checked}><span>${escapeHTML(p.id)} (${escapeHTML(p.nome)})</span></label>`;
    });

    abrirModal('modal-vagao');
}

export function atualizarCheckboxesBebidasPadrao() {
    const tipo = document.getElementById('modalVagaoTipo').value;
    const chks = document.querySelectorAll('#boxCheckboxesBebidasVagao input');
    if (tipo === 'turistico' || tipo === 'economico') {
        const padraoTur = ['C', 'Cp', 'Zp', 'Gg', 'Gp', 'Acp', 'KL'];
        chks.forEach(c => c.checked = padraoTur.includes(c.value));
    } else {
        const proibidasBoutique = ['C', 'Gg', 'Acp', 'Ac'];
        chks.forEach(c => c.checked = !proibidasBoutique.includes(c.value));
    }
}

export async function salvarVagaoModal() {
    const idOriginal = document.getElementById('modalVagaoIdOriginal').value;
    const numero = document.getElementById('modalVagaoNumero').value.trim();
    const nome = document.getElementById('modalVagaoNome').value.trim();
    const tipo = document.getElementById('modalVagaoTipo').value;
    const receitaId = document.getElementById('modalVagaoReceitaPadrao').value;

    if (!numero || !nome) return mostrarToast("Preencha Número e Nome!", true);

    const selecionadas = [];
    document.querySelectorAll('#boxCheckboxesBebidasVagao input:checked').forEach(c => selecionadas.push(c.value));

    const idFinal = idOriginal || ("vagao_" + Date.now().toString());
    const existente = window.vagoesDB.find(v => v.id === idFinal);
    const docKey = existente?._docId || idFinal;

    const dados = {
        id: idFinal,
        numero: escapeHTML(numero),
        nome: escapeHTML(nome),
        tipo: tipo,
        receitaId: receitaId || null,
        bebidasPermitidas: selecionadas
    };

    if (existente) Object.assign(existente, dados);
    else window.vagoesDB.push({ ...dados, _docId: docKey });
    setCache('trem_cache_vagoes', window.vagoesDB);

    await setDoc(doc(db, "vagoes", docKey), dados, { merge: true });
    fecharModal('modal-vagao');
    renderizarVagoesAdmin();
    mostrarToast("Vagão salvo na frota!");
}

export async function excluirVagao(id) {
    abrirConfirmacao("Tem certeza que deseja excluir este vagão?", async () => {
        const v = window.vagoesDB.find(x => x.id === id);
        const docKey = v?._docId || id;
        window.vagoesDB = window.vagoesDB.filter(x => x.id !== id);
        setCache('trem_cache_vagoes', window.vagoesDB);
        renderizarVagoesAdmin();
        await deleteDoc(doc(db, "vagoes", docKey));
        mostrarToast("Vagão excluído!");
    });
}
