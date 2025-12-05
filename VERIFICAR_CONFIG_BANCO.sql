-- ============================================================================
-- Script SQL: Verificar e Corrigir Configuração do Webhook WhatsApp
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para verificar e corrigir
-- a URL do webhook de autenticação WhatsApp

-- 1. VERIFICAR configuração atual
SELECT 
  key,
  value,
  description,
  updated_at
FROM sistemaretiradas.app_config
WHERE key = 'whatsapp_auth_webhook_url';

-- 2. SE a URL estiver incorreta (sem /connect), atualizar:
UPDATE sistemaretiradas.app_config
SET 
  value = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect',
  updated_at = NOW()
WHERE key = 'whatsapp_auth_webhook_url'
AND value != 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect';

-- 3. SE não existir a configuração, criar:
INSERT INTO sistemaretiradas.app_config (key, value, description, updated_at)
VALUES (
  'whatsapp_auth_webhook_url',
  'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect',
  'URL do webhook n8n para autenticação WhatsApp',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = NOW()
WHERE app_config.value != EXCLUDED.value;

-- 4. VERIFICAR novamente após atualização
SELECT 
  key,
  value,
  description,
  updated_at
FROM sistemaretiradas.app_config
WHERE key = 'whatsapp_auth_webhook_url';

