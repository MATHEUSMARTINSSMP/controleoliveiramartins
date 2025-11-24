// Script para verificar enum via API Supabase
const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

// Verificar estrutura da tabela adiantamentos
async function verificarEstrutura() {
  try {
    // Buscar informações da tabela adiantamentos
    const response = await fetch(`${SUPABASE_URL}/rest/v1/adiantamentos?limit=0`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Erro:', text);
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

verificarEstrutura();

