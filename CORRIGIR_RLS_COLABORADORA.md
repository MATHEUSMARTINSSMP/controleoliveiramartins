# 🔧 CORRIGIR RLS PARA COLABORADORAS REGISTRAREM PONTO

## ❌ Problema
Colaboradora não consegue registrar ponto - erro: "new row violates row-level security policy for table 'time_clock_records'"

## ✅ Solução

### 1. Executar a migração de correção

Execute no SQL Editor do Supabase:

```sql
-- Arquivo: supabase/migrations/20251210000046_fix_time_clock_records_insert_colaboradora.sql
```

Ou execute diretamente:

```sql
-- Habilitar RLS
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas conflitantes
DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;

-- Criar política correta
CREATE POLICY "colaboradora_insert_records" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (
    colaboradora_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'COLABORADORA'
          AND is_active = true
    )
);
```

### 2. Corrigir política de time_clock_hours_balance

Execute também:

```sql
-- Arquivo: supabase/migrations/20251210000042_fix_time_clock_hours_balance_rls.sql
```

Ou execute diretamente a parte da política de colaboradora:

```sql
-- Remover política antiga
DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_read" ON sistemaretiradas.time_clock_hours_balance;

-- Criar política simplificada
CREATE POLICY "time_clock_hours_balance_colaboradora_read"
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (
    -- Colaboradora pode ver seu próprio saldo
    (colaboradora_id = auth.uid() AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'COLABORADORA'
          AND is_active = true
    ))
    OR
    -- LOJA pode ver saldos das colaboradoras da sua loja
    (EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p_loja
        WHERE p_loja.id = auth.uid()
          AND p_loja.role = 'LOJA'
          AND p_loja.is_active = true
          AND time_clock_hours_balance.store_id = p_loja.store_id
    ))
    OR
    -- Admin pode ver saldos da sua loja
    (EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
          AND id IN (
              SELECT admin_id FROM sistemaretiradas.stores WHERE id = time_clock_hours_balance.store_id
          )
    ))
);
```

### 3. Verificar se a colaboradora está correta

Execute para verificar:

```sql
SELECT 
    id,
    name,
    email,
    role,
    is_active,
    store_id,
    store_default
FROM sistemaretiradas.profiles
WHERE id = '7835bdec-1cfa-44c4-a3a4-1e7b682a5ef5';  -- ID da Fernanda
```

Deve retornar:
- `role = 'COLABORADORA'`
- `is_active = true`
- `store_id` ou `store_default` preenchido

### 4. Testar novamente

Após executar as migrações:
1. Faça logout e login novamente como colaboradora
2. Tente registrar um ponto
3. Verifique se o erro desapareceu

## 🔍 Verificar Políticas

Execute o script `VERIFICAR_RLS_COLABORADORA.sql` para verificar todas as políticas:

```sql
-- Ver políticas de time_clock_records
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_records'
ORDER BY policyname;
```

## 📝 Notas

- A política `colaboradora_insert_records` verifica:
  1. Que `colaboradora_id = auth.uid()` (o registro pertence ao usuário)
  2. Que o usuário é uma colaboradora ativa (`role = 'COLABORADORA'` e `is_active = true`)

- Se ainda houver erro, verifique:
  1. Se o `store_id` no INSERT corresponde à loja da colaboradora
  2. Se a colaboradora está realmente ativa no banco
  3. Se não há outras políticas conflitantes

