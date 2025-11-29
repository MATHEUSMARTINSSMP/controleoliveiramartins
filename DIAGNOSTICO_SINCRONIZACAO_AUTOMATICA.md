# 🔍 DIAGNÓSTICO: Sincronização Automática Não Funciona

## ❌ PROBLEMA

A sincronização automática (cron de 1 minuto) não está atualizando o frontend automaticamente. É necessário apertar "Sincronizar Agora" manualmente.

---

## ✅ CORREÇÕES APLICADAS

### 1. **Função `verificarNovaVenda` - Corrigida**
- **Problema**: Estava usando `situacao: '1,3'` como string, causando erro na API
- **Solução**: Removido parâmetro `situacao`, busca todos e filtra depois
- **Arquivo**: `supabase/functions/sync-tiny-orders/index.ts`

### 2. **Modo Incremental Otimizado - Corrigido**
- **Problema**: Parâmetro `situacao` causava erro na API
- **Solução**: Removido do modo incremental, filtra depois
- **Arquivo**: `netlify/functions/sync-tiny-orders-background.js`

---

## 🔍 VERIFICAÇÕES NECESSÁRIAS

### 1. **Verificar se o Cron está Rodando**

Execute no Supabase SQL Editor:
```sql
-- Verificar status do job
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'sync-incremental-1min';

-- Verificar últimas execuções
SELECT 
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-incremental-1min')
ORDER BY start_time DESC
LIMIT 10;
```

**Resultado esperado**:
- `active: true`
- Execuções recentes (últimos minutos)
- `status: succeeded`

### 2. **Verificar Logs da Edge Function**

1. Acesse: Supabase Dashboard → Edge Functions → `sync-tiny-orders` → Logs
2. Procure por:
   - `[SyncTiny] 🔍 Verificando se há nova venda`
   - `[SyncTiny] ✅ NOVA VENDA DETECTADA!`
   - `[SyncTiny] ⏭️ Sem nova venda detectada`

**Se não aparecer nada**: O cron não está chamando a Edge Function

### 3. **Verificar Logs da Netlify Function**

1. Acesse: Netlify Dashboard → Functions → `sync-tiny-orders-background` → Logs
2. Procure por:
   - `[SyncBackground] 🎯 MODO INCREMENTAL OTIMIZADO`
   - `[SyncBackground] ✅ Pedido X criado`

**Se não aparecer nada**: A Edge Function não está chamando a Netlify Function

### 4. **Verificar Realtime no Supabase**

1. Acesse: Supabase Dashboard → Settings → API → Realtime
2. Verifique se:
   - Realtime está **habilitado**
   - A tabela `tiny_orders` está na lista de tabelas com Realtime

**Se não estiver habilitado**: O frontend não receberá atualizações

### 5. **Verificar Frontend Console**

1. Abra o DevTools (F12)
2. Vá para a aba Console
3. Procure por:
   - `[TinyOrdersList] 🔔 Mudança detectada em tempo real: INSERT`
   - `[AUTO-REFRESH] 📊 X novos pedidos detectados`

**Se não aparecer nada**: O Realtime não está funcionando ou não há mudanças

---

## 🔧 POSSÍVEIS CAUSAS

### 1. **Cron não está rodando**
- **Sintoma**: Nenhum log na Edge Function
- **Solução**: Verificar se o job está ativo e se `pg_cron` está habilitado

### 2. **Edge Function não detecta nova venda**
- **Sintoma**: Logs mostram "Sem nova venda detectada"
- **Causa**: Função `verificarNovaVenda` pode estar falhando
- **Solução**: Verificar logs da Edge Function

### 3. **Realtime não está habilitado**
- **Sintoma**: Frontend não atualiza automaticamente
- **Solução**: Habilitar Realtime no Supabase Dashboard

### 4. **Netlify Function falha silenciosamente**
- **Sintoma**: Edge Function chama, mas Netlify não processa
- **Solução**: Verificar logs da Netlify Function

---

## 🧪 TESTE PASSO A PASSO

### 1. **Criar uma nova venda no Tiny ERP**
- Venda nº 1418 (ou próximo número)

### 2. **Aguardar 1 minuto**
- O cron deve rodar automaticamente

### 3. **Verificar logs**
- Supabase Edge Function: Deve mostrar "NOVA VENDA DETECTADA"
- Netlify Function: Deve processar o pedido
- Frontend Console: Deve mostrar notificação

### 4. **Se não funcionar**
- Execute `VERIFICAR_CRON_AUTOMATICO.sql` no Supabase
- Verifique cada etapa acima
- Me envie os logs

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Cron job está ativo (`active: true`)
- [ ] Cron está executando (últimas execuções aparecem)
- [ ] Edge Function está sendo chamada (logs aparecem)
- [ ] `verificarNovaVenda` detecta novas vendas
- [ ] Netlify Function processa os pedidos
- [ ] Realtime está habilitado no Supabase
- [ ] Frontend está escutando Realtime (console mostra eventos)
- [ ] Notificações aparecem no frontend

---

## ✅ PRÓXIMOS PASSOS

1. Execute `VERIFICAR_CRON_AUTOMATICO.sql` no Supabase
2. Verifique os logs da Edge Function
3. Verifique os logs da Netlify Function
4. Verifique se Realtime está habilitado
5. Teste criando uma nova venda e aguardando 1 minuto

Me envie os resultados para continuar o diagnóstico!

