
// Mock dependencies
const normalizeTamanho = (t) => {
    if (!t) return null;
    const normalized = String(t).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    return normalized;
};

const normalizeCor = (c) => c ? String(c).trim().toUpperCase() : null;

async function processarItemCompleto(item) {
    const produto = item.produto || {};
    const itemData = item.item || item;

    const descricao = produto.descricao || itemData.descricao || null;

    let tamanho = null;
    let cor = null;

    // Fallbacks logic from the file
    if (!tamanho) {
        tamanho = normalizeTamanho(itemData.tamanho || produto.tamanho || null);
    }
    if (!cor) {
        cor = normalizeCor(itemData.cor || produto.cor || null);
    }

    // Regex Logic (The one I implemented)
    if ((!tamanho || !cor) && descricao) {
        console.log(`[Sim] 🔍 Tentando extrair variações da descrição: "${descricao}"`);

        let regexTamanho = /[\s-]+\s([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)$/i;
        let matchTamanho = descricao.match(regexTamanho);

        if (!matchTamanho) {
            regexTamanho = /Tam:?\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)/i;
            matchTamanho = descricao.match(regexTamanho);
        }

        if (matchTamanho && matchTamanho[1]) {
            if (!tamanho) {
                tamanho = normalizeTamanho(matchTamanho[1]);
                console.log(`[Sim] ✅ Tamanho extraído da descrição: "${tamanho}"`);
            }

            if (!cor) {
                const parteSemTamanho = descricao.substring(0, matchTamanho.index).trim();
                const partesPorHifen = parteSemTamanho.split(/\s-\s/);
                if (partesPorHifen.length > 1) {
                    const possivelCor = partesPorHifen[partesPorHifen.length - 1].trim();
                    if (possivelCor.length < 25 && possivelCor.length > 2 && !/\d/.test(possivelCor)) {
                        cor = normalizeCor(possivelCor);
                        console.log(`[Sim] ✅ Cor extraída da descrição: "${cor}"`);
                    }
                } else {
                    console.log(`[Sim] ❌ Falha ao extrair cor (sem hífen): "${parteSemTamanho}"`);
                }
            }
        } else {
            console.log(`[Sim] ❌ Falha ao extrair tamanho.`);
        }
    }

    return { tamanho, cor };
}

// Test Data from Supabase
const testItems = [
    { produto: { descricao: "VESTIDO MALHA DECOTE PREGAS VIOLETA ESCURO - P" }, item: {} },
    { produto: { descricao: "CALCA SARJA BOLSO APLICADO OFF WHITE - 36" }, item: {} },
    { produto: { descricao: "SHORT EST BOEME LISTRA EST BOEME LISTRA - M" }, item: {} }
];

async function run() {
    for (const item of testItems) {
        const result = await processarItemCompleto(item);
        console.log(`Result: Tamanho=${result.tamanho}, Cor=${result.cor}`);
        console.log('---');
    }
}

run();
