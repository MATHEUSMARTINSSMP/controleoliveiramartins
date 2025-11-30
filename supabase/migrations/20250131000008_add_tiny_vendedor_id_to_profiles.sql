-- ============================================================================
-- MIGRATION: Adicionar Campo tiny_vendedor_id para Matching de Colaboradoras
-- Data: 2025-01-31
-- Descrição: Adiciona campo para armazenar ID do vendedor do Tiny ERP
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNA tiny_vendedor_id NA TABELA profiles
-- ============================================================================

ALTER TABLE sistemaretiradas.profiles
ADD COLUMN IF NOT EXISTS tiny_vendedor_id TEXT;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_profiles_tiny_vendedor_id ON sistemaretiradas.profiles(tiny_vendedor_id) WHERE tiny_vendedor_id IS NOT NULL;

COMMENT ON COLUMN sistemaretiradas.profiles.tiny_vendedor_id IS 'ID do vendedor no Tiny ERP. Usado para matching automático de colaboradoras com vendedores.';

-- ============================================================================
-- 2. NOVA PRIORIDADE DE MATCHING (implementada no código JavaScript)
-- ============================================================================
-- 
-- Prioridade atualizada:
-- 1. CPF (mais confiável - identificador único da pessoa)
-- 2. tiny_vendedor_id (ID do Tiny - confiável e único por vendedor)
-- 3. Email (geralmente único, mas pode mudar)
-- 4. Nome normalizado (menos confiável - pode ter variações)
--
-- A função findCollaboratorByVendedor() já foi atualizada para usar essa nova prioridade.

