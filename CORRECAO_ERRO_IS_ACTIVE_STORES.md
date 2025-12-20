# Correção: Erro 42703 - Coluna `is_active` não existe na tabela `stores`

## 🐛 Problema

Erro ao buscar lojas:
```
GET /rest/v1/stores?select=id,name&is_active=eq.true
Status: 400
Error: 42703 (undefined_column)
```

A coluna `is_active` **não existe** na tabela `stores`. A coluna correta é `active`.

## ✅ Solução

A tabela `stores` usa a coluna `active` (BOOLEAN), não `is_active`.

### Query Correta:
```typescript
const { data, error } = await supabase
  .schema('sistemaretiradas')
  .from('stores')
  .select('id, name')
  .eq('active', true)  // ✅ CORRETO: usar 'active'
  .order('name');
```

### Query Incorreta (causa o erro):
```typescript
const { data, error } = await supabase
  .schema('sistemaretiradas')
  .from('stores')
  .select('id, name')
  .eq('is_active', true)  // ❌ INCORRETO: 'is_active' não existe
  .order('name');
```

## 📋 Verificação

Execute esta query SQL para confirmar:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'stores'
  AND column_name LIKE '%active%';
```

Resultado esperado:
- `active` (BOOLEAN) ✅
- `is_active` ❌ (não deve existir)

## 🔍 Onde Corrigir

Procure no código por:
- `.eq('is_active', true)` em queries de `stores`
- Filtros com `is_active` na URL de `stores`
- Interfaces TypeScript que definem `is_active` para `Store`

**Nota:** A tabela `profiles` usa `is_active`, mas a tabela `stores` usa `active`.

