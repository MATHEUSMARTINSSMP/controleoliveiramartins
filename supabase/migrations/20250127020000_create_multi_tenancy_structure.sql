-- =============================================================================
-- MULTI-TENANCY: Estrutura Base
-- =============================================================================
-- Cria estrutura para suportar múltiplos tenants (empresas)
-- Cada tenant terá seu próprio schema com todos os dados isolados
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. TABELA: tenants (no schema sistemaretiradas)
-- =============================================================================
-- Armazena informações sobre cada tenant (empresa/cliente)
-- IMPORTANTE: Esta tabela fica no schema sistemaretiradas junto com os dados existentes
-- NÃO mexe nos dados atuais, apenas adiciona controle de multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- Ex: "oliveira-martins"
    schema_name TEXT, -- Ex: "tenant_oliveira_martins" (NULL = usa sistemaretiradas)
    admin_user_id UUID, -- ID do usuário admin do tenant
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(active) WHERE active = true;

-- Comentários
COMMENT ON TABLE tenants IS 'Lista de tenants (empresas/clientes) do sistema';
COMMENT ON COLUMN tenants.slug IS 'Identificador único do tenant (usado em URL)';
COMMENT ON COLUMN tenants.schema_name IS 'Nome do schema PostgreSQL para este tenant';

-- RLS: Apenas ADMIN pode gerenciar tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer usuário autenticado pode ver tenants ativos (para identificar seu tenant)
CREATE POLICY "authenticated_view_tenants" ON tenants
    FOR SELECT
    USING (auth.role() = 'authenticated' AND active = true);

-- Política: Apenas super-admin pode criar/editar tenants (implementar depois se necessário)
-- Por enquanto, apenas via migration/SQL direto

-- =============================================================================
-- 2. FUNÇÃO: create_tenant_schema
-- =============================================================================
-- Cria um novo schema para um tenant e copia a estrutura de todas as tabelas
CREATE OR REPLACE FUNCTION create_tenant_schema(
    p_tenant_slug TEXT,
    p_tenant_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_tenant_id UUID;
    v_schema_name TEXT;
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY[
        'profiles',
        'stores',
        'goals',
        'day_weights',
        'sales',
        'purchases',
        'parcelas',
        'adiantamentos',
        'bonuses',
        'bonus_collaborators',
        'store_benchmarks',
        'collaborator_off_days',
        'weekly_goals',
        'whatsapp_notification_config',
        'cashback_balance',
        'cashback_transactions',
        'cashback_rules',
        'tiny_api_credentials'
    ];
BEGIN
    -- Validar slug
    IF p_tenant_slug IS NULL OR length(trim(p_tenant_slug)) = 0 THEN
        RAISE EXCEPTION 'Slug do tenant não pode ser vazio';
    END IF;

    -- Gerar schema name (sanitizar)
    v_schema_name := 'tenant_' || lower(regexp_replace(p_tenant_slug, '[^a-z0-9]', '_', 'g'));
    
    -- Verificar se já existe
    IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_tenant_slug OR schema_name = v_schema_name) THEN
        RAISE EXCEPTION 'Tenant com slug % já existe', p_tenant_slug;
    END IF;

    -- Criar tenant na tabela
    INSERT INTO tenants (name, slug, schema_name)
    VALUES (p_tenant_name, p_tenant_slug, v_schema_name)
    RETURNING id INTO v_tenant_id;
    
    -- Criar schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);
    
    -- Copiar estrutura de cada tabela
    FOREACH v_table_name IN ARRAY v_tables
    LOOP
        -- Criar tabela no schema do tenant baseada na estrutura do schema sistemaretiradas
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.%I (LIKE sistemaretiradas.%I INCLUDING ALL)
        ', v_schema_name, v_table_name, v_table_name);
        
        -- Copiar índices (se existirem)
        -- Nota: Isso é simplificado, pode precisar ajustar índices específicos depois
    END LOOP;
    
    -- Copiar RLS policies (simplificado - pode precisar ajustar depois)
    -- Nota: RLS policies precisam ser recriadas manualmente ou via script separado
    
    RAISE NOTICE 'Schema % criado com sucesso para tenant %', v_schema_name, p_tenant_name;
    
    RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION create_tenant_schema(TEXT, TEXT) IS 'Cria um novo schema para um tenant e copia estrutura de tabelas';

-- =============================================================================
-- 3. FUNÇÃO: get_tenant_schema_by_user
-- =============================================================================
-- Retorna o schema do tenant baseado no usuário logado
-- Se schema_name for NULL, retorna 'sistemaretiradas' (compatibilidade)
CREATE OR REPLACE FUNCTION get_tenant_schema_by_user()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_schema_name TEXT;
    v_user_id UUID;
    v_tenant_record RECORD;
