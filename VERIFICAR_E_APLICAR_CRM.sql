-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO E APLICAÇÃO DO SISTEMA CRM
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE A COLUNA crm_ativo EXISTE EM stores
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'stores' 
        AND column_name = 'crm_ativo'
    ) THEN
        ALTER TABLE sistemaretiradas.stores
        ADD COLUMN crm_ativo BOOLEAN NOT NULL DEFAULT false;
        
        CREATE INDEX IF NOT EXISTS idx_stores_crm_ativo ON sistemaretiradas.stores(crm_ativo);
        
        COMMENT ON COLUMN sistemaretiradas.stores.crm_ativo IS 'Indica se o módulo de CRM está ativo para esta loja';
        
        RAISE NOTICE 'Coluna crm_ativo adicionada à tabela stores';
    ELSE
        RAISE NOTICE 'Coluna crm_ativo já existe na tabela stores';
    END IF;
END $$;

-- ============================================================================
-- 2. VERIFICAR E CRIAR TABELA crm_contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    data_nascimento DATE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_store ON sistemaretiradas.crm_contacts(store_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_nome ON sistemaretiradas.crm_contacts(nome);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_data_nascimento ON sistemaretiradas.crm_contacts(data_nascimento);

COMMENT ON TABLE sistemaretiradas.crm_contacts IS 'Contatos do CRM vinculados a uma loja';
COMMENT ON COLUMN sistemaretiradas.crm_contacts.store_id IS 'Loja à qual o contato pertence (multi-tenancy)';

-- ============================================================================
-- 3. VERIFICAR E CRIAR TABELA crm_tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES sistemaretiradas.crm_contacts(id) ON DELETE SET NULL,
    cliente_nome TEXT, -- Nome do cliente (pode ser livre se não houver contato)
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('ALTA', 'MÉDIA', 'BAIXA')),
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONCLUÍDA', 'CANCELADA')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_store ON sistemaretiradas.crm_tasks(store_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_colaboradora ON sistemaretiradas.crm_tasks(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON sistemaretiradas.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON sistemaretiradas.crm_tasks(due_date);

COMMENT ON TABLE sistemaretiradas.crm_tasks IS 'Tarefas do CRM vinculadas a uma loja';
COMMENT ON COLUMN sistemaretiradas.crm_tasks.store_id IS 'Loja à qual a tarefa pertence (multi-tenancy)';

