import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' }
});

async function checkStructure() {
    console.log('🔍 Verificando estrutura de tiny_contacts...');

    // Tentar inserir um registro dummy para ver erro de colunas ou pegar um existente
    const { data, error } = await supabase
        .from('tiny_contacts')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        console.log('✅ Colunas encontradas:', Object.keys(data[0]));
    } else {
        console.log('⚠️ Tabela vazia ou erro:', error);
        // Fallback: tentar listar colunas via RPC se possível, ou inferir
    }
}

checkStructure();
