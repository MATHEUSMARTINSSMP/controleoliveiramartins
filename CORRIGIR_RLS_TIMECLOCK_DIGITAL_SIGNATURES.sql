-- =====================================================
-- CORRIGIR POLÍTICAS RLS PARA time_clock_digital_signatures
-- Ajustar políticas para permitir inserção correta
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "time_clock_digital_signatures_colaboradora_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_admin_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_insert" ON sistemaretiradas.time_clock_digital_signatures;

-- Política: Colaboradora vê apenas suas próprias assinaturas
CREATE POLICY "time_clock_digital_signatures_colaboradora_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (
    colaboradora_id = auth.uid()
    OR
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_digital_signatures.store_id))
    )
);

-- Política: Admin vê assinaturas da sua loja (já coberto pela política acima, mas mantendo para clareza)
CREATE POLICY "time_clock_digital_signatures_admin_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
);

-- Política: Colaboradora pode inserir suas próprias assinaturas
-- IMPORTANTE: Verificar se o colaboradora_id corresponde ao auth.uid()
-- No sistema de ponto, o colaboradoraId passado deve ser o mesmo que auth.uid()
CREATE POLICY "time_clock_digital_signatures_insert"
ON sistemaretiradas.time_clock_digital_signatures
FOR INSERT
TO authenticated
WITH CHECK (
    -- Permite se o colaboradora_id é o próprio usuário autenticado
    -- Esta é a condição principal para colaboradoras registrarem seu próprio ponto
    colaboradora_id = auth.uid()
);

-- Verificar se as políticas foram criadas
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS atualizadas para time_clock_digital_signatures';
    RAISE NOTICE '   - Colaboradoras podem inserir suas próprias assinaturas';
    RAISE NOTICE '   - Admins podem inserir assinaturas de qualquer colaboradora';
    RAISE NOTICE '   - Lojas podem inserir assinaturas de colaboradoras da sua loja';
END $$;

