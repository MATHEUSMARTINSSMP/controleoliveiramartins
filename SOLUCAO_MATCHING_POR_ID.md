# ✅ SOLUÇÃO: Matching por ID do Tiny (vendedor_tiny_id)

## 🎯 PROBLEMA IDENTIFICADO

**1216 pedidos sem match** porque:
- ❌ CPF não está disponível na API do Tiny (`/vendedores/{id}` não retorna CPF)
- ❌ Email pode não estar cadastrado
- ⚠️ Nome só funciona se for exatamente igual

**Resultado:** Apenas 1 match (Yasmim Bruna Mendes Castro - nome completo)

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Adicionar Matching por `tiny_vendedor_id`

**Por que funciona:**
- ✅ ID do Tiny é único por vendedor
- ✅ Não muda mesmo se nome ou outros dados mudarem
- ✅ Já está sendo salvo nos pedidos (`vendedor_tiny_id`)
- ✅ Muito mais confiável que nome

---

## 🔄 NOVA HIERARQUIA DE MATCHING

### Ordem de Prioridade:

```
1. ✅ CPF (mais confiável - identificador único da pessoa)
   ↓
2. ✅ tiny_vendedor_id (NOVO - ID do Tiny - confiável e único)
   ↓
3. ✅ Email (geralmente único)
   ↓
4. ⚠️ Nome normalizado (menos confiável)
```

---

## 📋 COMO FUNCIONA AGORA

### Fluxo Completo:

```
1. Pedido chega do Tiny com vendedor
   ↓
2. Busca dados completos do vendedor no Tiny (se tiver ID)
   ↓
3. Busca colaboradoras da loja no Supabase
   ↓
4. Tenta match por CPF (se disponível)
   ↓
5. ✅ NOVO: Tenta match por tiny_vendedor_id
   ↓
6. Tenta match por Email
   ↓
7. Tenta match por Nome (normalizado)
   ↓
8. Retorna colaboradora_id ou NULL
```

---

## 🔧 O QUE FOI IMPLEMENTADO

### 1. Migration (`20250131000008_add_tiny_vendedor_id_to_profiles.sql`)
   - Adiciona coluna `tiny_vendedor_id` em `profiles`
   - Cria índice para busca rápida

### 2. Função de Matching Atualizada
   - Adiciona matching por `tiny_vendedor_id` como prioridade 2
   - Logs detalhados para debugging

---

## 📝 COMO USAR

### Para fazer matching funcionar:

1. **Cadastrar ID do Tiny na colaboradora:**
   ```sql
   UPDATE sistemaretiradas.profiles
   SET tiny_vendedor_id = '908189863'
   WHERE name = 'Karol'
     AND role = 'COLABORADORA'
     AND store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';
   ```

2. **Ou usar interface (se criada):**
   - Editar colaboradora
   - Adicionar campo "ID do Vendedor no Tiny"
   - Informar o `vendedor_tiny_id`

---

## 🔍 Mapear Colaboradoras com Vendedores

### Query para ver IDs dos vendedores:

```sql
-- Ver vendedores únicos do Tiny e seus IDs
SELECT DISTINCT
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    s.name as loja,
    COUNT(*) as total_pedidos
FROM sistemaretiradas.tiny_orders ped
JOIN sistemaretiradas.stores s ON ped.store_id = s.id
WHERE ped.vendedor_nome IS NOT NULL
GROUP BY ped.vendedor_nome, ped.vendedor_tiny_id, s.name
ORDER BY loja, total_pedidos DESC;
```

### Query para atualizar colaboradoras:

```sql
-- Exemplo: Atualizar Karol
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '908189863'
WHERE name ILIKE '%karol%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1);

-- Exemplo: Atualizar Emilly Souza
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '942469081'
WHERE name ILIKE '%emilly%' AND name ILIKE '%souza%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1);

-- Exemplo: Atualizar Yasmim Bruna
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '927712006'
WHERE name ILIKE '%yasmim%' AND name ILIKE '%bruna%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1);

-- Exemplo: Atualizar Lainy
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '944659469'
WHERE name ILIKE '%lainy%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1);
```

---

## ✅ VANTAGENS

1. ✅ **Confiável:** ID do Tiny é único e não muda
2. ✅ **Automático:** Funciona sem precisar de CPF
3. ✅ **Rápido:** Índice no banco para busca eficiente
4. ✅ **Rastreável:** Logs mostram qual método deu match

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Executar migration `20250131000008_add_tiny_vendedor_id_to_profiles.sql`
2. ✅ Mapear colaboradoras com seus IDs do Tiny
3. ✅ Testar com novos pedidos
4. ✅ (Opcional) Reprocessar pedidos antigos

---

**Status:** ✅ **IMPLEMENTADO E PRONTO PARA USO**

