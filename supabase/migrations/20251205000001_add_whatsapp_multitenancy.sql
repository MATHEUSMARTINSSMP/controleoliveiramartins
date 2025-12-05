-- ============================================================================
-- Migration: Adicionar suporte a WhatsApp Multi-Tenancy
-- Data: 2025-12-05
-- Descrição: Cada loja pode ter seu próprio WhatsApp conectado via UazAPI
-- ============================================================================

-- Adicionar colunas para credenciais WhatsApp/UazAPI na tabela stores
ALTER TABLE sistemaretiradas.stores 
  ADD COLUMN IF NOT EXISTS uazapi_token TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_ativo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_connection_status TEXT DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.stores.uazapi_token IS 'Token de API da UazAPI para envio de WhatsApp';
COMMENT ON COLUMN sistemaretiradas.stores.uazapi_instance_id IS 'ID da instância UazAPI conectada';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_ativo IS 'Se o módulo WhatsApp está ativo para esta loja';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_connection_status IS 'Status da conexão: disconnected, connecting, connected, error';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_connected_at IS 'Data/hora da última conexão bem-sucedida';

-- Índice para buscar lojas com WhatsApp ativo
CREATE INDEX IF NOT EXISTS idx_stores_whatsapp_ativo 
  ON sistemaretiradas.stores(whatsapp_ativo) 
  WHERE whatsapp_ativo = true;

-- ============================================================================
-- SEGURANÇA: RLS Policies para credenciais WhatsApp
-- ============================================================================

-- Garantir que RLS está habilitado na tabela stores
ALTER TABLE sistemaretiradas.stores ENABLE ROW LEVEL SECURITY;

-- Policy: Admin pode ver apenas suas próprias lojas
DROP POLICY IF EXISTS "stores_admin_select_own" ON sistemaretiradas.stores;
CREATE POLICY "stores_admin_select_own" ON sistemaretiradas.stores
  FOR SELECT USING (
    -- Admin só vê suas próprias lojas
    admin_id = auth.uid()
    OR
    -- Colaboradoras podem ver dados básicos da sua loja (sem credenciais sensíveis)
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'COLABORADORA'
      AND p.store_id = stores.id
    )
  );

-- Policy: Apenas Admin pode editar suas lojas (incluindo credenciais WhatsApp)
DROP POLICY IF EXISTS "stores_admin_update_own" ON sistemaretiradas.stores;
CREATE POLICY "stores_admin_update_own" ON sistemaretiradas.stores
  FOR UPDATE USING (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Policy: Apenas Admin pode inserir lojas
DROP POLICY IF EXISTS "stores_admin_insert" ON sistemaretiradas.stores;
CREATE POLICY "stores_admin_insert" ON sistemaretiradas.stores
  FOR INSERT WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'stores' 
    AND column_name = 'uazapi_token'
  ) THEN
    RAISE NOTICE '✅ Coluna uazapi_token adicionada com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Falha ao adicionar coluna uazapi_token';
  END IF;
  
  -- Verificar políticas RLS
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'sistemaretiradas'
    AND tablename = 'stores'
    AND policyname = 'stores_admin_select_own'
  ) THEN
    RAISE NOTICE '✅ RLS Policy stores_admin_select_own criada com sucesso';
  ELSE
    RAISE NOTICE '⚠️ RLS Policy pode não ter sido criada (verifique manualmente)';
  END IF;
END $$;

