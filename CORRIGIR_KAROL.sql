-- ============================================================================
-- SCRIPT: Corrigir ID Duplicado da "Karol"
-- Descrição: Remover tiny_vendedor_id de Karolainy (errada) e manter em Karolayne (correta)
-- ============================================================================

-- ============================================================================
-- VERIFICAR ANTES (antes de executar o UPDATE)
-- ============================================================================

SELECT 
    name as colaboradora,
    tiny_vendedor_id,
    cpf,
    email
FROM sistemaretiradas.profiles
WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
  AND role = 'COLABORADORA'
ORDER BY name;

-- ============================================================================
-- CORRIGIR: Remover ID de Karolainy (manter apenas em Karolayne)
-- ============================================================================

UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = NULL
WHERE name = 'Karolainy Barbosa Tavares'
  AND role = 'COLABORADORA'
RETURNING id, name, tiny_vendedor_id;

-- ============================================================================
-- VERIFICAR DEPOIS (confirmar que ficou correto)
-- ============================================================================

SELECT 
    name as colaboradora,
    tiny_vendedor_id,
    cpf,
    email,
    CASE 
        WHEN name = 'Karolayne Rodrigues Araújo' AND tiny_vendedor_id = '908189863' THEN '✅ CORRETO'
        WHEN name = 'Karolainy Barbosa Tavares' AND tiny_vendedor_id IS NULL THEN '✅ CORRETO (ID removido)'
        ELSE '❌ VERIFICAR'
    END as status
FROM sistemaretiradas.profiles
WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
  AND role = 'COLABORADORA'
ORDER BY name;

