/**
 * Biblioteca de integração com N8N para DRE
 * Demonstração do Resultado do Exercício
 * 
 * IMPORTANTE: O N8N espera receber site_slug, não store_id
 * Este módulo converte store_id para site_slug automaticamente
 */

import type {
    TipoLancamentoDRE,
    DRECategoria,
    DRELancamento,
    DREAnalytics,
    DRECalculo,
    DRERespostaIA
} from '@/types/dre'
import { supabase } from '@/integrations/supabase/client'

// ============================================================
// CONFIGURAÇÃO N8N (usa proxy Netlify para evitar CORS)
// ============================================================

const USE_PROXY = true // Sempre usar proxy para evitar CORS
const PROXY_URL = '/.netlify/functions/n8n-proxy'

async function n8nRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    // Extrair parâmetros de query string se houver
    let cleanEndpoint = endpoint
    let params: Record<string, string> = {}
    
    if (endpoint.includes('?')) {
        const [path, queryString] = endpoint.split('?')
        cleanEndpoint = path
        const searchParams = new URLSearchParams(queryString)
        searchParams.forEach((value, key) => {
            params[key] = value
        })
    }

    // Preparar body para o proxy
    const proxyBody = {
        endpoint: cleanEndpoint,
        method: options.method || 'GET',
        params,
        body: options.body ? JSON.parse(options.body as string) : undefined
    }

    if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'development')) {
        console.log('[n8n-dre] Chamando via proxy:', cleanEndpoint)
    }

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proxyBody),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        const contentType = response.headers.get('content-type')
        const isJson = contentType?.includes('application/json')

        let data: any = {}

        if (isJson) {
            data = await response.json().catch((err) => {
                console.error('[n8n-dre] Erro ao parsear JSON:', err)
                return {}
            })
        } else {
            const text = await response.text().catch(() => '')
            if (text) {
                try {
                    data = JSON.parse(text)
                } catch {
                    throw new Error(`Resposta inválida: ${text.substring(0, 100)}`)
                }
            }
        }

        if (!response.ok) {
            const errorMsg = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`
            console.error('[n8n-dre] Erro HTTP:', {
                status: response.status,
                error: errorMsg
            })
            throw new Error(errorMsg)
        }

        if (data.success === false) {
            throw new Error(data.error || data.message || 'Erro na requisição')
        }

        return data as T
    } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            throw new Error('Timeout: A requisição demorou muito para responder')
        }
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            throw new Error(`Erro de rede: Não foi possível conectar ao servidor N8N`)
        }
        throw err
    }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function parseNumeric(value: string | number | null | undefined): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = parseFloat(value)
        return isNaN(parsed) ? 0 : parsed
    }
    return 0
}

function normalizeDRECategoria(data: any): DRECategoria {
    return {
        id: String(data.id || ''),
        nome: String(data.nome || ''),
        tipo: (data.tipo || 'DESPESA') as TipoLancamentoDRE,
        descricao: data.descricao || null,
        ordem: Number(data.ordem || 0),
        ativo: Boolean(data.ativo !== undefined ? data.ativo : true),
        store_id: data.store_id || null,
        is_global: Boolean(data.is_global || false),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || data.created_at || new Date().toISOString()
    }
}

function normalizeDRELancamento(data: any): DRELancamento {
    return {
        ...data,
        valor: parseNumeric(data.valor)
    }
}

export async function getStoreId(providedStoreId?: string): Promise<string> {
    if (providedStoreId) return providedStoreId

    try {
        const authData = localStorage.getItem('auth')
        if (authData) {
            const parsed = JSON.parse(authData)
            if (parsed.storeId) {
                return parsed.storeId
            }
        }
    } catch (err) {
        console.warn('[n8n-dre] Erro ao obter store_id do localStorage:', err)
    }

    return ''
}

/**
 * Busca o ID do usuário logado via Supabase auth
 * Usado para o campo created_by_id que o N8N exige
 */
export async function getCurrentUserId(): Promise<string> {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id || ''
    } catch (err) {
        console.warn('[n8n-dre] Erro ao obter user ID:', err)
        return ''
    }
}

/**
 * Busca o site_slug a partir do store_id
 * O N8N espera site_slug, não store_id
 */
const siteSlugCache: Record<string, string> = {}

export async function getSiteSlug(storeId: string): Promise<string> {
    if (!storeId) return ''
    
    if (siteSlugCache[storeId]) {
        return siteSlugCache[storeId]
    }

    try {
        const { data, error } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('site_slug')
            .eq('id', storeId)
            .single()

        if (error) {
            console.error('[n8n-dre] Erro ao buscar site_slug:', error)
            return ''
        }

        const siteSlug = data?.site_slug || ''
        if (siteSlug) {
            siteSlugCache[storeId] = siteSlug
        }
        return siteSlug
    } catch (err) {
        console.error('[n8n-dre] Erro ao buscar site_slug:', err)
        return ''
    }
}

// ============================================================
// CATEGORIAS DRE
// ============================================================

export async function getDRECategorias(filters?: {
    store_id?: string
    tipo?: TipoLancamentoDRE
    ativo?: boolean
    pesquisa?: string
    incluir_globais?: boolean
}): Promise<DRECategoria[]> {
    const store_id = filters?.store_id || await getStoreId()
    const site_slug = await getSiteSlug(store_id)

    const params = new URLSearchParams()
    if (site_slug) params.append('site_slug', site_slug)
    if (filters?.incluir_globais !== undefined) {
        params.append('incluir_globais', String(filters.incluir_globais))
    }
    if (filters?.tipo) params.append('tipo', filters.tipo)
    if (filters?.ativo !== undefined) params.append('ativo', String(filters.ativo))
    if (filters?.pesquisa) params.append('pesquisa', filters.pesquisa)

    const data = await n8nRequest<{
        success: boolean
        data: DRECategoria[]
        error?: string
    }>(`/api/dre/categorias${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET'
    })

    return (data.data || []).map(normalizeDRECategoria)
}

