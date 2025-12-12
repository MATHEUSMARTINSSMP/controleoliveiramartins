-- ============================================================================
-- Script para sincronizar tabelas crm_contacts e contacts
-- Garante que não haja duplicações de CPF entre as tabelas
-- ============================================================================

-- 1. Verificar se ambas as tabelas existem
DO $$
BEGIN
    -- Verificar se crm_contacts existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_contacts'
    ) THEN
        RAISE EXCEPTION 'Tabela crm_contacts não existe!';
    END IF;

    -- Verificar se contacts existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'contacts'
    ) THEN
        RAISE NOTICE 'Tabela contacts não existe. Criando...';
        -- Criar tabela contacts com mesma estrutura de crm_contacts
        CREATE TABLE IF NOT EXISTS sistemaretiradas.contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
            nome TEXT NOT NULL,
            email TEXT,
            telefone TEXT,
            cpf TEXT,
            data_nascimento DATE,
            observacoes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            tiny_contact_id UUID
        );

        -- Criar índices
        CREATE INDEX IF NOT EXISTS idx_contacts_store ON sistemaretiradas.contacts(store_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_nome ON sistemaretiradas.contacts(nome);
        CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON sistemaretiradas.contacts(cpf);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_cpf_unique 
        ON sistemaretiradas.contacts(cpf) 
        WHERE cpf IS NOT NULL;
    ELSE
        -- Tabela contacts existe, verificar se tem todas as colunas necessárias
        RAISE NOTICE 'Tabela contacts existe. Verificando colunas...';
        
        -- Adicionar coluna cpf se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'contacts' 
            AND column_name = 'cpf'
        ) THEN
            RAISE NOTICE 'Adicionando coluna cpf à tabela contacts...';
            ALTER TABLE sistemaretiradas.contacts
            ADD COLUMN cpf TEXT;
            
            -- Criar índices para CPF
            CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON sistemaretiradas.contacts(cpf);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_cpf_unique 
            ON sistemaretiradas.contacts(cpf) 
            WHERE cpf IS NOT NULL;
        END IF;
        
        -- Adicionar outras colunas que possam estar faltando
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'contacts' 
            AND column_name = 'tiny_contact_id'
        ) THEN
            RAISE NOTICE 'Adicionando coluna tiny_contact_id à tabela contacts...';
            ALTER TABLE sistemaretiradas.contacts
            ADD COLUMN tiny_contact_id UUID;
        END IF;
        
        -- Garantir que os índices existam
        CREATE INDEX IF NOT EXISTS idx_contacts_store ON sistemaretiradas.contacts(store_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_nome ON sistemaretiradas.contacts(nome);
    END IF;
END $$;

-- 2. SINCRONIZAR: crm_contacts -> contacts
-- Inserir registros de crm_contacts que não existem em contacts (por CPF ou ID)
DO $$
DECLARE
    inserted_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    -- Inserir registros novos (que não existem em contacts nem por ID nem por CPF)
    INSERT INTO sistemaretiradas.contacts (
        id, store_id, nome, email, telefone, cpf, 
        data_nascimento, observacoes, created_at, updated_at, tiny_contact_id
    )
    SELECT 
        crm.id,
        crm.store_id,
        crm.nome,
        crm.email,
        crm.telefone,
        crm.cpf,
        crm.data_nascimento,
        crm.observacoes,
        crm.created_at,
        crm.updated_at,
        crm.tiny_contact_id
    FROM sistemaretiradas.crm_contacts crm
    WHERE NOT EXISTS (
        -- Não existe por ID
        SELECT 1 FROM sistemaretiradas.contacts c 
        WHERE c.id = crm.id
    )
    AND (
        -- E não existe por CPF (se CPF não for NULL)
        crm.cpf IS NULL 
        OR NOT EXISTS (
            SELECT 1 FROM sistemaretiradas.contacts c 
            WHERE c.cpf = crm.cpf AND c.cpf IS NOT NULL
        )
    )
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Inseridos % registros de crm_contacts para contacts', inserted_count;

    -- Atualizar registros existentes em contacts com dados de crm_contacts
    -- (atualizar apenas se o ID existir em contacts)
    UPDATE sistemaretiradas.contacts c
    SET 
        store_id = crm.store_id,
        nome = crm.nome,
        email = crm.email,
        telefone = crm.telefone,
        cpf = crm.cpf,
        data_nascimento = crm.data_nascimento,
        observacoes = crm.observacoes,
        updated_at = crm.updated_at,
        tiny_contact_id = crm.tiny_contact_id
    FROM sistemaretiradas.crm_contacts crm
    WHERE c.id = crm.id
    AND (
        -- Só atualizar se houver diferenças
        c.store_id IS DISTINCT FROM crm.store_id
        OR c.nome IS DISTINCT FROM crm.nome
        OR c.email IS DISTINCT FROM crm.email
        OR c.telefone IS DISTINCT FROM crm.telefone
        OR c.cpf IS DISTINCT FROM crm.cpf
        OR c.data_nascimento IS DISTINCT FROM crm.data_nascimento
        OR c.observacoes IS DISTINCT FROM crm.observacoes
        OR c.tiny_contact_id IS DISTINCT FROM crm.tiny_contact_id
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Atualizados % registros em contacts com dados de crm_contacts', updated_count;
END $$;

-- 3. SINCRONIZAR: contacts -> crm_contacts
-- Inserir registros de contacts que não existem em crm_contacts (por CPF ou ID)
-- ATENÇÃO: Esta sincronização é mais conservadora para evitar conflitos
DO $$
DECLARE
    inserted_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    -- Inserir registros novos (que não existem em crm_contacts nem por ID nem por CPF)
    INSERT INTO sistemaretiradas.crm_contacts (
        id, store_id, nome, email, telefone, cpf, 
        data_nascimento, observacoes, created_at, updated_at, tiny_contact_id
    )
    SELECT 
        c.id,
        c.store_id,
        c.nome,
        c.email,
        c.telefone,
        c.cpf,
        c.data_nascimento,
        c.observacoes,
        c.created_at,
        c.updated_at,
        c.tiny_contact_id
    FROM sistemaretiradas.contacts c
    WHERE NOT EXISTS (
        -- Não existe por ID
        SELECT 1 FROM sistemaretiradas.crm_contacts crm 
        WHERE crm.id = c.id
    )
    AND (
        -- E não existe por CPF (se CPF não for NULL)
        c.cpf IS NULL 
        OR NOT EXISTS (
            SELECT 1 FROM sistemaretiradas.crm_contacts crm 
            WHERE crm.cpf = c.cpf AND crm.cpf IS NOT NULL
        )
    )
    ON CONFLICT (id) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Inseridos % registros de contacts para crm_contacts', inserted_count;

    -- Atualizar registros existentes em crm_contacts com dados de contacts
    -- (atualizar apenas se o ID existir em crm_contacts)
    UPDATE sistemaretiradas.crm_contacts crm
    SET 
        store_id = c.store_id,
        nome = c.nome,
        email = c.email,
        telefone = c.telefone,
        cpf = c.cpf,
        data_nascimento = c.data_nascimento,
        observacoes = c.observacoes,
        updated_at = c.updated_at,
        tiny_contact_id = c.tiny_contact_id
    FROM sistemaretiradas.contacts c
    WHERE crm.id = c.id
    AND (
        -- Só atualizar se houver diferenças
        crm.store_id IS DISTINCT FROM c.store_id
        OR crm.nome IS DISTINCT FROM c.nome
        OR crm.email IS DISTINCT FROM c.email
        OR crm.telefone IS DISTINCT FROM c.telefone
        OR crm.cpf IS DISTINCT FROM c.cpf
        OR crm.data_nascimento IS DISTINCT FROM c.data_nascimento
        OR crm.observacoes IS DISTINCT FROM c.observacoes
        OR crm.tiny_contact_id IS DISTINCT FROM c.tiny_contact_id
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Atualizados % registros em crm_contacts com dados de contacts', updated_count;
END $$;

-- 4. Verificar e remover duplicações de CPF dentro de cada tabela
-- (caso existam registros com mesmo CPF mas IDs diferentes)

-- Remover duplicados em crm_contacts (manter o mais recente)
DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH duplicados AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY cpf 
                ORDER BY updated_at DESC, created_at DESC
            ) as rn
        FROM sistemaretiradas.crm_contacts
        WHERE cpf IS NOT NULL
    )
    DELETE FROM sistemaretiradas.crm_contacts
    WHERE id IN (
        SELECT id FROM duplicados WHERE rn > 1
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Removidos % registros duplicados de crm_contacts (mesmo CPF)', deleted_count;
    END IF;
END $$;

-- Remover duplicados em contacts (manter o mais recente)
DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH duplicados AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY cpf 
                ORDER BY updated_at DESC, created_at DESC
            ) as rn
        FROM sistemaretiradas.contacts
        WHERE cpf IS NOT NULL
    )
    DELETE FROM sistemaretiradas.contacts
    WHERE id IN (
        SELECT id FROM duplicados WHERE rn > 1
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Removidos % registros duplicados de contacts (mesmo CPF)', deleted_count;
    END IF;
END $$;

-- 5. Relatório final de sincronização
SELECT 
    'crm_contacts' as tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT cpf) FILTER (WHERE cpf IS NOT NULL) as cpfs_unicos,
    COUNT(*) FILTER (WHERE cpf IS NOT NULL) as registros_com_cpf
