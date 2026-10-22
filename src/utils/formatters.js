// ==========================================================================
// UTILITÁRIOS DE FORMATAÇÃO, DATAS LOCAIS E ORDENAÇÃO
// ==========================================================================

export const ORDEM_PADRAO_CHEFE = [
    'C', 'Cp', 'Zp', 'Gg', 'Gp', 'Fgp', 'Am', 'Acp', 'Agsp', 'Aggp',
    'Chn', 'Chz', 'Su', 'Sp', 'KL', 'Kl', 'Esp', 'Gelo', 'Ac'
];

/**
 * Retorna a data atual no fuso horário LOCAL (YYYY-MM-DD).
 * Corrige o bug do toISOString() que mudava para o dia seguinte após as 21h no Brasil (UTC-3).
 */
export function getDataHojeLocal() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

export function formatarDataBR(dataISO) {
    if (!dataISO || typeof dataISO !== 'string') return '--/--/----';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function formatarEstoqueFardos(totalUnidades, unPorFardo) {
    unPorFardo = parseInt(unPorFardo) || 1;
    totalUnidades = parseInt(totalUnidades) || 0;
    if (unPorFardo <= 1) return `${totalUnidades} Un`;
    const fardos = Math.floor(totalUnidades / unPorFardo);
    const sobra = totalUnidades % unPorFardo;
    if (fardos > 0 && sobra > 0) return `${fardos} Fd + ${sobra} Un`;
    if (fardos > 0) return `${fardos} Fardos`;
    return `${sobra} Un`;
}

export function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

export function unescapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}

export function formatarMoeda(v) {
    return (Number(v) || 0).toFixed(2).replace('.', ',');
}

export function focarProximo(id) {
    const el = document.getElementById(id);
    if (el) el.focus();
}

export function ordenarPorRegra(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.sort((a, b) => {
        const ordA = a.ordem !== undefined && a.ordem !== null && a.ordem !== "" ? parseInt(a.ordem) : 9999;
        const ordB = b.ordem !== undefined && b.ordem !== null && b.ordem !== "" ? parseInt(b.ordem) : 9999;
        if (ordA !== ordB) return ordA - ordB;
        const idxA = ORDEM_PADRAO_CHEFE.indexOf(a.id);
        const idxB = ORDEM_PADRAO_CHEFE.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.nome || "").localeCompare(b.nome || "");
    });
}
