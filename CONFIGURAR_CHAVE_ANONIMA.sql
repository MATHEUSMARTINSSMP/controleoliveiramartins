-- =====================================================
-- CONFIGURAR CHAVE ANÔNIMA DO SUPABASE
-- =====================================================
-- Este script configura a chave anônima necessária para o cron job
-- chamar a Edge Function sem erro 401
--
-- IMPORTANTE: Você já tem o secret SUPABASE_ANON_KEY configurado no Supabase.
-- Este script copia esse valor para a tabela app_config para uso no cron job.

-- Opção 1: Se você souber a chave anônima, substitua 'SUA_ANON_KEY_AQUI' abaixo
-- Você pode encontrá-la em: Supabase Dashboard > Settings > API > Project API keys > anon public
-- OU copie do secret SUPABASE_ANON_KEY em: Edge Functions > Secrets

INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_anon_key', 'SUA_ANON_KEY_AQUI')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- Opção 2: Se preferir, você pode obter a chave diretamente dos secrets via Edge Function
-- Mas isso requer uma Edge Function intermediária, então a Opção 1 é mais simples

-- Verificar se foi configurado corretamente
SELECT 
    key,
    CASE 
        WHEN value IS NULL THEN '❌ NÃO CONFIGURADO'
        WHEN LENGTH(value) < 50 THEN '⚠️ VALOR SUSPEITO (muito curto)'
        ELSE '✅ CONFIGURADO'
    END as status,
    LENGTH(value) as key_length,
    LEFT(value, 20) || '...' as preview
FROM sistemaretiradas.app_config
WHERE key = 'supabase_anon_key';

-- NOTA: 
-- - A chave anônima geralmente começa com 'eyJ' e tem cerca de 150-200 caracteres
-- - Você pode copiar o valor do secret SUPABASE_ANON_KEY em: Edge Functions > Secrets

