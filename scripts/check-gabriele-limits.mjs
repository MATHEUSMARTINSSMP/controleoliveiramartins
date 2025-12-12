import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkGabrieleLimits() {
  const email = 'gabrielefreitaslobato@gmail.com';
  const mesCompetencia = '202512'; // Dezembro 2025
  
  console.log('🔍 Verificando limites de Gabriele Lobato de Freitas...\n');
  
  // 1. Buscar profile
  const { data: profile } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (!profile) {
    console.error('❌ Profile não encontrado!');
    return;
  }
  
  console.log('👤 PROFILE:');
  console.log('   ID:', profile.id);
  console.log('   Nome:', profile.name);
  console.log('   Limite Total:', profile.limite_total);
  console.log('   Limite Mensal:', profile.limite_mensal);
  console.log('   Ativo (is_active):', profile.is_active);
  console.log('   Ativo (active):', profile.active);
  
  // 2. Buscar compras
  const { data: purchases } = await supabase
    .schema('sistemaretiradas')
    .from('purchases')
    .select('id, valor_total, data_compra, status')
    .eq('colaboradora_id', profile.id);
  
  console.log('\n📦 COMPRAS:', purchases?.length || 0);
  if (purchases && purchases.length > 0) {
    purchases.forEach(p => {
      console.log(`   - ID: ${p.id.substring(0, 8)}... | Valor: R$ ${p.valor_total} | Status: ${p.status}`);
    });
  }
  
  const purchaseIds = purchases?.map(p => p.id) || [];
  
  // 3. Buscar parcelas
  const { data: parcelas } = await supabase
    .schema('sistemaretiradas')
    .from('parcelas')
    .select('*')
    .in('compra_id', purchaseIds)
    .in('status_parcela', ['PENDENTE', 'AGENDADO']);
  
  console.log('\n💳 PARCELAS PENDENTES:', parcelas?.length || 0);
  let totalParcelas = 0;
  let parcelasMesAtual = 0;
  
  if (parcelas && parcelas.length > 0) {
    parcelas.forEach(p => {
      const valor = Number(p.valor_parcela);
      totalParcelas += valor;
      if (p.competencia === mesCompetencia) {
        parcelasMesAtual += valor;
      }
      console.log(`   - Competência: ${p.competencia} | Valor: R$ ${valor} | Status: ${p.status_parcela}`);
    });
  }
  
  console.log(`   TOTAL PARCELAS: R$ ${totalParcelas.toFixed(2)}`);
  console.log(`   PARCELAS ${mesCompetencia}: R$ ${parcelasMesAtual.toFixed(2)}`);
  
  // 4. Buscar adiantamentos aprovados não descontados
  const { data: adiantamentosTotal } = await supabase
    .schema('sistemaretiradas')
    .from('adiantamentos')
    .select('*')
    .eq('colaboradora_id', profile.id)
    .eq('status', 'APROVADO')
    .is('data_desconto', null);
  
  console.log('\n💰 ADIANTAMENTOS APROVADOS (não descontados):', adiantamentosTotal?.length || 0);
  let totalAdiantamentosAprovados = 0;
  
  if (adiantamentosTotal && adiantamentosTotal.length > 0) {
    adiantamentosTotal.forEach(a => {
      const valor = Number(a.valor);
      totalAdiantamentosAprovados += valor;
      console.log(`   - Competência: ${a.mes_competencia} | Valor: R$ ${valor} | Aprovado em: ${a.data_aprovacao}`);
    });
  }
  
  console.log(`   TOTAL ADIANTAMENTOS: R$ ${totalAdiantamentosAprovados.toFixed(2)}`);
  
  // 5. Buscar adiantamentos do mês específico
  const { data: adiantamentosMes } = await supabase
    .schema('sistemaretiradas')
    .from('adiantamentos')
    .select('*')
    .eq('colaboradora_id', profile.id)
    .eq('mes_competencia', mesCompetencia)
    .eq('status', 'APROVADO')
    .is('data_desconto', null);
  
  let totalAdiantamentosMes = 0;
  if (adiantamentosMes && adiantamentosMes.length > 0) {
    adiantamentosMes.forEach(a => {
      totalAdiantamentosMes += Number(a.valor);
    });
  }
  
  console.log(`   ADIANTAMENTOS ${mesCompetencia}: R$ ${totalAdiantamentosMes.toFixed(2)}`);
  
  // 6. Calcular limites disponíveis
  const disponivelTotal = profile.limite_total - totalParcelas - totalAdiantamentosAprovados;
  const disponivelMensal = profile.limite_mensal - parcelasMesAtual - totalAdiantamentosMes;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CÁLCULO DE LIMITES:');
  console.log('='.repeat(60));
  console.log('LIMITE TOTAL:');
  console.log(`   Limite configurado: R$ ${profile.limite_total.toFixed(2)}`);
  console.log(`   - Parcelas pendentes: R$ ${totalParcelas.toFixed(2)}`);
  console.log(`   - Adiantamentos aprovados: R$ ${totalAdiantamentosAprovados.toFixed(2)}`);
  console.log(`   = DISPONÍVEL TOTAL: R$ ${disponivelTotal.toFixed(2)}`);
  console.log('');
  console.log('LIMITE MENSAL (Dezembro 2025):');
  console.log(`   Limite configurado: R$ ${profile.limite_mensal.toFixed(2)}`);
  console.log(`   - Parcelas do mês: R$ ${parcelasMesAtual.toFixed(2)}`);
  console.log(`   - Adiantamentos do mês: R$ ${totalAdiantamentosMes.toFixed(2)}`);
  console.log(`   = DISPONÍVEL MENSAL: R$ ${disponivelMensal.toFixed(2)}`);
  console.log('='.repeat(60));
  
  // 7. Diagnóstico
  console.log('\n🔍 DIAGNÓSTICO:');
  if (disponivelMensal < 200) {
    console.log('❌ PROBLEMA IDENTIFICADO!');
    console.log(`   Limite mensal disponível (R$ ${disponivelMensal.toFixed(2)}) está muito baixo!`);
    console.log('');
    console.log('   Possíveis causas:');
    console.log(`   1. Parcelas do mês ${mesCompetencia}: R$ ${parcelasMesAtual.toFixed(2)}`);
    console.log(`   2. Adiantamentos do mês ${mesCompetencia}: R$ ${totalAdiantamentosMes.toFixed(2)}`);
    console.log('');
    console.log('   TOTAL COMPROMETIDO NO MÊS:', (parcelasMesAtual + totalAdiantamentosMes).toFixed(2));
    console.log('   PERCENTUAL USADO:', ((parcelasMesAtual + totalAdiantamentosMes) / profile.limite_mensal * 100).toFixed(1) + '%');
  } else {
    console.log('✅ Limites parecem normais');
  }
}

checkGabrieleLimits().catch(console.error);
