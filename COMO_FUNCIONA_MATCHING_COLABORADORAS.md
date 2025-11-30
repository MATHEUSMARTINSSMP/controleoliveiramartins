# 🔍 COMO FUNCIONA O MATCHING DE COLABORADORAS

## 📋 RESUMO

O sistema **NÃO usa IDs do Tiny ERP** para fazer matching. Em vez disso, usa uma **hierarquia de critérios** baseada em dados confiáveis:

1. ✅ **CPF** (mais confiável) - Prioridade 1
2. ✅ **Email** - Prioridade 2  
3. ⚠️ **Nome** (normalizado) - Prioridade 3

---

## 🔄 COMO FUNCIONA

### Função: `findCollaboratorByVendedor()`

Localização: `netlify/functions/sync-tiny-orders-background.js` (linha 1793)

### Processo de Matching:

```
1. Pedido chega do Tiny ERP com vendedor
   ↓
2. Se vendedor tem ID mas não tem CPF, busca dados completos no Tiny
   ↓
3. Busca TODAS colaboradoras da loja no Supabase
   ↓
4. Tenta matching por CPF (PRIMEIRO)
   ↓
5. Se não encontrar, tenta por Email (SEGUNDO)
   ↓
6. Se não encontrar, tenta por Nome normalizado (TERCEIRO)
   ↓
7. Retorna colaboradora_id encontrada ou NULL
```

---

## 🎯 CRITÉRIOS DE MATCHING

### 1. ✅ **CPF** (MAIS CONFIÁVEL - Prioridade 1)

**Por quê?**
- CPF é único por pessoa
- Não muda mesmo se nome ou email mudarem
- 100% confiável

**Como funciona:**
```javascript
// Normaliza CPF (remove formatação)
normalizeCPF("123.456.789-00") → "12345678900"

// Compara CPFs normalizados
if (colabCPF === vendedorCPF) {
    return colaboradora_id; // ✅ MATCH!
}
```

**Exemplo:**
- Tiny: CPF `123.456.789-00`
- Supabase: CPF `12345678900`
- ✅ **MATCH!** (normalização remove pontos e traços)

---

### 2. ✅ **Email** (Prioridade 2)

**Por quê?**
- Email geralmente é único
- Raramente muda
- Boa confiabilidade

**Como funciona:**
```javascript
// Compara emails (case insensitive)
if (colab.email.toLowerCase() === vendedor.email.toLowerCase()) {
    return colaboradora_id; // ✅ MATCH!
}
```

**Exemplo:**
- Tiny: `MARIA@EMAIL.COM`
- Supabase: `maria@email.com`
- ✅ **MATCH!** (case insensitive)

---

### 3. ⚠️ **Nome** (MENOS CONFIÁVEL - Prioridade 3)

**Por quê?**
- Nome pode ter variações
- Pode haver duplicatas
- Último recurso

**Como funciona:**
```javascript
// Normaliza nome (remove acentos, lowercase, trim)
normalizeName("MARIA DA SILVA") → "maria da silva"
normalizeName("Maria da Silva") → "maria da silva"

// Compara nomes normalizados (EXATO)
if (normalizedColabNome === normalizedVendedorNome) {
    return colaboradora_id; // ✅ MATCH!
}
```

**Exemplo:**
- Tiny: `MARIA DA SILVA`
- Supabase: `Maria da Silva`
- ✅ **MATCH!** (normalização remove case e acentos)

---

## 🔍 POR QUE NÃO USA ID DO TINY?

**Problema:**
- O Tiny ERP pode ter IDs internos diferentes
- IDs podem mudar se dados forem importados/exportados
- IDs não são portáteis entre sistemas

**Solução:**
- Usar **CPF** (identificador único da pessoa)
- Usar **Email** (identificador único do usuário)
- Usar **Nome** apenas como fallback

---

## ✅ VANTAGENS DO SISTEMA ATUAL

1. ✅ **Confiável:** CPF é único e não muda
2. ✅ **Portável:** Funciona mesmo se IDs mudarem
3. ✅ **Flexível:** Funciona com múltiplos critérios
4. ✅ **Resiliente:** Fallback para nome se CPF/Email não existirem

---

## ⚠️ LIMITAÇÕES

1. ⚠️ **Nome pode falhar:** Se houver duas pessoas com mesmo nome
2. ⚠️ **Depende de dados:** Precisa ter CPF ou Email cadastrado
3. ⚠️ **Case-sensitive no nome:** Normalização ajuda, mas variações podem falhar

---

## 🔧 COMO VERIFICAR SE ESTÁ CORRETO

### Query SQL para Verificar Matches:

```sql
-- Ver todas colaboradoras e seus dados para matching
SELECT 
    p.id as colaboradora_id,
    p.name as nome_supabase,
    p.email as email_supabase,
    p.cpf as cpf_supabase,
    s.name as loja
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
ORDER BY s.name, p.name;
```

### Verificar Pedidos e Vendedores:

```sql
-- Ver pedidos e vendedores do Tiny
SELECT 
    to.id as pedido_id,
    to.numero_pedido,
    to.vendedor_nome,
    to.vendedor_tiny_id,
    to.colaboradora_id,
    p.name as colaboradora_match,
    p.cpf as colaboradora_cpf,
    s.name as loja
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.profiles p ON to.colaboradora_id = p.id
LEFT JOIN sistemaretiradas.stores s ON to.store_id = s.id
WHERE to.vendedor_nome IS NOT NULL
ORDER BY to.created_at DESC
LIMIT 50;
```

### Verificar Matches Corretos/Incorretos:

```sql
-- Pedidos COM colaboradora match
SELECT 
    COUNT(*) as total_com_match,
    COUNT(DISTINCT colaboradora_id) as colaboradoras_unicas
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NOT NULL;

-- Pedidos SEM colaboradora match
SELECT 
    COUNT(*) as total_sem_match,
    vendedor_nome,
    vendedor_tiny_id
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NULL
  AND vendedor_nome IS NOT NULL
GROUP BY vendedor_nome, vendedor_tiny_id
ORDER BY COUNT(*) DESC;
```

---

## 🔧 COMO MELHORAR O MATCHING

### Se o Matching Não Estiver Funcionando:

1. **Verificar CPF:**
   - Tiny ERP: CPF do vendedor está cadastrado?
   - Supabase: CPF da colaboradora está cadastrado?
   - Os CPFs são iguais? (sem formatação)

2. **Verificar Email:**
   - Tiny ERP: Email do vendedor está cadastrado?
   - Supabase: Email da colaboradora está cadastrado?
   - Os emails são iguais? (case insensitive)

3. **Verificar Nome:**
   - Tiny ERP: Nome do vendedor
   - Supabase: Nome da colaboradora
   - São exatamente iguais após normalização?

---

## 💡 RECOMENDAÇÃO

**Para matching mais confiável:**

1. ✅ **Cadastrar CPF** na colaboradora do Supabase
2. ✅ **Cadastrar CPF** no vendedor do Tiny ERP
3. ✅ Garantir que sejam **exatamente iguais** (apenas dígitos)

**CPF é 100% confiável** - muito melhor que nome!

---

**Data:** 2025-01-31
**Função:** `findCollaboratorByVendedor()` em `sync-tiny-orders-background.js`

