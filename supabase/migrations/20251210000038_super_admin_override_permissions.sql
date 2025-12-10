-- =====================================================
-- PERMISSÕES SUPER ADMIN - SOBRESCREVER TUDO
-- =====================================================
-- Esta migração garante que Super Admin tenha controle total
-- e possa ativar/desativar qualquer coisa, independente de billing

-- Função para verificar se usuário é Super Admin
-- Esta função verifica se o usuário autenticado (auth.uid()) é Super Admin
CREATE OR REPLACE FUNCTION sistemaretiradas.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_current_user_id UUID;
BEGIN
  -- Verificar se há um usuário autenticado
  v_current_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar FALSE
  IF v_current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se o usuário passado como parâmetro é o mesmo que está autenticado
  -- E se é Super Admin
  SELECT COALESCE(is_super_admin, FALSE) INTO v_is_super_admin
  FROM sistemaretiradas.profiles
  WHERE id = p_user_id 
    AND id = v_current_user_id 
    AND role = 'ADMIN';
  
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
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_current_user_id UUID;
BEGIN
  -- Verificar usuário autenticado
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o ID passado corresponde ao usuário autenticado
  IF p_super_admin_id != v_current_user_id THEN
    RAISE EXCEPTION 'ID do Super Admin não corresponde ao usuário autenticado';
  END IF;
  
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar is_active do usuário (SOBRESCREVE qualquer verificação de billing)
  -- Nota: updated_at pode não existir, então verificamos antes
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'profiles' 
      AND column_name = 'updated_at'
    ) THEN
      UPDATE sistemaretiradas.profiles
      SET is_active = p_active,
          updated_at = NOW()
      WHERE id = p_target_user_id;
    ELSE
      UPDATE sistemaretiradas.profiles
      SET is_active = p_active
      WHERE id = p_target_user_id;
    END IF;
  END $$;
  
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
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_column_name TEXT;
  v_current_user_id UUID;
BEGIN
  -- Verificar usuário autenticado
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o ID passado corresponde ao usuário autenticado
  IF p_super_admin_id != v_current_user_id THEN
    RAISE EXCEPTION 'ID do Super Admin não corresponde ao usuário autenticado';
  END IF;
  
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
    WHEN 'ajustes' THEN 'ajustes_condicionais_ativo'
    WHEN 'erp' THEN 'erp_ativo'
    WHEN 'check_meta' THEN 'check_meta_ativo'
    ELSE NULL
  END;
  
  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Módulo inválido: %', p_module_name;
  END IF;
  
  -- Atualizar módulo (SOBRESCREVE qualquer verificação de billing)
  -- Nota: updated_at pode não existir, então verificamos antes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'stores' 
    AND column_name = 'updated_at'
  ) THEN
    EXECUTE format('UPDATE sistemaretiradas.stores SET %I = $1, updated_at = NOW() WHERE id = $2', v_column_name)
    USING p_active, p_store_id;
  ELSE
    EXECUTE format('UPDATE sistemaretiradas.stores SET %I = $1 WHERE id = $2', v_column_name)
    USING p_active, p_store_id;
  END IF;
  
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
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_current_user_id UUID;
BEGIN
  -- Verificar usuário autenticado
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o ID passado corresponde ao usuário autenticado
  IF p_super_admin_id != v_current_user_id THEN
    RAISE EXCEPTION 'ID do Super Admin não corresponde ao usuário autenticado';
  END IF;
  
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar active da loja (SOBRESCREVE qualquer verificação)
  -- Nota: updated_at pode não existir, então verificamos antes
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'stores' 
      AND column_name = 'updated_at'
    ) THEN
      UPDATE sistemaretiradas.stores
      SET active = p_active,
          updated_at = NOW()
      WHERE id = p_store_id;
    ELSE
      UPDATE sistemaretiradas.stores
      SET active = p_active
      WHERE id = p_store_id;
    END IF;
  END $$;
  
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
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_current_user_id UUID;
BEGIN
  -- Verificar usuário autenticado
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o ID passado corresponde ao usuário autenticado
  IF p_super_admin_id != v_current_user_id THEN
    RAISE EXCEPTION 'ID do Super Admin não corresponde ao usuário autenticado';
  END IF;
  
  -- Verificar se quem está chamando é Super Admin
  SELECT sistemaretiradas.is_super_admin(p_super_admin_id) INTO v_is_super;
  
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas Super Admin pode executar esta ação';
  END IF;
  
  -- Atualizar subscription (SOBRESCREVE verificação automática)
  -- Nota: updated_at pode não existir, então não incluímos
  UPDATE sistemaretiradas.admin_subscriptions
  SET 
    status = p_status,
    payment_status = p_payment_status,
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    last_payment_date = COALESCE(p_last_payment_date, last_payment_date)
  WHERE admin_id = p_target_admin_id;
  
  -- Se pagamento foi marcado como pago, reativar admin imediatamente
  IF p_payment_status = 'PAID' AND p_status = 'ACTIVE' THEN
    -- Nota: updated_at pode não existir, então verificamos antes
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'profiles' 
      AND column_name = 'updated_at'
    ) THEN
      UPDATE sistemaretiradas.profiles
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = p_target_admin_id AND role = 'ADMIN';
    ELSE
      UPDATE sistemaretiradas.profiles
      SET is_active = TRUE
      WHERE id = p_target_admin_id AND role = 'ADMIN';
    END IF;
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
-- Nota: Como as funções são SECURITY DEFINER, elas já têm permissões elevadas
-- As RLS policies aqui são apenas uma camada extra de segurança
-- As funções RPC verificam internamente se o usuário é Super Admin

-- Policy para Super Admin atualizar qualquer profile
-- Usando função auxiliar para evitar problemas com auth.uid() em SECURITY DEFINER
DROP POLICY IF EXISTS "Super Admin can update any profile" ON sistemaretiradas.profiles;
CREATE POLICY "Super Admin can update any profile" ON sistemaretiradas.profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Verificar se o usuário autenticado é Super Admin
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  )
  WITH CHECK (
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  );

-- Policy para Super Admin atualizar qualquer store
DROP POLICY IF EXISTS "Super Admin can update any store" ON sistemaretiradas.stores;
CREATE POLICY "Super Admin can update any store" ON sistemaretiradas.stores
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  )
  WITH CHECK (
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  );

-- Policy para Super Admin atualizar qualquer subscription
DROP POLICY IF EXISTS "Super Admin can update any subscription" ON sistemaretiradas.admin_subscriptions;
CREATE POLICY "Super Admin can update any subscription" ON sistemaretiradas.admin_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  )
  WITH CHECK (
    COALESCE(
      (SELECT is_super_admin FROM sistemaretiradas.profiles WHERE id = auth.uid()),
      FALSE
    ) = TRUE
  );

