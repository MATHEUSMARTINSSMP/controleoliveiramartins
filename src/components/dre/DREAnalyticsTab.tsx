/**
 * Tab de Analytics DRE
 * Visualização simplificada de analytics com exportação Excel
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Download } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { DRECategoria, DRELancamento, TipoLancamentoDRE } from '@/types/dre'

interface Props {
    categorias: DRECategoria[]
    lancamentos: Array<DRELancamento & { categoria_nome: string; categoria_tipo: TipoLancamentoDRE }>
}

export default function DREAnalyticsTab({ categorias, lancamentos }: Props) {
    // Agrupar por categoria usando categoria_tipo do lançamento (já vem enriquecido)
    const porCategoria = lancamentos.reduce((acc, l) => {
        const key = l.categoria_nome || 'Desconhecido'
        const existing = acc.find(c => c.categoria === key)
        if (existing) {
            existing.total += Math.abs(l.valor)
        } else {
            acc.push({
                categoria: key,
                tipo: l.categoria_tipo,
                total: Math.abs(l.valor)
            })
        }
        return acc
    }, [] as Array<{ categoria: string; tipo: TipoLancamentoDRE; total: number }>)
        .sort((a, b) => b.total - a.total)

    const handleExportExcel = () => {
        try {
            // Calcular totais
            const totalReceitas = porCategoria.filter(c => c.tipo === 'RECEITA').reduce((sum, c) => sum + c.total, 0)
            const totalDespesas = porCategoria.filter(c => c.tipo === 'DESPESA').reduce((sum, c) => sum + c.total, 0)
            const totalInvestimentos = porCategoria.filter(c => c.tipo === 'INVESTIMENTO').reduce((sum, c) => sum + c.total, 0)
            const resultado = totalReceitas - totalDespesas - totalInvestimentos

            // Preparar dados para Excel
            const dadosExcel = [
                ['DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE)'],
                [''],
                ['RESUMO'],
                ['Receitas', `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Despesas', `R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Investimentos', `R$ ${totalInvestimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ['Resultado', `R$ ${resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                [''],
                ['RECEITAS POR CATEGORIA'],
                ['Categoria', 'Valor'],
                ...porCategoria.filter(c => c.tipo === 'RECEITA').map(c => [
                    c.categoria,
                    `R$ ${c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
                [''],
                ['DESPESAS POR CATEGORIA'],
                ['Categoria', 'Valor'],
                ...porCategoria.filter(c => c.tipo === 'DESPESA').map(c => [
                    c.categoria,
                    `R$ ${c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
                [''],
                ['INVESTIMENTOS POR CATEGORIA'],
                ['Categoria', 'Valor'],
                ...porCategoria.filter(c => c.tipo === 'INVESTIMENTO').map(c => [
                    c.categoria,
                    `R$ ${c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
            ]

            // Criar workbook
            const ws = XLSX.utils.aoa_to_sheet(dadosExcel)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'DRE')

            // Download
            const hoje = new Date().toISOString().split('T')[0]
            XLSX.writeFile(wb, `DRE_${hoje}.xlsx`)

            toast.success('Excel exportado com sucesso!')
        } catch (err) {
            console.error('Erro ao exportar Excel:', err)
            toast.error('Erro ao exportar Excel')
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Analytics DRE
                    </CardTitle>
                    <Button onClick={handleExportExcel} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Receitas por Categoria */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-green-600">Receitas por Categoria</h3>
                        <div className="space-y-2">
                            {porCategoria.filter(c => c.tipo === 'RECEITA').map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                    <span className="font-medium">{c.categoria}</span>
                                    <span className="text-green-600 font-bold">
                                        R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Despesas por Categoria */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-red-600">Despesas por Categoria</h3>
                        <div className="space-y-2">
                            {porCategoria.filter(c => c.tipo === 'DESPESA').map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                    <span className="font-medium">{c.categoria}</span>
                                    <span className="text-red-600 font-bold">
                                        R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Investimentos por Categoria */}
                    {porCategoria.filter(c => c.tipo === 'INVESTIMENTO').length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3 text-blue-600">Investimentos por Categoria</h3>
                            <div className="space-y-2">
                                {porCategoria.filter(c => c.tipo === 'INVESTIMENTO').map((c, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                        <span className="font-medium">{c.categoria}</span>
                                        <span className="text-blue-600 font-bold">
                                            R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
