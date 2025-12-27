-- ============================================================================
-- Migration: Adicionar coluna whatsapp à tabela stores
-- Data: 2025-12-28
-- Descrição: Adiciona coluna para armazenar o telefone WhatsApp da loja
--            (usado para enviar notificações de tarefas atrasadas)
-- ============================================================================

-- Adicionar coluna whatsapp na tabela stores
ALTER TABLE sistemaretiradas.stores 
ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Comentário para documentação
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp IS 'Telefone WhatsApp da loja para receber notificações (ex: tarefas atrasadas). Formato: 5598987654321';

-- Índice para busca rápida de lojas com WhatsApp cadastrado
CREATE INDEX IF NOT EXISTS idx_stores_whatsapp 
ON sistemaretiradas.stores(whatsapp) 
WHERE whatsapp IS NOT NULL;

