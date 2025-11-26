# ✅ Resumo: Sincronização Automática em Background

## 🎯 O QUE A SINCRONIZAÇÃO FAZ

### ✅ VARREDURA COMPLETA EM TODAS AS LOJAS

A Edge Function `sync-tiny-orders` faz uma **varredura completa**:

1. **Busca TODAS as lojas** com integração Tiny ERP ativa:
   - Filtra por `sistema_erp = 'TINY'`
   - Filtra por `sync_status = 'CONNECTED'`
   - Filtra por `access_token IS NOT NULL`

2. **Para cada loja encontrada:**
   - Sincroniza pedidos das **últimas 12 horas**
   - Sincronização incremental (apenas novos/atualizados)
   - Processa até 2 páginas (100 pedidos por loja)

3. **Salva logs** de cada sincronização em `erp_sync_logs`

4. **Retorna resumo** com:
   - Total de lojas processadas
   - Total de pedidos sincronizados
   - Total de pedidos atualizados
   - Total de erros

---

## ⚠️ ATENÇÃO: Netlify Function Precisa Ser Implementada

A Edge Function está **chamando** a Netlify Function `sync-tiny-orders-background`, mas essa função ainda está com lógica placeholder.

**O que precisa ser feito:**
- A Netlify Function precisa chamar a função `syncTinyOrders` do arquivo `src/lib/erp/syncTiny.ts`
- OU a Edge Function precisa fazer a sincronização diretamente (sem depender da Netlify Function)

---

## 📊 O QUE ESTÁ FUNCIONANDO AGORA

✅ **Agendamento:** Configurado para executar a cada 30 minutos  
✅ **Busca de lojas:** Busca todas as lojas com integração ativa  
✅ **Estrutura:** Pronta para sincronizar cada loja  
⚠️ **Lógica de sincronização:** Precisa ser implementada na Netlify Function

---

## 🔧 PRÓXIMO PASSO

Implementar a lógica completa de sincronização na Netlify Function ou adaptar a Edge Function para fazer a sincronização diretamente.

