# Guia: Políticas RLS com Enum - Boas Práticas

## ⚠️ Regra Crítica: Separação de Scripts

**IMPORTANTE:** Quando uma política RLS precisa usar um novo valor de enum, os scripts DEVEM ser separados em partes distintas.

### Por quê?

O PostgreSQL não permite usar um novo valor de enum na mesma transação em que ele foi adicionado. O erro típico é:

```
ERROR: 55P04: unsafe use of new value "VALOR" of enum type nome_enum
HINT: New enum values must be committed before they can be used.
```

## 📋 Estrutura Padrão para Scripts com Enum

### **PARTE 1: Adicionar Valor ao Enum**
- Descobrir o enum correto (schema + nome)
- Verificar se o valor já existe
- Adicionar o valor se não existir
- **FAZER COMMIT** (ou aguardar commit automático)

### **PARTE 2: Criar Política RLS**
- Remover política antiga (se existir)
- Criar política usando o novo valor do enum
- Verificar política criada

## 🔧 Padrão de Separação

### Quando separar:

1. **SEMPRE separar quando:**
   - Adicionar novo valor a enum
   - Criar política RLS que usa esse valor
   - Criar constraint CHECK que usa esse valor
   - Criar função que retorna esse valor

2. **NÃO precisa separar quando:**
   - Apenas criar políticas (sem alterar enum)
   - Apenas adicionar valores a enum (sem usar imediatamente)
   - Trabalhar com valores de enum já existentes

## 📝 Template de Scripts Separados

### PARTE1_ADICIONAR_ENUM_[VALOR].sql
```sql
-- Descobrir enum
DO $$
DECLARE
  v_enum_schema TEXT;
  v_enum_name TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Buscar enum da coluna
  SELECT udt_schema, udt_name
  INTO v_enum_schema, v_enum_name
  FROM information_schema.columns
  WHERE table_schema = 'sistemaretiradas'
    AND table_name = 'nome_tabela'
    AND column_name = 'nome_coluna';
  
  -- Verificar se valor existe
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = v_enum_schema
      AND t.typname = v_enum_name
      AND e.enumlabel = 'NOVO_VALOR'
  ) INTO v_exists;
  
  -- Adicionar se não existir
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', 
      v_enum_schema, v_enum_name, 'NOVO_VALOR');
  END IF;
END $$;
```

### PARTE2_CRIAR_POLITICA_RLS_[NOME].sql
```sql
-- Criar política usando o novo valor
DROP POLICY IF EXISTS "nome_politica" ON nome_tabela;

CREATE POLICY "nome_politica"
ON nome_tabela
FOR UPDATE
USING (
  -- condições
  AND status = 'NOVO_VALOR'  -- usando o valor adicionado na Parte 1
)
WITH CHECK (
  -- condições
);
```

## ✅ Checklist Antes de Criar Scripts

- [ ] Identifiquei se preciso adicionar valor a enum?
- [ ] Se sim, criei PARTE1 para adicionar o enum?
- [ ] Se sim, criei PARTE2 para usar o enum?
- [ ] Adicionei instruções claras de execução?
- [ ] Documentei a necessidade de commit entre partes?

## 🎯 Exemplos de Casos que Precisam Separação

### ✅ Caso 1: Adicionar CANCELADO e criar política
- **PARTE 1:** Adicionar "CANCELADO" ao enum status_adiantamento
- **PARTE 2:** Criar política que permite mudar para "CANCELADO"

### ✅ Caso 2: Adicionar novo status e constraint
- **PARTE 1:** Adicionar "ARQUIVADO" ao enum status_venda
- **PARTE 2:** Criar constraint CHECK que permite "ARQUIVADO"

### ❌ Caso 3: Apenas criar política (não precisa separar)
- Criar política que usa valores de enum já existentes
- Não precisa separar, pode fazer tudo em um script

## 📚 Referências

- PostgreSQL Documentation: [ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html)
- Erro comum: `55P04: unsafe use of new value`
- Solução: Separar em transações distintas com COMMIT entre elas

