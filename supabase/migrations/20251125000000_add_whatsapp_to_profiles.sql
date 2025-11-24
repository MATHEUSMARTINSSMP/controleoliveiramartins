-- Migration: Adicionar campo WhatsApp na tabela profiles
-- Data: 2025-11-25
-- NOTA: A notificação de gincana será controlada pelos bônus ativos, não pelo perfil

-- Adicionar coluna whatsapp (TEXT, pode ser NULL inicialmente, mas será obrigatório no cadastro)
ALTER TABLE sistemaretiradas.profiles
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.profiles.whatsapp IS 'Número de WhatsApp da colaboradora (formato: apenas números, 10-11 dígitos). Obrigatório para colaboradoras receberem notificações de gincanas.';

-- Criar índice para otimizar buscas por WhatsApp
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp ON sistemaretiradas.profiles(whatsapp) WHERE whatsapp IS NOT NULL;

