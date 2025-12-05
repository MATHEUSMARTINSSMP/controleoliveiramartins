-- Migration: Create RLS policies for collaborator_off_days table
-- Description: Políticas de Row Level Security para a tabela collaborator_off_days
-- Date: 2025-12-05

-- Habilitar RLS na tabela
ALTER TABLE sistemaretiradas.collaborator_off_days ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver todas as folgas
CREATE POLICY "admin_select_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.active = true
        )
    );

-- Policy: LOJA pode ver folgas da sua loja
CREATE POLICY "loja_select_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.active = true
            AND profiles.store_id = collaborator_off_days.store_id
        )
    );

-- Policy: ADMIN pode inserir folgas
CREATE POLICY "admin_insert_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.active = true
        )
    );

-- Policy: LOJA pode inserir folgas da sua loja
CREATE POLICY "loja_insert_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.active = true
            AND profiles.store_id = collaborator_off_days.store_id
        )
    );

-- Policy: ADMIN pode atualizar folgas
CREATE POLICY "admin_update_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.active = true
        )
    );

-- Policy: LOJA pode atualizar folgas da sua loja
CREATE POLICY "loja_update_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.active = true
            AND profiles.store_id = collaborator_off_days.store_id
        )
    );

-- Policy: ADMIN pode deletar folgas
CREATE POLICY "admin_delete_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.active = true
        )
    );

-- Policy: LOJA pode deletar folgas da sua loja
CREATE POLICY "loja_delete_collaborator_off_days"
    ON sistemaretiradas.collaborator_off_days
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.active = true
            AND profiles.store_id = collaborator_off_days.store_id
        )
    );

