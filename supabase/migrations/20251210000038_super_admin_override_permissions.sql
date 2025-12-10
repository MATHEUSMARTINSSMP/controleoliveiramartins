-- =====================================================
-- PERMISSÕES SUPER ADMIN - SOBRESCREVER TUDO
-- =====================================================
-- Esta migração garante que Super Admin tenha controle total
-- e possa ativar/desativar qualquer coisa, independente de billing

-- Função para verificar se usuário é Super Admin
CREATE OR REPLACE FUNCTION sistemaretiradas.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT COALESCE(is_super_admin, FALSE) INTO v_is_super_admin
  FROM sistemaretiradas.profiles
  WHERE id = p_user_id AND role = 'ADMIN';
  
  RETURN COALESCE(v_is_super_admin, FALSE);
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.is_super_admin(UUID) IS 'Verifica se o usuário é Super Admin';

-- Função para Super Admin ativar/desativar qualquer admin (ignora billing)
CREATE OR REPLACE FUNCTION sistemaretiradas.super_admin_toggle_user_active(
  p_super_admin_id UUID,
  p_target_user_id UUID,
  p_active BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_super BOOLEAN;
BEGIN
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar is_active do usuário (SOBRESCREVE qualquer verificação de billing)
  UPDATE sistemaretiradas.profiles
  SET is_active = p_active,
      updated_at = NOW()
  WHERE id = p_target_user_id;
  
  RETURN json_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'is_active', p_active,
    'message', format('Usuário %s com sucesso', CASE WHEN p_active THEN 'ativado' ELSE 'desativado' END)
  );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.super_admin_toggle_user_active(UUID, UUID, BOOLEAN) IS 'Super Admin pode ativar/desativar qualquer usuário, ignorando billing';

-- Função para Super Admin ativar/desativar módulos de qualquer loja (ignora billing)
CREATE OR REPLACE FUNCTION sistemaretiradas.super_admin_toggle_store_module(
  p_super_admin_id UUID,
  p_store_id UUID,
  p_module_name TEXT,
  p_active BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_column_name TEXT;
BEGIN
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Mapear nome do módulo para coluna
  v_column_name := CASE p_module_name
    WHEN 'cashback' THEN 'cashback_ativo'
    WHEN 'crm' THEN 'crm_ativo'
    WHEN 'wishlist' THEN 'wishlist_ativo'
    WHEN 'ponto' THEN 'ponto_ativo'
    WHEN 'ajustes' THEN 'ajustes_ativo'
    WHEN 'erp' THEN 'erp_ativo'
    WHEN 'check_meta' THEN 'check_meta_ativo'
    ELSE NULL
  END;
  
  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Módulo inválido: %', p_module_name;
  END IF;
  
  -- Atualizar módulo (SOBRESCREVE qualquer verificação de billing)
  EXECUTE format('UPDATE sistemaretiradas.stores SET %I = $1, updated_at = NOW() WHERE id = $2', v_column_name)
  USING p_active, p_store_id;
  
  RETURN json_build_object(
    'success', true,
    'store_id', p_store_id,
    'module', p_module_name,
    'active', p_active,
    'message', format('Módulo %s %s com sucesso', p_module_name, CASE WHEN p_active THEN 'ativado' ELSE 'desativado' END)
  );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.super_admin_toggle_store_module(UUID, UUID, TEXT, BOOLEAN) IS 'Super Admin pode ativar/desativar módulos de qualquer loja, ignorando billing';

-- Função para Super Admin ativar/desativar loja (ignora billing)
CREATE OR REPLACE FUNCTION sistemaretiradas.super_admin_toggle_store_active(
  p_super_admin_id UUID,
  p_store_id UUID,
  p_active BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_super BOOLEAN;
BEGIN
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar active da loja (SOBRESCREVE qualquer verificação)
  UPDATE sistemaretiradas.stores
  SET active = p_active,
      updated_at = NOW()
  WHERE id = p_store_id;
  
  RETURN json_build_object(
    'success', true,
    'store_id', p_store_id,
    'active', p_active,
    'message', format('Loja %s com sucesso', CASE WHEN p_active THEN 'ativada' ELSE 'desativada' END)
  );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.super_admin_toggle_store_active(UUID, UUID, BOOLEAN) IS 'Super Admin pode ativar/desativar qualquer loja, ignorando billing';

-- Função para Super Admin atualizar billing status (sobrescreve verificação automática)
CREATE OR REPLACE FUNCTION sistemaretiradas.super_admin_update_billing_status(
  p_super_admin_id UUID,
  p_target_admin_id UUID,
  p_status TEXT,
  p_payment_status TEXT,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_last_payment_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_super BOOLEAN;
BEGIN
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar subscription (SOBRESCREVE verificação automática)
  UPDATE sistemaretiradas.admin_subscriptions
  SET 
    status = p_status,
    payment_status = p_payment_status,
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    last_payment_date = COALESCE(p_last_payment_date, last_payment_date),
    updated_at = NOW()
  WHERE admin_id = p_target_admin_id;
  
  -- Se pagamento foi marcado como pago, reativar admin imediatamente
  IF p_payment_status = 'PAID' AND p_status = 'ACTIVE' THEN
    UPDATE sistemaretiradas.profiles
    SET is_active = TRUE,
        updated_at = NOW()
    WHERE id = p_target_admin_id AND role = 'ADMIN';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'admin_id', p_target_admin_id,
    'status', p_status,
    'payment_status', p_payment_status,
    'message', 'Status de billing atualizado com sucesso'
  );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.super_admin_update_billing_status(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Super Admin pode atualizar status de billing de qualquer admin, sobrescrevendo verificação automática';

-- Garantir permissões
GRANT EXECUTE ON FUNCTION sistemaretiradas.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.super_admin_toggle_user_active(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.super_admin_toggle_store_module(UUID, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.super_admin_toggle_store_active(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.super_admin_update_billing_status(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- RLS Policies para permitir Super Admin fazer qualquer alteração
-- Nota: RLS já deve estar configurado, mas vamos garantir que Super Admin tenha acesso total

-- Policy para Super Admin atualizar qualquer profile
DROP POLICY IF EXISTS "Super Admin can update any profile" ON sistemaretiradas.profiles;
CREATE POLICY "Super Admin can update any profile" ON sistemaretiradas.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

-- Policy para Super Admin atualizar qualquer store
DROP POLICY IF EXISTS "Super Admin can update any store" ON sistemaretiradas.stores;
CREATE POLICY "Super Admin can update any store" ON sistemaretiradas.stores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

-- Policy para Super Admin atualizar qualquer subscription
DROP POLICY IF EXISTS "Super Admin can update any subscription" ON sistemaretiradas.admin_subscriptions;
CREATE POLICY "Super Admin can update any subscription" ON sistemaretiradas.admin_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

