-- ============================================
-- CORRIGIR TRIGGER handle_new_user
-- ============================================
-- Este script verifica e corrige o trigger para garantir
-- que novos usuários sejam criados no schema correto
-- ============================================

-- Verificar a função atual
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- ============================================
-- CORRIGIR FUNÇÃO handle_new_user
-- ============================================
-- Atualizar para usar o schema correto
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "sacadaohboy-mrkitsch-loungerie".profiles (id, name, email, role, active, limite_total, limite_mensal, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'COLABORADORA'),
    true,
    1000.00,
    800.00,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- VERIFICAR TRIGGER
-- ============================================

-- Verificar se o trigger existe
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Recriar trigger se necessário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Verificar função atualizada
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Verificar trigger
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ============================================
-- FIM
-- ============================================

