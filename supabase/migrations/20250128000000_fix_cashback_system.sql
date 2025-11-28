-- ============================================================================
-- FIX: Sistema de Cashback - Dropar funções existentes antes de recriar
-- Data: 2025-01-28
-- ============================================================================

-- Dropar função renovar_cashback que está causando conflito
DROP FUNCTION IF EXISTS sistemaretiradas.renovar_cashback(UUID, UUID);

-- Agora a migration completa pode rodar sem erros