export async function createDRECategoria(data: {
    nome: string
    tipo: TipoLancamentoDRE
    descricao?: string
    ordem?: number
    ativo?: boolean
    store_id?: string
}): Promise<DRECategoria> {
    const store_id = await getStoreId(data.store_id)
    const site_slug = await getSiteSlug(store_id)

    if (!site_slug) {
        throw new Error('site_slug é obrigatório para criar categoria DRE customizada')
    }

    const result = await n8nRequest<{
        success: boolean
        data: DRECategoria
        error?: string
    }>(`/api/dre/categorias`, {
        method: 'POST',
        body: JSON.stringify({
            nome: data.nome,
            tipo: data.tipo,
            descricao: data.descricao || null,
            ordem: data.ordem || 0,
            ativo: data.ativo !== undefined ? data.ativo : true,
            site_slug,
            is_global: false
        })
    })

    if (!result.success) {
        throw new Error(result.error || 'Erro ao criar categoria DRE')
    }

    return normalizeDRECategoria(result.data)
}

export async function updateDRECategoria(
    id: string,
    updates: Partial<Pick<DRECategoria, 'nome' | 'descricao' | 'ordem' | 'ativo'>>
): Promise<DRECategoria> {
    const result = await n8nRequest<{
        success: boolean
        data: DRECategoria
        error?: string
    }>(`/api/dre/categorias/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    })

    return normalizeDRECategoria(result.data)
}

export async function deleteDRECategoria(id: string): Promise<void> {
    await n8nRequest<{
        success: boolean
        error?: string
    }>(`/api/dre/categorias/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    })
}

// ============================================================
// LANÇAMENTOS DRE
// ============================================================

