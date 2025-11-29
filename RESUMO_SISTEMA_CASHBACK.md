# 📋 RESUMO DO SISTEMA DE CASHBACK - Estado Atual

## 🎯 Contexto
Sistema de cashback implementado para clientes do ERP Tiny. O frontend insere diretamente nas tabelas do Supabase (sem usar RPCs), e triggers/funções com SECURITY DEFINER atualizam os saldos automaticamente.

## ❌ Problemas Identificados e Corrigidos

### 1. **Erro 42501 - RLS bloqueando INSERT**
- **Problema**: Frontend não conseguia inserir em `cashback_transactions` por falta de políticas RLS
- **Solução**: Migration `20250128000006_add_cashback_rls_insert_update_delete.sql`
  - Adicionadas políticas para INSERT/UPDATE/DELETE em `cashback_transactions`
  - Adicionadas políticas para UPDATE/DELETE em `cashback_balance`
  - Frontend pode inserir transações, mas não criar saldos (apenas funções fazem isso)

### 2. **Erro 42P10 - ON CONFLICT sem constraint explícita**
- **Problema**: `ON CONFLICT (cliente_id)` não encontrava a constraint
- **Solução**: Migrations `20250128000007`, `20250128000008`, `20250128000009`
  - Alterado para `ON CONFLICT ON CONSTRAINT cashback_balance_unique_cliente`
  - Corrigido em todas as funções que fazem INSERT/UPDATE em `cashback_balance`

### 3. **Erro 42704 - Constraint não existe**
- **Problema**: Constraint `cashback_balance_unique_cliente` não existe no banco
- **Status**: ⚠️ **PENDENTE** - Precisa criar a constraint no Supabase

## 🔧 Migrations Criadas (Ordem de Aplicação)

1. **`20250128000000_create_cashback_system.sql`** (Original)
   - Cria tabelas: `cashback_settings`, `cashback_balance`, `cashback_transactions`
   - Cria funções RPC e triggers
   - Define constraint: `CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id)`

2. **`20250128000006_add_cashback_rls_insert_update_delete.sql`**
   - Políticas RLS para INSERT/UPDATE/DELETE
   - Frontend pode inserir em `cashback_transactions`
   - Frontend pode atualizar (não criar) em `cashback_balance`

3. **`20250128000007_fix_cashback_functions_security_definer.sql`**
   - Adiciona `SECURITY DEFINER` em `atualizar_saldo_cliente_cashback` e `gerar_cashback`
   - Corrige `ON CONFLICT` para usar nome da constraint explicitamente
   - Remove política de INSERT para frontend em `cashback_balance`

4. **`20250128000008_fix_all_on_conflict_constraints.sql`**
   - Corrige função `atualizar_saldos_cashback` para usar constraint explicitamente
   - Adiciona `SECURITY DEFINER`

5. **`20250128000009_fix_original_on_conflict_in_create_system.sql`**
   - Garante que todas as funções usam `ON CONSTRAINT` explicitamente
   - Adiciona `SECURITY DEFINER` onde necessário

## 🔴 Problema Atual (NÃO RESOLVIDO)

### Constraint não existe no banco
**Erro**: `constraint "cashback_balance_unique_cliente" for table "cashback_balance" does not exist`

**Causa Provável**:
- A migration original pode não ter sido aplicada completamente
- A constraint pode ter sido criada com nome diferente
- A tabela pode ter sido criada manualmente sem a constraint

**Solução Necessária**:
Criar migration para verificar e criar a constraint se não existir:

```sql
-- Verificar se constraint existe e criar se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cashback_balance_unique_cliente'
          AND conrelid = 'sistemaretiradas.cashback_balance'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_balance
        ADD CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id);
    END IF;
END $$;
```

## 📁 Arquivos Modificados Recentemente

### Frontend
- **`src/pages/erp/CashbackManagement.tsx`**
  - Refatorado para inserir diretamente em `cashback_transactions` (sem RPCs)
  - Busca configurações de cashback
  - Calcula valores e datas no frontend
  - Insere dados prontos no Supabase

### Backend/Netlify Functions
- **`netlify/functions/sync-tiny-orders-background.js`**
  - Fallback manual de cashback após inserir pedido
  - Aguarda trigger executar, verifica se cashback foi gerado, tenta manual se necessário

## 🔄 Fluxo Atual do Sistema

1. **Frontend insere transação** em `cashback_transactions`
   - Lançamento manual: Admin/LOJA insere transação tipo `EARNED`
   - Resgate manual: Admin/LOJA insere transação tipo `REDEEMED`

2. **Trigger automático** (se configurado)
   - Trigger `trg_atualizar_saldo_cashback_insert` chama `atualizar_saldo_cliente_cashback`
   - Função usa `SECURITY DEFINER` para criar/atualizar `cashback_balance`
   - Usa `ON CONFLICT ON CONSTRAINT cashback_balance_unique_cliente`

3. **Sincronização de pedidos**
   - Netlify Function insere pedido em `tiny_orders`
   - Trigger `trg_gerar_cashback_new_order` chama `gerar_cashback`
   - Função cria transação e atualiza saldo automaticamente

## ⚠️ Ações Necessárias

1. **CRÍTICO**: Criar migration para garantir que a constraint existe
2. Aplicar todas as migrations na ordem no Supabase
3. Testar inserção manual de cashback após aplicar migrations
4. Verificar se triggers estão funcionando corretamente

## 📝 Notas Importantes

- **Frontend NÃO cria saldos**: Apenas funções com `SECURITY DEFINER` criam `cashback_balance`
- **Frontend apenas insere transações**: Em `cashback_transactions`
- **Triggers atualizam saldos**: Automaticamente após inserção de transações
- **SECURITY DEFINER**: Funções que manipulam saldos precisam disso para ignorar RLS

## 🔗 Arquivos de Referência

- `supabase/migrations/20250128000000_create_cashback_system.sql` - Estrutura base
- `src/pages/erp/CashbackManagement.tsx` - Frontend de gestão
- `netlify/functions/sync-tiny-orders-background.js` - Sincronização com fallback

