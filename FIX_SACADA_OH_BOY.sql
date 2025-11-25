-- =============================================================================
-- FIX: Associar dados da Loja "Sacada | Oh, Boy"
-- =============================================================================
-- Este script combina e corrige os dados entre tenants, stores e profiles
-- para garantir que tudo esteja sincronizado corretamente
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- 1. Verificar dados atuais
SELECT '=== TENANT ===' as seção;
SELECT * FROM tenants WHERE slug = 'oliveira-martins';

SELECT '=== STORE ===' as seção;
SELECT * FROM stores WHERE id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

SELECT '=== PROFILE LOJA ===' as seção;
SELECT * FROM profiles WHERE store_default = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

-- 2. Atualizar store com admin_user_id e sistema_erp (se necessário)
UPDATE stores
SET 
  admin_user_id = '7391610a-f83b-4727-875f-81299b8bfa68', -- Admin do sistema
  sistema_erp = 'TINY' -- Definir sistema ERP como TINY
WHERE id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

-- 3. Atualizar profile da loja para ter store_id correto
UPDATE profiles
SET 
  store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- ID da loja Sacada
WHERE id = '50dddb57-68c9-4ed1-8e23-a9038b0d3b2f'; -- Profile "Loja Sacada Oh,Boy!"

-- 4. Criar ou atualizar integração ERP para a loja
INSERT INTO erp_integrations (
  store_id,
  sistema_erp,
  client_id,
  client_secret,
  sync_status,
  last_sync_at,
  error_message,
  active
)
VALUES (
  'cee7d359-0240-4131-87a2-21ae44bd1bb4', -- ID da loja
  'TINY',
  '', -- Será preenchido pelo dev no /dev/erp-config
  '', -- Será preenchido pelo dev no /dev/erp-config
  'DISCONNECTED',
  NULL,
  NULL,
  true
)
ON CONFLICT (store_id) 
DO UPDATE SET
  sistema_erp = EXCLUDED.sistema_erp,
  sync_status = COALESCE(erp_integrations.sync_status, EXCLUDED.sync_status),
  active = true,
  updated_at = NOW();

-- 5. Verificar dados atualizados
SELECT '=== STORE ATUALIZADO ===' as seção;
SELECT 
  s.id,
  s.name,
  s.admin_id,
  s.sistema_erp,
  s.active,
  ei.id as erp_integration_id,
  ei.sistema_erp as erp_sistema,
  ei.sync_status as erp_status
FROM stores s
LEFT JOIN erp_integrations ei ON ei.store_id = s.id
WHERE s.id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

SELECT '=== PROFILE ATUALIZADO ===' as seção;
SELECT 
  p.id,
  p.name,
  p.email,
  p.role,
  p.store_id,
  p.store_default,
  s.name as store_name
FROM profiles p
LEFT JOIN stores s ON s.id = p.store_id
WHERE p.id = '50dddb57-68c9-4ed1-8e23-a9038b0d3b2f';

SELECT '=== INTEGRAÇÃO ERP ===' as seção;
SELECT 
  ei.id,
  ei.store_id,
  s.name as store_name,
  ei.sistema_erp,
  ei.sync_status,
  ei.client_id IS NOT NULL AND ei.client_id != '' as tem_client_id,
  ei.client_secret IS NOT NULL AND ei.client_secret != '' as tem_client_secret,
  ei.last_sync_at
FROM erp_integrations ei
JOIN stores s ON s.id = ei.store_id
WHERE ei.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

-- =============================================================================
-- RESUMO
-- =============================================================================
-- ✅ Store atualizada com admin_id e sistema_erp
-- ✅ Profile atualizada com store_id correto
-- ✅ Integração ERP criada/atualizada para a loja
-- ⚠️ IMPORTANTE: Preencher client_id e client_secret no /dev/erp-config
-- =============================================================================

