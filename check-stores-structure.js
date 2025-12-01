import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' }
});

async function checkStoresStructure() {
    console.log('🔍 Verificando estrutura da tabela stores...\n');

    // Buscar uma loja de exemplo
    const { data: stores, error } = await supabase
        .from('stores')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Erro ao buscar stores:', error);
        return;
    }

    if (stores && stores.length > 0) {
        console.log('✅ Estrutura da tabela stores:');
        console.log('Campos disponíveis:', Object.keys(stores[0]));
        console.log('\nExemplo de loja:');
        console.log(JSON.stringify(stores[0], null, 2));
    } else {
        console.log('⚠️  Nenhuma loja encontrada');
    }
}

checkStoresStructure();
