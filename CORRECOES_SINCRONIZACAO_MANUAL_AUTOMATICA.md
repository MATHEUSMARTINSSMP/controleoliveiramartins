# 🔧 CORREÇÕES: Sincronização Manual e Automática

## ❌ PROBLEMAS IDENTIFICADOS

### 1. **"Sincronizar Agora" buscando 400 pedidos**
- **Causa**: Estava usando `limit: 100` e `max_pages: 999`, buscando todos os pedidos do dia
- **Correção**: Agora usa `limit: 1` e `max_pages: 1` para buscar apenas a última venda

### 2. **Notificações automáticas não aparecem**
- **Causa**: O cron de 1 minuto está funcionando, mas precisa verificar se o frontend está escutando Realtime
- **Status**: Verificando...

---

## ✅ CORREÇÕES APLICADAS

### 1. **"Sincronizar Agora" - Buscar apenas última venda**

**Arquivo**: `src/pages/erp/ERPDashboard.tsx`

**Mudanças**:
- Período reduzido de 12 horas para 2 horas
- `limit: 1` (apenas 1 pedido por página)
- `max_pages: 1` (apenas 1 página)

```typescript
if (periodo === 'agora') {
  // ✅ Sincronizar Agora: Buscar apenas a última venda (últimas 2 horas, limit: 1)
  const agora = new Date();
  const duasHorasAtras = new Date(agora);
  duasHorasAtras.setHours(agora.getHours() - 2);
  dataInicio = duasHorasAtras.toISOString().split('T')[0];
  mensagem = 'Sincronizando última venda (últimas 2 horas)...';
}

// No body:
limit: periodo === 'agora' ? 1 : 100, // ✅ "Sincronizar Agora": apenas 1 pedido
max_pages: periodo === 'agora' ? 1 : 999, // ✅ "Sincronizar Agora": apenas 1 página
```

### 2. **Sincronização Automática (Cron 1 minuto)**

**Arquivo**: `supabase/functions/sync-tiny-orders/index.ts`

**Status**: ✅ Já está configurado corretamente
- Verifica se há nova venda antes de sincronizar
- Passa `ultimo_numero_conhecido` para modo incremental otimizado
- Usa `modo_incremental_otimizado: true` e `apenas_novas_vendas: true`

---

## 🔍 VERIFICAÇÃO DO FRONTEND

### Realtime está configurado?

**Arquivo**: `src/components/erp/TinyOrdersList.tsx`

✅ **Realtime configurado**:
```typescript
const channel = supabase
  .channel(`tiny_orders_${storeId}`)
  .on('postgres_changes', {
    event: '*', // INSERT, UPDATE, DELETE
    schema: 'sistemaretiradas',
    table: 'tiny_orders',
    filter: `store_id=eq.${storeId}`,
  }, (payload) => {
    console.log('[TinyOrdersList] 🔔 Mudança detectada em tempo real:', payload.eventType);
    fetchOrders(); // Recarregar lista
  })
  .subscribe();
```

✅ **Auto-refresh configurado** (30 segundos):
```typescript
const interval = setInterval(() => {
  fetchOrdersSilently();
}, 30000);
```

✅ **Notificações configuradas**:
```typescript
if (novosSemDuplicados.length > 0 && !isFirstLoad) {
  novosSemDuplicados.forEach((novoPedido) => {
    sonnerToast.success("🎉 Nova Venda!", {
      description: `Pedido ${novoPedido.numero_pedido}...`,
      duration: 5000,
    });
  });
}
```

---

## 🧪 TESTE AGORA

### 1. **Teste Sincronização Manual**
1. Aperte "Sincronizar Agora"
2. Deve buscar apenas 1 pedido (não 400)
3. Verifique os logs da Netlify Function

### 2. **Teste Sincronização Automática**
1. Aguarde 1 minuto (cron deve rodar)
2. Crie uma nova venda no Tiny ERP
3. Aguarde até 1 minuto
4. Verifique se:
   - O pedido aparece no frontend
   - A notificação aparece
   - O Realtime detecta a mudança

### 3. **Verificar Logs**
- **Supabase Edge Function**: Verificar se `incremental_1min` está rodando
- **Netlify Function**: Verificar se está usando `modo_incremental_otimizado`
- **Frontend Console**: Verificar se aparece `🔔 Mudança detectada em tempo real`

---

## 📊 RESULTADO ESPERADO

### ✅ Sincronização Manual ("Sincronizar Agora")
- Busca apenas 1 pedido (última venda)
- Não busca 400 pedidos
- Rápido e eficiente

### ✅ Sincronização Automática (Cron 1 minuto)
- Verifica se há nova venda antes de sincronizar
- Busca apenas pedidos novos (modo incremental otimizado)
- Frontend detecta via Realtime
- Notificação aparece automaticamente

---

## 🔧 SE AINDA NÃO FUNCIONAR

1. **Verificar se Realtime está habilitado no Supabase**:
   - Settings → API → Realtime
   - Verificar se `tiny_orders` está na lista de tabelas

2. **Verificar se o cron está rodando**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-incremental-1min')
   ORDER BY start_time DESC LIMIT 5;
   ```

3. **Verificar logs da Edge Function**:
   - Supabase Dashboard → Edge Functions → sync-tiny-orders → Logs

---

## ✅ PRÓXIMOS PASSOS

1. Teste "Sincronizar Agora" - deve buscar apenas 1 pedido
2. Aguarde 1 minuto e verifique se o cron detecta novas vendas
3. Verifique se as notificações aparecem no frontend

