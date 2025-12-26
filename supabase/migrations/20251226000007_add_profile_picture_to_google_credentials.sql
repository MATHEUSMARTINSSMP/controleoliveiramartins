-- ============================================================================
-- Migration: Adicionar foto de perfil às credenciais do Google
-- Data: 2025-12-26
-- Descrição: Adiciona coluna profile_picture_url à tabela google_credentials
-- Schema: sistemaretiradas
-- ============================================================================

-- Adicionar coluna profile_picture_url se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'sistemaretiradas'
        AND table_name = 'google_credentials'
        AND column_name = 'profile_picture_url'
    ) THEN
        ALTER TABLE sistemaretiradas.google_credentials
        ADD COLUMN profile_picture_url TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.google_credentials.profile_picture_url IS 'URL da foto de perfil do usuário Google';
    END IF;
END $$;
