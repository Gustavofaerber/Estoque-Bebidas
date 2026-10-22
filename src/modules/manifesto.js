// ==========================================================================
// MÓDULO: MANIFESTO PÚBLICO (VER CARGA DO TREM)
// ==========================================================================
import { getDataHojeLocal, formatarDataBR, escapeHTML } from '../utils/formatters.js';
import { mostrarToast } from '../utils/toast.js';

export function carregarManifestoPublico(forcarUltima = false) {
    const div = document.getElementById('conteudoManifestoPublico');
    if (!div) return;
    div.innerHTML = "";

    const elData = document.getElementById('filtroDataManifesto');
    if (!window.cargasDiaDB || window.cargasDiaDB.length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:35px 15px; color:var(--secondary);">
                <i class="ph ph-train" style="font-size:36px; display:block; margin-bottom:10px; color:var(--primary);"></i>
                <p>Nenhuma carga registrada no momento.</p>
            </div>
        `;
        return;
    }

    const cargasOrdenadas = [...window.cargasDiaDB].sort((a, b) => {
        if (b.data !== a.data) return (b.data || "").localeCompare(a.data || "");
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    const ultimaCarga = cargasOrdenadas[0];
    let dataSel = elData ? elData.value : "";
    if (forcarUltima || !dataSel) {
        dataSel = ultimaCarga ? ultimaCarga.data : getDataHojeLocal();
        if (elData) elData.value = dataSel;
    }

    const carga = window.cargasDiaDB.find(c => c.data === dataSel);
    if (!carga || !carga.itens || Object.keys(carga.itens).length === 0) {
        div.innerHTML = `
            <div style="text-align:center; padding:30px 15px; color:var(--secondary);">
                <i class="ph ph-calendar-blank" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                <p>Nenhuma escala para <strong>${formatarDataBR(dataSel)}</strong>.</p>
                ${ultimaCarga ? `
                    <button type="button" class="btn btn-secondary btn-pequeno" style="margin-top:10px;" onclick="document.getElementById('filtroDataManifesto').value='${ultimaCarga.data}'; window.carregarManifestoPublico(false);">
                        <i class="ph ph-arrow-counter-clockwise"></i> Ver Carga de ${formatarDataBR(ultimaCarga.data)}
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }

    let itensOrdenados = Object.keys(carga.itens).map(sigla => {
        const prod = window.produtosDB.find(p => p.id === sigla);
        return {
            sigla,
            ...carga.itens[sigla],
            ordem: carga.itens[sigla].ordem !== undefined ? carga.itens[sigla].ordem : (prod?.ordem ?? 9999)
        };
    });
    itensOrdenados.sort((a, b) => (parseInt(a.ordem) || 9999) - (parseInt(b.ordem) || 9999));

    let linhasHtml = "";
    itensOrdenados.forEach(item => {
        if (item.total <= 0 && item.baga <= 0 && (!item.destino || item.destino.trim() === '')) return;
        const strDestino = item.destino ? `<span class="manifesto-destino">(${escapeHTML(item.destino)})</span>` : '';
        const formulaTexto = item.baga > 0
            ? `${escapeHTML(item.sigla)}=${item.total}-${item.baga}=<strong>${item.cont}</strong> <span style="font-size:13px; color:var(--secondary); font-style:italic;">${strDestino}</span>`
            : `${escapeHTML(item.sigla)}=<strong>${item.total}</strong> <span style="font-size:13px; color:var(--secondary); font-style:italic;">${strDestino}</span>`;
        linhasHtml += `
            <div class="manifesto-linha" style="justify-content:flex-start; gap:8px;">
                <span class="manifesto-formula">${formulaTexto}</span>
            </div>
        `;
    });

    const isMaisRecente = ultimaCarga && ultimaCarga.data === carga.data;
    div.innerHTML = `
        <div class="manifesto-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                <div>
                    <h3 style="color:var(--primary); font-size:18px; margin:0;"><i class="ph ph-train"></i> Carga Oficial</h3>
                    ${isMaisRecente ? '<span style="background:#dcfce7; color:#15803d; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700;">Última Carga Lançada</span>' : ''}
                </div>
                <div style="text-align:end;">
                    <span style="font-size:12px; color:var(--secondary); display:block;">Para a Viagem:</span>
                    <span style="font-weight:800; color:var(--accent); font-size:16px;">${formatarDataBR(carga.data)}</span>
                </div>
            </div>
            ${linhasHtml}
            ${carga.obsEspeciais ? `
                <div class="manifesto-obs-box">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:15px;">
                        <i class="ph ph-star-fill"></i> Observações & Extras:
                    </div>
                    ${escapeHTML(carga.obsEspeciais)}
                </div>
            ` : ''}
            <div style="margin-top:14px; display:flex; justify-content:flex-end;">
                <button type="button" class="btn btn-secondary btn-pequeno" onclick="window.copiarManifestoTexto('${carga.data}')">
                    <i class="ph ph-copy"></i> Copiar Escala (WhatsApp)
                </button>
            </div>
        </div>
    `;
}

export function copiarManifestoTexto(dataSel) {
    const carga = window.cargasDiaDB.find(c => c.data === dataSel);
    if (!carga || !carga.itens) return;

    let itensOrdenados = Object.keys(carga.itens).map(sigla => {
        const prod = window.produtosDB.find(p => p.id === sigla);
        return {
            sigla,
            ...carga.itens[sigla],
            ordem: carga.itens[sigla].ordem !== undefined ? carga.itens[sigla].ordem : (prod?.ordem ?? 9999)
        };
    });
    itensOrdenados.sort((a, b) => (parseInt(a.ordem) || 9999) - (parseInt(b.ordem) || 9999));

    let linhas = [`*CARGA DO TREM - ${formatarDataBR(carga.data)}*`, ''];
    itensOrdenados.forEach(item => {
        if (item.total <= 0 && item.baga <= 0 && (!item.destino || item.destino.trim() === '')) return;
        const dest = item.destino ? ` (${item.destino})` : '';
        if (item.baga > 0) {
            linhas.push(`${item.sigla}=${item.total}-${item.baga}=${item.cont}${dest}`);
        } else {
            linhas.push(`${item.sigla}=${item.total}${dest}`);
        }
    });

    if (carga.obsEspeciais) {
        linhas.push('', `*Obs:*`, carga.obsEspeciais);
    }

    navigator.clipboard?.writeText(linhas.join('\n')).then(() => {
        mostrarToast("Escala copiada para a área de transferência!");
    }).catch(() => {
        mostrarToast("Não foi possível copiar automaticamente.", true);
    });
}
