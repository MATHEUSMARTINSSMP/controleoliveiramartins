# 📋 SQL DIVIDIDA EM PARTES - ORDEM DE EXECUÇÃO

Execute as migrações na seguinte ordem:

## PARTE 1: Adaptar cashback_transactions
**Arquivo:** `supabase/migrations/20250130001000_part1_adapt_cashback_transactions.sql`
- Adiciona campos `cliente_id`, `tiny_order_id`
- Adiciona campos de data (`data_liberacao`, `data_expiracao`)
- Adiciona campos `renovado`, `recuperado`
- Adiciona `cashback_settings_id`
- Cria índices

**EXECUTAR PRIMEIRO**

## PARTE 2: Adaptar cashback_balance
**Arquivo:** `supabase/migrations/20250130002000_part2_adapt_cashback_balance.sql`
- Adiciona campo `cliente_id`
- Adiciona campo `store_id`
- Adiciona `balance_disponivel`, `balance_pendente`
- Adiciona campos de expiração
- Remove constraint antiga e cria nova
- Cria índices únicos parciais

**EXECUTAR SEGUNDO**

## PARTE 3: Criar função de cálculo
**Arquivo:** `supabase/migrations/20250130003000_part3_create_cashback_function.sql`
- Cria função `calculate_cashback_for_tiny_order()`
- Lógica de cálculo de cashback

**EXECUTAR TERCEIRO**

## PARTE 4: Criar trigger
**Arquivo:** `supabase/migrations/20250130004000_part4_create_cashback_trigger.sql`
- Cria trigger `trigger_calculate_cashback_tiny_order`
- Dispara função quando pedido é inserido/atualizado

**EXECUTAR QUARTO**

## PARTE 5: Funções utilitárias
**Arquivo:** `supabase/migrations/20250130005000_part5_create_utility_functions.sql`
- Função `update_cashback_balances_on_liberation()`
- Função `renovar_cashback()`
- Função `get_cashback_summary_for_client()`
- Função `get_cashback_history_for_client()`

**EXECUTAR QUINTO**

---

⚠️ **IMPORTANTE:** 
- Execute na ordem numérica (part1, part2, part3, part4, part5)
- Cada parte verifica se as tabelas existem antes de modificar
- Se alguma parte falhar, verifique a mensagem de erro e corrija antes de continuar
