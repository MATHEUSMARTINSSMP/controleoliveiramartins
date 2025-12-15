-- =============================================================================
-- TODAS AS QUERIES CORRIGIDAS PARA N8N - DRE
-- Schema: sistemaretiradas
-- =============================================================================

-- =============================================================================
-- NODE: PostgreSQL - GET Categorias (usado pelo Preparar Prompt IA)
-- =============================================================================
-- Parâmetro: $1 = store_id (do CONVERT SITE SLUG TO STORE ID)

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
-- NODE: PostgreSQL - GET Lançamentos
-- =============================================================================
-- Parâmetros: $1=site_slug, $2=categoria_id, $3=competencia, $4=pesquisa
-- NOTA: Removido JOIN com collaborators pois a tabela não existe

SELECT 
    l.*,
    c.nome AS categoria_nome,
    c.tipo AS categoria_tipo
FROM sistemaretiradas.dre_lancamentos l
LEFT JOIN sistemaretiradas.dre_categorias c ON l.categoria_id = c.id
INNER JOIN sistemaretiradas.stores s ON l.store_id = s.id
WHERE 
    ($1::text = '' OR s.site_slug = $1)
    AND ($2::uuid IS NULL OR l.categoria_id = $2)
    AND ($3::text = '' OR l.competencia = $3)
    AND ($4::text = '' OR l.descricao ILIKE '%' || $4 || '%')
ORDER BY l.competencia DESC, l.data_lancamento DESC;


-- =============================================================================
-- NODE: PostgreSQL - POST Lançamento (Manual e IA)
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


-- Query Replacement para POST:
-- {
--   "categoria_id": "={{ $json.categoria_id }}",
--   "descricao": "={{ $json.descricao }}",
--   "valor": "={{ $json.valor }}",
--   "competencia": "={{ $json.competencia }}",
--   "data_lancamento": "={{ $json.data_lancamento }}",
--   "observacoes": "={{ $json.observacoes }}",
--   "store_id": "={{ $('CONVERT SITE SLUG TO STORE ID').first().json.store_id }}",
--   "created_by_id": "={{ $json.created_by_id }}"
-- }


-- =============================================================================
-- NODE: PostgreSQL - PUT Lançamento
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
RETURNING 
    *,
    (SELECT nome FROM sistemaretiradas.dre_categorias WHERE id = COALESCE($1::uuid, categoria_id)) AS categoria_nome,
    (SELECT tipo FROM sistemaretiradas.dre_categorias WHERE id = COALESCE($1::uuid, categoria_id)) AS categoria_tipo;


-- =============================================================================
-- NODE: PostgreSQL - DELETE Lançamento
-- =============================================================================
-- Parâmetro: $1=id

DELETE FROM sistemaretiradas.dre_lancamentos 
WHERE id = $1::uuid 
RETURNING id;


-- =============================================================================
-- NODE: CONVERT SITE SLUG TO STORE ID
-- =============================================================================
-- Parâmetro: $1=site_slug

SELECT id AS store_id 
FROM sistemaretiradas.stores 
WHERE site_slug = $1
LIMIT 1;


-- =============================================================================
-- CÓDIGO JAVASCRIPT CORRIGIDO PARA: Processar Resposta IA
-- =============================================================================
-- Cole este código no node "Processar Resposta IA":

/*
const dadosIA = $('Preparar Prompt IA').item.json
const respostaIA = $('AI Agent').item.json
const categorias = $('PostgreSQL - GET Categorias').all().map(item => item.json)

let jsonResposta = null
try {
    const conteudo = respostaIA.output || respostaIA.content || respostaIA.text || respostaIA
    
    let jsonText = conteudo
    if (typeof conteudo === 'string') {
        jsonText = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = jsonText.match(/(\{[\s\S]*\})/)
        if (jsonMatch) {
            jsonText = jsonMatch[1]
        }
        jsonResposta = JSON.parse(jsonText)
    } else if (typeof conteudo === 'object') {
        jsonResposta = conteudo
    } else {
        throw new Error('Formato de resposta da IA não reconhecido')
    }
} catch (error) {
    throw new Error(`Erro ao processar resposta da IA: ${error.message}`)
}

// Validar categoria_id e buscar nome/tipo
let categoria_nome = 'Não identificada'
let categoria_tipo = 'DESPESA'

if (jsonResposta.categoria_id) {
    const cat = categorias.find(c => c.id === jsonResposta.categoria_id)
    if (cat) {
        categoria_nome = cat.nome
        categoria_tipo = cat.tipo
    }
}

// Validar valor
let valor = 0
if (jsonResposta.valor) {
    valor = parseFloat(String(jsonResposta.valor).replace(/[^\d.,\-]/g, '').replace(',', '.'))
}

if (!valor || valor === 0) {
    throw new Error('IA não retornou valor válido')
}

// Validar competência
let competencia = jsonResposta.competencia || ''
if (!competencia || competencia.length !== 6) {
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    competencia = `${ano}${mes}`
}

// Data de lançamento
let data_lancamento = jsonResposta.data_lancamento
if (!data_lancamento) {
    const agora = new Date()
    data_lancamento = agora.toISOString().split('T')[0]
}

const observacoes = `Processado via IA. Prompt: "${dadosIA.prompt_original}". ${jsonResposta.observacoes || ''}`.trim()

return {
    json: {
        categoria_id: jsonResposta.categoria_id,
        categoria_nome: categoria_nome,
        categoria_tipo: categoria_tipo,
        descricao: jsonResposta.descricao?.trim() || 'Lançamento via IA',
        valor: valor,
        competencia: competencia,
        data_lancamento: data_lancamento,
        observacoes: observacoes,
        site_slug: dadosIA.site_slug,
        created_by_id: dadosIA.created_by_id,
        tipo_detectado: jsonResposta.tipo_detectado || categoria_tipo,
        is_ia: true
    }
}
*/


-- =============================================================================
-- RESUMO DAS CORREÇÕES:
-- 
-- 1. Todos os schemas mudados de "elevea" para "sistemaretiradas"
-- 2. Tabelas: dre_lancamentos, dre_categorias, collaborators, stores
-- 3. INSERT/UPDATE agora retornam categoria_nome e categoria_tipo
-- 4. Processar Resposta IA busca categoria_nome/tipo das categorias carregadas
-- 5. Data de lançamento usa data atual se não informada
-- 6. Valor é parseado corretamente mesmo com R$, vírgula, etc.
-- =============================================================================
