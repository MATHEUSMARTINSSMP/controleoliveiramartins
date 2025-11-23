-- Script SQL para vincular todas as 3 lojas ao admin do sistema
-- Execute este script no Supabase SQL Editor

-- ============================================
-- VINCULAR TODAS AS LOJAS AO ADMIN
-- ============================================

UPDATE sistemaretiradas.stores
SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'  -- ID do Administrador Sistema
WHERE name IN ('Mr. Kitsch', 'Loungerie', 'Sacada | Oh, Boy')
  AND (admin_id IS NULL OR admin_id != '7391610a-f83b-4727-875f-81299b8bfa68');

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se todas as lojas foram vinculadas corretamente
SELECT 
  s.id,
  s.name as store_name,
  s.admin_id,
  p.name as admin_name,
  p.email as admin_email,
  CASE 
    WHEN s.admin_id IS NOT NULL THEN '✅ Vinculada'
    ELSE '❌ Não vinculada'
  END as status
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.active = true
ORDER BY s.name;

-- Resultado esperado:
-- Todas as 3 lojas devem ter:
-- - admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
-- - admin_name = 'Administrador Sistema'
-- - admin_email = 'matheusmartinss@icloud.com'
-- - status = '✅ Vinculada'

