# 📋 ORDEM DE EXECUÇÃO DAS SQLs - CASHBACK PARA CLIENTES

## ⚠️ EXECUTE AS MIGRAÇÕES NESTA ORDEM EXATA:

### **PARTE 1:** Adaptar cashback_transactions
```sql
-- Arquivo: supabase/migrations/20250130001000_part1_adapt_cashback_transactions.sql
```
**O que faz:**
- ✅ Verifica se a tabela `cashback_transactions` existe
- ✅ Adiciona campo `cliente_id` (FK para tiny_contacts)
- ✅ Adiciona campo `tiny_order_id` (FK para tiny_orders)
- ✅ Adiciona campos de data (`data_liberacao`, `data_expiracao`)
- ✅ Adiciona campos `renovado`, `recuperado`
- ✅ Adiciona `cashback_settings_id`
- ✅ Cria índices

---

### **PARTE 2:** Adaptar cashback_balance
```sql
-- Arquivo: supabase/migrations/20250130002000_part2_adapt_cashback_balance.sql
```
**O que faz:**
- ✅ Verifica se a tabela `cashback_balance` existe
- ✅ Adiciona campo `cliente_id` (FK para tiny_contacts)
- ✅ Adiciona campo `store_id` (FK para stores)
- ✅ Adiciona `balance_disponivel`, `balance_pendente`
- ✅ Adiciona campos de expiração
- ✅ Remove constraint UNIQUE antiga
- ✅ Cria constraint CHECK (colaboradora_id OU cliente_id)
- ✅ Cria índices únicos parciais

---

### **PARTE 3:** Criar função de cálculo
```sql
-- Arquivo: supabase/migrations/20250130003000_part3_create_cashback_function.sql
```
**O que faz:**
- ✅ Cria função `calculate_cashback_for_tiny_order()`
- ✅ Lógica completa de cálculo de cashback
- ✅ Verifica se é UPDATE para evitar duplicação
- ✅ Calcula datas de liberação e expiração
- ✅ Atualiza saldos e cria transações

---

### **PARTE 4:** Criar trigger
```sql
-- Arquivo: supabase/migrations/20250130004000_part4_create_cashback_trigger.sql
```
**O que faz:**
- ✅ Verifica se a tabela `tiny_orders` existe
- ✅ Remove trigger anterior se existir
- ✅ Cria trigger `trigger_calculate_cashback_tiny_order`
- ✅ Dispara em INSERT ou UPDATE quando situação for faturado/aprovado

---

### **PARTE 5:** Funções utilitárias
```sql
-- Arquivo: supabase/migrations/20250130005000_part5_create_utility_functions.sql
```
**O que faz:**
- ✅ Cria função `update_cashback_balances_on_liberation()`
- ✅ Cria função `renovar_cashback()`
- ✅ Cria função `get_cashback_summary_for_client()`
- ✅ Cria função `get_cashback_history_for_client()`

---

## 🚨 IMPORTANTE:

1. **Execute na ordem numérica:** part1 → part2 → part3 → part4 → part5
2. **Cada parte verifica se as tabelas existem** antes de modificar
3. **Se alguma parte falhar:** pare e verifique o erro antes de continuar
4. **Após executar todas as partes:** o sistema de cashback estará pronto para clientes

---

## ✅ CHECKLIST DE EXECUÇÃO:

- [ ] PARTE 1 executada com sucesso
- [ ] PARTE 2 executada com sucesso
- [ ] PARTE 3 executada com sucesso
- [ ] PARTE 4 executada com sucesso
- [ ] PARTE 5 executada com sucesso

---

## 📝 NOTAS:

- A migração original `20250130000000_adapt_cashback_for_clients.sql` foi movida para `.backup`
- Todas as partes são **idempotentes** (podem ser executadas múltiplas vezes sem erro)
- Todas as partes verificam existência de tabelas antes de modificar

