# Resumo da Migração Multi-ERP - Status Final

## ✅ O que foi completado

### 1. Migrations Criadas/Verificadas
- ✅ **Fase 1**: `20251221000006_add_generic_external_order_support.sql` - Adiciona suporte genérico em `sales`
- ✅ **Nova Migration Necessária**: `20251221000005_1_add_external_order_to_cashback_transactions.sql` - Adiciona suporte em `cashback_transactions`
- ✅ **Fase 2**: `20251221000007_fase2_migrate_rpc_functions.sql` - Migra funções RPC
- ✅ **Fase 3**: `20251221000008_fase3_deprecate_tiny_order_id.sql` - Marca `tiny_order_id` como DEPRECATED
- ✅ **Fase 4**: `20251221000009_fase4_remove_tiny_order_id.sql` - Remove `tiny_order_id` completamente

### 2. Código Atualizado
Todos os arquivos que usavam `tiny_order_id` diretamente foram atualizados para usar `external_order_id` + `order_source`:

- ✅ **netlify/functions/sync-tiny-orders-background.js**
  - Verificação de cashback existente
  - Chamada `gerar_cashback`
  - Queries para verificar vendas duplicadas

- ✅ **src/components/erp/TinyOrdersList.tsx**
  - Verificação de cashback antes de deletar pedido

- ✅ **netlify/functions/cashback-generate-retroactive.js**
  - Verificação de cashback existente
  - Chamada `gerar_cashback`

### 3. Estrutura de Dados
- ✅ Tabela `sales`: Tem `external_order_id` + `order_source` (Fase 1)
- ✅ Tabela `cashback_transactions`: Migration criada para adicionar `external_order_id` + `order_source`
- ✅ Função `gerar_cashback`: Aceita ambos os formatos (compatibilidade)
- ✅ Função `processar_tiny_order_para_venda`: Usa nova estrutura

## ⚠️ Ação Necessária

### EXECUTAR Migration no Supabase

**IMPORTANTE**: Antes de usar a fase 2 no ambiente de produção, execute:

```
20251221000005_1_add_external_order_to_cashback_transactions.sql
```

Esta migration:
- Adiciona colunas `external_order_id` e `order_source` em `cashback_transactions`
- Migra dados existentes de `tiny_order_id` para nova estrutura
- Cria índices para performance

**Ordem de execução das migrations**:
1. `20251221000006_add_generic_external_order_support.sql` (Fase 1)
2. `20251221000005_1_add_external_order_to_cashback_transactions.sql` ⚠️ **EXECUTAR**
3. `20251221000007_fase2_migrate_rpc_functions.sql` (Fase 2)
4. `20251221000008_fase3_deprecate_tiny_order_id.sql` (Fase 3)
5. `20251221000009_fase4_remove_tiny_order_id.sql` (Fase 4) - Opcional por enquanto

## 📋 Checklist de Testes

Após executar as migrations, teste:

- [ ] Sincronização de pedidos Tiny para `sales`
- [ ] Criação de vendas com `external_order_id` + `order_source`
- [ ] Geração automática de cashback via trigger
- [ ] Geração manual de cashback via RPC
- [ ] Verificação de duplicatas funciona corretamente
- [ ] Queries de cashback por pedido funcionam
- [ ] Deletar pedido verifica cashback corretamente
- [ ] Cashback retroativo funciona

## 🔄 Compatibilidade

O sistema mantém compatibilidade durante a transição:

1. **Função `gerar_cashback`** aceita:
   - `p_external_order_id` + `p_order_source` (preferido)
   - `p_tiny_order_id` (DEPRECATED, funciona durante migração)

2. **Queries** podem usar:
   - `external_order_id` + `order_source` (preferido)
   - `tiny_order_id` (fallback durante migração)

3. **Após Fase 4**: Todas as referências a `tiny_order_id` serão removidas

## 📝 Notas Técnicas

- O sistema agora suporta múltiplos ERPs (TINY, LINX, MICROVIX, etc) através de `external_order_id` + `order_source`
- Cada ERP pode ter seu próprio formato de ID (TEXT permite isso)
- O índice único garante que cada pedido externo gere apenas uma venda/cashback
- A estrutura é escalável para futuros ERPs sem necessidade de alterações no schema

## 🚀 Próximos Passos

1. **Execute** a migration `20251221000005_1_add_external_order_to_cashback_transactions.sql` no Supabase
2. **Teste** todos os fluxos listados acima
3. Após confirmar que tudo funciona:
   - A Fase 3 já foi executada (trigger de sincronização)
   - A Fase 4 pode ser executada quando estiver seguro para remover `tiny_order_id` completamente

## ✅ Status Final

**Código**: 100% atualizado ✅  
**Migrations**: Todas criadas ✅  
**Documentação**: Completa ✅  
**Pendente**: Executar migration no Supabase ⚠️

