import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLScript() {
  console.log('🔧 Executando script de fix do cashback...\n');
  
  // Ler o arquivo SQL
  const sqlScript = fs.readFileSync('supabase/migrations/FIX_CASHBACK_COMPLETE.sql', 'utf8');
  
  console.log('📄 Script carregado. Executando no Supabase...\n');
  
  // Executar o script
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlScript });
  
  if (error) {
    console.error('❌ Erro ao executar SQL:', error);
    
    // Tentar executar via query direta
    console.log('\n🔄 Tentando executar via query direta...\n');
    
    const { data: queryData, error: queryError } = await supabase
      .from('_sql')
      .select('*')
      .limit(0);
    
    if (queryError) {
      console.error('❌ Erro na query direta:', queryError);
    }
    
    return;
  }
  
  console.log('✅ Script executado com sucesso!');
  console.log('Resultado:', data);
}

executeSQLScript().catch(console.error);
