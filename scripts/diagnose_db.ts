
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function diagnose() {
    console.log("Iniciando diagnóstico com Service Role Key (Bypass RLS)...");

    // 1. Tentar buscar o usuário específico que estava falhando
    const targetUserId = '7391610a-f83b-4727-875f-81299b8bfa68';
    console.log(`\n1. Buscando perfil do usuário: ${targetUserId}`);

    const { data: profile, error: profileError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

    if (profileError) {
        console.error("❌ Erro ao buscar perfil:", profileError);
    } else {
        console.log("✅ Perfil encontrado:", profile);
    }

    // 2. Listar primeiros 5 perfis para garantir que a tabela responde
    console.log("\n2. Listando primeiros 5 perfis da tabela...");
    const { data: profiles, error: listError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, role, active')
        .limit(5);

    if (listError) {
        console.error("❌ Erro ao listar perfis:", listError);
    } else {
        console.log(`✅ ${profiles?.length || 0} perfis encontrados.`);
        console.table(profiles);
    }

    // 3. Verificar se a função get_user_role existe (tentando chamar via rpc se possível, ou apenas inferindo)
    // Nota: RPC só funciona se a função for exposta, mas podemos tentar uma query direta se tivéssemos acesso SQL, 
    // mas com o client JS ficamos limitados às operações padrão ou RPCs configuradas.
    // Vamos pular essa parte e focar nos dados.

}

diagnose().catch(console.error);
