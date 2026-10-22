// ==========================================================================
// MÓDULO: PRODUTOS, FARDOS & PREÇOS
// ==========================================================================
import { db, doc, setDoc, deleteDoc } from '../config/firebase.js';
import { formatarEstoqueFardos, formatarMoeda, ordenarPorRegra, escapeHTML, unescapeHTML, focarProximo } from '../utils/formatters.js';
import { setCache } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';

export function renderizarProdutosAdmin() {
    const div = document.getElementById('listaProdutosAdmin');
    if (!div) return;
    div.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    if (!window.produtosDB || window.produtosDB.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum produto cadastrado no catálogo.</p>';
        return;
    }

    window.produtosDB.forEach(p => {
        const unFardo = p.unidadesPorFardo || 1;
        const contFormatado = formatarEstoqueFardos(p.estoqueContainerUnidades, unFardo);
        const bagaFormatado = formatarEstoqueFardos(p.estoqueBagageiroUnidades, unFardo);
        const idSafe = escapeHTML(p.id);

        div.innerHTML += `
            <div class="card" style="padding:15px; margin-bottom:12px; border-inline-start:5px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
                    <div>
                        <span class="badge-ordem">#${p.ordem || '-'}</span>
                        <strong style="font-size:16px; color:var(--primary);">${escapeHTML(p.nome)} (${idSafe})</strong>
                        <div style="font-size:13px; color:var(--secondary); margin-top:4px;">
                            <span>${unFardo} un/fardo</span> &bull;
                            <span style="font-weight:700; color:var(--text);">R$ ${formatarMoeda(p.precoVenda)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.abrirModalProduto('${idSafe}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                        <button type="button" class="btn btn-danger btn-pequeno" aria-label="Excluir ${escapeHTML(p.nome)}" onclick="window.excluirProduto('${idSafe}')"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border); font-size:12px;">
                    <div style="background:var(--container-bg); padding:6px 10px; border-radius:6px; color:var(--container-color);">
                        <strong>Contêiner:</strong> ${contFormatado} (${p.estoqueContainerUnidades || 0} un)
                    </div>
                    <div style="background:var(--bagageiro-bg); padding:6px 10px; border-radius:6px; color:var(--bagageiro-color);">
                        <strong>Bagageiro:</strong> ${bagaFormatado} (${p.estoqueBagageiroUnidades || 0} un)
                    </div>
                </div>
            </div>
        `;
    });
}

export function abrirModalProduto(id = null) {
    if (id) {
        const p = window.produtosDB.find(x => x.id === id);
        if (!p) return;
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Produto';
        document.getElementById('modalProdIdOriginal').value = p.id;
        document.getElementById('modalProdOrdem').value = p.ordem || 99;
        document.getElementById('modalProdSigla').value = p.id;
        document.getElementById('modalProdSigla').disabled = true;
        document.getElementById('modalProdNome').value = unescapeHTML(p.nome);
        document.getElementById('modalProdUnFardo').value = p.unidadesPorFardo || 12;
        document.getElementById('modalProdPreco').value = p.precoVenda || 0;
    } else {
        document.getElementById('modalProdutoTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Novo Produto';
        document.getElementById('modalProdIdOriginal').value = "";
        document.getElementById('modalProdOrdem').value = (window.produtosDB.length + 1);
        document.getElementById('modalProdSigla').value = "";
        document.getElementById('modalProdSigla').disabled = false;
        document.getElementById('modalProdNome').value = "";
        document.getElementById('modalProdUnFardo').value = 12;
        document.getElementById('modalProdPreco').value = 6;
    }

    abrirModal('modal-produto');
    setTimeout(() => focarProximo(id ? 'modalProdNome' : 'modalProdSigla'), 100);
}

export async function salvarProdutoModal() {
    const idOriginal = document.getElementById('modalProdIdOriginal').value.trim();
    const sigla = document.getElementById('modalProdSigla').value.trim();
    const nome = document.getElementById('modalProdNome').value.trim();
    const ordem = parseInt(document.getElementById('modalProdOrdem').value) || 99;
    const unFardo = Math.max(1, parseInt(document.getElementById('modalProdUnFardo').value) || 1);
    const preco = parseFloat(document.getElementById('modalProdPreco').value) || 0;

    if (!sigla || !nome) return mostrarToast("Preencha a Sigla e o Nome!", true);

    const finalId = idOriginal || sigla;

    if (!idOriginal && window.produtosDB.some(p => p.id.toLowerCase() === finalId.toLowerCase())) {
        return mostrarToast(`Já existe produto com a sigla "${finalId}"!`, true);
    }

    const prodExistente = window.produtosDB.find(p => p.id === finalId);
    const docKey = prodExistente?._docId || finalId;

    const dados = {
        id: finalId,
        sigla: finalId,
        nome: escapeHTML(nome),
        ordem: ordem,
        unidadesPorFardo: unFardo,
        precoVenda: preco,
        estoqueContainerUnidades: prodExistente ? (parseInt(prodExistente.estoqueContainerUnidades) || 0) : 0,
        estoqueBagageiroUnidades: prodExistente ? (parseInt(prodExistente.estoqueBagageiroUnidades) || 0) : 0
    };

    if (prodExistente) {
        Object.assign(prodExistente, dados);
    } else {
        window.produtosDB.push({ ...dados, _docId: docKey });
    }
    setCache('trem_cache_produtos', window.produtosDB);

    await setDoc(doc(db, "produtos", docKey), dados, { merge: true });
    fecharModal('modal-produto');
    renderizarProdutosAdmin();
    mostrarToast("Produto salvo com sucesso!");
}

export async function excluirProduto(id) {
    abrirConfirmacao(`Deseja excluir o produto "${id}"?`, async () => {
        const prod = window.produtosDB.find(p => p.id === id);
        const docKey = prod?._docId || id;
        window.produtosDB = window.produtosDB.filter(p => p.id !== id);
        setCache('trem_cache_produtos', window.produtosDB);
        await deleteDoc(doc(db, "produtos", docKey));
        renderizarProdutosAdmin();
        mostrarToast("Produto excluído!");
    });
}
