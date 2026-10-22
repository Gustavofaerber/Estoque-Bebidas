// ==========================================================================
// MÓDULO: CARRINHO DE VENDAS (ACERTO & ABATE DO BAGAGEIRO)
// ==========================================================================
import { db, doc, writeBatch, increment } from '../config/firebase.js';
import { getDataHojeLocal, formatarMoeda, ordenarPorRegra, escapeHTML } from '../utils/formatters.js';
import { setCache, atualizarDashboardKPIs } from '../state/store.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarTela } from '../state/router.js';

export function abrirSetupCarrinho() {
    const sel = document.getElementById('selectApoioCarrinho');
    if (sel) {
        const valAntigo = sel.value;
        sel.innerHTML = '<option value="">-- Selecione o apoio --</option>';
        [...window.usuariosDB].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).forEach(u => {
            sel.innerHTML += `<option value="${escapeHTML(u.nome)}">${escapeHTML(u.nome)}</option>`;
        });
        if (valAntigo) sel.value = valAntigo;
    }
    const dt = document.getElementById('dataCarrinho');
    if (dt && !dt.value) dt.value = getDataHojeLocal();
}

export function iniciarAcertoCarrinho() {
    const apoio = document.getElementById('selectApoioCarrinho')?.value;
    const sentido = document.getElementById('sentidoCarrinho')?.value || 'Ida';
    if (!apoio) return mostrarToast("Selecione o apoio responsável!", true);

    document.getElementById('lblCarrinhoSentido').innerText = `${apoio} - ${sentido}`;
    const selExtra = document.getElementById('selectItemExtraCarrinho');
    if (selExtra) {
        selExtra.innerHTML = "";
        ordenarPorRegra(window.produtosDB);
        window.produtosDB.forEach(p => {
            selExtra.innerHTML += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.id)} - ${escapeHTML(p.nome)} (R$ ${formatarMoeda(p.precoVenda)})</option>`;
        });
    }

    window.itensExtrasCarrinhoTemp = [];
    document.getElementById('listaExtrasAdicionados').innerHTML = "";
    document.getElementById('carrinhoTroco').value = "0";

    const divItens = document.getElementById('listaItensCarrinho');
    divItens.innerHTML = "";
    ordenarPorRegra(window.produtosDB);

    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        const idSafe = escapeHTML(p.id);
        divItens.innerHTML += `
            <div class="item-contagem" style="margin-bottom:10px; padding:12px;">
                <div class="item-contagem-header" style="margin-bottom:8px; padding-bottom:6px;">
                    <span><strong>${escapeHTML(p.nome)} (${idSafe})</strong> &bull; R$ ${formatarMoeda(p.precoVenda)}</span>
                    <span id="carrinho_sub_${idSafe}" style="color:var(--success); font-weight:800; font-size:13px;">R$ 0,00</span>
                </div>
                <div class="grid-inputs" style="grid-template-columns: 1fr 1fr 1fr;">
                    <div><label>Saiu (Un):</label><input type="number" id="carrinho_saiu_${idSafe}" value="0" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularVendas()"></div>
                    <div><label>Voltou (Un):</label><input type="number" id="carrinho_voltou_${idSafe}" value="0" min="0" inputmode="numeric" onfocus="this.select()" oninput="window.calcularVendas()"></div>
                    <div><label>Vendeu (Un):</label><input type="number" id="carrinho_vendeu_${idSafe}" value="0" readonly class="input-pax" style="font-weight:bold;"></div>
                </div>
            </div>
        `;
    });

    calcularVendas();
    mostrarTela('tela-acerto-carrinho');
}

export function calcularVendas() {
    let totalLiquido = 0;
    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        const saiu = parseInt(document.getElementById(`carrinho_saiu_${p.id}`)?.value) || 0;
        const voltou = parseInt(document.getElementById(`carrinho_voltou_${p.id}`)?.value) || 0;
        const vendeu = Math.max(0, saiu - voltou);

        if (document.getElementById(`carrinho_vendeu_${p.id}`)) {
            document.getElementById(`carrinho_vendeu_${p.id}`).value = vendeu;
        }
        const sub = vendeu * (p.precoVenda || 0);
        totalLiquido += sub;
        if (document.getElementById(`carrinho_sub_${p.id}`)) {
            document.getElementById(`carrinho_sub_${p.id}`).innerText = `R$ ${formatarMoeda(sub)}`;
        }
    });

    window.itensExtrasCarrinhoTemp.forEach(extra => totalLiquido += (extra.total || 0));
    const troco = parseFloat(document.getElementById('carrinhoTroco')?.value) || 0;

    if (document.getElementById('lblTotalVendasCarrinho')) {
        document.getElementById('lblTotalVendasCarrinho').innerText = formatarMoeda(totalLiquido);
    }
    if (document.getElementById('lblTotalEntregar')) {
        document.getElementById('lblTotalEntregar').innerText = `R$ ${formatarMoeda(totalLiquido + troco)}`;
    }
}

export function adicionarItemExtraVenda() {
    const pId = document.getElementById('selectItemExtraCarrinho').value;
    const qtd = parseInt(document.getElementById('qtdItemExtraCarrinho').value) || 1;
    const prod = window.produtosDB.find(x => x.id === pId);

    if (!prod || qtd < 1) return;

    window.itensExtrasCarrinhoTemp.push({
        id: pId,
        nome: prod.nome,
        qtd,
        preco: prod.precoVenda || 0,
        total: qtd * (prod.precoVenda || 0)
    });
    renderizarExtrasAdicionados();
    calcularVendas();
    document.getElementById('qtdItemExtraCarrinho').value = 1;
}

export function removerItemExtraVenda(index) {
    window.itensExtrasCarrinhoTemp.splice(index, 1);
    renderizarExtrasAdicionados();
    calcularVendas();
}

export function renderizarExtrasAdicionados() {
    const div = document.getElementById('listaExtrasAdicionados');
    if (!div) return;
    div.innerHTML = "";
    window.itensExtrasCarrinhoTemp.forEach((item, idx) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid var(--border); padding:8px 12px; border-radius:8px; margin-bottom:6px;">
                <span><strong>${item.qtd}x</strong> ${escapeHTML(item.nome)} &bull; R$ ${formatarMoeda(item.total)}</span>
                <button type="button" class="btn btn-danger btn-pequeno" style="padding:4px 8px;" onclick="window.removerItemExtraVenda(${idx})"><i class="ph ph-trash"></i></button>
            </div>
        `;
    });
}

