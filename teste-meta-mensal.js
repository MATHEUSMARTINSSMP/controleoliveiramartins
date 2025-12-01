import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarCriacaoMetaMensal() {
    console.log('🧪 TESTE: Criando meta MENSAL diretamente...\n');

    // ID da loja "Sacada | Oh, Boy" (do diagnóstico anterior)
    const storeId = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';
    const mesReferencia = '202512';

    const payload = {
        tipo: 'MENSAL',
        mes_referencia: mesReferencia,
        store_id: storeId,
        colaboradora_id: null,
        meta_valor: 50000,
        super_meta_valor: 60000,
        ativo: true,
        daily_weights: {}
    };

    console.log('📝 Payload:', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .insert(payload)
        .select();

    if (error) {
        console.error('❌ ERRO ao criar meta MENSAL:', error);
        console.error('Detalhes:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ Meta MENSAL criada com sucesso!');
        console.log('Dados:', JSON.stringify(data, null, 2));
    }

    // Verificar se foi criada
    console.log('\n🔍 Verificando se a meta foi criada...');
    const { data: verificacao, error: erroVerif } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('*')
        .eq('tipo', 'MENSAL')
        .eq('store_id', storeId)
        .eq('mes_referencia', mesReferencia);

    if (erroVerif) {
        console.error('❌ Erro ao verificar:', erroVerif);
    } else {
        console.log(`${verificacao?.length > 0 ? '✅' : '❌'} Encontradas ${verificacao?.length || 0} metas MENSAL para esta loja/mês`);
        if (verificacao && verificacao.length > 0) {
            console.log('Meta encontrada:', JSON.stringify(verificacao[0], null, 2));
        }
    }
}

testarCriacaoMetaMensal();
