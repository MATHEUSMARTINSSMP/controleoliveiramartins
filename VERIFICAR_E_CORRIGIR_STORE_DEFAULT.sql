-- Script para verificar e corrigir store_default dos perfis LOJA
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR PERFIS LOJA COM store_default INVÁLIDO
-- ============================================

-- Verificar perfis LOJA que têm store_default como texto (não UUID)
SELECT 
  p.id,
  p.name,
  p.email,
  p.role,
  p.store_default,
  CASE 
    WHEN p.store_default::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN '✅ UUID válido'
    ELSE '❌ NÃO é UUID (provavelmente nome da loja)'
  END as store_default_status,
  s.id as store_id_from_name,
  s.name as store_name
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON s.name = p.store_default::text
WHERE p.role = 'LOJA'
ORDER BY p.name;

-- ============================================
-- 2. CORRIGIR store_default DOS PERFIS LOJA
-- ============================================

-- Atualizar perfis LOJA que têm store_default como nome de loja
-- Substituir pelo UUID correto da loja
UPDATE sistemaretiradas.profiles p
SET store_default = s.id::text
FROM sistemaretiradas.stores s
WHERE p.role = 'LOJA'
  AND p.store_default IS NOT NULL
  -- Verificar se store_default NÃO é UUID válido
  AND NOT (p.store_default::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  -- Fazer match pelo nome da loja
  AND s.name = p.store_default::text
  AND s.active = true;

-- ============================================
-- 3. VERIFICAR SE FOI CORRIGIDO
-- ============================================

-- Verificar novamente após correção
SELECT 
  p.id,
  p.name,
  p.email,
  p.role,
  p.store_default,
  CASE 
    WHEN p.store_default::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN '✅ UUID válido'
    ELSE '❌ AINDA NÃO é UUID'
  END as store_default_status,
  s.name as store_name,
  s.admin_id as store_admin_id
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON s.id::text = p.store_default::text
WHERE p.role = 'LOJA'
ORDER BY p.name;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- ✅ Este script corrige perfis LOJA que têm store_default como nome de loja
-- ✅ Substitui pelo UUID correto da loja
-- ✅ Após a correção, a política RLS deve funcionar corretamente
-- ✅ Se algum perfil LOJA não tiver store_default, ele não será atualizado
-- ✅ Verifique manualmente se todos os perfis LOJA foram corrigidos

