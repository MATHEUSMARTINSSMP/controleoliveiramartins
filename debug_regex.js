
const normalizeTamanho = (t) => t ? t.toUpperCase().trim() : null;
const normalizeCor = (c) => c ? c.toUpperCase().trim() : null;

function testExtraction(descricao) {
    console.log(`Testing: "${descricao}"`);

    let tamanho = null;
    let cor = null;

    // Regex from my previous fix
    // Regex 1: Padrão " - X" ou " - XX"
    let regexTamanho = /[\s-]+\s([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)$/i;
    let matchTamanho = descricao.match(regexTamanho);

    // Regex 2: Padrão "Tam: X"
    if (!matchTamanho) {
        regexTamanho = /Tam:?\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)/i;
        matchTamanho = descricao.match(regexTamanho);
    }

    if (matchTamanho && matchTamanho[1]) {
        tamanho = normalizeTamanho(matchTamanho[1]);
        console.log(`  ✅ Tamanho match: "${tamanho}"`);

        if (!cor) {
            const parteSemTamanho = descricao.substring(0, matchTamanho.index).trim();
            const partesPorHifen = parteSemTamanho.split(/\s-\s/);
            if (partesPorHifen.length > 1) {
                const possivelCor = partesPorHifen[partesPorHifen.length - 1].trim();
                if (possivelCor.length < 25 && possivelCor.length > 2 && !/\d/.test(possivelCor)) {
                    cor = normalizeCor(possivelCor);
                    console.log(`  ✅ Cor match: "${cor}"`);
                } else {
                    console.log(`  ❌ Cor rejeitada: "${possivelCor}"`);
                }
            } else {
                console.log(`  ❌ Não foi possível separar cor por hífen. Parte sem tamanho: "${parteSemTamanho}"`);
            }
        }
    } else {
        console.log(`  ❌ Tamanho não encontrado.`);
    }
    console.log('---');
}

const testCases = [
    "VESTIDO MALHA DECOTE PREGAS VIOLETA ESCURO - P",
    "CALCA SARJA BOLSO APLICADO OFF WHITE - 36",
    "SHORT EST BOEME LISTRA EST BOEME LISTRA - M",
    "CAMISA EST BOEME LISTRA EST BOEME LISTRA - M",
    "VESTIDO TIVOLI OFF-WHITE - 42"
];

testCases.forEach(testExtraction);