FROM sistemaretiradas.crm_contacts
UNION ALL
SELECT 
    'contacts' as tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT cpf) FILTER (WHERE cpf IS NOT NULL) as cpfs_unicos,
    COUNT(*) FILTER (WHERE cpf IS NOT NULL) as registros_com_cpf
FROM sistemaretiradas.contacts;

-- 6. Verificar registros que existem em uma tabela mas não na outra (por CPF)
SELECT 
    'Registros em crm_contacts sem correspondente em contacts (por CPF)' as tipo,
    COUNT(*) as quantidade
FROM sistemaretiradas.crm_contacts crm
WHERE crm.cpf IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.contacts c 
    WHERE c.cpf = crm.cpf
)
UNION ALL
SELECT 
    'Registros em contacts sem correspondente em crm_contacts (por CPF)' as tipo,
    COUNT(*) as quantidade
FROM sistemaretiradas.contacts c
WHERE c.cpf IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.crm_contacts crm 
    WHERE crm.cpf = c.cpf
);

-- ============================================================================
-- FIM DA SINCRONIZAÇÃO
-- ============================================================================
-- 
-- RESUMO:
-- 1. Verifica/cria tabela contacts se necessário
-- 2. Sincroniza crm_contacts -> contacts (inserir novos e atualizar existentes)
-- 3. Sincroniza contacts -> crm_contacts (inserir novos e atualizar existentes)
-- 4. Remove duplicados dentro de cada tabela (mantém o mais recente)
-- 5. Mostra relatório final
-- 
-- GARANTIAS:
-- - Não cria duplicados de CPF entre as tabelas
-- - Não cria duplicados de CPF dentro da mesma tabela
-- - Mantém dados mais recentes em caso de conflito
-- - Usa ID como chave primária e CPF como chave de unicidade
-- ============================================================================