-- ============================================================================
-- 4. VERIFICAR E CRIAR TABELA crm_commitments
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.crm_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES sistemaretiradas.crm_contacts(id) ON DELETE SET NULL,
    cliente_nome TEXT, -- Nome do cliente (pode ser livre se não houver contato)
    type TEXT NOT NULL CHECK (type IN ('AJUSTE', 'FOLLOW_UP', 'VENDA', 'OUTRO')),
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'AGENDADO' CHECK (status IN ('AGENDADO', 'CONCLUÍDO', 'CANCELADO', 'FALTANDO')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_commitments_store ON sistemaretiradas.crm_commitments(store_id);
CREATE INDEX IF NOT EXISTS idx_crm_commitments_colaboradora ON sistemaretiradas.crm_commitments(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_crm_commitments_scheduled_date ON sistemaretiradas.crm_commitments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_crm_commitments_status ON sistemaretiradas.crm_commitments(status);

COMMENT ON TABLE sistemaretiradas.crm_commitments IS 'Compromissos do CRM vinculados a uma loja';
COMMENT ON COLUMN sistemaretiradas.crm_commitments.store_id IS 'Loja à qual o compromisso pertence (multi-tenancy)';

-- ============================================================================
-- 5. VERIFICAR E CRIAR TABELA crm_post_sales
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.crm_post_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE SET NULL,
    tiny_order_id UUID REFERENCES sistemaretiradas.tiny_orders(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES sistemaretiradas.crm_contacts(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    sale_date DATE NOT NULL,
    scheduled_follow_up DATE NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'AGENDADA' CHECK (status IN ('AGENDADA', 'CONCLUÍDA', 'CANCELADA')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_post_sales_store ON sistemaretiradas.crm_post_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_crm_post_sales_sale ON sistemaretiradas.crm_post_sales(sale_id);
CREATE INDEX IF NOT EXISTS idx_crm_post_sales_scheduled_follow_up ON sistemaretiradas.crm_post_sales(scheduled_follow_up);
CREATE INDEX IF NOT EXISTS idx_crm_post_sales_status ON sistemaretiradas.crm_post_sales(status);

COMMENT ON TABLE sistemaretiradas.crm_post_sales IS 'Pós-vendas agendadas vinculadas a uma loja';
COMMENT ON COLUMN sistemaretiradas.crm_post_sales.store_id IS 'Loja à qual a pós-venda pertence (multi-tenancy)';

-- ============================================================================
-- 6. CRIAR TRIGGERS PARA updated_at (se não existirem)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS update_crm_contacts_updated_at ON sistemaretiradas.crm_contacts;
DROP TRIGGER IF EXISTS update_crm_tasks_updated_at ON sistemaretiradas.crm_tasks;
DROP TRIGGER IF EXISTS update_crm_commitments_updated_at ON sistemaretiradas.crm_commitments;
DROP TRIGGER IF EXISTS update_crm_post_sales_updated_at ON sistemaretiradas.crm_post_sales;

-- Criar triggers
CREATE TRIGGER update_crm_contacts_updated_at
    BEFORE UPDATE ON sistemaretiradas.crm_contacts
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at
    BEFORE UPDATE ON sistemaretiradas.crm_tasks
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_crm_commitments_updated_at
    BEFORE UPDATE ON sistemaretiradas.crm_commitments
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_crm_post_sales_updated_at
    BEFORE UPDATE ON sistemaretiradas.crm_post_sales
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

-- ============================================================================
-- 7. HABILITAR RLS E CRIAR POLÍTICAS
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_post_sales ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem (para evitar duplicatas)
DROP POLICY IF EXISTS "Admin pode ver contatos de suas lojas" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Loja pode ver contatos da sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Colaboradora pode ver contatos da sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Admin pode criar contatos para suas lojas" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Loja pode criar contatos para sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Colaboradora pode criar contatos para sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Admin pode atualizar contatos de suas lojas" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Loja pode atualizar contatos da sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Colaboradora pode atualizar contatos da sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Admin pode deletar contatos de suas lojas" ON sistemaretiradas.crm_contacts;

-- Políticas para crm_contacts
CREATE POLICY "Admin pode ver contatos de suas lojas"
ON sistemaretiradas.crm_contacts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_contacts.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode ver contatos da sua loja"
ON sistemaretiradas.crm_contacts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_contacts.store_id
    )
);

CREATE POLICY "Colaboradora pode ver contatos da sua loja"
ON sistemaretiradas.crm_contacts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_contacts.store_id
    )
);

CREATE POLICY "Admin pode criar contatos para suas lojas"
ON sistemaretiradas.crm_contacts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_contacts.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode criar contatos para sua loja"
ON sistemaretiradas.crm_contacts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_contacts.store_id
    )
);

CREATE POLICY "Colaboradora pode criar contatos para sua loja"
ON sistemaretiradas.crm_contacts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_contacts.store_id
    )
);

CREATE POLICY "Admin pode atualizar contatos de suas lojas"
ON sistemaretiradas.crm_contacts
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_contacts.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode atualizar contatos da sua loja"
ON sistemaretiradas.crm_contacts
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_contacts.store_id
    )
);

CREATE POLICY "Colaboradora pode atualizar contatos da sua loja"
ON sistemaretiradas.crm_contacts
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_contacts.store_id
    )
);

CREATE POLICY "Admin pode deletar contatos de suas lojas"
ON sistemaretiradas.crm_contacts
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_contacts.store_id
        AND s.admin_id = auth.uid()
    )
);

-- Remover políticas antigas de crm_tasks
DROP POLICY IF EXISTS "Admin pode ver tarefas de suas lojas" ON sistemaretiradas.crm_tasks;
DROP POLICY IF EXISTS "Loja pode ver tarefas da sua loja" ON sistemaretiradas.crm_tasks;
DROP POLICY IF EXISTS "Colaboradora pode ver tarefas da sua loja" ON sistemaretiradas.crm_tasks;
DROP POLICY IF EXISTS "Admin pode gerenciar tarefas de suas lojas" ON sistemaretiradas.crm_tasks;
DROP POLICY IF EXISTS "Loja pode gerenciar tarefas da sua loja" ON sistemaretiradas.crm_tasks;
DROP POLICY IF EXISTS "Colaboradora pode gerenciar tarefas da sua loja" ON sistemaretiradas.crm_tasks;