export async function getDRELancamentos(filters?: {
    competencia?: string
    categoria_id?: string
    tipo?: TipoLancamentoDRE
    store_id?: string
}): Promise<DRELancamento[]> {
    const store_id = await getStoreId(filters?.store_id)
    const site_slug = await getSiteSlug(store_id)

    const params = new URLSearchParams()
    if (site_slug) params.append('site_slug', site_slug)
    if (filters?.competencia) params.append('competencia', filters.competencia)
    if (filters?.categoria_id) params.append('categoria_id', filters.categoria_id)
    if (filters?.tipo) params.append('tipo', filters.tipo)

    const data = await n8nRequest<{
        success: boolean
        data: DRELancamento[]
        error?: string
    }>(`/api/dre/lancamentos${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET'
    })

    return (data.data || []).map(normalizeDRELancamento)
}

export async function createDRELancamento(data: {
    categoria_id: string
    descricao: string
    valor: number
    competencia: string
    data_lancamento: string // YYYY-MM-DD
    observacoes?: string
    store_id?: string
    created_by_id?: string
}): Promise<DRELancamento> {
    const store_id = await getStoreId(data.store_id)
    const site_slug = await getSiteSlug(store_id)

    if (!site_slug) {
        throw new Error('site_slug é obrigatório para criar lançamento DRE')
    }

    if (!data.data_lancamento) {
        throw new Error('data_lancamento é obrigatório e deve estar no formato YYYY-MM-DD')
    }

    let dataLancamentoFormatada = data.data_lancamento
    if (dataLancamentoFormatada.includes('T')) {
        dataLancamentoFormatada = dataLancamentoFormatada.split('T')[0]
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataLancamentoFormatada)) {
        throw new Error('data_lancamento deve estar no formato YYYY-MM-DD')
    }

    let competenciaFormatada = data.competencia
    if (competenciaFormatada.includes('-') || competenciaFormatada.includes('/')) {
        competenciaFormatada = competenciaFormatada.replace(/[-/]/g, '').substring(0, 6)
    }

    if (!competenciaFormatada || competenciaFormatada.length !== 6 || !/^\d{6}$/.test(competenciaFormatada)) {
        throw new Error('competencia é obrigatória e deve estar no formato YYYYMM (ex: "202512")')
    }

    // Buscar created_by_id automaticamente se não fornecido
    let created_by_id = data.created_by_id
    if (!created_by_id) {
        created_by_id = await getCurrentUserId()
    }

    const result = await n8nRequest<{
        success: boolean
        data: DRELancamento
        error?: string
    }>(`/api/dre/lancamentos`, {
        method: 'POST',
        body: JSON.stringify({
            tipo: 'manual',
            categoria_id: data.categoria_id,
            descricao: data.descricao,
            valor: data.valor,
            competencia: competenciaFormatada,
            data_lancamento: dataLancamentoFormatada,
            observacoes: data.observacoes || null,
            site_slug,
            created_by_id: created_by_id || null
        })
    })

    if (!result.success) {
        throw new Error(result.error || 'Erro ao criar lançamento DRE')
    }

    return normalizeDRELancamento(result.data)
}

/**
 * Cria lançamento DRE via IA (processamento de linguagem natural)
 * Usa endpoint dedicado para IA: /api/financeiro/dre/lancamentos/ia
 */
export async function createDRELancamentoIA(data: {
    prompt: string
    store_id?: string
    created_by_id?: string
}): Promise<DRELancamento> {
    const store_id = await getStoreId(data.store_id)
    const site_slug = await getSiteSlug(store_id)

    if (!site_slug) {
        throw new Error('site_slug é obrigatório para criar lançamento via IA')
    }

    if (!data.prompt || !data.prompt.trim()) {
        throw new Error('prompt é obrigatório para lançamento via IA')
    }

    // Buscar created_by_id automaticamente se não fornecido
    let created_by_id = data.created_by_id
    if (!created_by_id) {
        created_by_id = await getCurrentUserId()
    }

    if (!created_by_id) {
        throw new Error('created_by_id é obrigatório - usuário não está logado')
    }

    const result = await n8nRequest<{
        success: boolean
        data: DRELancamento
        error?: string
    }>(`/api/financeiro/dre/lancamentos/ia`, {
        method: 'POST',
        body: JSON.stringify({
            prompt: data.prompt,
            site_slug,
            created_by_id
        })
    })

    if (!result.success) {
        throw new Error(result.error || 'Erro ao processar lançamento via IA')
    }

    return normalizeDRELancamento(result.data)
}

export async function updateDRELancamento(
    id: string,
    updates: Partial<Pick<DRELancamento, 'categoria_id' | 'descricao' | 'valor' | 'competencia' | 'observacoes'>>
): Promise<DRELancamento> {
    const result = await n8nRequest<{
        success: boolean
        data: DRELancamento
        error?: string
    }>(`/api/dre/lancamentos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    })

    return normalizeDRELancamento(result.data)
}

