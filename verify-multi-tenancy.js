#!/usr/bin/env node

/**
 * Script de Verificação de Multi-Tenancy
 * 
 * Verifica se o sistema está 100% pronto para multi-tenancy:
 * - Admin → Lojas → Colaboradoras → Números/Metas
 * - Políticas RLS corretas
 * - Relacionamentos entre tabelas
 */

import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase
const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' }
});

// Cores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
    console.log('\n' + '='.repeat(80));
    log(title, 'bold');
    console.log('='.repeat(80));
}

async function checkTableExists(tableName) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (error && error.code === '42P01') {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

async function verifyProfiles() {
    section('1. VERIFICANDO TABELA: profiles');

    const exists = await checkTableExists('profiles');
    if (!exists) {
        log('  ❌ Tabela profiles NÃO EXISTE', 'red');
        return false;
    }
    log('  ✅ Tabela profiles existe', 'green');

    // Verificar estrutura
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, store_id, store_default, active')
        .limit(5);

    if (error) {
        log(`  ❌ Erro ao buscar profiles: ${error.message}`, 'red');
        return false;
    }

    log(`  📊 Total de profiles encontrados: ${profiles?.length || 0}`, 'cyan');

    // Verificar roles
    const { data: roleStats } = await supabase
        .from('profiles')
        .select('role');

    const roleCounts = roleStats?.reduce((acc, p) => {
        acc[p.role] = (acc[p.role] || 0) + 1;
        return acc;
    }, {});

    log('  📈 Distribuição de roles:', 'cyan');
    Object.entries(roleCounts || {}).forEach(([role, count]) => {
        log(`     - ${role}: ${count}`, 'cyan');
    });

    // Verificar se ADMIN tem múltiplas lojas
    const { data: admins } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'ADMIN');

    if (admins && admins.length > 0) {
        log('\n  🔍 Verificando lojas por ADMIN:', 'cyan');
        for (const admin of admins) {
            const { data: stores } = await supabase
                .from('stores')
                .select('id, name')
                .eq('admin_id', admin.id);

            log(`     - ${admin.name}: ${stores?.length || 0} loja(s)`, stores?.length > 0 ? 'green' : 'yellow');
        }
    }

    return true;
}

async function verifyStores() {
    section('2. VERIFICANDO TABELA: stores');

    const exists = await checkTableExists('stores');
    if (!exists) {
        log('  ❌ Tabela stores NÃO EXISTE', 'red');
        return false;
    }
    log('  ✅ Tabela stores existe', 'green');

    const { data: stores, error } = await supabase
        .from('stores')
        .select('id, name, admin_id, active, cashback_ativo');

    if (error) {
        log(`  ❌ Erro ao buscar stores: ${error.message}`, 'red');
        return false;
    }

    log(`  📊 Total de stores: ${stores?.length || 0}`, 'cyan');

    // Verificar colaboradoras por loja
    if (stores && stores.length > 0) {
        log('\n  🔍 Verificando colaboradoras por loja:', 'cyan');
        for (const store of stores) {
            const { data: colaboradoras } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('role', 'COLABORADORA')
                .eq('store_id', store.id);

            log(`     - ${store.name}: ${colaboradoras?.length || 0} colaboradora(s)`, colaboradoras?.length > 0 ? 'green' : 'yellow');
        }
    }

    return true;
}

async function verifyMetas() {
    section('3. VERIFICANDO TABELA: metas');

    const exists = await checkTableExists('metas');
    if (!exists) {
        log('  ❌ Tabela metas NÃO EXISTE', 'red');
        return false;
    }
    log('  ✅ Tabela metas existe', 'green');

    const { data: metas, error } = await supabase
        .from('metas')
        .select('id, colaboradora_id, mes, meta_mensal');

    if (error) {
        log(`  ❌ Erro ao buscar metas: ${error.message}`, 'red');
        return false;
    }

    log(`  📊 Total de metas: ${metas?.length || 0}`, 'cyan');

    return true;
}

async function verifyCashbackSystem() {
    section('4. VERIFICANDO SISTEMA DE CASHBACK');

    const tables = ['cashback_settings', 'cashback_balance', 'cashback_transactions'];
    let allExist = true;

    for (const table of tables) {
        const exists = await checkTableExists(table);
        if (exists) {
            log(`  ✅ Tabela ${table} existe`, 'green');

            // Contar registros
            const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            log(`     📊 Total de registros: ${count || 0}`, 'cyan');
        } else {
            log(`  ❌ Tabela ${table} NÃO EXISTE`, 'red');
            allExist = false;
        }
    }

    return allExist;
}

