import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27CckEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function systemHealthCheck() {
  console.log('🏥 VERIFICAÇÃO GERAL DE SAÚDE DO SISTEMA\n');
  console.log('='.repeat(60));
  
  // 1. Verificar colaboradoras
  console.log('\n👥 COLABORADORAS:');
  const { data: colaboradoras, error: colabError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('id, name, email, is_active, limite_total, limite_mensal, store_id')
    .eq('role', 'COLABORADORA');
  
  if (colabError) {
    console.error('❌ Erro ao buscar colaboradoras:', colabError);
  } else {
    console.log(`   Total: ${colaboradoras?.length || 0}`);
    console.log(`   Ativas: ${colaboradoras?.filter(c => c.is_active).length || 0}`);
    console.log(`   Inativas: ${colaboradoras?.filter(c => !c.is_active).length || 0}`);
    
    // Verificar se todas têm auth user
    let semAuthUser = 0;
    let semLoja = 0;
    let semLimites = 0;
    
    for (const colab of colaboradoras || []) {
      const { data: authUser } = await supabase.auth.admin.getUserById(colab.id);
      if (!authUser.user) semAuthUser++;
      if (!colab.store_id) semLoja++;
      if (!colab.limite_total || !colab.limite_mensal) semLimites++;
    }
    
    console.log(`   Sem auth user: ${semAuthUser}`);
    console.log(`   Sem loja: ${semLoja}`);
    console.log(`   Sem limites configurados: ${semLimites}`);
  }
  
  // 2. Verificar lojas
  console.log('\n🏪 LOJAS:');
  const { data: lojas } = await supabase
    .schema('sistemaretiradas')
    .from('stores')
    .select('id, name, admin_id, whatsapp_ativo');
  
  console.log(`   Total: ${lojas?.length || 0}`);
  console.log(`   Com WhatsApp ativo: ${lojas?.filter(l => l.whatsapp_ativo).length || 0}`);
  console.log(`   Sem admin_id: ${lojas?.filter(l => !l.admin_id).length || 0}`);
  
  // 3. Verificar compras
  console.log('\n📦 COMPRAS:');
  const { data: compras } = await supabase
    .schema('sistemaretiradas')
    .from('purchases')
    .select('id, status_compra, valor_total');
  
  const comprasPorStatus = {
    PENDENTE: 0,
    APROVADO: 0,
    REJEITADO: 0,
    CANCELADO: 0
  };
  
  compras?.forEach(c => {
    comprasPorStatus[c.status_compra] = (comprasPorStatus[c.status_compra] || 0) + 1;
  });
  
  console.log(`   Total: ${compras?.length || 0}`);
  console.log(`   Pendentes: ${comprasPorStatus.PENDENTE}`);
  console.log(`   Aprovadas: ${comprasPorStatus.APROVADO}`);
  console.log(`   Rejeitadas: ${comprasPorStatus.REJEITADO}`);
  console.log(`   Canceladas: ${comprasPorStatus.CANCELADO}`);
  
  // 4. Verificar parcelas
  console.log('\n💳 PARCELAS:');
  const { data: parcelas } = await supabase
    .schema('sistemaretiradas')
    .from('parcelas')
    .select('id, status_parcela, valor_parcela');
  
  const parcelasPorStatus = {
    PENDENTE: 0,
    AGENDADO: 0,
    DESCONTADO: 0
  };
  
  parcelas?.forEach(p => {
    parcelasPorStatus[p.status_parcela] = (parcelasPorStatus[p.status_parcela] || 0) + 1;
  });
  
  console.log(`   Total: ${parcelas?.length || 0}`);
  console.log(`   Pendentes: ${parcelasPorStatus.PENDENTE}`);
  console.log(`   Agendadas: ${parcelasPorStatus.AGENDADO}`);
  console.log(`   Descontadas: ${parcelasPorStatus.DESCONTADO}`);
  
  // 5. Verificar adiantamentos
  console.log('\n💰 ADIANTAMENTOS:');
  const { data: adiantamentos } = await supabase
    .schema('sistemaretiradas')
    .from('adiantamentos')
    .select('id, status, valor, data_desconto');
  
  const adiantamentosPorStatus = {
    PENDENTE: 0,
    APROVADO: 0,
    REJEITADO: 0
  };
  
  let aprovadosDescontados = 0;
  let aprovadosNaoDescontados = 0;
  
  adiantamentos?.forEach(a => {
    adiantamentosPorStatus[a.status] = (adiantamentosPorStatus[a.status] || 0) + 1;
    if (a.status === 'APROVADO') {
      if (a.data_desconto) {
        aprovadosDescontados++;
      } else {
        aprovadosNaoDescontados++;
      }
    }
  });
  
  console.log(`   Total: ${adiantamentos?.length || 0}`);
  console.log(`   Pendentes: ${adiantamentosPorStatus.PENDENTE}`);
  console.log(`   Aprovados: ${adiantamentosPorStatus.APROVADO}`);
  console.log(`     - Já descontados: ${aprovadosDescontados}`);
  console.log(`     - Não descontados: ${aprovadosNaoDescontados}`);
  console.log(`   Rejeitados: ${adiantamentosPorStatus.REJEITADO}`);
  
  // 6. Verificar vendas
  console.log('\n💵 VENDAS:');
  const { data: vendas } = await supabase
    .schema('sistemaretiradas')
    .from('sales')
    .select('id, valor, data_venda');
  
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const vendasMes = vendas?.filter(v => new Date(v.data_venda) >= inicioMes).length || 0;
  
  console.log(`   Total: ${vendas?.length || 0}`);
  console.log(`   Este mês: ${vendasMes}`);
  
  // 7. Verificar cashback
  console.log('\n🎁 CASHBACK:');
  const { data: cashbackTransactions } = await supabase
    .schema('sistemaretiradas')
    .from('cashback_transactions')
    .select('id, valor, tipo');
  
  const creditado = cashbackTransactions?.filter(t => t.tipo === 'CREDITO').length || 0;
  const resgatado = cashbackTransactions?.filter(t => t.tipo === 'RESGATE').length || 0;
  
  console.log(`   Total transações: ${cashbackTransactions?.length || 0}`);
  console.log(`   Creditado: ${creditado}`);
  console.log(`   Resgatado: ${resgatado}`);
  
  // 8. Verificar ponto
  console.log('\n⏰ CONTROLE DE PONTO:');
  const { data: pontos } = await supabase
    .schema('sistemaretiradas')
    .from('time_clock_records')
    .select('id, tipo_registro, horario, lancamento_manual');
  
  const pontosHoje = pontos?.filter(p => {
    const data = new Date(p.horario);
    return data.toDateString() === hoje.toDateString();
  }).length || 0;
  
  const manuais = pontos?.filter(p => p.lancamento_manual).length || 0;
  
  console.log(`   Total registros: ${pontos?.length || 0}`);
  console.log(`   Hoje: ${pontosHoje}`);
  console.log(`   Lançamentos manuais: ${manuais}`);
  
  // 9. Verificar notificações WhatsApp
  console.log('\n�� NOTIFICAÇÕES WHATSAPP:');
  const { data: whatsappQueue } = await supabase
    .schema('sistemaretiradas')
    .from('cashback_whatsapp_queue')
    .select('id, status');
  
  const pendentes = whatsappQueue?.filter(q => q.status === 'PENDENTE').length || 0;
  const enviadas = whatsappQueue?.filter(q => q.status === 'ENVIADO').length || 0;
  const falhas = whatsappQueue?.filter(q => q.status === 'FALHA').length || 0;
  
  console.log(`   Total na fila: ${whatsappQueue?.length || 0}`);
  console.log(`   Pendentes: ${pendentes}`);
  console.log(`   Enviadas: ${enviadas}`);
  console.log(`   Falhas: ${falhas}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ VERIFICAÇÃO CONCLUÍDA\n');
}

systemHealthCheck().catch(console.error);
