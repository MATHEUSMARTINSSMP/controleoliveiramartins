-- =====================================================
-- FUNÇÃO RPC PARA INSERIR ASSINATURA DIGITAL
-- Permite inserir assinatura mesmo quando auth.uid() não corresponde ao colaboradora_id
-- Usa SECURITY DEFINER para bypassar RLS com validação adequada
-- =====================================================

-- Remover função existente se houver
DROP FUNCTION IF EXISTS sistemaretiradas.insert_time_clock_digital_signature(
    p_time_clock_record_id UUID,
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_password_hash TEXT,
    p_device_info JSONB,
    p_ip_address INET,
    p_rep_identity TEXT
);

CREATE OR REPLACE FUNCTION sistemaretiradas.insert_time_clock_digital_signature(
    p_time_clock_record_id UUID,
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_password_hash TEXT,
    p_device_info JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_rep_identity TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_colaboradora_role TEXT;
    v_colaboradora_store_id UUID;
    v_auth_user_id UUID;
    v_auth_user_role TEXT;
BEGIN
    -- Obter usuário autenticado
    v_auth_user_id := auth.uid();
    
    IF v_auth_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuário não autenticado'
        );
    END IF;
    
    -- Verificar se o registro de ponto existe
    SELECT id INTO v_record_id
    FROM sistemaretiradas.time_clock_records
    WHERE id = p_time_clock_record_id;
    
    IF v_record_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Registro de ponto não encontrado'
        );
    END IF;
    
    -- Verificar se a colaboradora existe e obter informações
    SELECT role, store_id INTO v_colaboradora_role, v_colaboradora_store_id
    FROM sistemaretiradas.profiles
    WHERE id = p_colaboradora_id;
    
    IF v_colaboradora_role IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Colaboradora não encontrada'
        );
    END IF;
    
    IF v_colaboradora_role != 'COLABORADORA' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ID fornecido não é de uma colaboradora'
        );
    END IF;
    
    -- Verificar permissões:
    -- 1. Se o usuário autenticado é a própria colaboradora
    -- 2. Se o usuário autenticado é LOJA e a store_id corresponde
    -- 3. Se o usuário autenticado é ADMIN
    
    SELECT role INTO v_auth_user_role
    FROM sistemaretiradas.profiles
    WHERE id = v_auth_user_id;
    
    -- Validar permissão
    IF v_auth_user_id = p_colaboradora_id THEN
        -- Própria colaboradora - permitido
        NULL; -- OK
    ELSIF v_auth_user_role = 'LOJA' THEN
        -- Usuário LOJA - verificar se a store_id corresponde
        DECLARE
            v_loja_store_id UUID;
        BEGIN
            SELECT store_id INTO v_loja_store_id
            FROM sistemaretiradas.profiles
            WHERE id = v_auth_user_id;
            
            IF v_loja_store_id != p_store_id THEN
                RETURN json_build_object(
                    'success', false,
                    'error', 'Loja não autorizada para esta operação'
                );
            END IF;
        END;
    ELSIF v_auth_user_role = 'ADMIN' THEN
        -- Admin - permitido
        NULL; -- OK
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'Permissão negada'
        );
    END IF;
    
    -- Verificar se já existe assinatura para este registro
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.time_clock_digital_signatures
        WHERE time_clock_record_id = p_time_clock_record_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Assinatura digital já existe para este registro'
        );
    END IF;
    
    -- Inserir assinatura digital
    INSERT INTO sistemaretiradas.time_clock_digital_signatures (
        time_clock_record_id,
        colaboradora_id,
        store_id,
        password_hash,
        device_info,
        ip_address,
        rep_identity,
        created_at
    ) VALUES (
        p_time_clock_record_id,
        p_colaboradora_id,
        p_store_id,
        p_password_hash,
        p_device_info,
        p_ip_address,
        COALESCE(p_rep_identity, 'REP-' || substring(p_store_id::text, 1, 8) || '-' || extract(epoch from now())::bigint::text),
        NOW()
    )
    RETURNING id INTO v_record_id;
    
    RETURN json_build_object(
        'success', true,
        'id', v_record_id,
        'message', 'Assinatura digital criada com sucesso'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Comentário
COMMENT ON FUNCTION sistemaretiradas.insert_time_clock_digital_signature IS 'Insere assinatura digital de registro de ponto com validação de permissões';

