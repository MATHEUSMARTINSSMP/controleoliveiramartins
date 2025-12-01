-- ============================================================================
-- MIGRATION: Criar Tabelas do Sistema de CRM
-- Data: 2025-02-02
-- Descrição: Cria todas as tabelas necessárias para o módulo de CRM
-- ============================================================================

-- ============================================================================
-- 1. TABELA: crm_contacts (Contatos do CRM)
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
-- 2. TABELA: crm_tasks (Tarefas do CRM)
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
-- 3. TABELA: crm_commitments (Compromissos do CRM)
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
-- 4. TABELA: crm_post_sales (Pós-Vendas Agendadas)
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
-- 5. ADICIONAR COLUNA crm_ativo NA TABELA stores (se não existir)
-- ============================================================================
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS crm_ativo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_crm_ativo ON sistemaretiradas.stores(crm_ativo);

COMMENT ON COLUMN sistemaretiradas.stores.crm_ativo IS 'Indica se o módulo de CRM está ativo para esta loja';

-- ============================================================================
-- 6. TRIGGERS PARA updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- 7. RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.crm_post_sales ENABLE ROW LEVEL SECURITY;

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
        AND p.store_default::UUID = crm_contacts.store_id
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
        AND p.store_default::UUID = crm_contacts.store_id
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
        AND p.store_default::UUID = crm_contacts.store_id
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

-- Políticas para crm_tasks (mesmo padrão)
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
        AND p.store_default::UUID = crm_tasks.store_id
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
        AND p.store_default::UUID = crm_tasks.store_id
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

-- Políticas para crm_commitments (mesmo padrão)
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
        AND p.store_default::UUID = crm_commitments.store_id
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

-- Políticas para crm_post_sales (mesmo padrão)
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
        AND p.store_default::UUID = crm_post_sales.store_id
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
-- FIM DA MIGRATION
-- ============================================================================

