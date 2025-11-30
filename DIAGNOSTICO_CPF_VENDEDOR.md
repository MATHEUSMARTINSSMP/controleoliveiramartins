# 🔍 DIAGNÓSTICO: Por Que CPF Não Está Funcionando?

## 📊 SITUAÇÃO ATUAL

- ✅ **1 pedido com match** (Yasmim Bruna Mendes Castro - nome completo)
- ❌ **1216 pedidos sem match**
- ⚠️ Vendedores sem match: Karol, Emilly Souza, Yasmim Bruna, Lainy, etc.

---

## 🔍 POR QUE CPF NÃO FUNCIONA?

### Problema Principal:

A API do Tiny ERP pode **NÃO retornar CPF** no endpoint `/vendedores/{id}`.

**Fluxo atual:**
```
1. Pedido chega com vendedor.id
2. Sistema busca `/vendedores/{id}` no Tiny
3. Tiny pode não retornar CPF
4. Sistema tenta match por CPF → FALHA (não tem CPF)
5. Tenta por Email → FALHA (pode não ter)
6. Tenta por Nome → FUNCIONA (se nome for exato)
```

---

## 💡 SOLUÇÃO PROPOSTA

### Adicionar Matching por `vendedor_tiny_id`

O `vendedor_tiny_id` é **confiável** porque:
- ✅ É único por vendedor no Tiny
- ✅ Não muda (mesmo que nome mude)
- ✅ Já está sendo salvo nos pedidos

**Estratégia:**
1. Criar campo `tiny_vendedor_id` na tabela `profiles`
2. Cadastrar ID do Tiny na colaboradora
3. Fazer matching por ID do Tiny (prioridade 1.5 - entre CPF e Email)

---

## 🔧 QUERIES PARA VERIFICAR

### 1. Ver colaboradoras e seus CPFs:

```sql
SELECT 
    p.id,
    p.name,
    p.cpf,
    p.email,
    s.name as loja
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
ORDER BY s.name, p.name;
```

### 2. Ver vendedores do Tiny e seus dados:

```sql
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

### 3. Verificar se API retorna CPF:

Precisa testar chamando a API do Tiny diretamente para ver o que ela retorna.

---

## ✅ RECOMENDAÇÕES

### Solução Imediata:
1. ✅ **Cadastrar CPF** nas colaboradoras no Supabase
2. ✅ **Cadastrar CPF** nos vendedores no Tiny ERP
3. ✅ Garantir que CPFs sejam iguais

### Solução Alternativa (Recomendada):
1. 🔧 **Adicionar campo `tiny_vendedor_id`** em `profiles`
2. 🔧 **Cadastrar ID do Tiny** na colaboradora
3. 🔧 **Fazer matching por ID** (mais confiável que nome)

---

**Próximo passo:** Implementar matching por `vendedor_tiny_id`?

