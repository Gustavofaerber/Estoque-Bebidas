// ==========================================================================
// MÓDULO: GESTÃO DE EQUIPE DE APOIOS (USUÁRIOS)
// ==========================================================================
import { db, doc, setDoc, deleteDoc } from '../config/firebase.js';
import { escapeHTML } from '../utils/formatters.js';
import { setCache } from '../state/store.js';
import { mostrarToast, abrirConfirmacao } from '../utils/toast.js';

export function renderizarUsuarios() {
    const div = document.getElementById('listaUsuariosAdmin');
    if (!div) return;
    div.innerHTML = "";

    const usersOrd = [...window.usuariosDB].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    if (usersOrd.length === 0) {
        div.innerHTML = '<p style="text-align:center; color:var(--secondary); padding:20px;">Nenhum apoio cadastrado.</p>';
        return;
    }

    usersOrd.forEach(u => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 8px; border-bottom:1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-user-circle" style="font-size:24px; color:var(--primary);"></i>
                    <strong style="font-size:16px;">${escapeHTML(u.nome)}</strong>
                </div>
                <button type="button" class="btn btn-danger btn-pequeno" aria-label="Remover ${escapeHTML(u.nome)}" onclick="window.excluirUsuario('${escapeHTML(u.id)}')"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
}

export async function adicionarUsuario() {
    const input = document.getElementById('novoUsuarioNome');
    const nome = input ? input.value.trim() : "";
    if (!nome) return mostrarToast("Digite o nome do Apoio!", true);

    const id = "user_" + Date.now().toString();
    const novoUser = { id, _docId: id, nome: escapeHTML(nome) };
    window.usuariosDB.push(novoUser);
    setCache('trem_cache_usuarios', window.usuariosDB);

    input.value = "";
    renderizarUsuarios();
    await setDoc(doc(db, "usuarios", id), { id, nome: escapeHTML(nome) });
    mostrarToast("Apoio adicionado!");
}

export async function excluirUsuario(id) {
    abrirConfirmacao("Deseja remover este apoio da equipe?", async () => {
        const u = window.usuariosDB.find(x => x.id === id);
        const docKey = u?._docId || id;
        window.usuariosDB = window.usuariosDB.filter(x => x.id !== id);
        setCache('trem_cache_usuarios', window.usuariosDB);
        renderizarUsuarios();
        await deleteDoc(doc(db, "usuarios", docKey));
        mostrarToast("Apoio removido!");
    });
}