export async function deleteDRELancamento(id: string): Promise<void> {
    await n8nRequest<{
        success: boolean
        error?: string
    }>(`/api/dre/lancamentos/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    })
}

// ============================================================
// ANALYTICS DRE
// ============================================================

export async function getDREAnalytics(filters?: {
    store_id?: string
    periodo_inicio?: string // YYYY-MM-DD
    periodo_fim?: string // YYYY-MM-DD
}): Promise<DREAnalytics> {
    const store_id = await getStoreId(filters?.store_id)
    const site_slug = await getSiteSlug(store_id)

    if (!site_slug) {
        throw new Error('site_slug é obrigatório para obter analytics DRE')
    }

    const params = new URLSearchParams()
    params.append('site_slug', site_slug)

    if (filters?.periodo_inicio) {
        let periodoInicio = filters.periodo_inicio
        if (periodoInicio.includes('T')) {
            periodoInicio = periodoInicio.split('T')[0]
        }
        if (/^\d{6}$/.test(periodoInicio)) {
            const ano = periodoInicio.substring(0, 4)
            const mes = periodoInicio.substring(4, 6)
            periodoInicio = `${ano}-${mes}-01`
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodoInicio)) {
            throw new Error('periodo_inicio deve estar no formato YYYY-MM-DD')
        }
        params.append('periodo_inicio', periodoInicio)
    }

    if (filters?.periodo_fim) {
        let periodoFim = filters.periodo_fim
        if (periodoFim.includes('T')) {
            periodoFim = periodoFim.split('T')[0]
        }
        if (/^\d{6}$/.test(periodoFim)) {
            const ano = periodoFim.substring(0, 4)
            const mes = periodoFim.substring(4, 6)
            const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
            periodoFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodoFim)) {
            throw new Error('periodo_fim deve estar no formato YYYY-MM-DD')
        }
        params.append('periodo_fim', periodoFim)
    }

    const data = await n8nRequest<{
        success: boolean
        data: DREAnalytics
        error?: string
    }>(`/api/dre/analytics${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET'
    })

    return data.data
}

// ============================================================
// PERGUNTAS À IA
// ============================================================

/**
 * Faz uma pergunta sobre DRE para a IA
 * Exemplos: "Qual minha margem bruta?", "Quanto gastei com pessoal?"
 */
export async function perguntarDRE(data: {
    pergunta: string
    store_id?: string
}): Promise<DRERespostaIA> {
    const store_id = await getStoreId(data.store_id)
    const site_slug = await getSiteSlug(store_id)

    if (!site_slug) {
        throw new Error('site_slug é obrigatório para fazer perguntas sobre DRE')
    }

    const result = await n8nRequest<{
        success: boolean
        data: DRERespostaIA
        error?: string
    }>(`/api/dre/perguntas-ia`, {
        method: 'POST',
        body: JSON.stringify({
            pergunta: data.pergunta,
            site_slug
        })
    })

    // Se N8N não está configurado, retornar resposta vazia com erro
    if (!result.success && result.error?.includes('N8N não configurado')) {
        return {
            resposta: 'Assistente IA não está configurado. Configure VITE_N8N_BASE_URL para usar esta funcionalidade.',
            calculos: []
        } as DRERespostaIA
    }

    if (!result.success) {
        throw new Error(result.error || 'Erro ao processar pergunta via IA')
    }

    return result.data
}

// ============================================================
// UTILITÁRIOS (FORMATAÇÃO)
// ============================================================

export function formatCompetencia(competencia: string): string {
    if (competencia.length !== 6) return competencia
    const ano = competencia.substring(0, 4)
    const mes = competencia.substring(4, 6)
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const mesNome = meses[parseInt(mes) - 1] || mes
    return `${mesNome}/${ano}`
}

export function getCompetenciasFuturas(): Array<{ value: string; label: string }> {
    const competencias: Array<{ value: string; label: string }> = []
    const hoje = new Date()

    for (let i = 0; i < 12; i++) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
        const ano = data.getFullYear()
        const mes = String(data.getMonth() + 1).padStart(2, '0')
        const competencia = `${ano}${mes}`
        competencias.push({
            value: competencia,
            label: formatCompetencia(competencia)
        })
    }

    return competencias
}
