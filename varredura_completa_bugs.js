import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'sistemaretiradas' }
});

async function varreduraCompleta() {
  console.log('🔍 ========== VARREDURA COMPLETA DE BUGS ==========\n');

  const problemas = [];

  // 1. Verificar se tiny_order_id está sendo retornado nas queries
  console.log('1️⃣ Verificando se tiny_order_id está sendo retornado nas queries...');
  try {
    const lojaDashboard = readFileSync('./src/pages/LojaDashboard.tsx', 'utf8');
    
    // Verificar fetchSalesWithStoreId
    if (lojaDashboard.includes("from('sales')")) {
      const queries = lojaDashboard.match(/from\(['"]sales['"]\)[\s\S]*?\.select\([\s\S]*?\)/g) || [];
      
      queries.forEach((query, idx) => {
        if (query.includes('tiny_order_id')) {
          console.log(`   ✅ Query ${idx + 1} inclui tiny_order_id`);
        } else if (query.includes('select(') && query.includes('*')) {
          console.log(`   ✅ Query ${idx + 1} usa SELECT * (inclui todos os campos)`);
        } else {
          console.log(`   ⚠️  Query ${idx + 1} pode não incluir tiny_order_id`);
          problemas.push(`Query de sales pode não retornar tiny_order_id (linha aproximada)`);
        }
      });
    }
  } catch (error) {
    console.log('   ❌ Erro ao ler arquivo:', error.message);
  }
  console.log('');

  // 2. Verificar estrutura da tabela sales
  console.log('2️⃣ Verificando estrutura da tabela sales...');
  try {
    const { data: sampleSale, error } = await supabase
      .from('sales')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('   ❌ Erro ao buscar venda de exemplo:', error.message);
      problemas.push(`Erro ao verificar estrutura: ${error.message}`);
    } else if (sampleSale) {
      const campos = Object.keys(sampleSale);
      if (campos.includes('tiny_order_id')) {
        console.log('   ✅ Campo tiny_order_id existe na tabela sales');
      } else {
        console.log('   ❌ Campo tiny_order_id NÃO existe na tabela sales!');
        problemas.push('Campo tiny_order_id não existe na tabela sales - Execute a migration!');
      }
      
      console.log(`   📋 Campos encontrados: ${campos.join(', ')}`);
    } else {
      console.log('   ⚠️  Nenhuma venda encontrada para verificar estrutura');
    }
  } catch (error) {
    console.log('   ❌ Erro:', error.message);
    problemas.push(`Erro ao verificar estrutura: ${error.message}`);
  }
  console.log('');

  // 3. Verificar inconsistências entre vendas e pedidos
  console.log('3️⃣ Verificando inconsistências entre vendas e pedidos...');
  try {
    const { data: vendasComLink, error: vendasError } = await supabase
      .from('sales')
      .select('id, tiny_order_id, valor, colaboradora_id')
      .not('tiny_order_id', 'is', null)
      .limit(10);

    if (!vendasError && vendasComLink && vendasComLink.length > 0) {
      let inconsistencias = 0;
      for (const venda of vendasComLink) {
        const { data: pedido, error: pedidoError } = await supabase
          .from('tiny_orders')
          .select('id, valor_total, colaboradora_id')
          .eq('id', venda.tiny_order_id)
          .single();

        if (pedidoError || !pedido) {
          inconsistencias++;
          console.log(`   ❌ Venda ${venda.id.substring(0, 8)}... linkada com pedido inexistente ${venda.tiny_order_id?.substring(0, 8)}...`);
          problemas.push(`Venda ${venda.id} linkada com pedido inexistente`);
        } else {
          // Verificar se valores correspondem
          const valorVenda = parseFloat(venda.valor || 0);
          const valorPedido = parseFloat(pedido.valor_total || 0);
          if (Math.abs(valorVenda - valorPedido) > 0.01) {
            inconsistencias++;
            console.log(`   ⚠️  Venda ${venda.id.substring(0, 8)}...: valor venda (${valorVenda}) != valor pedido (${valorPedido})`);
            problemas.push(`Valor inconsistente: venda ${venda.id} (R$ ${valorVenda}) != pedido (R$ ${valorPedido})`);
          }

          // Verificar colaboradoras
          if (venda.colaboradora_id !== pedido.colaboradora_id) {
            inconsistencias++;
            console.log(`   ⚠️  Venda ${venda.id.substring(0, 8)}...: colaboradora venda (${venda.colaboradora_id?.substring(0, 8)}) != colaboradora pedido (${pedido.colaboradora_id?.substring(0, 8)})`);
            problemas.push(`Colaboradora inconsistente: venda ${venda.id}`);
          }
        }
      }
      
      if (inconsistencias === 0) {
        console.log('   ✅ Nenhuma inconsistência encontrada');
      } else {
        console.log(`   ⚠️  ${inconsistencias} inconsistência(s) encontrada(s)`);
      }
    } else {
      console.log('   ⚠️  Nenhuma venda com link encontrada para verificar');
    }
  } catch (error) {
    console.log('   ❌ Erro:', error.message);
    problemas.push(`Erro ao verificar inconsistências: ${error.message}`);
  }
  console.log('');

  // 4. Verificar problemas no código
  console.log('4️⃣ Verificando problemas no código...');
  try {
    const lojaDashboard = readFileSync('./src/pages/LojaDashboard.tsx', 'utf8');
    
    // Verificar se handleEdit preserva tiny_order_id
    if (lojaDashboard.includes('handleEdit = (sale: Sale)')) {
      const handleEditMatch = lojaDashboard.match(/handleEdit = \(sale: Sale\)[\s\S]*?setDialogOpen\(true\);/);
      if (handleEditMatch) {
        const handleEditCode = handleEditMatch[0];
        if (!handleEditCode.includes('tiny_order_id')) {
          console.log('   ⚠️  handleEdit não preserva tiny_order_id do sale');
          problemas.push('handleEdit pode não estar preservando tiny_order_id');
        } else {
          console.log('   ✅ handleEdit preserva tiny_order_id');
        }
      }
    }

    // Verificar duplicação de código
    const tabelasVendas = (lojaDashboard.match(/sales\.map\(\(sale\)/g) || []).length;
    console.log(`   📊 Tabelas de vendas encontradas: ${tabelasVendas}`);
    if (tabelasVendas > 1) {
      console.log('   ✅ Múltiplas tabelas encontradas (normal para diferentes views)');
    }

    // Verificar se há imports duplicados
    const imports = lojaDashboard.match(/^import .* from/gm) || [];
    const importsUnicos = new Set(imports);
    if (imports.length !== importsUnicos.size) {
      console.log('   ⚠️  Possíveis imports duplicados');
      problemas.push('Imports possivelmente duplicados');
    } else {
      console.log('   ✅ Sem imports duplicados aparentes');
    }

  } catch (error) {
    console.log('   ❌ Erro ao analisar código:', error.message);
  }
  console.log('');

  // 5. Verificar problemas na função SQL
  console.log('5️⃣ Verificando função SQL...');
  try {
    const sqlFunction = readFileSync('./supabase/migrations/20250201000002_create_vendas_from_tiny_orders.sql', 'utf8');
    
    // Verificar se há problemas de sintaxe SQL
    if (sqlFunction.includes('DECLARE') && sqlFunction.includes('BEGIN')) {
      const declares = (sqlFunction.match(/DECLARE/g) || []).length;
      const begins = (sqlFunction.match(/BEGIN/g) || []).length;
      
      if (declares === begins) {
        console.log('   ✅ Estrutura DECLARE/BEGIN balanceada');
      } else {
        console.log(`   ⚠️  Possível desbalanceamento: ${declares} DECLARE vs ${begins} BEGIN`);
        problemas.push('Possível desbalanceamento DECLARE/BEGIN na função SQL');
      }
    }

    // Verificar se retorna os campos corretos
    if (sqlFunction.includes('RETURNS TABLE') && sqlFunction.includes('vendas_criadas')) {
      console.log('   ✅ Função retorna campos esperados');
    } else {
      console.log('   ⚠️  Função pode não retornar campos esperados');
    }

  } catch (error) {
    console.log('   ❌ Erro ao verificar função SQL:', error.message);
  }
  console.log('');

  // 6. Verificar problemas de integração
  console.log('6️⃣ Verificando integração...');
  try {
    const syncFile = readFileSync('./netlify/functions/sync-tiny-orders-background.js', 'utf8');
    
    // Verificar se a chamada está correta
    if (syncFile.includes("criar_vendas_de_tiny_orders")) {
      if (syncFile.includes(".rpc('criar_vendas_de_tiny_orders'") || syncFile.includes('.rpc("criar_vendas_de_tiny_orders"')) {
        console.log('   ✅ Função está sendo chamada corretamente');
      } else {
        console.log('   ⚠️  Função mencionada mas pode não estar sendo chamada corretamente');
        problemas.push('Chamada RPC pode estar incorreta');
      }
    } else {
      console.log('   ❌ Função não encontrada no código de sincronização');
      problemas.push('Função criar_vendas_de_tiny_orders não encontrada no sync');
    }

    // Verificar se está dentro de try/catch
    const linhas = syncFile.split('\n');
    const linhaRPC = linhas.findIndex(l => l.includes('criar_vendas_de_tiny_orders'));
    if (linhaRPC >= 0) {
      // Verificar se está dentro de try
      let dentroTry = false;
      for (let i = linhaRPC; i >= 0; i--) {
        if (linhas[i].includes('try {')) {
          dentroTry = true;
          break;
        }
        if (linhas[i].includes('} catch') || linhas[i].includes('function') || linhas[i].includes('exports')) {
          break;
        }
      }
      if (dentroTry) {
        console.log('   ✅ Chamada está protegida por try/catch');
      } else {
        console.log('   ⚠️  Chamada pode não estar protegida por try/catch');
        problemas.push('Chamada RPC pode não estar protegida');
      }
    }

  } catch (error) {
    console.log('   ❌ Erro:', error.message);
  }
  console.log('');

  // Resumo final
  console.log('📊 ========== RESUMO DE PROBLEMAS ENCONTRADOS ==========');
  if (problemas.length === 0) {
    console.log('✅ NENHUM PROBLEMA CRÍTICO ENCONTRADO!');
  } else {
    console.log(`⚠️  ${problemas.length} problema(s) encontrado(s):`);
    problemas.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p}`);
    });
  }
  console.log('=======================================================\n');

  return problemas;
}

varreduraCompleta().catch(console.error);

