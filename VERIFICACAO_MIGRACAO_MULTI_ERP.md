# Verificação da Migração Multi-ERP

## ✅ Migrations Criadas/Atualizadas

### Fase 1 (Já executada)
- ✅ `20251221000006_add_generic_external_order_support.sql` - Adiciona `external_order_id` e `order_source` em `sales`

### Nova Migration Necessária
- ✅ `20251221000005_1_add_external_order_to_cashback_transactions.sql` - Adiciona `external_order_id` e `order_source` em `cashback_transactions`
  - **IMPORTANTE**: Esta migration deve ser executada ANTES da fase 2, pois a fase 2 tenta inserir dados nessas colunas

### Fase 2 (Já executada)
- ✅ `20251221000007_fase2_migrate_rpc_functions.sql` - Migra funções RPC para usar nova estrutura
  - Atualiza `gerar_cashback` para aceitar `p_external_order_id` + `p_order_source`
  - Mantém compatibilidade com `p_tiny_order_id` (DEPRECATED)
  - Atualiza `processar_tiny_order_para_venda` para usar nova estrutura

### Fase 3 (Já executada)
- ✅ `20251221000008_fase3_deprecate_tiny_order_id.sql` - Marca `tiny_order_id` como DEPRECATED
  - Cria trigger de sincronização bidirecional

### Fase 4 (Já executada)
- ✅ `20251221000009_fase4_remove_tiny_order_id.sql` - Remove `tiny_order_id` completamente
  - Remove coluna, índices e constraints relacionados

## ✅ Código JavaScript Atualizado

### `netlify/functions/sync-tiny-orders-background.js`
- ✅ Linha 850: Atualizado para usar `external_order_id` + `order_source` ao verificar cashback existente
- ✅ Linha 864: Atualizado para usar `p_external_order_id` + `p_order_source` na chamada `gerar_cashback`
- ✅ Linhas 2635-2673: Já estava usando `external_order_id` + `order_source` (mantido fallback para compatibilidade)

## ⚠️ Pendências Identificadas

### 1. Migration Necessária
**AÇÃO NECESSÁRIA**: Executar a migration `20251221000005_1_add_external_order_to_cashback_transactions.sql` no Supabase antes de continuar usando a fase 2.

Esta migration adiciona as colunas `external_order_id` e `order_source` na tabela `cashback_transactions`, que são necessárias para a fase 2 funcionar corretamente.

### 2. Código TypeScript/JavaScript
- ✅ `netlify/functions/sync-tiny-orders-background.js` - **ATUALIZADO**
- ⚠️ `src/pages/erp/CashbackManagement.tsx` - Interface ainda tem `tiny_order_id`, mas isso é OK pois:
  - A coluna ainda existe durante a fase 3 (DEPRECATED)
  - Lançamentos manuais usam `tiny_order_id: null` (correto)
  - A interface pode ser atualizada na fase 4 quando a coluna for removida

### 3. Outras Referências
- Verificadas referências a `tiny_order_id` em outros arquivos
- Maioria são migrations antigas ou código legado que não precisa ser atualizado imediatamente
- O código principal (`sync-tiny-orders-background.js`) já foi atualizado

## 📋 Checklist Final

- [x] Migration para adicionar `external_order_id` + `order_source` em `cashback_transactions` criada
- [x] Código JavaScript atualizado para usar nova estrutura:
  - [x] `sync-tiny-orders-background.js`
  - [x] `TinyOrdersList.tsx`
  - [x] `cashback-generate-retroactive.js`
- [x] Funções RPC migradas (fase 2)
- [x] Trigger de sincronização criado (fase 3)
- [x] Remoção de `tiny_order_id` preparada (fase 4)
- [ ] **EXECUTAR** migration `20251221000005_1_add_external_order_to_cashback_transactions.sql` no Supabase

## 🚀 Próximos Passos

1. **EXECUTAR** a migration `20251221000005_1_add_external_order_to_cashback_transactions.sql` no Supabase
2. Testar o fluxo completo:
   - Sincronização de pedidos Tiny
   - Criação de vendas
   - Geração de cashback
   - Verificação de duplicatas
3. Após confirmar que tudo funciona, a fase 4 pode ser executada para remover `tiny_order_id` completamente

## 📝 Notas

- A função `gerar_cashback` aceita tanto `p_external_order_id` + `p_order_source` quanto `p_tiny_order_id` (DEPRECATED) para manter compatibilidade durante a transição
- O código JavaScript usa a nova estrutura, mas mantém fallback para `tiny_order_id` durante a migração
- Após a fase 4, todas as referências a `tiny_order_id` serão removidas