export async function salvarAcertoCarrinho() {
    const apoio = document.getElementById('selectApoioCarrinho').value;
    const data = document.getElementById('dataCarrinho').value || getDataHojeLocal();
    const sentido = document.getElementById('sentidoCarrinho').value;
    const troco = parseFloat(document.getElementById('carrinhoTroco').value) || 0;

    let totalVendasR$ = 0;
    let itensVendidos = {};
    const batch = writeBatch(db);

    window.produtosDB.filter(p => (p.precoVenda || 0) > 0 && p.id !== 'Gelo').forEach(p => {
        const saiu = parseInt(document.getElementById(`carrinho_saiu_${p.id}`)?.value) || 0;
        const voltou = parseInt(document.getElementById(`carrinho_voltou_${p.id}`)?.value) || 0;
        const vendeu = Math.max(0, saiu - voltou);

        if (saiu > 0 || voltou > 0 || vendeu > 0) {
            const sub = vendeu * (p.precoVenda || 0);
            totalVendasR$ += sub;
            itensVendidos[p.id] = { saiu, voltou, vendeu, subtotal: sub };
            if (vendeu > 0) {
                const docKey = p._docId || p.id;
                p.estoqueBagageiroUnidades = (parseInt(p.estoqueBagageiroUnidades) || 0) - vendeu;
                batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(-vendeu) }, { merge: true });
            }
        }
    });

    window.itensExtrasCarrinhoTemp.forEach(ex => {
        totalVendasR$ += ex.total;
        const prod = window.produtosDB.find(p => p.id === ex.id);
        const docKey = prod?._docId || ex.id;
        if (prod) {
            prod.estoqueBagageiroUnidades = (parseInt(prod.estoqueBagageiroUnidades) || 0) - ex.qtd;
        }
        batch.set(doc(db, "produtos", docKey), { estoqueBagageiroUnidades: increment(-ex.qtd) }, { merge: true });
    });

    const acertoId = `carrinho_${data}_${sentido}_${Date.now()}`;
    const docVenda = {
        id: acertoId,
        data,
        apoio,
        sentido,
        trocoInicial: troco,
        totalVendasR$: formatarMoeda(totalVendasR$),
        totalEntregarR$: formatarMoeda(totalVendasR$ + troco),
        itens: itensVendidos,
        extras: window.itensExtrasCarrinhoTemp,
        timestamp: Date.now()
    };

    window.vendasCarrinhoDB.push(docVenda);
    setCache('trem_cache_vendas', window.vendasCarrinhoDB);
    setCache('trem_cache_produtos', window.produtosDB);

    batch.set(doc(db, "vendas_carrinho", acertoId), docVenda);
    await batch.commit();

    atualizarDashboardKPIs();
    mostrarToast("Acerto concluído e bebidas descontadas do Bagageiro!");
    mostrarTela('tela-inicial');
}