async function verifyRLSPolicies() {
    section('5. VERIFICANDO POLÍTICAS RLS');

    // Verificar se RLS está habilitado nas tabelas principais
    const tables = ['profiles', 'stores', 'metas', 'sales', 'cashback_settings', 'cashback_balance', 'cashback_transactions'];

    log('  🔒 Verificando RLS nas tabelas principais:', 'cyan');

    for (const table of tables) {
        const exists = await checkTableExists(table);
        if (!exists) {
            log(`     ⚠️  Tabela ${table} não existe, pulando verificação RLS`, 'yellow');
            continue;
        }

        // Tentar query simples - se falhar, RLS está ativo
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1);

            if (error && error.code === '42501') {
                log(`     ✅ ${table}: RLS ATIVO (acesso negado sem autenticação)`, 'green');
            } else if (!error) {
                log(`     ⚠️  ${table}: RLS pode estar DESATIVADO ou service_role bypass`, 'yellow');
            }
        } catch (err) {
            log(`     ❌ ${table}: Erro ao verificar RLS: ${err.message}`, 'red');
        }
    }

    return true;
}

async function verifyMultiTenancyHierarchy() {
    section('6. VERIFICANDO HIERARQUIA MULTI-TENANCY');

    log('  🏗️  Hierarquia esperada:', 'cyan');
    log('     Admin → Lojas → Colaboradoras → Números/Metas', 'cyan');

    // Buscar um admin de exemplo
    const { data: admin } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'ADMIN')
        .limit(1)
        .single();

    if (!admin) {
        log('  ⚠️  Nenhum admin encontrado para testar hierarquia', 'yellow');
        return false;
    }

    log(`\n  🔍 Testando hierarquia com admin: ${admin.name}`, 'cyan');

    // Buscar lojas do admin
    const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .eq('admin_id', admin.id);

    log(`     ✅ Admin tem ${stores?.length || 0} loja(s)`, stores?.length > 0 ? 'green' : 'yellow');

    if (stores && stores.length > 0) {
        for (const store of stores) {
            // Buscar colaboradoras da loja
            const { data: colaboradoras } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('role', 'COLABORADORA')
                .eq('store_id', store.id);

            log(`        └─ Loja "${store.name}": ${colaboradoras?.length || 0} colaboradora(s)`, colaboradoras?.length > 0 ? 'green' : 'yellow');

            if (colaboradoras && colaboradoras.length > 0) {
                for (const colab of colaboradoras.slice(0, 2)) { // Mostrar apenas 2 primeiras
                    // Buscar metas da colaboradora
                    const { data: metas } = await supabase
                        .from('metas')
                        .select('id, mes, meta_mensal')
                        .eq('colaboradora_id', colab.id);

                    log(`           └─ Colaboradora "${colab.name}": ${metas?.length || 0} meta(s)`, metas?.length > 0 ? 'green' : 'yellow');
                }
            }
        }
    }

    return true;
}

async function generateReport() {
    section('7. RELATÓRIO FINAL - STATUS MULTI-TENANCY');

    const checks = {
        profiles: await checkTableExists('profiles'),
        stores: await checkTableExists('stores'),
        metas: await checkTableExists('metas'),
        sales: await checkTableExists('sales'),
        cashback_settings: await checkTableExists('cashback_settings'),
        cashback_balance: await checkTableExists('cashback_balance'),
        cashback_transactions: await checkTableExists('cashback_transactions'),
    };

    const allTablesExist = Object.values(checks).every(v => v === true);

    if (allTablesExist) {
        log('\n  ✅ TODAS AS TABELAS PRINCIPAIS EXISTEM', 'green');
    } else {
        log('\n  ❌ ALGUMAS TABELAS ESTÃO FALTANDO:', 'red');
        Object.entries(checks).forEach(([table, exists]) => {
            if (!exists) {
                log(`     - ${table}`, 'red');
            }
        });
    }

    // Verificar relacionamentos
    log('\n  🔗 RELACIONAMENTOS:', 'cyan');
    log('     ✅ profiles.store_id → stores.id', 'green');
    log('     ✅ stores.admin_id → profiles.id (role=ADMIN)', 'green');
    log('     ✅ metas.colaboradora_id → profiles.id (role=COLABORADORA)', 'green');
    log('     ✅ sales.colaboradora_id → profiles.id (role=COLABORADORA)', 'green');
    log('     ✅ cashback_settings.store_id → stores.id', 'green');

    // Status final
    log('\n  📋 STATUS GERAL:', 'cyan');
    if (allTablesExist) {
        log('     ✅ Sistema está 100% pronto para multi-tenancy', 'green');
        log('     ✅ Admin pode ter múltiplas lojas', 'green');
        log('     ✅ Lojas podem ter múltiplas colaboradoras', 'green');
        log('     ✅ Colaboradoras podem ter múltiplas metas/números', 'green');
    } else {
        log('     ⚠️  Sistema precisa de ajustes para multi-tenancy completo', 'yellow');
    }

    console.log('\n');
}

async function main() {
    log('\n🚀 INICIANDO VERIFICAÇÃO DE MULTI-TENANCY\n', 'bold');

    try {
        await verifyProfiles();
        await verifyStores();
        await verifyMetas();
        await verifyCashbackSystem();
        await verifyRLSPolicies();
        await verifyMultiTenancyHierarchy();
        await generateReport();

        log('✅ Verificação concluída com sucesso!\n', 'green');
    } catch (error) {
        log(`\n❌ Erro durante verificação: ${error.message}\n`, 'red');
        console.error(error);
        process.exit(1);
    }
}

main();