-- Políticas para crm_tasks
CREATE POLICY "Admin pode ver tarefas de suas lojas"
ON sistemaretiradas.crm_tasks
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_tasks.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode ver tarefas da sua loja"
ON sistemaretiradas.crm_tasks
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_tasks.store_id
    )
);

CREATE POLICY "Colaboradora pode ver tarefas da sua loja"
ON sistemaretiradas.crm_tasks
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_tasks.store_id
    )
);

CREATE POLICY "Admin pode gerenciar tarefas de suas lojas"
ON sistemaretiradas.crm_tasks
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_tasks.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode gerenciar tarefas da sua loja"
ON sistemaretiradas.crm_tasks
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_tasks.store_id
    )
);

CREATE POLICY "Colaboradora pode gerenciar tarefas da sua loja"
ON sistemaretiradas.crm_tasks
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_tasks.store_id
    )
);

-- Remover políticas antigas de crm_commitments
DROP POLICY IF EXISTS "Admin pode gerenciar compromissos de suas lojas" ON sistemaretiradas.crm_commitments;
DROP POLICY IF EXISTS "Loja pode gerenciar compromissos da sua loja" ON sistemaretiradas.crm_commitments;
DROP POLICY IF EXISTS "Colaboradora pode gerenciar compromissos da sua loja" ON sistemaretiradas.crm_commitments;

-- Políticas para crm_commitments
CREATE POLICY "Admin pode gerenciar compromissos de suas lojas"
ON sistemaretiradas.crm_commitments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_commitments.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode gerenciar compromissos da sua loja"
ON sistemaretiradas.crm_commitments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_commitments.store_id
    )
);

CREATE POLICY "Colaboradora pode gerenciar compromissos da sua loja"
ON sistemaretiradas.crm_commitments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_commitments.store_id
    )
);

-- Remover políticas antigas de crm_post_sales
DROP POLICY IF EXISTS "Admin pode gerenciar pós-vendas de suas lojas" ON sistemaretiradas.crm_post_sales;
DROP POLICY IF EXISTS "Loja pode gerenciar pós-vendas da sua loja" ON sistemaretiradas.crm_post_sales;
DROP POLICY IF EXISTS "Colaboradora pode gerenciar pós-vendas da sua loja" ON sistemaretiradas.crm_post_sales;

-- Políticas para crm_post_sales
CREATE POLICY "Admin pode gerenciar pós-vendas de suas lojas"
ON sistemaretiradas.crm_post_sales
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = crm_post_sales.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Loja pode gerenciar pós-vendas da sua loja"
ON sistemaretiradas.crm_post_sales
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default = crm_post_sales.store_id
    )
);

CREATE POLICY "Colaboradora pode gerenciar pós-vendas da sua loja"
ON sistemaretiradas.crm_post_sales
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_post_sales.store_id
    )
);

-- ============================================================================
-- 8. VERIFICAÇÃO FINAL
-- ============================================================================
DO $$
DECLARE
    v_crm_ativo_exists BOOLEAN;
    v_tables_exist BOOLEAN;
BEGIN
    -- Verificar se crm_ativo existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'stores' 
        AND column_name = 'crm_ativo'
    ) INTO v_crm_ativo_exists;
    
    -- Verificar se todas as tabelas existem
    SELECT (
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'crm_contacts') AND
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'crm_tasks') AND
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'crm_commitments') AND
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'crm_post_sales')
    ) INTO v_tables_exist;
    
    IF v_crm_ativo_exists AND v_tables_exist THEN
        RAISE NOTICE '✅ Sistema CRM configurado com sucesso!';
        RAISE NOTICE '   - Coluna crm_ativo existe em stores';
        RAISE NOTICE '   - Todas as tabelas CRM foram criadas';
        RAISE NOTICE '   - RLS habilitado e políticas criadas';
    ELSE
        RAISE WARNING '⚠️ Alguma verificação falhou. Execute o script novamente.';
    END IF;
END $$;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

