# ⚠️ PROBLEMA IDENTIFICADO: IDs Duplicados do Tiny

## 🔍 PROBLEMA

Duas colaboradoras têm o **mesmo** `tiny_vendedor_id`:

1. **Karolainy Barbosa Tavares** → `tiny_vendedor_id = '908189863'`
2. **Karolayne Rodrigues Araújo** → `tiny_vendedor_id = '908189863'`

**Vendedor do Tiny correspondente:** "Karol" (ID: 908189863)

---

## ⚠️ IMPACTO

Isso causa **conflito** porque:
- O sistema não sabe qual colaboradora usar quando um pedido vem do vendedor "Karol"
- Pode fazer match errado
- Pode causar inconsistências nos relatórios

---

## ✅ SOLUÇÃO

### 1. Identificar qual colaboradora deve manter o ID

**Critério:** A colaboradora com **mais pedidos já matchados** deve manter o ID.

### 2. Remover ID das outras

Remover `tiny_vendedor_id` das colaboradoras que não devem ter (para mapear corretamente depois).

---

## 📋 AÇÕES NECESSÁRIAS

### Passo 1: Ver qual colaboradora deve manter o ID

Execute a **Query 3** do arquivo `CORRIGIR_DUPLICADOS_TINY_ID.sql`:

```sql
-- Ver qual colaboradora tem mais pedidos matchados
SELECT 
    p.id,
    p.name,
    p.tiny_vendedor_id,
    (SELECT COUNT(*) 
     FROM sistemaretiradas.tiny_orders ped 
     WHERE ped.colaboradora_id = p.id) as total_pedidos
FROM sistemaretiradas.profiles p
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.tiny_vendedor_id = '908189863'
ORDER BY total_pedidos DESC;
```

### Passo 2: Decidir qual é a "Karol" correta

**Possibilidades:**

1. **Karolainy Barbosa Tavares** é a "Karol" correta
2. **Karolayne Rodrigues Araújo** é a "Karol" correta
3. **Nenhuma delas** é a "Karol" (ambas são pessoas diferentes)

### Passo 3: Remover ID da colaboradora errada

Se decidir que **Karolainy** é a correta:

```sql
-- Remover ID de Karolayne
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = NULL
WHERE name = 'Karolayne Rodrigues Araújo'
  AND role = 'COLABORADORA';
```

Se decidir que **Karolayne** é a correta:

```sql
-- Remover ID de Karolainy
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = NULL
WHERE name = 'Karolainy Barbosa Tavares'
  AND role = 'COLABORADORA';
```

Se **nenhuma** é a "Karol":

```sql
-- Remover ID de ambas
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = NULL
WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
  AND role = 'COLABORADORA';
```

### Passo 4: Mapear corretamente depois

Depois de remover o ID duplicado, você pode:
1. Verificar qual colaboradora realmente é a "Karol" do Tiny
2. Mapear corretamente com base no nome ou CPF
3. Ou criar uma nova colaboradora "Karol" se necessário

---

## 🔍 COMO VERIFICAR QUAL É A CORRETA

### Método 1: Ver histórico de pedidos

```sql
-- Ver pedidos já matchados com cada colaboradora
SELECT 
    p.name as colaboradora,
    COUNT(*) as total_pedidos,
    MAX(ped.created_at) as ultimo_pedido,
    MIN(ped.created_at) as primeiro_pedido
FROM sistemaretiradas.tiny_orders ped
JOIN sistemaretiradas.profiles p ON ped.colaboradora_id = p.id
WHERE p.name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
GROUP BY p.name
ORDER BY total_pedidos DESC;
```

### Método 2: Ver CPF no Tiny

Se você tiver acesso ao CPF do vendedor "Karol" no Tiny ERP, compare com:
- Karolainy: CPF `01751437221`
- Karolayne: CPF `04412393232`

### Método 3: Confirmar com a equipe

Perguntar qual colaboradora é realmente a "Karol" que vende no Tiny.

---

## 📝 QUERY COMPLETA PARA GERAR COMANDOS

Execute a **Query 4** do arquivo `CORRIGIR_DUPLICADOS_TINY_ID.sql` para gerar automaticamente os comandos UPDATE necessários.

---

**Recomendação:** Remover o ID duplicado de **uma** das colaboradoras (a que tiver menos pedidos matchados ou que não for a "Karol" correta) e depois mapear novamente baseado no nome ou CPF.

