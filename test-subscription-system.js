import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' }
});

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSubscriptionSystem() {
    log('\n🚀 TESTANDO SISTEMA DE PLANOS\n', 'bold');

    try {
        // 1. Verificar planos criados
        log('1️⃣  Verificando planos disponíveis...', 'cyan');
        const { data: plans, error: plansError } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (plansError) {
            log(`❌ Erro: ${plansError.message}`, 'red');
            return;
        }

        log(`✅ ${plans.length} planos encontrados:\n`, 'green');
        plans.forEach(plan => {
            log(`   📦 ${plan.display_name}`, 'cyan');
            log(`      Lojas: ${plan.max_stores}`, 'cyan');
            log(`      Colaboradoras: ${plan.max_colaboradoras_total}`, 'cyan');
            log(`      Preço: R$ ${(plan.price_monthly / 100).toFixed(2)}/mês\n`, 'cyan');
        });

        // 2. Verificar addons
        log('2️⃣  Verificando addons disponíveis...', 'cyan');
        const { data: addons } = await supabase
            .from('subscription_addons')
            .select('*')
            .eq('is_active', true);

        log(`✅ ${addons?.length || 0} addons encontrados:\n`, 'green');
        addons?.forEach(addon => {
            log(`   🔌 ${addon.display_name}`, 'cyan');
            log(`      Preço: R$ ${(addon.price_monthly / 100).toFixed(2)}/mês\n`, 'cyan');
        });

        // 3. Buscar admin de teste
        log('3️⃣  Buscando admin para teste...', 'cyan');
        const { data: admin } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('role', 'ADMIN')
            .limit(1)
            .single();

        if (!admin) {
            log('❌ Nenhum admin encontrado', 'red');
            return;
        }

        log(`✅ Admin encontrado: ${admin.name}\n`, 'green');

        // 4. Testar função get_admin_limits
        log('4️⃣  Testando função get_admin_limits()...', 'cyan');
        const { data: limits, error: limitsError } = await supabase
            .rpc('get_admin_limits', { p_admin_id: admin.id });

        if (limitsError) {
            log(`❌ Erro: ${limitsError.message}`, 'red');
            return;
        }

        log(`✅ Limites do admin:\n`, 'green');
        log(`   Máximo de lojas: ${limits[0].max_stores}`, 'cyan');
        log(`   Máximo de colaboradoras: ${limits[0].max_colaboradoras_total}\n`, 'cyan');

        // 5. Contar lojas atuais
        log('5️⃣  Verificando uso atual...', 'cyan');
        const { count: storesCount } = await supabase
            .from('stores')
            .select('*', { count: 'exact', head: true })
            .eq('admin_id', admin.id)
            .eq('active', true);

        log(`✅ Lojas criadas: ${storesCount} / ${limits[0].max_stores}\n`, 'green');

        // 6. Testar can_create_store
        log('6️⃣  Testando função can_create_store()...', 'cyan');
        const { data: canCreate } = await supabase
            .rpc('can_create_store', { p_admin_id: admin.id });

        log(`${canCreate ? '✅' : '❌'} Pode criar nova loja? ${canCreate ? 'SIM' : 'NÃO'}\n`, canCreate ? 'green' : 'red');

        // 7. Testar can_create_colaboradora
        log('7️⃣  Testando função can_create_colaboradora()...', 'cyan');
        const { data: canCreateColab } = await supabase
            .rpc('can_create_colaboradora', { p_admin_id: admin.id });

        log(`${canCreateColab ? '✅' : '❌'} Pode criar colaboradora? ${canCreateColab ? 'SIM' : 'NÃO'}\n`, canCreateColab ? 'green' : 'red');

        log('\n✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!\n', 'green');

    } catch (error) {
        log(`\n❌ Erro durante teste: ${error.message}\n`, 'red');
        console.error(error);
    }
}

testSubscriptionSystem();
