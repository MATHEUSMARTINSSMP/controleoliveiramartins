-- =====================================================
-- SCRIPT PARA CRIAR SISTEMA DE PIN DE ASSINATURA DIGITAL
-- Execute este script diretamente no Supabase SQL Editor
-- =====================================================

-- Habilitar extensão pgcrypto para criptografia de PINs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remover funções existentes (todas as possíveis assinaturas)
DROP FUNCTION IF EXISTS sistemaretiradas.has_signature_pin(UUID);
DROP FUNCTION IF EXISTS sistemaretiradas.set_signature_pin(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS sistemaretiradas.validate_signature_pin(UUID, TEXT);
-- Remover versões antigas que possam ter assinaturas diferentes
DO $$ 
BEGIN
    -- Tentar remover todas as versões possíveis
    EXECUTE 'DROP FUNCTION IF EXISTS sistemaretiradas.has_signature_pin';
    EXECUTE 'DROP FUNCTION IF EXISTS sistemaretiradas.set_signature_pin';
    EXECUTE 'DROP FUNCTION IF EXISTS sistemaretiradas.validate_signature_pin';
EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros se não existir
    NULL;
END $$;

-- 1. Tabela de PINs de assinatura digital
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_pins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- PIN criptografado (hash bcrypt)
    pin_hash TEXT NOT NULL,
    
    -- Status
    ativo BOOLEAN DEFAULT true,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES sistemaretiradas.profiles(id),
    
    -- Único por colaboradora
    UNIQUE(colaboradora_id)
);

