-- Script para verificar status do pg_cron e extensões
-- Execute este script no Supabase SQL Editor

-- Verificar status completo
SELECT sistemaretiradas.verificar_status_cron();

-- Verificar pg_cron diretamente
SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
) AS pg_cron_enabled;

-- Verificar pg_net
SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
) AS pg_net_enabled;

-- Verificar http extension
SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'http'
) AS http_enabled;

-- Verificar jobs do pg_cron (se estiver habilitado)
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active,
    nodename,
    nodeport,
    database,
    username
FROM cron.job
WHERE jobname IN ('process-store-task-alerts', 'reset-daily-sends')
ORDER BY jobname;

