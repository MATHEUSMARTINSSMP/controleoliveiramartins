-- ============================================
-- VERIFICAR E CORRIGIR TRIGGER handle_new_user
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new
-- ============================================

-- 1. VERIFICAR SE O TRIGGER EXISTE
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. VERIFICAR A FUNÇÃO ATUAL
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- ============================================
-- 3. CRIAR/ATUALIZAR FUNÇÃO handle_new_user
-- ============================================
-- Esta função cria o profile no schema correto quando um novo usuário é criado
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir profile no schema correto
  INSERT INTO "sacadaohboy-mrkitsch-loungerie".profiles (
    id, 
    name, 
    email, 
    role, 
    active, 
    limite_total, 
    limite_mensal, 
    created_at, 
    updated_at
  )
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
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, "sacadaohboy-mrkitsch-loungerie".profiles.name),
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 4. CRIAR/RECRIAR TRIGGER
-- ============================================

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger novo
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. VERIFICAR SE FUNCIONOU
-- ============================================

-- Verificar trigger criado
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Verificar função atualizada
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- ============================================
-- 6. TESTE: Verificar profiles existentes
-- ============================================

SELECT 
  id,
  name,
  email,
  role,
  active,
  limite_total,
  limite_mensal,
  created_at
FROM "sacadaohboy-mrkitsch-loungerie".profiles
ORDER BY created_at DESC
LIMIT 10;

