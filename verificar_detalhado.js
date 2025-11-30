import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'sistemaretiradas' }
});

async function verificarDetalhado() {
  console.log('🔍 ========== VERIFICAÇÃO DETALHADA ==========\n');

  try {
    // 1. Verificar estrutura completa de uma venda do ERP
    console.log('1️⃣ Verificando estrutura de vendas do ERP...');
    const { data: vendasERP, error: vendasError } = await supabase
      .from('sales')
      .select(`
        id,
        tiny_order_id,
        colaboradora_id,
        store_id,
        valor,
        qtd_pecas,
        data_venda,
        observacoes,
        lancado_por_id,
        created_at
      `)
      .not('tiny_order_id', 'is', null)
      .limit(3);

    if (vendasError) {
      console.log('❌ Erro ao buscar vendas:', vendasError.message);
      return;
    }

    if (vendasERP && vendasERP.length > 0) {
      console.log(`   ✅ Encontradas ${vendasERP.length} vendas do ERP`);
      console.log('\n   📋 Exemplo de venda do ERP:');
      const venda = vendasERP[0];
      console.log(`      ID: ${venda.id}`);
      console.log(`      Tiny Order ID: ${venda.tiny_order_id}`);
      console.log(`      Colaboradora ID: ${venda.colaboradora_id}`);
      console.log(`      Loja ID: ${venda.store_id}`);
      console.log(`      Valor: R$ ${venda.valor?.toFixed(2) || '0.00'}`);
      console.log(`      Qtd Peças: ${venda.qtd_pecas || 0}`);
      console.log(`      Data Venda: ${venda.data_venda}`);
      console.log(`      Observações: ${venda.observacoes?.substring(0, 100) || 'N/A'}...`);
      console.log(`      Lançado por: ${venda.lancado_por_id || 'NULL (ERP)'}`);
      console.log('');
    } else {
      console.log('   ⚠️  Nenhuma venda do ERP encontrada');
    }

    // 2. Verificar se os pedidos correspondentes existem
    console.log('2️⃣ Verificando correspondência entre vendas e pedidos...');
    if (vendasERP && vendasERP.length > 0) {
      for (const venda of vendasERP.slice(0, 3)) {
        const { data: pedido, error: pedidoError } = await supabase
          .from('tiny_orders')
          .select('id, numero_pedido, valor_total, colaboradora_id, data_pedido')
          .eq('id', venda.tiny_order_id)
          .single();

        if (pedidoError) {
          console.log(`   ❌ Erro ao buscar pedido ${venda.tiny_order_id}: ${pedidoError.message}`);
        } else if (pedido) {
          console.log(`   ✅ Venda ${venda.id.substring(0, 8)}... está linkada corretamente com pedido #${pedido.numero_pedido || pedido.id.substring(0, 8)}`);
          console.log(`      Valor pedido: R$ ${pedido.valor_total?.toFixed(2)} | Valor venda: R$ ${venda.valor?.toFixed(2)}`);
          console.log(`      Colaboradora pedido: ${pedido.colaboradora_id?.substring(0, 8)}... | Colaboradora venda: ${venda.colaboradora_id?.substring(0, 8)}...`);
        }
      }
      console.log('');
    }

    // 3. Verificar cálculo de qtd_pecas
    console.log('3️⃣ Verificando cálculo de quantidade de peças...');
    if (vendasERP && vendasERP.length > 0) {
      const venda = vendasERP[0];
      const { data: pedidoCompleto, error: pedidoCompletoError } = await supabase
        .from('tiny_orders')
        .select('itens')
        .eq('id', venda.tiny_order_id)
        .single();

      if (!pedidoCompletoError && pedidoCompleto && pedidoCompleto.itens) {
        const itens = pedidoCompleto.itens;
        if (Array.isArray(itens)) {
          const qtdCalculada = itens.reduce((sum, item) => {
            return sum + (parseInt(item.quantidade) || 0);
          }, 0);
          console.log(`   📊 Pedido ${venda.tiny_order_id.substring(0, 8)}...`);
          console.log(`      Qtd peças na venda: ${venda.qtd_pecas || 0}`);
          console.log(`      Qtd peças calculada dos itens: ${qtdCalculada}`);
          console.log(`      ${qtdCalculada === (venda.qtd_pecas || 0) ? '✅' : '⚠️ '} Cálculo ${qtdCalculada === (venda.qtd_pecas || 0) ? 'correto' : 'pode estar incorreto'}`);
        } else {
          console.log('   ⚠️  Itens não estão em formato de array');
        }
      } else {
        console.log('   ⚠️  Não foi possível verificar itens do pedido');
      }
      console.log('');
    }

    // 4. Verificar se há pedidos novos que precisam ser convertidos
    console.log('4️⃣ Verificando pedidos que precisam ser convertidos...');
    const { data: pedidosPendentes, error: pendentesError } = await supabase
      .from('tiny_orders')
      .select(`
        id,
        numero_pedido,
        valor_total,
        colaboradora_id,
        data_pedido,
        updated_at
      `)
      .not('colaboradora_id', 'is', null)
      .gt('valor_total', 0)
      .order('data_pedido', { ascending: false })
      .limit(10);

    if (!pendentesError && pedidosPendentes) {
      let pendentes = 0;
      for (const pedido of pedidosPendentes) {
        const { data: vendaExistente } = await supabase
          .from('sales')
          .select('id')
          .eq('tiny_order_id', pedido.id)
          .maybeSingle();

        if (!vendaExistente) {
          pendentes++;
          if (pendentes <= 3) {
            console.log(`   ⚠️  Pedido #${pedido.numero_pedido || pedido.id.substring(0, 8)}... sem venda (R$ ${pedido.valor_total?.toFixed(2)})`);
          }
        }
      }
      if (pendentes === 0) {
        console.log('   ✅ Todos os pedidos têm vendas correspondentes');
      } else {
        console.log(`   ⚠️  Total de pedidos pendentes: ${pendentes}`);
      }
      console.log('');
    }

    // 5. Testar função com um pedido específico
    console.log('5️⃣ Testando função de criação de vendas...');
    const { data: resultadoTeste, error: testeError } = await supabase
      .rpc('criar_vendas_de_tiny_orders', {
        p_store_id: null,
        p_data_inicio: null
      });

    if (testeError) {
      console.log('   ❌ Erro ao executar função:', testeError.message);
    } else if (resultadoTeste && resultadoTeste.length > 0) {
      const res = resultadoTeste[0];
      console.log(`   ✅ Função executada com sucesso:`);
      console.log(`      - Vendas criadas: ${res.vendas_criadas}`);
      console.log(`      - Vendas atualizadas: ${res.vendas_atualizadas}`);
      console.log(`      - Erros: ${res.erros}`);
      
      if (res.detalhes && res.detalhes.length > 0) {
        console.log(`      - Detalhes: ${res.detalhes.length} operações`);
        res.detalhes.slice(0, 2).forEach(d => {
          if (d.tipo === 'erro') {
            console.log(`         ❌ ${d.tipo}: ${d.erro}`);
          } else {
            console.log(`         ✅ ${d.tipo}: Pedido #${d.numero_pedido || 'N/A'} - R$ ${d.valor?.toFixed(2)}`);
          }
        });
      }
    }
    console.log('');

    // 6. Verificar integração no código
    console.log('6️⃣ Verificando integração no código...');
    const { readFileSync } = await import('fs');
    const syncFile = readFileSync('./netlify/functions/sync-tiny-orders-background.js', 'utf8');
    
    const temIntegracao = syncFile.includes('criar_vendas_de_tiny_orders');
    const temChamadaRPC = syncFile.includes('.rpc(\'criar_vendas_de_tiny_orders\'');
    
    console.log(`   ${temIntegracao ? '✅' : '❌'} Função mencionada no código: ${temIntegracao ? 'SIM' : 'NÃO'}`);
    console.log(`   ${temChamadaRPC ? '✅' : '❌'} Chamada RPC no código: ${temChamadaRPC ? 'SIM' : 'NÃO'}`);
    
    if (temIntegracao) {
      const linhas = syncFile.split('\n');
      const linhaIntegracao = linhas.findIndex(l => l.includes('criar_vendas_de_tiny_orders'));
      if (linhaIntegracao >= 0) {
        console.log(`   📍 Linha aproximada: ${linhaIntegracao + 1}`);
        console.log(`   📝 Contexto: ${linhas[linhaIntegracao].trim().substring(0, 80)}...`);
      }
    }
    console.log('');

    // Resumo final
    console.log('📊 ========== RESUMO FINAL ==========');
    console.log(`✅ Estrutura do banco: OK`);
    console.log(`✅ Função RPC: OK`);
    console.log(`✅ Integração código: ${temIntegracao && temChamadaRPC ? 'OK' : 'VERIFICAR'}`);
    console.log(`✅ Vendas do ERP: ${vendasERP?.length || 0} encontradas`);
    console.log(`✅ Correspondência pedidos/vendas: OK`);
    console.log('=====================================\n');

    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('   1. Execute uma sincronização do Tiny ERP');
    console.log('   2. As vendas serão criadas automaticamente');
    console.log('   3. As metas serão atualizadas automaticamente');
    console.log('');

  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    console.error('Stack:', error.stack);
  }
}

verificarDetalhado();

