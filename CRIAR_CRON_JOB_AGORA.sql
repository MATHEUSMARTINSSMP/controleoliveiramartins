-- ============================================================================
-- SCRIPT: Criar Cron Job para Processar Fila de WhatsApp AGORA
-- Descrição: Cria o cron job para executar a cada 1 minuto
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE pg_cron ESTÁ HABILITADO
-- ============================================================================

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
        THEN '✅ pg_cron está HABILITADO'
        ELSE '❌ pg_cron NÃO está habilitado'
    END as status_pg_cron;

-- ============================================================================
-- 2. VERIFICAR SE O JOB JÁ EXISTE
-- ============================================================================

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM cron.job 
            WHERE jobname = 'processar-fila-whatsapp-cashback'
        )
        THEN '✅ Job JÁ EXISTE'
        ELSE '❌ Job NÃO existe - precisa criar'
    END as status_job;

-- ============================================================================
-- 3. REMOVER JOB ANTIGO (SE EXISTIR) - Para recriar limpo
-- ============================================================================

-- Descomentar para remover job existente
-- SELECT cron.unschedule('processar-fila-whatsapp-cashback');

-- ============================================================================
-- 4. CRIAR NOVO CRON JOB (A CADA 1 MINUTO)
-- ============================================================================

-- IMPORTANTE: Só execute se pg_cron estiver habilitado!

SELECT cron.schedule(
    'processar-fila-whatsapp-cashback',  -- Nome do job
    '* * * * *',                         -- A cada minuto (cron expression)
    $$
    SELECT sistemaretiradas.chamar_processar_fila_whatsapp();
    $$
);

-- ============================================================================
-- 5. VERIFICAR SE O JOB FOI CRIADO
-- ============================================================================

SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname = 'processar-fila-whatsapp-cashback';

-- ============================================================================
-- 6. TESTAR A FUNÇÃO MANUALMENTE (Opcional)
-- ============================================================================

-- Descomentar para testar a função diretamente
-- SELECT sistemaretiradas.chamar_processar_fila_whatsapp();

-- ============================================================================
-- NOTA: Se pg_cron não estiver habilitado, você verá um erro
-- Nesse caso, habilite primeiro: Supabase Dashboard > Database > Extensions
-- ============================================================================

