-- =====================================================
-- CORRIGIR POLÍTICAS RLS DA TABELA crm_contacts
-- =====================================================
-- Esta migração garante que as políticas RLS estão corretas
-- e permitem que admins criem contatos para suas lojas

-- Remover políticas antigas de INSERT para recriar
DROP POLICY IF EXISTS "Admin pode criar contatos para suas lojas" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Loja pode criar contatos para sua loja" ON sistemaretiradas.crm_contacts;
DROP POLICY IF EXISTS "Colaboradora pode criar contatos para sua loja" ON sistemaretiradas.crm_contacts;

-- Recriar política de INSERT para Admin (garantir que está correta)
CREATE POLICY "Admin pode criar contatos para suas lojas"
ON sistemaretiradas.crm_contacts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM sistemaretiradas.stores s
        WHERE s.id = crm_contacts.store_id
        AND s.admin_id = auth.uid()
    )
);

-- Recriar política de INSERT para Loja
CREATE POLICY "Loja pode criar contatos para sua loja"
ON sistemaretiradas.crm_contacts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.store_default::UUID = crm_contacts.store_id
    )
);

-- Recriar política de INSERT para Colaboradora
CREATE POLICY "Colaboradora pode criar contatos para sua loja"
ON sistemaretiradas.crm_contacts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = crm_contacts.store_id
    )
);

-- Garantir que RLS está habilitado
ALTER TABLE sistemaretiradas.crm_contacts ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "Admin pode criar contatos para suas lojas" ON sistemaretiradas.crm_contacts IS 'Permite que admins criem contatos para lojas que eles administram';