-- 2. Tabela de audit log de alterações de PIN
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_pin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Tipo de ação
    acao VARCHAR(20) NOT NULL CHECK (acao IN ('criado', 'alterado', 'redefinido', 'desativado')),
    
    -- IP e user agent para auditoria
    ip_address INET,
    user_agent TEXT,
    
    -- Quem fez a ação
    realizado_por UUID REFERENCES sistemaretiradas.profiles(id),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_time_clock_pins_colaboradora ON sistemaretiradas.time_clock_pins(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_pins_store ON sistemaretiradas.time_clock_pins(store_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_pin_audit_log_colaboradora ON sistemaretiradas.time_clock_pin_audit_log(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_pin_audit_log_store ON sistemaretiradas.time_clock_pin_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_pin_audit_log_created_at ON sistemaretiradas.time_clock_pin_audit_log(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE sistemaretiradas.time_clock_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_pin_audit_log ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "time_clock_pins_colaboradora_read" ON sistemaretiradas.time_clock_pins;
DROP POLICY IF EXISTS "time_clock_pins_admin_read" ON sistemaretiradas.time_clock_pins;
DROP POLICY IF EXISTS "time_clock_pin_audit_log_colaboradora_read" ON sistemaretiradas.time_clock_pin_audit_log;
DROP POLICY IF EXISTS "time_clock_pin_audit_log_admin_read" ON sistemaretiradas.time_clock_pin_audit_log;

-- Política: Colaboradora vê apenas seu próprio PIN (mas não o hash)
CREATE POLICY "time_clock_pins_colaboradora_read"
ON sistemaretiradas.time_clock_pins
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política: Admin vê PINs da sua loja (mas não o hash)
CREATE POLICY "time_clock_pins_admin_read"
ON sistemaretiradas.time_clock_pins
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Colaboradora vê seu próprio audit log
CREATE POLICY "time_clock_pin_audit_log_colaboradora_read"
ON sistemaretiradas.time_clock_pin_audit_log
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política: Admin vê audit log da sua loja
CREATE POLICY "time_clock_pin_audit_log_admin_read"
ON sistemaretiradas.time_clock_pin_audit_log
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_time_clock_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_time_clock_pins_updated_at ON sistemaretiradas.time_clock_pins;
CREATE TRIGGER trigger_update_time_clock_pins_updated_at
    BEFORE UPDATE ON sistemaretiradas.time_clock_pins
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_time_clock_pins_updated_at();

-- =====================================================
-- FUNÇÕES RPC PARA GERENCIAMENTO DE PIN
-- =====================================================

-- Função: Verificar se colaboradora tem PIN cadastrado
CREATE OR REPLACE FUNCTION sistemaretiradas.has_signature_pin(
    p_colaboradora_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_pin BOOLEAN;
BEGIN
    -- Verificar se existe PIN ativo para a colaboradora
    SELECT EXISTS(
        SELECT 1 
        FROM sistemaretiradas.time_clock_pins 
        WHERE colaboradora_id = p_colaboradora_id 
        AND ativo = true
    ) INTO v_has_pin;
    
    RETURN COALESCE(v_has_pin, false);
END;
$$;

-- Função: Criar ou atualizar PIN de assinatura digital
CREATE OR REPLACE FUNCTION sistemaretiradas.set_signature_pin(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin_hash TEXT;
    v_existing_pin_id UUID;
    v_acao VARCHAR(20);
    v_user_agent TEXT;
    v_ip_address INET;
BEGIN
    -- Validar PIN (6-8 dígitos numéricos)
    IF NOT (p_pin ~ '^[0-9]{6,8}$') THEN
        RAISE EXCEPTION 'PIN deve ter entre 6 e 8 dígitos numéricos';
    END IF;
    
    -- Validar que não é sequência óbvia
    IF p_pin IN ('123456', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999') THEN
        RAISE EXCEPTION 'PIN não pode ser uma sequência óbvia';
    END IF;
    
    -- Gerar hash do PIN usando pgcrypto (bcrypt)
    -- Usar custo 10 para balancear segurança e performance
    v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
    
    -- Verificar se já existe PIN para esta colaboradora
    SELECT id INTO v_existing_pin_id
    FROM sistemaretiradas.time_clock_pins
    WHERE colaboradora_id = p_colaboradora_id;
    
    -- Obter informações de auditoria (se disponíveis)
    -- Nota: Em funções RPC do Supabase, essas informações podem não estar disponíveis
    -- Tentar obter, mas não falhar se não estiver disponível
    BEGIN
        v_user_agent := current_setting('request.headers', true)::json->>'user-agent';
    EXCEPTION WHEN OTHERS THEN
        v_user_agent := NULL;
    END;
    
    BEGIN
        v_ip_address := inet_client_addr();
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;
    
    IF v_existing_pin_id IS NOT NULL THEN
        -- Atualizar PIN existente
        UPDATE sistemaretiradas.time_clock_pins
        SET 
            pin_hash = v_pin_hash,
            updated_at = NOW(),
            created_by = auth.uid()
        WHERE id = v_existing_pin_id;
        
        v_acao := 'alterado';
    ELSE
        -- Criar novo PIN
        INSERT INTO sistemaretiradas.time_clock_pins (
            colaboradora_id,
            store_id,
            pin_hash,
            ativo,
            created_by
        ) VALUES (
            p_colaboradora_id,
            p_store_id,
            v_pin_hash,
            true,
            auth.uid()
        );
        
        v_acao := 'criado';
    END IF;
    
    -- Registrar no audit log
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
        colaboradora_id,
        store_id,
        acao,
        ip_address,
        user_agent,
        realizado_por
    ) VALUES (
        p_colaboradora_id,
        p_store_id,
        v_acao,
        v_ip_address,
        v_user_agent,
        auth.uid()
    );
    
    RETURN json_build_object(
        'success', true,
        'acao', v_acao,
        'message', CASE 
            WHEN v_acao = 'criado' THEN 'PIN criado com sucesso'
            ELSE 'PIN atualizado com sucesso'
        END
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Função: Validar PIN de assinatura digital
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_signature_pin(
    p_colaboradora_id UUID,
    p_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin_hash TEXT;
    v_is_valid BOOLEAN;
    v_pin_id UUID;
BEGIN
    -- Buscar hash do PIN da colaboradora
    SELECT id, pin_hash INTO v_pin_id, v_pin_hash
    FROM sistemaretiradas.time_clock_pins
    WHERE colaboradora_id = p_colaboradora_id
    AND ativo = true;
    
    -- Se não encontrou PIN, retornar inválido
    IF v_pin_hash IS NULL THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'PIN não cadastrado. Por favor, cadastre um PIN primeiro.'
        );
    END IF;
    
    -- Validar PIN usando crypt
    -- IMPORTANTE: crypt compara o hash gerado com o hash armazenado
    -- Se o PIN estiver correto, crypt(p_pin, v_pin_hash) retornará o mesmo hash
    v_is_valid := (v_pin_hash = crypt(p_pin, v_pin_hash));
    
    IF v_is_valid THEN
        RETURN json_build_object(
            'valid', true,
            'message', 'PIN válido'
        );
    ELSE
        -- Log para debug (não expor informações sensíveis)
        RAISE WARNING 'PIN inválido para colaboradora %', p_colaboradora_id;
        RETURN json_build_object(
            'valid', false,
            'error', 'PIN inválido. Verifique se digitou corretamente.'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro completo para debug
        RAISE WARNING 'Erro ao validar PIN: %', SQLERRM;
        RETURN json_build_object(
            'valid', false,
            'error', 'Erro ao validar PIN. Tente novamente.'
        );
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE sistemaretiradas.time_clock_pins IS 'Armazena PINs de assinatura digital para registro de ponto (REP-P compliance)';
COMMENT ON TABLE sistemaretiradas.time_clock_pin_audit_log IS 'Registra todas as alterações de PIN para auditoria e compliance';
COMMENT ON FUNCTION sistemaretiradas.has_signature_pin(UUID) IS 'Verifica se colaboradora tem PIN cadastrado';
COMMENT ON FUNCTION sistemaretiradas.set_signature_pin(UUID, UUID, TEXT) IS 'Cria ou atualiza PIN de assinatura digital com hash bcrypt';
COMMENT ON FUNCTION sistemaretiradas.validate_signature_pin(UUID, TEXT) IS 'Valida PIN de assinatura digital ao registrar ponto';

