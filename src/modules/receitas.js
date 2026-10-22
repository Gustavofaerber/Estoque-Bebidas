// ==========================================================================
// MÓDULO: RECEITAS DE CARGA (KITS PADRÃO)
// ==========================================================================
import { db, doc, setDoc, deleteDoc } from '../config/firebase.js';
import { ordenarPorRegra, escapeHTML, unescapeHTML } from '../utils/formatters.js';
import { setCache } from '../state/store.js';
import { mostrarToast, abrirModal, fecharModal, abrirConfirmacao } from '../utils/toast.js';

export function renderizarReceitasAdmin() {
    const div = document.getElementById('listaReceitasAdmin');
    if (!div) return;
    div.innerHTML = "";

    if (!window.receitasDB || window.receitasDB.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhuma receita criada.</p>';
        return;
    }

    window.receitasDB.forEach(r => {
        let resumoItens = [];
        for (let sigla in r.itens) {
            if (r.itens[sigla] > 0) resumoItens.push(`<b>${r.itens[sigla]}x</b> ${escapeHTML(sigla)}`);
        }

        const idSafe = escapeHTML(r.id);
        div.innerHTML += `
            <div class="card" style="padding:15px; margin-bottom:10px; border-inline-start:5px solid var(--accent);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                    <strong style="font-size:16px; color:var(--primary);"><i class="ph ph-receipt"></i> ${escapeHTML(r.nome)}</strong>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.abrirModalReceita('${idSafe}')"><i class="ph ph-pencil-simple"></i> Editar</button>
                        <button type="button" class="btn btn-danger btn-pequeno" aria-label="Excluir receita" onclick="window.excluirReceita('${idSafe}')"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div style="font-size:13px; color:var(--secondary); line-height:1.5;">
                    ${resumoItens.join(' &bull; ') || 'Nenhum item configurado.'}
                </div>
            </div>
        `;
    });
}

export function abrirModalReceita(id = null) {
    const divProds = document.getElementById('modalReceitaListaProdutos');
    divProds.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    let recObj = null;
    if (id) {
        recObj = window.receitasDB.find(x => x.id === id);
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-pencil-simple"></i> Editar Receita';
        document.getElementById('modalReceitaIdOriginal').value = recObj?.id || "";
        document.getElementById('modalReceitaNome').value = unescapeHTML(recObj?.nome || "");
    } else {
        document.getElementById('modalReceitaTitulo').innerHTML = '<i class="ph ph-plus-circle"></i> Nova Receita';
        document.getElementById('modalReceitaIdOriginal').value = "";
        document.getElementById('modalReceitaNome').value = "";
    }

    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const valQtd = recObj?.itens?.[p.id] || 0;
        const idSafe = escapeHTML(p.id);
        divProds.innerHTML += `
            <div class="item-receita-linha">
                <span><strong>${idSafe}</strong> - ${escapeHTML(p.nome)}</span>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:11px; color:var(--secondary);">Qtd:</span>
                    <input type="number" id="rec_input_${idSafe}" value="${valQtd}" min="0" inputmode="numeric" onfocus="this.select()" style="width:80px; text-align:center; padding:6px; font-weight:700;">
                </div>
            </div>
        `;
    });
    abrirModal('modal-receita');
}

export async function salvarReceitaModal() {
    const idOriginal = document.getElementById('modalReceitaIdOriginal').value;
    const nome = document.getElementById('modalReceitaNome').value.trim();
    if (!nome) return mostrarToast("Digite o nome da Receita!", true);

    let itens = {};
    window.produtosDB.filter(p => !p.nome.includes('(Venda)')).forEach(p => {
        const q = parseInt(document.getElementById(`rec_input_${p.id}`)?.value) || 0;
        if (q > 0) itens[p.id] = q;
    });

    const idFinal = idOriginal || ("rec_" + Date.now().toString());
    const existente = window.receitasDB.find(r => r.id === idFinal);
    const docKey = existente?._docId || idFinal;
    const dados = { id: idFinal, nome: escapeHTML(nome), itens };

    if (existente) Object.assign(existente, dados);
    else window.receitasDB.push({ ...dados, _docId: docKey });
    setCache('trem_cache_receitas', window.receitasDB);

    await setDoc(doc(db, "receitas_carga", docKey), dados);
    fecharModal('modal-receita');
    renderizarReceitasAdmin();
    mostrarToast("Receita salva!");
}

export async function excluirReceita(id) {
    abrirConfirmacao("Deseja excluir esta receita?", async () => {
        const r = window.receitasDB.find(x => x.id === id);
        const docKey = r?._docId || id;
        window.receitasDB = window.receitasDB.filter(x => x.id !== id);
        setCache('trem_cache_receitas', window.receitasDB);
        renderizarReceitasAdmin();
        await deleteDoc(doc(db, "receitas_carga", docKey));
        mostrarToast("Receita excluída!");
    });
}
