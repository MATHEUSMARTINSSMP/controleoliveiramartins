-- ============================================================================
-- DIAGNÓSTICO: Verificar problemas na tabela queue_members
-- ============================================================================
-- Execute esta query no SQL Editor do Supabase para diagnosticar problemas
-- ============================================================================

-- 1. Verificar registros duplicados (mesma colaboradora, mesma sessão, status ativo)
SELECT 
    session_id,
    profile_id,
    COUNT(*) as total_registros,
    STRING_AGG(id::text, ', ') as ids,
    STRING_AGG(status, ', ') as status_list,
    STRING_AGG(position::text, ', ') as positions
FROM sistemaretiradas.queue_members
WHERE status IN ('disponivel', 'em_atendimento', 'pausado')
GROUP BY session_id, profile_id
HAVING COUNT(*) > 1
ORDER BY total_registros DESC;

-- 2. Verificar todos os registros de uma sessão específica (substitua o session_id)
SELECT 
    id,
    session_id,
    profile_id,
    status,
    position,
    check_in_at,
    updated_at,
    p.name as colaboradora_nome
FROM sistemaretiradas.queue_members qm
LEFT JOIN sistemaretiradas.profiles p ON p.id = qm.profile_id
WHERE session_id = 'd0d1b4e0-7e17-40bd-a46f-6a08a2fea95c'  -- Substitua pelo session_id do erro
ORDER BY profile_id, status;

-- 3. Verificar atendimentos em andamento sem queue_member correspondente
SELECT 
    a.id as attendance_id,
    a.profile_id,
    a.session_id,
    a.status as attendance_status,
    a.started_at,
    qm.id as queue_member_id,
    qm.status as queue_member_status
FROM sistemaretiradas.attendances a
LEFT JOIN sistemaretiradas.queue_members qm 
    ON qm.profile_id = a.profile_id 
    AND qm.session_id = a.session_id
WHERE a.status = 'em_andamento'
ORDER BY a.started_at DESC;

-- 4. Verificar colaboradora específica que está dando erro (substitua o profile_id)
SELECT 
    qm.id,
    qm.session_id,
    qm.profile_id,
    qm.status,
    qm.position,
    qm.check_in_at,
    qm.updated_at,
    p.name as colaboradora_nome
FROM sistemaretiradas.queue_members qm
LEFT JOIN sistemaretiradas.profiles p ON p.id = qm.profile_id
WHERE qm.profile_id = '07d97621-6744-4eb7-a09e-fd59c0e31f08'  -- Substitua pelo profile_id do erro
ORDER BY qm.session_id, qm.status;

-- 5. Limpar registros duplicados e registros 'finalizado' órfãos
-- Esta query:
-- - Remove registros 'finalizado' que não deveriam existir (só devem existir status ativos)
-- - Mantém apenas o registro mais recente para cada (session_id, profile_id) com status ativo
DELETE FROM sistemaretiradas.queue_members
WHERE id IN (
    -- Remover registros 'finalizado' (não deveriam existir na fila)
    SELECT id
    FROM sistemaretiradas.queue_members
    WHERE status = 'finalizado'
    
    UNION ALL
    
    -- Remover duplicatas de status ativos (mantém apenas o mais recente)
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY session_id, profile_id 
                   ORDER BY 
                       CASE status 
                           WHEN 'em_atendimento' THEN 1  -- Priorizar 'em_atendimento'
                           WHEN 'disponivel' THEN 2
                           WHEN 'pausado' THEN 3
                           ELSE 4
                       END,
                       updated_at DESC, 
                       check_in_at DESC
               ) as rn
        FROM sistemaretiradas.queue_members
        WHERE status IN ('disponivel', 'em_atendimento', 'pausado')
    ) t
    WHERE rn > 1
);

-- ============================================================================
-- ✅ QUERIES DE DIAGNÓSTICO
-- ============================================================================
-- Execute a query 1 primeiro para ver se há duplicatas
-- Depois execute a query 3 para ver atendimentos sem queue_member
-- Use as queries 2 e 4 para investigar casos específicos
-- A query 5 é para limpar duplicatas (use com cuidado!)

