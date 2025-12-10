-- =====================================================
-- VERIFICAÇÃO AUTOMÁTICA DE BILLING E ATIVAÇÃO/DESATIVAÇÃO
-- =====================================================
-- Esta migração cria funções para verificar billing status
-- e atualizar automaticamente is_active dos admins baseado no pagamento
-- Sistema de bloqueio gradual:
-- - 2 dias de atraso: Aviso visual (is_active = true, mas billingStatus mostra warning)
-- - 3 dias de atraso: Modo read-only (is_active = true, mas billingStatus mostra read-only)
-- - 7 dias de atraso: Bloqueio total (is_active = false, exceto aba billing)

-- Função para verificar e atualizar status de billing de um admin
CREATE OR REPLACE FUNCTION sistemaretiradas.check_and_update_admin_billing_status(p_admin_id UUID)
RETURNS TABLE (
  has_access BOOLEAN,
  reason TEXT,
  message TEXT,
  days_overdue INTEGER,
  access_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_subscription RECORD;
  v_days_overdue INTEGER := 0;
  v_current_period_end TIMESTAMPTZ;
  v_last_payment_date TIMESTAMPTZ;
  v_status TEXT;
  v_payment_status TEXT;
  v_should_be_active BOOLEAN := TRUE;
  v_access_level TEXT := 'FULL';
BEGIN
  -- Buscar assinatura do admin
  SELECT 
    asub.status,
    asub.last_payment_status,
    asub.current_period_end,
    asub.last_payment_date,
    asub.next_billing_date
  INTO v_subscription
  FROM sistemaretiradas.admin_subscriptions asub
  WHERE asub.admin_id = p_admin_id
  LIMIT 1;

  -- Se não há assinatura, considerar como inativo
  IF v_subscription IS NULL THEN
    -- Atualizar is_active para false
    UPDATE sistemaretiradas.profiles
    SET is_active = FALSE
    WHERE id = p_admin_id AND role = 'ADMIN';
    
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      'NO_SUBSCRIPTION'::TEXT,
      'Nenhuma assinatura encontrada'::TEXT,
      0::INTEGER,
      'BLOCKED'::TEXT;
    RETURN;
  END IF;

  v_status := v_subscription.status;
  v_payment_status := v_subscription.last_payment_status;
  v_current_period_end := v_subscription.current_period_end;
  v_last_payment_date := v_subscription.last_payment_date;

  -- Calcular dias de atraso
  IF v_current_period_end IS NOT NULL AND v_current_period_end < NOW() THEN
    v_days_overdue := EXTRACT(DAY FROM (NOW() - v_current_period_end))::INTEGER;
  END IF;

  -- Determinar nível de acesso baseado em dias de atraso
  -- PROGRESSÃO DE RESTRIÇÕES:
  -- - 0-1 dia: Acesso total (FULL)
  -- - 2 dias: Aviso visual (WARNING) - is_active = true, mas mostra aviso
  -- - 3-6 dias: Modo read-only (READ_ONLY) - is_active = true, mas bloqueia ações
  -- - 7+ dias: Bloqueio total (BLOCKED) - is_active = false, exceto aba billing
  
  IF v_status = 'ACTIVE' AND v_payment_status = 'PAID' AND v_days_overdue = 0 THEN
    -- Em dia: acesso total
    v_access_level := 'FULL';
    v_should_be_active := TRUE;
  ELSIF v_days_overdue >= 7 THEN
    -- 7+ dias: bloqueio total (exceto aba billing)
    -- is_active = false para bloquear login, mas permite acesso à aba billing
    v_access_level := 'BLOCKED';
    v_should_be_active := FALSE;
  ELSIF v_days_overdue >= 3 THEN
    -- 3-6 dias: modo read-only
    -- is_active = true para permitir login, mas bloqueia ações de criação/edição
    v_access_level := 'READ_ONLY';
    v_should_be_active := TRUE;
  ELSIF v_days_overdue >= 2 THEN
    -- 2 dias: aviso visual
    -- is_active = true, acesso completo, mas mostra aviso
    v_access_level := 'WARNING';
    v_should_be_active := TRUE;
  ELSE
    -- 0-1 dia: acesso normal (pode estar vencendo hoje ou venceu hoje)
    v_access_level := 'FULL';
    v_should_be_active := TRUE;
  END IF;

  -- Atualizar is_active do perfil baseado no status
  UPDATE sistemaretiradas.profiles
  SET is_active = v_should_be_active
  WHERE id = p_admin_id AND role = 'ADMIN';

  -- Retornar status
  RETURN QUERY SELECT 
    v_should_be_active::BOOLEAN,
    CASE 
      WHEN v_days_overdue >= 7 THEN 'PAYMENT_OVERDUE_BLOCKED'::TEXT
      WHEN v_days_overdue >= 3 THEN 'PAYMENT_OVERDUE_READ_ONLY'::TEXT
      WHEN v_days_overdue >= 2 THEN 'PAYMENT_OVERDUE_WARNING'::TEXT
      WHEN v_status = 'ACTIVE' AND v_payment_status = 'PAID' THEN 'PAID'::TEXT
      ELSE 'PAYMENT_REQUIRED'::TEXT
    END,
    CASE 
      WHEN v_days_overdue >= 7 THEN format('Pagamento atrasado há %s dias. Acesso bloqueado.', v_days_overdue)
      WHEN v_days_overdue >= 3 THEN format('Pagamento atrasado há %s dias. Acesso somente leitura.', v_days_overdue)
      WHEN v_days_overdue >= 2 THEN format('Pagamento atrasado há %s dias. Regularize seu pagamento.', v_days_overdue)
      WHEN v_status = 'ACTIVE' AND v_payment_status = 'PAID' THEN 'Pagamento em dia'
      ELSE 'Pagamento pendente'
    END,
    v_days_overdue,
    v_access_level;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_and_update_admin_billing_status(UUID) IS 'Verifica billing status e atualiza is_active automaticamente baseado em dias de atraso';

-- Função para verificar todos os admins (chamada pelo cron)
CREATE OR REPLACE FUNCTION sistemaretiradas.check_all_admins_billing_status()
RETURNS TABLE (
  admin_id UUID,
  admin_email TEXT,
  has_access BOOLEAN,
  reason TEXT,
  days_overdue INTEGER,
  access_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Verificar todos os admins
  FOR v_admin IN
    SELECT p.id, p.email
    FROM sistemaretiradas.profiles p
    WHERE p.role = 'ADMIN'
  LOOP
    -- Verificar e atualizar status de cada admin
    RETURN QUERY
    SELECT 
      v_admin.id,
      v_admin.email,
      result.has_access,
      result.reason,
      result.days_overdue,
      result.access_level
    FROM sistemaretiradas.check_and_update_admin_billing_status(v_admin.id) AS result;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_all_admins_billing_status() IS 'Verifica billing status de todos os admins e atualiza is_active automaticamente';

-- Função wrapper para chamar via pg_cron
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_verificacao_billing_diaria()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
  PERFORM sistemaretiradas.check_all_admins_billing_status();
  RAISE NOTICE 'Verificação de billing diária executada com sucesso em %', NOW();
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.chamar_verificacao_billing_diaria() IS 'Wrapper para chamar verificação de billing via pg_cron';

-- Agendar verificação diária às 00:00 (horário de Brasília)
-- Nota: pg_cron usa UTC, então 00:00 BRT = 03:00 UTC
SELECT cron.schedule(
  'verificacao-billing-diaria',
  '0 3 * * *', -- 03:00 UTC = 00:00 BRT (UTC-3)
  $$SELECT sistemaretiradas.chamar_verificacao_billing_diaria()$$
);

-- Garantir permissões
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_and_update_admin_billing_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_all_admins_billing_status() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.chamar_verificacao_billing_diaria() TO authenticated;

-- Atualizar função check_admin_access para usar a nova lógica
-- Primeiro, remover a função antiga se existir
DROP FUNCTION IF EXISTS sistemaretiradas.check_admin_access(UUID) CASCADE;

-- Criar nova versão que retorna access_level também
CREATE OR REPLACE FUNCTION sistemaretiradas.check_admin_access(p_admin_id UUID)
RETURNS TABLE (
  has_access BOOLEAN,
  reason TEXT,
  message TEXT,
  days_overdue INTEGER,
  access_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
  -- Usar a nova função que também atualiza is_active
  RETURN QUERY
  SELECT 
    result.has_access,
    result.reason,
    result.message,
    result.days_overdue,
    result.access_level
  FROM sistemaretiradas.check_and_update_admin_billing_status(p_admin_id) AS result;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_admin_access(UUID) IS 'Verifica acesso do admin baseado em billing (atualizado para usar nova lógica com progressão de restrições)';

-- Garantir permissões
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_admin_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_admin_access(UUID) TO anon;

-- Atualizar funções dependentes que usam check_admin_access
-- can_admin_create_or_edit e can_admin_view precisam ser atualizadas
DROP FUNCTION IF EXISTS sistemaretiradas.can_admin_create_or_edit(UUID) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.can_admin_view(UUID) CASCADE;

-- Recriar can_admin_create_or_edit com nova assinatura
CREATE OR REPLACE FUNCTION sistemaretiradas.can_admin_create_or_edit(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_access RECORD;
BEGIN
    -- Verificar acesso usando nova função
    SELECT * INTO v_access
    FROM sistemaretiradas.check_admin_access(p_admin_id)
    LIMIT 1;
    
    -- Permitir apenas se FULL ou WARNING
    RETURN v_access.access_level IN ('FULL', 'WARNING');
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.can_admin_create_or_edit(UUID) IS 'Verifica se admin pode criar/editar (bloqueia em READ_ONLY e BLOCKED)';

-- Recriar can_admin_view com nova assinatura
CREATE OR REPLACE FUNCTION sistemaretiradas.can_admin_view(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_access RECORD;
BEGIN
    -- Verificar acesso usando nova função
    SELECT * INTO v_access
    FROM sistemaretiradas.check_admin_access(p_admin_id)
    LIMIT 1;
    
    -- Permitir visualização exceto se BLOCKED
    RETURN v_access.access_level != 'BLOCKED';
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.can_admin_view(UUID) IS 'Verifica se admin pode visualizar (sempre permite exceto BLOCKED)';

-- Garantir permissões das funções dependentes
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_create_or_edit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_create_or_edit(UUID) TO anon;
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_view(UUID) TO anon;

