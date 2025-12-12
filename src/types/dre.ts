/**
 * Tipos TypeScript para o Sistema DRE
 * (Demonstração do Resultado do Exercício)
 */

export type TipoLancamentoDRE = 'RECEITA' | 'DESPESA' | 'INVESTIMENTO'

export interface DRECategoria {
    id: string
    nome: string
    tipo: TipoLancamentoDRE
    descricao?: string | null
    ativo: boolean
    ordem: number
    store_id?: string | null
    is_global: boolean
    created_at: string
    updated_at: string
}

export interface DRELancamento {
    id: string
    categoria_id: string
    descricao: string
    valor: number
    competencia: string // YYYYMM
    data_lancamento: string // YYYY-MM-DD
    observacoes?: string | null
    store_id: string
    created_by_id?: string | null
    created_at: string
    updated_at: string
    // Campos relacionados (join)
    categoria_nome?: string
    categoria_tipo?: TipoLancamentoDRE
}

export interface DREAnalytics {
    periodo: {
        inicio: string
        fim: string
        periodo_anterior_inicio: string
        periodo_anterior_fim: string
    }
    totais: {
        receitas: number
        despesas: number
        investimentos: number
        lucro: number
    }
    comparativo: {
        periodo_atual: {
            receitas: number
            despesas: number
            investimentos: number
            lucro: number
        }
        periodo_anterior: {
            receitas: number
            despesas: number
            investimentos: number
            lucro: number
        }
        variacoes: {
            receitas: number // Percentual
            despesas: number
            investimentos: number
            lucro: number
        }
    }
    grafico_mensal: Array<{
        periodo: string // YYYYMM
        periodo_formatado: string // "Jan/2025"
        receitas: number
        despesas: number
        investimentos: number
        lucro: number
    }>
    grafico_por_categoria: Array<{
        categoria: string
        tipo: TipoLancamentoDRE
        valor: number
        porcentagem: number
    }>
    tendencias: Array<{
        periodo: string
        periodo_formatado: string
        receitas: number
        despesas: number
        investimentos: number
        lucro: number
        media_movel_receitas: number
        media_movel_despesas: number
        media_movel_lucro: number
    }>
    crescimento_medio: {
        receitas: number // Percentual
        despesas: number
        lucro: number
    }
}

export interface DRECalculo {
    total_receitas: number
    receitas_mes: number
    total_despesas: number
    despesas_mes: number
    total_investimentos: number
    investimentos_mes: number
    lucro_total: number
    lucro_mes: number
}

export interface DRERespostaIA {
    pergunta: string
    resposta: string
    calculos?: Array<{
        label: string
        formula: string
        valor: number
    }>
    dados_utilizados?: {
        periodo: string
        receitas: number
        despesas: number
        investimentos: number
        lucro: number
    }
}
