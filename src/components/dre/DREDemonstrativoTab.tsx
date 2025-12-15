/**
 * Tab Demonstrativo DRE
 * Visualização completa do Demonstrativo do Resultado do Exercício
 * Estrutura contábil padrão brasileira
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, FileText, Download, Filter } from 'lucide-react'
import type { DRECategoria, DRELancamento, TipoLancamentoDRE } from '@/types/dre'
import * as dre from '@/lib/n8n-dre'

interface Props {
    categorias: DRECategoria[]
    lancamentos: Array<DRELancamento & { categoria_nome: string; categoria_tipo: TipoLancamentoDRE }>
}

interface LinhaDemo {
    id: string
    label: string
    tipo: 'titulo' | 'subtitulo' | 'item' | 'total' | 'resultado'
    operador?: '+' | '-' | '='
    valor: number
    porcentagem: number
    nivel: number
    filhos?: LinhaDemo[]
    expandido?: boolean
    categoria_tipo?: TipoLancamentoDRE
}

export default function DREDemonstrativoTab({ categorias, lancamentos }: Props) {
    const anoAtual = new Date().getFullYear()
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')

    const [filtroAno, setFiltroAno] = useState<string>(String(anoAtual))
    const [filtroMes, setFiltroMes] = useState<string>('all')
    const [expandidos, setExpandidos] = useState<Set<string>>(new Set(['despesas', 'receitas']))

    const lancamentosFiltrados = useMemo(() => {
        return lancamentos.filter(l => {
            const anoLanc = l.competencia.substring(0, 4)
            const mesLanc = l.competencia.substring(4, 6)
            if (filtroAno !== 'all' && anoLanc !== filtroAno) return false
            if (filtroMes !== 'all' && mesLanc !== filtroMes) return false
            return true
        })
    }, [lancamentos, filtroAno, filtroMes])

    const dadosDRE = useMemo(() => {
        const receitas = lancamentosFiltrados.filter(l => l.categoria_tipo === 'RECEITA')
        const despesas = lancamentosFiltrados.filter(l => l.categoria_tipo === 'DESPESA')
        const investimentos = lancamentosFiltrados.filter(l => l.categoria_tipo === 'INVESTIMENTO')

        const totalReceitas = receitas.reduce((sum, l) => sum + l.valor, 0)
        const totalDespesas = despesas.reduce((sum, l) => sum + Math.abs(l.valor), 0)
        const totalInvestimentos = investimentos.reduce((sum, l) => sum + Math.abs(l.valor), 0)

        const receitasPorCategoria = receitas.reduce((acc, l) => {
            const cat = l.categoria_nome || 'Outros'
            acc[cat] = (acc[cat] || 0) + l.valor
            return acc
        }, {} as Record<string, number>)

        const despesasPorCategoria = despesas.reduce((acc, l) => {
            const cat = l.categoria_nome || 'Outros'
            acc[cat] = (acc[cat] || 0) + Math.abs(l.valor)
            return acc
        }, {} as Record<string, number>)

        const investimentosPorCategoria = investimentos.reduce((acc, l) => {
            const cat = l.categoria_nome || 'Outros'
            acc[cat] = (acc[cat] || 0) + Math.abs(l.valor)
            return acc
        }, {} as Record<string, number>)

        return {
            totalReceitas,
            totalDespesas,
            totalInvestimentos,
            receitasPorCategoria,
            despesasPorCategoria,
            investimentosPorCategoria,
            resultadoBruto: totalReceitas - totalDespesas,
            resultadoLiquido: totalReceitas - totalDespesas - totalInvestimentos
        }
    }, [lancamentosFiltrados])

    const calcPorcentagem = (valor: number) => {
        if (dadosDRE.totalReceitas === 0) return 0
        return (valor / dadosDRE.totalReceitas) * 100
    }

    const toggleExpandido = (id: string) => {
        const novos = new Set(expandidos)
        if (novos.has(id)) {
            novos.delete(id)
        } else {
            novos.add(id)
        }
        setExpandidos(novos)
    }

    const formatarValor = (valor: number) => {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const formatarPorcentagem = (valor: number) => {
        return valor.toFixed(2)
    }

    const periodoLabel = useMemo(() => {
        if (filtroMes === 'all') {
            return `Janeiro a Dezembro/${filtroAno}`
        }
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
        const mesNome = meses[parseInt(filtroMes) - 1]
        return `${mesNome}/${filtroAno}`
    }, [filtroAno, filtroMes])

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-primary" />
                        <div>
                            <CardTitle>Demonstrativo do Resultado do Exercício</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Período: {periodoLabel}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={filtroAno} onValueChange={setFiltroAno}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent>
                                {dre.getAnosDisponiveis().map(a => (
                                    <SelectItem key={a.value} value={String(a.value)}>{a.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filtroMes} onValueChange={setFiltroMes}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Ano inteiro</SelectItem>
                                {dre.getMesesDisponiveis().map(m => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" title="Exportar PDF">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Contas</th>
                                <th className="text-right p-3 font-semibold w-40">Valor (R$)</th>
                                <th className="text-right p-3 font-semibold w-24">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {/* RECEITAS */}
                            <Collapsible open={expandidos.has('receitas')} onOpenChange={() => toggleExpandido('receitas')} asChild>
                                <>
                                    <CollapsibleTrigger asChild>
                                        <tr className="bg-green-500/5 hover-elevate cursor-pointer">
                                            <td className="p-3 font-semibold flex items-center gap-2">
                                                {expandidos.has('receitas') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                <span className="text-green-600">(+)</span> Receita Bruta
                                            </td>
                                            <td className="text-right p-3 font-semibold text-green-600">
                                                {formatarValor(dadosDRE.totalReceitas)}
                                            </td>
                                            <td className="text-right p-3 font-semibold">
                                                100,00
                                            </td>
                                        </tr>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent asChild>
                                        <>
                                            {Object.entries(dadosDRE.receitasPorCategoria).map(([cat, valor]) => (
                                                <tr key={`rec-${cat}`} className="bg-green-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground">
                                                        <span className="text-green-500 mr-2">(+)</span>
                                                        {cat}
                                                    </td>
                                                    <td className="text-right p-3 text-green-600">
                                                        {formatarValor(valor)}
                                                    </td>
                                                    <td className="text-right p-3 text-muted-foreground">
                                                        {formatarPorcentagem(calcPorcentagem(valor))}
                                                    </td>
                                                </tr>
                                            ))}
                                            {Object.keys(dadosDRE.receitasPorCategoria).length === 0 && (
                                                <tr className="bg-green-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground italic" colSpan={3}>
                                                        Nenhuma receita lançada no período
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    </CollapsibleContent>
                                </>
                            </Collapsible>

                            {/* DESPESAS */}
                            <Collapsible open={expandidos.has('despesas')} onOpenChange={() => toggleExpandido('despesas')} asChild>
                                <>
                                    <CollapsibleTrigger asChild>
                                        <tr className="bg-red-500/5 hover-elevate cursor-pointer">
                                            <td className="p-3 font-semibold flex items-center gap-2">
                                                {expandidos.has('despesas') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                <span className="text-red-600">(-)</span> Despesas Operacionais
                                            </td>
                                            <td className="text-right p-3 font-semibold text-red-600">
                                                {formatarValor(dadosDRE.totalDespesas)}
                                            </td>
                                            <td className="text-right p-3 font-semibold">
                                                {formatarPorcentagem(calcPorcentagem(dadosDRE.totalDespesas))}
                                            </td>
                                        </tr>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent asChild>
                                        <>
                                            {Object.entries(dadosDRE.despesasPorCategoria).map(([cat, valor]) => (
                                                <tr key={`desp-${cat}`} className="bg-red-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground">
                                                        <span className="text-red-500 mr-2">(-)</span>
                                                        {cat}
                                                    </td>
                                                    <td className="text-right p-3 text-red-600">
                                                        {formatarValor(valor)}
                                                    </td>
                                                    <td className="text-right p-3 text-muted-foreground">
                                                        {formatarPorcentagem(calcPorcentagem(valor))}
                                                    </td>
                                                </tr>
                                            ))}
                                            {Object.keys(dadosDRE.despesasPorCategoria).length === 0 && (
                                                <tr className="bg-red-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground italic" colSpan={3}>
                                                        Nenhuma despesa lançada no período
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    </CollapsibleContent>
                                </>
                            </Collapsible>

                            {/* RESULTADO OPERACIONAL */}
                            <tr className={`font-semibold ${dadosDRE.resultadoBruto >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                <td className="p-3">
                                    <span className={dadosDRE.resultadoBruto >= 0 ? 'text-green-600' : 'text-red-600'}>(=)</span> Resultado Operacional Bruto
                                </td>
                                <td className={`text-right p-3 ${dadosDRE.resultadoBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatarValor(dadosDRE.resultadoBruto)}
                                </td>
                                <td className="text-right p-3">
                                    {formatarPorcentagem(calcPorcentagem(dadosDRE.resultadoBruto))}
                                </td>
                            </tr>

                            {/* INVESTIMENTOS */}
                            <Collapsible open={expandidos.has('investimentos')} onOpenChange={() => toggleExpandido('investimentos')} asChild>
                                <>
                                    <CollapsibleTrigger asChild>
                                        <tr className="bg-blue-500/5 hover-elevate cursor-pointer">
                                            <td className="p-3 font-semibold flex items-center gap-2">
                                                {expandidos.has('investimentos') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                <span className="text-blue-600">(-)</span> Investimentos / CAPEX
                                            </td>
                                            <td className="text-right p-3 font-semibold text-blue-600">
                                                {formatarValor(dadosDRE.totalInvestimentos)}
                                            </td>
                                            <td className="text-right p-3 font-semibold">
                                                {formatarPorcentagem(calcPorcentagem(dadosDRE.totalInvestimentos))}
                                            </td>
                                        </tr>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent asChild>
                                        <>
                                            {Object.entries(dadosDRE.investimentosPorCategoria).map(([cat, valor]) => (
                                                <tr key={`inv-${cat}`} className="bg-blue-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground">
                                                        <span className="text-blue-500 mr-2">(-)</span>
                                                        {cat}
                                                    </td>
                                                    <td className="text-right p-3 text-blue-600">
                                                        {formatarValor(valor)}
                                                    </td>
                                                    <td className="text-right p-3 text-muted-foreground">
                                                        {formatarPorcentagem(calcPorcentagem(valor))}
                                                    </td>
                                                </tr>
                                            ))}
                                            {Object.keys(dadosDRE.investimentosPorCategoria).length === 0 && (
                                                <tr className="bg-blue-500/5">
                                                    <td className="p-3 pl-10 text-muted-foreground italic" colSpan={3}>
                                                        Nenhum investimento lançado no período
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    </CollapsibleContent>
                                </>
                            </Collapsible>

                            {/* RESULTADO LÍQUIDO */}
                            <tr className={`font-bold text-lg ${dadosDRE.resultadoLiquido >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                <td className="p-4">
                                    <span className={dadosDRE.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}>(=)</span> Resultado Líquido do Exercício
                                </td>
                                <td className={`text-right p-4 ${dadosDRE.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatarValor(dadosDRE.resultadoLiquido)}
                                </td>
                                <td className="text-right p-4">
                                    {formatarPorcentagem(calcPorcentagem(dadosDRE.resultadoLiquido))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Legenda e Resumo */}
                <div className="mt-6 flex flex-wrap gap-4 text-sm">
                    <Badge variant="outline" className="gap-2">
                        <span className="text-green-600">(+)</span> Receitas somam ao resultado
                    </Badge>
                    <Badge variant="outline" className="gap-2">
                        <span className="text-red-600">(-)</span> Despesas subtraem do resultado
                    </Badge>
                    <Badge variant="outline" className="gap-2">
                        <span className="text-blue-600">(-)</span> Investimentos subtraem do resultado
                    </Badge>
                    <Badge variant="outline" className="gap-2">
                        <span>(=)</span> Resultado calculado
                    </Badge>
                </div>

                {/* Indicador visual do resultado */}
                <div className={`mt-6 p-4 rounded-lg text-center ${dadosDRE.resultadoLiquido >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <p className="text-sm text-muted-foreground mb-1">Situação do Período</p>
                    <p className={`text-2xl font-bold ${dadosDRE.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dadosDRE.resultadoLiquido >= 0 ? 'LUCRO' : 'PREJUÍZO'} DE R$ {formatarValor(Math.abs(dadosDRE.resultadoLiquido))}
                    </p>
                    {dadosDRE.totalReceitas > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Margem Líquida: {formatarPorcentagem(calcPorcentagem(dadosDRE.resultadoLiquido))}%
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
