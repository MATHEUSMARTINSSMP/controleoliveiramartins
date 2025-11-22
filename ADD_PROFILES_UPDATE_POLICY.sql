-- Adicionar política RLS para ADMIN poder fazer UPDATE na tabela profiles
-- Isso permitirá que ADMINs desativem/ativem colaboradoras e lojas

-- 1. Verificar se já existe política de UPDATE para ADMIN
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
  AND cmd = 'UPDATE'
  AND policyname LIKE '%ADMIN%';

-- 2. Criar função auxiliar para verificar se o usuário é ADMIN (se não existir)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Dropar políticas de UPDATE existentes (se houver conflito)
DROP POLICY IF EXISTS "ADMIN can update all profiles" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "ADMIN can update profiles" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON sistemaretiradas.profiles;

-- 4. Criar política para ADMIN poder fazer UPDATE em todos os profiles
CREATE POLICY "ADMIN can update all profiles"
ON sistemaretiradas.profiles
FOR UPDATE
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- 5. Criar política para usuários poderem atualizar seu próprio perfil (exceto role e alguns campos críticos)
CREATE POLICY "Users can update own profile"
ON sistemaretiradas.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND (
        -- Usuário pode atualizar seu próprio perfil, mas não pode:
        -- - Mudar o role
        -- - Mudar o active (apenas ADMIN pode)
        -- - Mudar o id
        (SELECT role FROM sistemaretiradas.profiles WHERE id = auth.uid()) = role
        AND (SELECT active FROM sistemaretiradas.profiles WHERE id = auth.uid()) = active
    )
);

-- 6. Verificar se as políticas foram criadas corretamente
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
  AND cmd = 'UPDATE';

-- 7. Teste manual (descomente para testar):
-- UPDATE sistemaretiradas.profiles SET active = false WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9' RETURNING *;

