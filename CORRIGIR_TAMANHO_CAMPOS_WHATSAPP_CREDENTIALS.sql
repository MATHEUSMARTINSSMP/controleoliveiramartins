-- ============================================================================
-- Script de Correcao: Aumentar tamanho dos campos VARCHAR
-- Data: 2025-12-06
-- Problema: value too long for type character varying(50)
-- ============================================================================

-- Alterar campos que podem receber valores maiores
ALTER TABLE sistemaretiradas.whatsapp_credentials
  ALTER COLUMN uazapi_status TYPE VARCHAR(100);

ALTER TABLE sistemaretiradas.whatsapp_credentials
  ALTER COLUMN status TYPE VARCHAR(100);

ALTER TABLE sistemaretiradas.whatsapp_credentials
  ALTER COLUMN whatsapp_instance_name TYPE TEXT;

ALTER TABLE sistemaretiradas.whatsapp_credentials
  ALTER COLUMN customer_id TYPE TEXT;

ALTER TABLE sistemaretiradas.whatsapp_credentials
  ALTER COLUMN site_slug TYPE TEXT;

-- Verificar alteracoes
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'whatsapp_credentials'
ORDER BY ordinal_position;
