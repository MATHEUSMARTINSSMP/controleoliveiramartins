-- ============================================
-- ATUALIZAR STATUS DE CAMPANHA PARA COMPLETED
-- ============================================
-- Função e trigger para atualizar automaticamente o status
-- da campanha para COMPLETED quando todas as mensagens foram enviadas
-- ============================================

-- Função para verificar e atualizar status de campanhas completas
CREATE OR REPLACE FUNCTION sistemaretiradas.update_campaign_status_if_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_recipients INTEGER;
  v_sent_count INTEGER;
  v_failed_count INTEGER;
  v_total_processed INTEGER;
BEGIN
  -- Se não há campaign_id, não fazer nada
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar mensagens enviadas e falhadas para esta campanha
  SELECT 
    wc.total_recipients,
    COUNT(*) FILTER (WHERE wmq.status = 'SENT'),
    COUNT(*) FILTER (WHERE wmq.status = 'FAILED')
  INTO v_total_recipients, v_sent_count, v_failed_count
  FROM sistemaretiradas.whatsapp_campaigns wc
  LEFT JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
  WHERE wc.id = NEW.campaign_id
  GROUP BY wc.id, wc.total_recipients;

  -- Calcular total de mensagens processadas (SENT + FAILED)
  v_total_processed := COALESCE(v_sent_count, 0) + COALESCE(v_failed_count, 0);

  -- Se todas as mensagens foram processadas (enviadas ou falhadas)
  -- e a campanha ainda não está COMPLETED ou CANCELLED
  IF v_total_recipients > 0 AND v_total_processed >= v_total_recipients THEN
    UPDATE sistemaretiradas.whatsapp_campaigns
    SET 
      status = 'COMPLETED',
      completed_at = COALESCE(completed_at, NOW()),
      sent_count = v_sent_count,
      failed_count = v_failed_count,
      updated_at = NOW()
    WHERE id = NEW.campaign_id
      AND status NOT IN ('COMPLETED', 'CANCELLED');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger para executar após INSERT ou UPDATE na fila de mensagens
DROP TRIGGER IF EXISTS trigger_update_campaign_status_on_message_queue ON sistemaretiradas.whatsapp_message_queue;

CREATE TRIGGER trigger_update_campaign_status_on_message_queue
  AFTER INSERT OR UPDATE OF status ON sistemaretiradas.whatsapp_message_queue
  FOR EACH ROW
  WHEN (NEW.campaign_id IS NOT NULL AND NEW.status IN ('SENT', 'FAILED'))
  EXECUTE FUNCTION sistemaretiradas.update_campaign_status_if_completed();

-- Comentário
COMMENT ON FUNCTION sistemaretiradas.update_campaign_status_if_completed() IS 
  'Atualiza automaticamente o status da campanha para COMPLETED quando todas as mensagens foram processadas (enviadas ou falhadas)';

