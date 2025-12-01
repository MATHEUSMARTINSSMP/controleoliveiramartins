# 🔧 SOLUÇÃO: Vendas do ERP não aparecem no Dashboard da Loja

## Problema Identificado

As vendas estão sendo sincronizadas no **Dashboard ERP** (tabela `tiny_orders`), mas **não estão aparecendo no Dashboard da Loja** (tabela `sales`).

## Causa Raiz

O Dashboard da Loja busca vendas da tabela `sales`, não de `tiny_orders`. A função `criar_vendas_de_tiny_orders` deveria converter automaticamente os pedidos do Tiny em vendas, mas pode estar:

1. **Não sendo executada** após a sincronização
2. **Falhando silenciosamente** sem gerar erros visíveis
3. **Não encontrando pedidos** devido a filtros incorretos (colaboradora_id, store_id, valor_total)

## Correções Aplicadas

✅ **Melhorado**: `netlify/functions/sync-tiny-orders-background.js`

**Mudanças:**
- Adicionados logs detalhados para debug
- Melhor tratamento de erros com stack trace
- Logs mostram quantas vendas foram criadas/atualizadas
- Logs mostram detalhes de cada venda criada (número do pedido, sale_id)

## Próximos Passos

### 1. Executar Diagnóstico

Execute no Supabase SQL Editor:
```sql
-- Arquivo: VERIFICAR_VENDAS_NAO_APARECEM.sql
```

Este script verifica:
- Pedidos do Tiny que têm/não têm venda
- Vendas recentes criadas
- Problemas com store_id ou colaboradora_id

### 2. Forçar Criação de Vendas (se necessário)

Execute no Supabase SQL Editor:
```sql
-- Arquivo: FORCAR_CRIACAO_VENDAS.sql
```

Este script:
- Verifica pedidos sem venda
- Executa a função `criar_vendas_de_tiny_orders`
- Mostra o resultado
- Lista vendas criadas recentemente

### 3. Verificar Logs da Sincronização

Após a próxima sincronização automática, verifique os logs da Netlify Function `sync-tiny-orders-background` para ver:
- Se a função `criar_vendas_de_tiny_orders` está sendo chamada
- Quantas vendas foram criadas/atualizadas
- Se há erros na criação

### 4. Verificar Dados dos Pedidos

Os pedidos precisam ter:
- ✅ `colaboradora_id` preenchido (obrigatório)
- ✅ `store_id` preenchido (obrigatório)
- ✅ `valor_total > 0` (obrigatório)

Se algum pedido não tiver esses dados, a venda não será criada.

## Verificação

Após executar os scripts, verifique:

1. ✅ Pedidos do Tiny têm `colaboradora_id` preenchido
2. ✅ Pedidos do Tiny têm `store_id` preenchido
3. ✅ Pedidos do Tiny têm `valor_total > 0`
4. ✅ Vendas foram criadas na tabela `sales` com `tiny_order_id` preenchido
5. ✅ Vendas aparecem no Dashboard da Loja

## Arquivos Criados

- `VERIFICAR_VENDAS_NAO_APARECEM.sql` - Script de diagnóstico completo
- `FORCAR_CRIACAO_VENDAS.sql` - Script para forçar criação de vendas
- `SOLUCAO_VENDAS_NAO_APARECEM.md` - Este documento

## Arquivos Modificados

- `netlify/functions/sync-tiny-orders-background.js` - Melhorias em logs e tratamento de erros

