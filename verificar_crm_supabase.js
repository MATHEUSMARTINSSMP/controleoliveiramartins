/**
 * Script de Verificação do Sistema CRM no Supabase
 * Verifica se todas as tabelas e configurações estão corretas
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'sistemaretiradas' }
});

async function verificarCRM() {
  console.log('🔍 VERIFICANDO SISTEMA CRM NO SUPABASE...\n');
  console.log('='.repeat(60));

  const problemas = [];
  const sucessos = [];

  // 1. Verificar coluna crm_ativo em stores
  console.log('\n1. Verificando coluna crm_ativo em stores...');
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, crm_ativo')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('crm_ativo')) {
        problemas.push('❌ Coluna crm_ativo NÃO existe em stores');
        console.log('   ❌ Coluna crm_ativo NÃO existe');
      } else {
        problemas.push(`❌ Erro ao verificar stores: ${error.message}`);
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      sucessos.push('✅ Coluna crm_ativo existe em stores');
      console.log('   ✅ Coluna crm_ativo existe');
      if (data && data.length > 0) {
        console.log(`   📊 Exemplo: ${data[0].name} - crm_ativo: ${data[0].crm_ativo}`);
      }
    }
  } catch (error) {
    problemas.push(`❌ Erro ao verificar stores: ${error.message}`);
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 2. Verificar tabela crm_contacts
  console.log('\n2. Verificando tabela crm_contacts...');
  try {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        problemas.push('❌ Tabela crm_contacts NÃO existe');
        console.log('   ❌ Tabela crm_contacts NÃO existe');
      } else {
        problemas.push(`❌ Erro ao verificar crm_contacts: ${error.message}`);
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      sucessos.push('✅ Tabela crm_contacts existe');
      console.log('   ✅ Tabela crm_contacts existe');
      console.log(`   📊 Total de contatos: ${data ? '0 ou mais' : '0'}`);
    }
  } catch (error) {
    problemas.push(`❌ Erro ao verificar crm_contacts: ${error.message}`);
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 3. Verificar tabela crm_tasks
  console.log('\n3. Verificando tabela crm_tasks...');
  try {
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        problemas.push('❌ Tabela crm_tasks NÃO existe');
        console.log('   ❌ Tabela crm_tasks NÃO existe');
      } else {
        problemas.push(`❌ Erro ao verificar crm_tasks: ${error.message}`);
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      sucessos.push('✅ Tabela crm_tasks existe');
      console.log('   ✅ Tabela crm_tasks existe');
    }
  } catch (error) {
    problemas.push(`❌ Erro ao verificar crm_tasks: ${error.message}`);
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 4. Verificar tabela crm_commitments
  console.log('\n4. Verificando tabela crm_commitments...');
  try {
    const { data, error } = await supabase
      .from('crm_commitments')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        problemas.push('❌ Tabela crm_commitments NÃO existe');
        console.log('   ❌ Tabela crm_commitments NÃO existe');
      } else {
        problemas.push(`❌ Erro ao verificar crm_commitments: ${error.message}`);
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      sucessos.push('✅ Tabela crm_commitments existe');
      console.log('   ✅ Tabela crm_commitments existe');
    }
  } catch (error) {
    problemas.push(`❌ Erro ao verificar crm_commitments: ${error.message}`);
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 5. Verificar tabela crm_post_sales
  console.log('\n5. Verificando tabela crm_post_sales...');
  try {
    const { data, error } = await supabase
      .from('crm_post_sales')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        problemas.push('❌ Tabela crm_post_sales NÃO existe');
        console.log('   ❌ Tabela crm_post_sales NÃO existe');
      } else {
        problemas.push(`❌ Erro ao verificar crm_post_sales: ${error.message}`);
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      sucessos.push('✅ Tabela crm_post_sales existe');
      console.log('   ✅ Tabela crm_post_sales existe');
    }
  } catch (error) {
    problemas.push(`❌ Erro ao verificar crm_post_sales: ${error.message}`);
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMO DA VERIFICAÇÃO\n');

  if (sucessos.length > 0) {
    console.log('✅ SUCESSOS:');
    sucessos.forEach(s => console.log(`   ${s}`));
  }

  if (problemas.length > 0) {
    console.log('\n❌ PROBLEMAS ENCONTRADOS:');
    problemas.forEach(p => console.log(`   ${p}`));
    console.log('\n⚠️ Execute o script VERIFICAR_E_APLICAR_CRM.sql no Supabase SQL Editor para corrigir!');
  } else {
    console.log('\n✅ SISTEMA CRM 100% CONFIGURADO!');
    console.log('   Todas as tabelas e configurações estão corretas.');
  }

  console.log('\n' + '='.repeat(60));
}

verificarCRM().catch(console.error);

