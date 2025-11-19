-- Script para corrigir a função is_admin
-- Este script cria a função is_admin no schema correto (sistemaretiradas)
-- e garante que ela consulte a tabela correta (sistemaretiradas.profiles)

-- 1. Criar a função no schema sistemaretiradas
CREATE OR REPLACE FUNCTION "sistemaretiradas".is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
  -- Verifica se o usuário atual tem a role 'ADMIN' na tabela profiles do schema sistemaretiradas
  RETURN EXISTS (
    SELECT 1
    FROM "sistemaretiradas".profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  );
END;
$$;

-- 2. Dar permissão de execução para todos os usuários autenticados
GRANT EXECUTE ON FUNCTION "sistemaretiradas".is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION "sistemaretiradas".is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION "sistemaretiradas".is_admin() TO anon;

-- 3. (Opcional) Remover a função antiga do schema public para evitar confusão
-- DROP FUNCTION IF EXISTS public.is_admin();
