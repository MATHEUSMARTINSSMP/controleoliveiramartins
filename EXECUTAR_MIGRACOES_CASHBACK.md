# 🚀 EXECUTAR MIGRAÇÕES DE CASHBACK - ORDEM CORRETA

## ⚠️ IMPORTANTE: Execute nesta ordem exata!

### **ETAPA 0: Garantir que tabelas existam** ⭐ EXECUTE PRIMEIRO
```sql
-- Arquivo: supabase/migrations/20250130000001_ensure_cashback_tables_exist.sql
```
**O que faz:**
- ✅ Cria `cashback_transactions` se não existir
- ✅ Cria `cashback_balance` se não existir
- ✅ Cria `cashback_settings` se não existir
- ✅ Cria índices básicos
- ✅ Habilita RLS e cria políticas básicas

---

### **ETAPA 1: Adaptar cashback_transactions**
```sql
-- Arquivo: supabase/migrations/20250130001000_part1_adapt_cashback_transactions.sql
```
**O que faz:**
- ✅ Adiciona `cliente_id` (FK para tiny_contacts)
- ✅ Adiciona `tiny_order_id` (FK para tiny_orders)
- ✅ Adiciona campos de data (`data_liberacao`, `data_expiracao`)
- ✅ Adiciona campos `renovado`, `recuperado`
- ✅ Adiciona `cashback_settings_id`

---

### **ETAPA 2: Adaptar cashback_balance**
```sql
-- Arquivo: supabase/migrations/20250130002000_part2_adapt_cashback_balance.sql
```
**O que faz:**
- ✅ Adiciona `cliente_id` (FK para tiny_contacts)
- ✅ Adiciona `store_id` (FK para stores)
- ✅ Adiciona `balance_disponivel`, `balance_pendente`
- ✅ Adiciona campos de expiração
- ✅ Remove constraint UNIQUE antiga
- ✅ Cria constraint CHECK (colaboradora_id OU cliente_id)
- ✅ Cria índices únicos parciais

---

### **ETAPA 3: Criar função de cálculo**
```sql
-- Arquivo: supabase/migrations/20250130003000_part3_create_cashback_function.sql
```
**O que faz:**
- ✅ Cria função `calculate_cashback_for_tiny_order()`
- ✅ Lógica completa de cálculo de cashback

---

### **ETAPA 4: Criar trigger**
```sql
-- Arquivo: supabase/migrations/20250130004000_part4_create_cashback_trigger.sql
```
**O que faz:**
- ✅ Cria trigger `trigger_calculate_cashback_tiny_order`
- ✅ Dispara em INSERT ou UPDATE quando situação for faturado/aprovado

---

### **ETAPA 5: Funções utilitárias**
```sql
-- Arquivo: supabase/migrations/20250130005000_part5_create_utility_functions.sql
```
**O que faz:**
- ✅ Função `update_cashback_balances_on_liberation()`
- ✅ Função `renovar_cashback()`
- ✅ Função `get_cashback_summary_for_client()`
- ✅ Função `get_cashback_history_for_client()`

---

## 📋 CHECKLIST DE EXECUÇÃO:

1. [ ] **ETAPA 0** executada com sucesso (✅ tabelas criadas)
2. [ ] **ETAPA 1** executada com sucesso
3. [ ] **ETAPA 2** executada com sucesso
4. [ ] **ETAPA 3** executada com sucesso
5. [ ] **ETAPA 4** executada com sucesso
6. [ ] **ETAPA 5** executada com sucesso

---

## 🔧 SE DER ERRO:

### Erro: "relation 'cashback_transactions' does not exist"
**Solução:** Execute a **ETAPA 0** primeiro!

### Erro: "constraint already exists"
**Solução:** Normal, as migrações verificam existência. Pode continuar.

### Erro: "column already exists"
**Solução:** Normal, as migrações verificam existência. Pode continuar.

---

## ✅ VERIFICAÇÃO FINAL:

Após executar todas as etapas, verifique:

```sql
-- Verificar se tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'sistemaretiradas' 
AND table_name LIKE 'cashback%';

-- Verificar se função existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'sistemaretiradas' 
AND routine_name LIKE 'calculate_cashback%';

-- Verificar se trigger existe
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_schema = 'sistemaretiradas' 
AND trigger_name LIKE '%cashback%';
```

---

**Todas as migrações são idempotentes** (podem ser executadas múltiplas vezes sem erro).

