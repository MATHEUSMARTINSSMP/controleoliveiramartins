# 🔍 Como Identificar Qual ID do Tiny Corresponde a Qual Colaboradora?

## 📋 ESTRATÉGIAS PARA IDENTIFICAR

### 1. ✅ **Por Nome (Mais Simples)**

**Use a Query 1 do arquivo `IDENTIFICAR_MATCH_COLABORADORAS.sql`**

Ela compara nomes e mostra:
- ✅ **Match Exato** - Alta confiança (nomes iguais após normalização)
- ⚠️ **Match Parcial** - Verificar manualmente (um nome contém o outro)
- ⚠️ **Primeiro Nome Igual** - Verificar (pode ser pessoa diferente)

**Exemplo:**
- Colaboradora: "Yasmim Bruna Mendes Castro"
- Vendedor Tiny: "Yasmim Bruna"
- **Resultado:** ⚠️ Match Parcial - Verificar

---

### 2. ✅ **Por Histórico de Pedidos (Mais Confiável)**

**Use a Query 2 do arquivo `IDENTIFICAR_MATCH_COLABORADORAS.sql`**

Se algum pedido **já teve match por nome**, podemos usar o ID do vendedor desse pedido.

**Exemplo:**
- Se pedido #1410 já foi matchado com colaboradora "Karol"
- E o vendedor desse pedido tem ID `908189863`
- **Então:** Colaboradora "Karol" deve ter `tiny_vendedor_id = '908189863'`

---

### 3. ✅ **Comparação Manual (Recomendado)**

**Passo a passo:**

1. **Listar colaboradoras:**
   ```sql
   SELECT name, cpf, email, tiny_vendedor_id
   FROM sistemaretiradas.profiles
   WHERE role = 'COLABORADORA' AND active = true
   ORDER BY name;
   ```

2. **Listar vendedores do Tiny:**
   ```sql
   SELECT DISTINCT vendedor_nome, vendedor_tiny_id
   FROM sistemaretiradas.tiny_orders
   WHERE vendedor_nome IS NOT NULL
   ORDER BY vendedor_nome;
   ```

3. **Comparar manualmente:**
   - Ver se nomes são similares
   - Verificar se já houve match em pedidos anteriores
   - Confirmar com a equipe

4. **Atualizar:**
   ```sql
   UPDATE sistemaretiradas.profiles
   SET tiny_vendedor_id = '908189863'
   WHERE name = 'Karol'
     AND role = 'COLABORADORA';
   ```

---

## 🎯 QUERY RECOMENDADA PARA COMEÇAR

Execute esta query primeiro para ver matches sugeridos:

```sql
-- Ver matches sugeridos baseado em nomes
WITH colaboradoras AS (
    SELECT 
        p.id,
        p.name as nome_colaboradora,
        p.cpf,
        p.tiny_vendedor_id as id_tiny_atual,
        s.name as loja
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON p.store_id = s.id
    WHERE p.role = 'COLABORADORA' AND p.active = true
),
vendedores_tiny AS (
    SELECT DISTINCT
        ped.vendedor_nome,
        ped.vendedor_tiny_id,
        ped.store_id
    FROM sistemaretiradas.tiny_orders ped
    WHERE ped.vendedor_nome IS NOT NULL
)
SELECT 
    c.nome_colaboradora,
    c.id_tiny_atual,
    v.vendedor_nome,
    v.vendedor_tiny_id as id_tiny_sugerido,
    CASE 
        WHEN LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) = 
             LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) 
        THEN '✅ MATCH EXATO'
        WHEN LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) LIKE 
             '%' || LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
        THEN '⚠️ MATCH PARCIAL'
        ELSE '❌ DIFERENTE'
    END as confianca
FROM colaboradoras c
CROSS JOIN vendedores_tiny v
WHERE c.store_id = v.store_id
  AND (
      LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) = 
      LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g'))
      OR
      LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) LIKE 
      '%' || LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
  )
ORDER BY confianca, c.nome_colaboradora;
```

---

## 📊 EXEMPLO PRÁTICO

### Cenário: Mapear "Karol"

1. **Ver colaboradora:**
   ```sql
   SELECT name, cpf, email FROM sistemaretiradas.profiles
   WHERE name ILIKE '%karol%' AND role = 'COLABORADORA';
   ```
   Resultado: `name = 'Karol'`

2. **Ver vendedores do Tiny com nome similar:**
   ```sql
   SELECT DISTINCT vendedor_nome, vendedor_tiny_id
   FROM sistemaretiradas.tiny_orders
   WHERE vendedor_nome ILIKE '%karol%';
   ```
   Resultado: `vendedor_nome = 'Karol'`, `vendedor_tiny_id = '908189863'`

3. **Verificar se já houve match:**
   ```sql
   SELECT COUNT(*) as total_pedidos
   FROM sistemaretiradas.tiny_orders
   WHERE vendedor_nome = 'Karol'
     AND colaboradora_id = (SELECT id FROM sistemaretiradas.profiles WHERE name = 'Karol' LIMIT 1);
   ```
   Se `total_pedidos > 0`, confirma que é a mesma pessoa.

4. **Atualizar:**
   ```sql
   UPDATE sistemaretiradas.profiles
   SET tiny_vendedor_id = '908189863'
   WHERE name = 'Karol' AND role = 'COLABORADORA';
   ```

---

## ✅ CHECKLIST PARA MAPEAR

- [ ] Executar query de matches sugeridos
- [ ] Verificar matches exatos (alta confiança)
- [ ] Verificar matches parciais (confirmar manualmente)
- [ ] Verificar histórico de pedidos já matchados
- [ ] Confirmar com a equipe se necessário
- [ ] Atualizar `tiny_vendedor_id` nas colaboradoras
- [ ] Testar com novos pedidos

---

## 🚀 AUTOMAÇÃO FUTURA

**Ideia:** Criar interface no Admin para:
1. Listar colaboradoras sem `tiny_vendedor_id`
2. Mostrar vendedores do Tiny com nomes similares
3. Permitir mapear com 1 clique
4. Mostrar confiança do match

**Quer que eu implemente essa interface?**