BEGIN
    -- Obter ID do usuário atual
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN 'sistemaretiradas'; -- Schema padrão
    END IF;
    
    -- Buscar tenant do usuário (verificar se profile existe no sistemaretiradas primeiro)
    -- Para compatibilidade, se o usuário existe no sistemaretiradas, usa esse schema
    IF EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = v_user_id) THEN
        -- Verificar se há tenant configurado com schema_name NULL (usa sistemaretiradas)
        SELECT schema_name INTO v_schema_name
        FROM tenants
        WHERE active = true
        AND (schema_name IS NULL OR schema_name = 'sistemaretiradas')
        LIMIT 1;
        
        -- Se não encontrou tenant específico, retorna sistemaretiradas (padrão)
        RETURN COALESCE(v_schema_name, 'sistemaretiradas');
    END IF;
    
    -- Se usuário não está no sistemaretiradas, buscar em outros schemas de tenant
    FOR v_tenant_record IN 
        SELECT schema_name FROM tenants 
        WHERE active = true 
        AND schema_name IS NOT NULL
        AND schema_name != 'sistemaretiradas'
    LOOP
        -- Verificar se o usuário existe neste schema
        EXECUTE format('
            SELECT 1 FROM %I.profiles WHERE id = $1
        ', v_tenant_record.schema_name) INTO v_schema_name USING v_user_id;
        
        IF v_schema_name IS NOT NULL THEN
            RETURN v_tenant_record.schema_name;
        END IF;
    END LOOP;
    
    -- Se não encontrou, retorna schema padrão (sistemaretiradas)
    RETURN 'sistemaretiradas';
END;
$$;

COMMENT ON FUNCTION get_tenant_schema_by_user() IS 'Retorna o schema do tenant do usuário logado. Retorna sistemaretiradas por padrão para compatibilidade';

-- =============================================================================
-- 4. FUNÇÃO: migrate_data_to_tenant
-- =============================================================================
-- Migra dados do schema sistemaretiradas para um schema de tenant específico
-- ATENÇÃO: Esta função deve ser executada com cuidado e apenas uma vez por tenant
CREATE OR REPLACE FUNCTION migrate_data_to_tenant(
    p_tenant_schema_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY[
        'profiles',
        'stores',
        'goals',
        'day_weights',
        'sales',
        'purchases',
        'parcelas',
        'adiantamentos',
        'bonuses',
        'bonus_collaborators',
        'store_benchmarks',
        'collaborator_off_days',
        'weekly_goals',
        'whatsapp_notification_config',
        'cashback_balance',
        'cashback_transactions',
        'cashback_rules',
        'tiny_api_credentials'
    ];
    v_count INTEGER;
    v_total_count INTEGER := 0;
    v_result JSON;
BEGIN
    -- Validar que o schema existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = p_tenant_schema_name
    ) THEN
        RAISE EXCEPTION 'Schema % não existe', p_tenant_schema_name;
    END IF;

    -- Migrar dados de cada tabela
    FOREACH v_table_name IN ARRAY v_tables
    LOOP
        -- Verificar se a tabela existe no schema origem
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = v_table_name
        ) THEN
            -- Copiar dados (INSERT ... SELECT)
            EXECUTE format('
                INSERT INTO %I.%I 
                SELECT * FROM sistemaretiradas.%I
                ON CONFLICT DO NOTHING
            ', p_tenant_schema_name, v_table_name, v_table_name);
            
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_total_count := v_total_count + v_count;
            
            RAISE NOTICE 'Migrados % registros da tabela %', v_count, v_table_name;
        END IF;
    END LOOP;
    
    v_result := json_build_object(
        'success', true,
        'total_migrated', v_total_count,
        'schema', p_tenant_schema_name
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION migrate_data_to_tenant(TEXT) IS 'Migra dados do schema sistemaretiradas para um schema de tenant';

-- =============================================================================
-- 5. CRIAR TENANT PADRÃO: oliveira-martins
-- =============================================================================
-- Cria o tenant padrão para Oliveira Martins
-- IMPORTANTE: Este tenant usa o schema sistemaretiradas (schema_name = NULL)
-- Dados existentes continuam no sistemaretiradas, sem migração
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Criar tenant que usa o schema sistemaretiradas atual
    -- schema_name = NULL significa que usa o schema padrão (sistemaretiradas)
    INSERT INTO tenants (name, slug, schema_name, active)
    VALUES ('Oliveira Martins', 'oliveira-martins', NULL, true)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO v_tenant_id;
    
    IF v_tenant_id IS NOT NULL THEN
        RAISE NOTICE 'Tenant padrão criado: % (usa schema sistemaretiradas)', v_tenant_id;
    ELSE
        RAISE NOTICE 'Tenant oliveira-martins já existe';
    END IF;
END;
$$;

-- =============================================================================
-- 6. ATUALIZAR tiny_api_credentials para suportar tenant_id (OPCIONAL)
-- =============================================================================
-- Adicionar tenant_id na tabela de credenciais Tiny (se a tabela existir)
-- Isso permite que cada tenant tenha suas próprias credenciais Tiny ERP
DO $$
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_api_credentials'
    ) THEN
        -- Verificar se a coluna já existe antes de adicionar
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'tiny_api_credentials' 
            AND column_name = 'tenant_id'
        ) THEN
            ALTER TABLE sistemaretiradas.tiny_api_credentials 
            ADD COLUMN tenant_id UUID REFERENCES tenants(id);
            
            -- Atualizar registros existentes para o tenant padrão (se houver)
            UPDATE sistemaretiradas.tiny_api_credentials
            SET tenant_id = (SELECT id FROM tenants WHERE slug = 'oliveira-martins' LIMIT 1)
            WHERE tenant_id IS NULL;
        END IF;
    END IF;
END;
$$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

