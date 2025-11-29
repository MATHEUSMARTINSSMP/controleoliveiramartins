# 🔍 DIAGNÓSTICO: Atualização de Novas Vendas no Frontend

## ❌ PROBLEMA IDENTIFICADO

1. **Erro no Upsert**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`
2. **Pedido novo não aparece**: Pedido 1414 foi processado mas não foi salvo no banco
3. **Frontend não atualiza**: Mesmo após sincronização manual

---

## 🔧 CAUSA RAIZ

### 1. **Índice Único Parcial**
O índice foi criado com `WHERE numero_pedido IS NOT NULL`, mas o Supabase precisa de um **constraint UNIQUE real** (não apenas índice parcial) para `ON CONFLICT` funcionar.

### 2. **Upsert Falhando**
Como o constraint não existe, o upsert falha e o pedido não é salvo no banco.

### 3. **Frontend Não Atualiza**
Se o pedido não foi salvo no banco, o Realtime não detecta mudanças e o frontend não atualiza.

---

## ✅ SOLUÇÃO

### 1. **Criar Constraint UNIQUE Real**
```sql
-- Execute: CORRIGIR_INDICE_UNICO.sql
ALTER TABLE sistemaretiradas.tiny_orders 
  ADD CONSTRAINT tiny_orders_numero_pedido_store_id_key 
  UNIQUE (numero_pedido, store_id);
```

### 2. **Garantir numero_pedido Não NULL**
```sql
-- Atualizar registros antigos
UPDATE sistemaretiradas.tiny_orders
SET numero_pedido = COALESCE(numero_pedido, tiny_id::text, 'SEM_NUMERO_' || id::text)
WHERE numero_pedido IS NULL;

-- Adicionar NOT NULL
ALTER TABLE sistemaretiradas.tiny_orders 
  ALTER COLUMN numero_pedido SET NOT NULL;
```

### 3. **Verificar Frontend**
- ✅ Realtime está configurado
- ✅ Auto-refresh está ativo (30 segundos)
- ✅ Detecção de novos pedidos está funcionando

---

## 📋 PRÓXIMOS PASSOS

1. **Execute o script `CORRIGIR_INDICE_UNICO.sql` no Supabase**
2. **Teste sincronização manual novamente**
3. **Verifique se o pedido aparece no frontend**

---

## 🔍 VERIFICAÇÃO

Após executar o script, verifique:
```sql
-- Verificar constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND conname LIKE '%numero_pedido%';
```

---

## ✅ RESULTADO ESPERADO

Após corrigir:
- ✅ Upsert funciona corretamente
- ✅ Pedidos novos são salvos no banco
- ✅ Realtime detecta mudanças
- ✅ Frontend atualiza automaticamente
- ✅ Notificações aparecem

