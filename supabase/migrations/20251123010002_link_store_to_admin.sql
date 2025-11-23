-- Migration: Vincular lojas existentes ao admin
-- Descrição: Atualiza as lojas existentes para vincular ao admin do sistema
-- Data: 2025-11-23

-- ============================================
-- 1. VINCULAR LOJA "Mr. Kitsch" AO ADMIN
-- ============================================

-- Vincular a loja "Mr. Kitsch" ao admin existente
UPDATE sistemaretiradas.stores
SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'  -- ID do Administrador Sistema
WHERE name = 'Mr. Kitsch' 
  AND admin_id IS NULL;

-- ============================================
-- 2. VINCULAR OUTRAS LOJAS (OPCIONAL)
-- ============================================

-- Se quiser vincular outras lojas ao mesmo admin, descomente e ajuste:
-- UPDATE sistemaretiradas.stores
-- SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
-- WHERE name IN ('Loungerie', 'Sacada | Oh, Boy')
--   AND admin_id IS NULL;

-- ============================================
-- 3. VERIFICAÇÃO
-- ============================================

-- Verificar se as lojas foram vinculadas corretamente
SELECT 
  s.id,
  s.name as store_name,
  s.admin_id,
  p.name as admin_name,
  p.email as admin_email
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.active = true
ORDER BY s.name;

