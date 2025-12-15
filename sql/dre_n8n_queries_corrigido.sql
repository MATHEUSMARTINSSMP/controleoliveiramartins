-- =============================================================================
-- QUERIES SQL CORRIGIDAS PARA N8N - SISTEMA DRE
-- Schema: sistemaretiradas
-- Tabelas: dre_categorias, dre_lancamentos
-- =============================================================================

-- =============================================================================
-- 1. GET LANÇAMENTOS - Query corrigida
-- =============================================================================
-- Parâmetros: $1=site_slug, $2=categoria_id, $3=competencia, $4=pesquisa

SELECT 
    l.*,
    c.nome AS categoria_nome,
    c.tipo AS categoria_tipo,
    col.name AS created_by_name
FROM sistemaretiradas.dre_lancamentos l
LEFT JOIN sistemaretiradas.dre_categorias c ON l.categoria_id = c.id
LEFT JOIN sistemaretiradas.collaborators col ON l.created_by_id = col.user_id
INNER JOIN sistemaretiradas.stores s ON l.store_id = s.id
WHERE 
    ($1::text = '' OR s.site_slug = $1)
    AND ($2::uuid IS NULL OR l.categoria_id = $2)
    AND ($3::text = '' OR l.competencia = $3)
    AND ($4::text = '' OR l.descricao ILIKE '%' || $4 || '%')
ORDER BY l.competencia DESC, l.data_lancamento DESC;


-- =============================================================================
-- 2. GET CATEGORIAS - Query corrigida
-- =============================================================================
-- Parâmetros: $1=store_id (vem do CONVERT SITE SLUG TO STORE ID)

SELECT 
    c.id, 
    c.nome, 
    c.tipo, 
    c.descricao, 
    c.ordem, 
    c.ativo,
    COALESCE(c.store_id IS NULL, false) AS is_global
FROM sistemaretiradas.dre_categorias c
WHERE c.ativo = true 
  AND (c.store_id IS NULL OR c.store_id = $1::uuid)
ORDER BY c.tipo, c.ordem, c.nome;


-- =============================================================================
-- 3. POST LANÇAMENTO (Manual) - Query corrigida
-- =============================================================================
-- Parâmetros: $1=categoria_id, $2=descricao, $3=valor, $4=competencia, 
--             $5=data_lancamento, $6=observacoes, $7=store_id, $8=created_by_id

INSERT INTO sistemaretiradas.dre_lancamentos 
    (categoria_id, descricao, valor, competencia, data_lancamento, observacoes, store_id, created_by_id) 
VALUES 
    ($1::uuid, $2, $3::decimal, $4, COALESCE($5::date, CURRENT_DATE), $6, $7::uuid, $8::uuid) 
RETURNING 
    *,
    (SELECT nome FROM sistemaretiradas.dre_categorias WHERE id = $1::uuid) AS categoria_nome,
    (SELECT tipo FROM sistemaretiradas.dre_categorias WHERE id = $1::uuid) AS categoria_tipo;


-- =============================================================================
-- 4. PUT LANÇAMENTO - Query corrigida
-- =============================================================================
-- Parâmetros: $1=categoria_id, $2=descricao, $3=valor, $4=competencia, $5=observacoes, $6=id

UPDATE sistemaretiradas.dre_lancamentos 
SET 
    categoria_id = COALESCE($1::uuid, categoria_id),
    descricao = COALESCE($2, descricao),
    valor = COALESCE($3::decimal, valor),
    competencia = COALESCE($4, competencia),
    observacoes = COALESCE($5, observacoes),
    updated_at = NOW()
WHERE id = $6::uuid
RETURNING *;


-- =============================================================================
-- 5. DELETE LANÇAMENTO - Query corrigida
-- =============================================================================
-- Parâmetro: $1=id

DELETE FROM sistemaretiradas.dre_lancamentos 
WHERE id = $1::uuid 
RETURNING id;


-- =============================================================================
-- 6. CONVERTER SITE_SLUG PARA STORE_ID
-- =============================================================================
-- Parâmetro: $1=site_slug
-- Use ANTES de qualquer operação que precise do store_id

SELECT id AS store_id 
FROM sistemaretiradas.stores 
WHERE site_slug = $1
LIMIT 1;


-- =============================================================================
-- 7. BUSCAR CATEGORIAS PARA IA (com store_id)
-- =============================================================================
-- Parâmetro: $1=store_id

SELECT 
    c.id, 
    c.nome, 
    c.tipo, 
    c.descricao
FROM sistemaretiradas.dre_categorias c
WHERE c.ativo = true 
  AND (c.store_id IS NULL OR c.store_id = $1::uuid)
ORDER BY c.tipo, c.ordem, c.nome;


-- =============================================================================
-- RESUMO DAS MUDANÇAS:
-- 
-- ERRADO (como estava):
--   elevea.financeiro_dre_lancamentos
--   elevea.financeiro_dre_categorias
--   elevea.financeiro_colaboradoras
--
-- CORRETO (como deve ser):
--   sistemaretiradas.dre_lancamentos
--   sistemaretiradas.dre_categorias
--   sistemaretiradas.collaborators
--   sistemaretiradas.stores
-- =============================================================================
