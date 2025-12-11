-- =====================================================
-- CORRIGIR NOTIFICAÇÕES DE PONTO - USAR EDGE FUNCTION
-- =====================================================
-- Substitui o processamento via pg_net por Edge Function do Supabase
-- que chama diretamente a Netlify Function, muito mais confiável

-- 1. Remover a função SQL problemática que usa pg_net
DROP FUNCTION IF EXISTS sistemaretiradas.process_time_clock_notification_queue() CASCADE;

-- 2. Criar função wrapper que chama a Edge Function do Supabase
-- Esta função será chamada pelo cron job e redirecionará para a Edge Function
CREATE OR REPLACE FUNCTION sistemaretiradas.process_time_clock_notification_queue()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_result JSON;
    v_supabase_url TEXT;
    v_service_role_key TEXT;
    v_response JSONB;
BEGIN
    -- Obter URL do Supabase e Service Role Key das variáveis de ambiente do Supabase
    -- Nota: Estas variáveis estão disponíveis automaticamente no Supabase
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.service_role_key', true);
    
    -- Se não estiverem disponíveis via current_setting, usar valores padrão do Supabase
    -- IMPORTANTE: A Edge Function será chamada diretamente pelo cron job configurado
    -- no Supabase Dashboard, não por esta função SQL
    -- Esta função existe apenas para compatibilidade, mas não será usada
    
    -- Retornar informação de que deve usar Edge Function
    RETURN json_build_object(
        'success', true,
        'message', 'Use Edge Function: /functions/v1/process-time-clock-notifications',
        'note', 'O cron job deve ser configurado para chamar a Edge Function diretamente'
    );
END;
$$;

-- 3. Atualizar o cron job para chamar a Edge Function
-- Remover job existente
SELECT cron.unschedule('process-time-clock-notifications') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
);

-- NOTA: O cron job deve ser configurado manualmente no Supabase Dashboard
-- para chamar a Edge Function diretamente:
-- URL: https://seu-projeto.supabase.co/functions/v1/process-time-clock-notifications
-- Método: POST
-- Headers: Authorization: Bearer SERVICE_ROLE_KEY
-- Schedule: * * * * * (a cada minuto)

-- Por enquanto, criar um job que chama uma função placeholder
-- IMPORTANTE: Configure manualmente o cron job no Supabase Dashboard para chamar a Edge Function

-- Comentário explicativo
COMMENT ON FUNCTION sistemaretiradas.process_time_clock_notification_queue() IS 
'DEPRECATED: Use a Edge Function /functions/v1/process-time-clock-notifications diretamente. Configure o cron job no Supabase Dashboard para chamar a Edge Function.';

-- 4. Reativar itens falhados que tiveram erro de "column content does not exist"
-- (esses foram falhas do pg_net antigo, podem ser reprocessados)
UPDATE sistemaretiradas.time_clock_notification_queue
SET status = 'PENDING',
    error_message = NULL,
    attempts = 0
WHERE status = 'FAILED'
AND error_message LIKE '%column "content" does not exist%'
AND attempts < 3;

COMMENT ON TABLE sistemaretiradas.time_clock_notification_queue IS 
'Fila de notificações de controle de ponto aguardando envio via WhatsApp. Processada pela Edge Function process-time-clock-notifications.';

