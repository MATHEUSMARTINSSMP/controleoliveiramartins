import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'sistemaretiradas' }
});

async function verificarTudo() {
  console.log('🔍 ========== VERIFICAÇÃO COMPLETA ==========\n');

  try {
    // 1. Verificar se a coluna tiny_order_id existe em sales
    console.log('1️⃣ Verificando se a coluna tiny_order_id existe em sales...');
    const { data: salesColumns, error: columnsError } = await supabase
      .from('sales')
      .select('tiny_order_id')
      .limit(1);

    if (columnsError && columnsError.message.includes('column')) {
      console.log('❌ ERRO: Coluna tiny_order_id não existe! Execute a migration primeiro.');
      return;
    }
    console.log('✅ Coluna tiny_order_id existe em sales\n');

    // 2. Verificar se a função RPC existe
    console.log('2️⃣ Verificando se a função criar_vendas_de_tiny_orders existe...');
    try {
      const { data: functionTest, error: functionError } = await supabase
        .rpc('criar_vendas_de_tiny_orders', {
          p_store_id: null,
          p_data_inicio: null
        });

      if (functionError) {
        if (functionError.message.includes('function') || functionError.message.includes('does not exist')) {
          console.log('❌ ERRO: Função criar_vendas_de_tiny_orders não existe! Execute a migration primeiro.');
          console.log('   Erro:', functionError.message);
          return;
        }
        throw functionError;
      }
      console.log('✅ Função criar_vendas_de_tiny_orders existe e está funcionando\n');
    } catch (err) {
      console.log('❌ ERRO ao testar função:', err.message);
      return;
    }

    // 3. Verificar pedidos do Tiny sem venda correspondente
    console.log('3️⃣ Verificando pedidos do Tiny sem venda correspondente...');
    const { data: pedidosSemVenda, error: pedidosError } = await supabase
      .from('tiny_orders')
      .select(`
        id,
        numero_pedido,
        store_id,
        colaboradora_id,
        valor_total,
        data_pedido,
        updated_at
      `)
      .not('colaboradora_id', 'is', null)
      .gt('valor_total', 0)
      .order('data_pedido', { ascending: false })
      .limit(10);

    if (pedidosError) {
      console.log('❌ Erro ao buscar pedidos:', pedidosError.message);
      return;
    }

    // Verificar quais têm venda
    const pedidosComVenda = [];
    const pedidosSemVendaList = [];

    for (const pedido of pedidosSemVenda || []) {
      const { data: venda } = await supabase
        .from('sales')
        .select('id, tiny_order_id')
        .eq('tiny_order_id', pedido.id)
        .maybeSingle();

      if (venda) {
        pedidosComVenda.push(pedido);
      } else {
        pedidosSemVendaList.push(pedido);
      }
    }

    console.log(`   📊 Total de pedidos verificados: ${pedidosSemVenda?.length || 0}`);
    console.log(`   ✅ Pedidos COM venda: ${pedidosComVenda.length}`);
    console.log(`   ⚠️  Pedidos SEM venda: ${pedidosSemVendaList.length}\n`);

    if (pedidosSemVendaList.length > 0) {
      console.log('   📋 Exemplos de pedidos sem venda:');
      pedidosSemVendaList.slice(0, 3).forEach(p => {
        console.log(`      - Pedido #${p.numero_pedido || p.id.substring(0, 8)}: R$ ${p.valor_total?.toFixed(2) || '0.00'}`);
      });
      console.log('');
    }

    // 4. Contar total de pedidos e vendas
    console.log('4️⃣ Estatísticas gerais...');
    const { count: totalPedidos } = await supabase
      .from('tiny_orders')
      .select('*', { count: 'exact', head: true })
      .not('colaboradora_id', 'is', null)
      .gt('valor_total', 0);

    const { count: totalVendasERP } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .not('tiny_order_id', 'is', null);

    const { count: totalVendasManuais } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .is('tiny_order_id', null);

    console.log(`   📊 Total de pedidos do Tiny (com colaboradora e valor > 0): ${totalPedidos || 0}`);
    console.log(`   📊 Total de vendas do ERP (linkadas com pedidos): ${totalVendasERP || 0}`);
    console.log(`   📊 Total de vendas manuais (sem link): ${totalVendasManuais || 0}\n`);

    // 5. Testar a função de criação de vendas
    console.log('5️⃣ Testando função de criação de vendas...');
    const { data: resultado, error: resultadoError } = await supabase
      .rpc('criar_vendas_de_tiny_orders', {
        p_store_id: null,
        p_data_inicio: null
      });

    if (resultadoError) {
      console.log('❌ Erro ao executar função:', resultadoError.message);
      return;
    }

    if (resultado && resultado.length > 0) {
      const res = resultado[0];
      console.log(`   ✅ Vendas criadas: ${res.vendas_criadas}`);
      console.log(`   ✅ Vendas atualizadas: ${res.vendas_atualizadas}`);
      console.log(`   ⚠️  Erros: ${res.erros}`);
      
      if (res.detalhes && res.detalhes.length > 0) {
        console.log(`   📋 Detalhes (primeiros 3):`);
        res.detalhes.slice(0, 3).forEach(d => {
          console.log(`      - ${d.tipo}: Pedido #${d.numero_pedido || 'N/A'} - R$ ${d.valor?.toFixed(2) || '0.00'} (${d.qtd_pecas || 0} peças)`);
        });
      }
      console.log('');
    }

    // 6. Verificar índices (verificar se há vendas com tiny_order_id)
    console.log('6️⃣ Verificando estrutura...');
    const { data: vendasComLink, error: linkError } = await supabase
      .from('sales')
      .select('id, tiny_order_id, valor, qtd_pecas')
      .not('tiny_order_id', 'is', null)
      .limit(5);

    if (!linkError && vendasComLink && vendasComLink.length > 0) {
      console.log(`   ✅ Encontradas ${vendasComLink.length} vendas linkadas com pedidos do Tiny`);
      console.log(`   📋 Exemplo: Venda ${vendasComLink[0].id.substring(0, 8)}... linkada com pedido ${vendasComLink[0].tiny_order_id.substring(0, 8)}...`);
    } else {
      console.log('   ⚠️  Nenhuma venda linkada encontrada ainda');
    }
    console.log('');

    // 7. Verificar integração com sincronização
    console.log('7️⃣ Verificando integração com sincronização...');
    const syncFile = readFileSync(
      './netlify/functions/sync-tiny-orders-background.js',
      'utf8'
    );
    
    if (syncFile.includes('criar_vendas_de_tiny_orders')) {
      console.log('   ✅ Função está integrada no sync-tiny-orders-background.js');
    } else {
      console.log('   ❌ ERRO: Função NÃO está integrada no sync-tiny-orders-background.js');
    }
    console.log('');

    // Resumo final
    console.log('📊 ========== RESUMO FINAL ==========');
    console.log(`✅ Coluna tiny_order_id: OK`);
    console.log(`✅ Função RPC: OK`);
    console.log(`✅ Integração com sync: ${syncFile.includes('criar_vendas_de_tiny_orders') ? 'OK' : 'ERRO'}`);
    console.log(`📊 Pedidos sem venda: ${pedidosSemVendaList.length}`);
    console.log(`📊 Vendas criadas no teste: ${resultado?.[0]?.vendas_criadas || 0}`);
    console.log('=====================================\n');

    if (pedidosSemVendaList.length > 0) {
      console.log('💡 RECOMENDAÇÃO: Execute a função criar_vendas_de_tiny_orders() para criar vendas dos pedidos pendentes.');
      console.log('   SQL: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);\n');
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    console.error('Stack:', error.stack);
  }
}

verificarTudo();

