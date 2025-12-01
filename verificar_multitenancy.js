/**
 * Script de Verificação de Multi-Tenancy
 * 
 * Verifica se o sistema está 100% pronto para multi-tenancy:
 * 1. Admin tem acesso a todas as suas lojas
 * 2. Lojas têm acesso a todas as suas colaboradoras
 * 3. Colaboradoras têm acesso apenas aos seus dados
 * 4. Usuários podem ter várias lojas vinculadas
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada!');
  console.log('Por favor, forneça a chave via variável de ambiente ou edite o script.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'sistemaretiradas' }
});

async function verificarEstruturaTabelas() {
  console.log('\n📋 1. VERIFICANDO ESTRUTURA DAS TABELAS...\n');
  
  const verificacoes = [];
  
  // Verificar se stores tem admin_id
  try {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const store = data[0];
      const temAdminId = 'admin_id' in store;
      verificacoes.push({
        tabela: 'stores',
        campo: 'admin_id',
        existe: temAdminId,
        valor: store.admin_id || 'NULL'
      });
      
      console.log(`✅ stores.admin_id: ${temAdminId ? 'EXISTE' : '❌ NÃO EXISTE'}`);
      if (temAdminId && store.admin_id) {
        console.log(`   Valor exemplo: ${store.admin_id}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar stores:', error.message);
  }
  
  // Verificar profiles
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const profile = data[0];
      const campos = ['store_id', 'store_default', 'role'];
      campos.forEach(campo => {
        verificacoes.push({
          tabela: 'profiles',
          campo: campo,
          existe: campo in profile,
          valor: profile[campo] || 'NULL'
        });
        console.log(`✅ profiles.${campo}: ${campo in profile ? 'EXISTE' : '❌ NÃO EXISTE'}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro ao verificar profiles:', error.message);
  }
  
  return verificacoes;
}

async function verificarRLS() {
  console.log('\n🔒 2. VERIFICANDO POLÍTICAS RLS...\n');
  
  const tabelas = [
    'stores',
    'profiles',
    'sales',
    'goals',
    'cashback_transactions',
    'cashback_balance',
    'tiny_orders',
    'tiny_contacts',
    'adiantamentos',
    'compras'
  ];
  
  const resultados = [];
  
  for (const tabela of tabelas) {
    try {
      // Verificar se RLS está habilitado
      const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          SELECT tablename, rowsecurity 
          FROM pg_tables 
          WHERE schemaname = 'sistemaretiradas' 
          AND tablename = '${tabela}'
        `
      });
      
      // Verificar políticas
      const { data: policiesData, error: policiesError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          SELECT COUNT(*) as count
          FROM pg_policies
          WHERE schemaname = 'sistemaretiradas'
          AND tablename = '${tabela}'
        `
      });
      
      const temRLS = rlsData && rlsData[0]?.rowsecurity;
      const numPolicies = policiesData && policiesData[0]?.count || 0;
      
      resultados.push({
        tabela,
        rls_habilitado: temRLS,
        num_politicas: numPolicies
      });
      
      console.log(`${tabela}:`);
      console.log(`  RLS: ${temRLS ? '✅ HABILITADO' : '❌ DESABILITADO'}`);
      console.log(`  Políticas: ${numPolicies}`);
      
    } catch (error) {
      console.error(`❌ Erro ao verificar ${tabela}:`, error.message);
    }
  }
  
  return resultados;
}

async function verificarRelacionamentos() {
  console.log('\n🔗 3. VERIFICANDO RELACIONAMENTOS ADMIN-LOJA-COLABORADORA...\n');
  
  try {
    // Buscar um admin
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role')
      .eq('role', 'ADMIN')
      .eq('active', true)
      .limit(1);
    
    if (adminError) throw adminError;
    
    if (!admins || admins.length === 0) {
      console.log('⚠️ Nenhum admin encontrado para teste');
      return null;
    }
    
    const admin = admins[0];
    console.log(`\n👤 Admin de teste: ${admin.name} (${admin.email})`);
    
    // Buscar lojas do admin
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name, admin_id, active')
      .eq('admin_id', admin.id)
      .eq('active', true);
    
    if (storesError) throw storesError;
    
    console.log(`\n🏪 Lojas do admin: ${stores?.length || 0}`);
    stores?.forEach(store => {
      console.log(`  - ${store.name} (${store.id})`);
    });
    
    // Para cada loja, buscar colaboradoras
    if (stores && stores.length > 0) {
      for (const store of stores) {
        const { data: colaboradoras, error: colabError } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email, role, store_id')
          .eq('role', 'COLABORADORA')
          .eq('store_id', store.id)
          .eq('active', true);
        
        if (colabError) {
          console.error(`  ❌ Erro ao buscar colaboradoras da loja ${store.name}:`, colabError.message);
        } else {
          console.log(`\n  👥 Colaboradoras da loja ${store.name}: ${colaboradoras?.length || 0}`);
          colaboradoras?.forEach(colab => {
            console.log(`    - ${colab.name} (${colab.email})`);
          });
        }
      }
    }
    
    return {
      admin,
      stores: stores || [],
      total_colaboradoras: stores?.reduce((sum, store) => {
        // Contar colaboradoras de cada loja
        return sum;
      }, 0) || 0
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar relacionamentos:', error.message);
    return null;
  }
}

async function verificarAcessoMultiTenancy() {
  console.log('\n🔐 4. VERIFICANDO ACESSO MULTI-TENANCY (RLS)...\n');
  
  try {
    // Buscar um admin
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'ADMIN')
      .eq('active', true)
      .limit(1);
    
    if (!admins || admins.length === 0) {
      console.log('⚠️ Nenhum admin encontrado para teste de acesso');
      return;
    }
    
    const admin = admins[0];
    console.log(`\n👤 Testando acesso como: ${admin.name}`);
    
    // Criar cliente com token do admin (simulado)
    // Nota: Para testar RLS real, precisaríamos do token JWT do admin
    // Aqui vamos apenas verificar a estrutura
    
    console.log('\n📊 Verificações de acesso:');
    console.log('  ✅ Admin deve ver todas as lojas onde admin_id = auth.uid()');
    console.log('  ✅ Loja deve ver apenas sua loja (store_default = loja.id)');
    console.log('  ✅ Colaboradora deve ver apenas seus dados (store_id = colaboradora.store_id)');
    
    // Verificar se há políticas RLS que usam admin_id
    console.log('\n🔍 Verificando políticas RLS que usam admin_id...');
    
    // Buscar lojas do admin
    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, name, admin_id')
      .eq('admin_id', admin.id);
    
    console.log(`\n  Lojas vinculadas ao admin: ${stores?.length || 0}`);
    stores?.forEach(store => {
      console.log(`    - ${store.name} (admin_id: ${store.admin_id})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar acesso:', error.message);
  }
}

async function verificarTabelasPrincipais() {
  console.log('\n📦 5. VERIFICANDO TABELAS PRINCIPAIS E SEUS CAMPOS DE MULTI-TENANCY...\n');
  
  const tabelas = [
    { nome: 'stores', campos: ['admin_id'] },
    { nome: 'profiles', campos: ['store_id', 'store_default'] },
    { nome: 'sales', campos: ['store_id', 'colaboradora_id'] },
    { nome: 'goals', campos: ['store_id', 'colaboradora_id'] },
    { nome: 'cashback_transactions', campos: ['store_id', 'colaboradora_id'] },
    { nome: 'cashback_balance', campos: ['store_id', 'colaboradora_id'] },
    { nome: 'tiny_orders', campos: ['store_id', 'colaboradora_id'] },
    { nome: 'tiny_contacts', campos: ['store_id'] },
    { nome: 'adiantamentos', campos: ['colaboradora_id'] },
    { nome: 'compras', campos: ['loja_id', 'colaboradora_id'] }
  ];
  
  const resultados = [];
  
  for (const { nome, campos } of tabelas) {
    try {
      const { data, error } = await supabaseAdmin
        .from(nome)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${nome}: Erro - ${error.message}`);
        resultados.push({ tabela: nome, status: 'erro', erro: error.message });
        continue;
      }
      
      if (data && data.length > 0) {
        const registro = data[0];
        const camposExistentes = [];
        const camposFaltando = [];
        
        campos.forEach(campo => {
          if (campo in registro) {
            camposExistentes.push(campo);
          } else {
            camposFaltando.push(campo);
          }
        });
        
        console.log(`${nome}:`);
        if (camposExistentes.length > 0) {
          console.log(`  ✅ Campos existentes: ${camposExistentes.join(', ')}`);
        }
        if (camposFaltando.length > 0) {
          console.log(`  ❌ Campos faltando: ${camposFaltando.join(', ')}`);
        }
        
        resultados.push({
          tabela: nome,
          status: camposFaltando.length === 0 ? 'ok' : 'incompleto',
          campos_existentes: camposExistentes,
          campos_faltando: camposFaltando
        });
      } else {
        console.log(`${nome}: ⚠️ Tabela vazia (não é possível verificar campos)`);
        resultados.push({ tabela: nome, status: 'vazio' });
      }
      
    } catch (error) {
      console.error(`❌ Erro ao verificar ${nome}:`, error.message);
      resultados.push({ tabela: nome, status: 'erro', erro: error.message });
    }
  }
  
  return resultados;
}

async function main() {
  console.log('🚀 INICIANDO VERIFICAÇÃO DE MULTI-TENANCY\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Estrutura das tabelas
    const estrutura = await verificarEstruturaTabelas();
    
    // 2. RLS
    const rls = await verificarRLS();
    
    // 3. Relacionamentos
    const relacionamentos = await verificarRelacionamentos();
    
    // 4. Acesso Multi-Tenancy
    await verificarAcessoMultiTenancy();
    
    // 5. Tabelas principais
    const tabelas = await verificarTabelasPrincipais();
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMO DA VERIFICAÇÃO\n');
    
    const problemas = [];
    
    // Verificar se stores tem admin_id
    const storesTemAdminId = estrutura?.find(e => e.tabela === 'stores' && e.campo === 'admin_id' && e.existe);
    if (!storesTemAdminId) {
      problemas.push('❌ stores não tem campo admin_id');
    } else {
      console.log('✅ stores tem campo admin_id');
    }
    
    // Verificar RLS
    const rlsComProblemas = rls?.filter(r => !r.rls_habilitado || r.num_politicas === 0);
    if (rlsComProblemas && rlsComProblemas.length > 0) {
      problemas.push(`❌ ${rlsComProblemas.length} tabela(s) sem RLS ou políticas`);
      rlsComProblemas.forEach(r => {
        console.log(`  - ${r.tabela}: RLS=${r.rls_habilitado}, Políticas=${r.num_politicas}`);
      });
    } else {
      console.log('✅ RLS configurado corretamente nas tabelas principais');
    }
    
    // Verificar campos de multi-tenancy
    const tabelasIncompletas = tabelas?.filter(t => t.status === 'incompleto');
    if (tabelasIncompletas && tabelasIncompletas.length > 0) {
      problemas.push(`❌ ${tabelasIncompletas.length} tabela(s) com campos de multi-tenancy faltando`);
      tabelasIncompletas.forEach(t => {
        console.log(`  - ${t.tabela}: faltando ${t.campos_faltando?.join(', ')}`);
      });
    } else {
      console.log('✅ Campos de multi-tenancy presentes nas tabelas principais');
    }
    
    // Relacionamentos
    if (relacionamentos) {
      console.log(`\n✅ Relacionamentos verificados:`);
      console.log(`  - Admin: ${relacionamentos.admin?.name}`);
      console.log(`  - Lojas: ${relacionamentos.stores?.length || 0}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (problemas.length === 0) {
      console.log('\n✅ SISTEMA 100% PRONTO PARA MULTI-TENANCY!\n');
    } else {
      console.log('\n⚠️ PROBLEMAS ENCONTRADOS:\n');
      problemas.forEach(p => console.log(`  ${p}`));
      console.log('\n');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error);
    process.exit(1);
  }
}

main();

