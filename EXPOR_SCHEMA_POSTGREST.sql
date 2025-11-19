-- Script para expor o schema no PostgREST do Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se o schema está na lista de schemas expostos
-- O PostgREST precisa que o schema esteja na lista de schemas permitidos
-- Isso geralmente é feito através da configuração do PostgREST, mas podemos verificar:

-- Verificar schemas disponíveis
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('sacadaohboy-mrkitsch-loungerie', 'elevea', 'public')
ORDER BY schema_name;

-- 2. Garantir que o schema tem as permissões corretas
-- (Já feito no script VERIFICAR_PERMISSOES_COMPLETO.sql)

-- 3. IMPORTANTE: No Supabase Dashboard, você precisa configurar o PostgREST
-- para expor o schema. Isso geralmente é feito através de:
-- 
-- Dashboard do Supabase > Settings > API > Exposed Schemas
-- 
-- Adicione 'sacadaohboy-mrkitsch-loungerie' à lista de schemas expostos.
--
-- OU através de configuração no arquivo config.toml (se usando Supabase local):
-- [api]
-- db_schemas = ["public", "sacadaohboy-mrkitsch-loungerie", "elevea"]

-- 4. Verificar se as tabelas estão acessíveis
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname IN ('sacadaohboy-mrkitsch-loungerie', 'elevea', 'public')
ORDER BY schemaname, tablename;

-- 5. Se o schema não estiver exposto, você pode tentar criar uma view no schema public
-- que aponte para as tabelas do schema customizado (workaround temporário):
-- 
-- CREATE OR REPLACE VIEW public.profiles AS 
-- SELECT * FROM "sacadaohboy-mrkitsch-loungerie".profiles;
--
-- (Mas isso não é recomendado para produção)

-- NOTA: O erro 4ZPOT do PostgREST significa que o schema não está na lista de schemas expostos.
-- Você precisa configurar isso no Dashboard do Supabase ou através da configuração do PostgREST.

