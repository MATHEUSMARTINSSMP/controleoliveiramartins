/**
 * Tab de Analytics DRE
 * Visualização simplificada de analytics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { DRECategoria, DRELancamento, TipoLancamentoDRE } from '@/types/dre'

interface Props {
    categorias: DRECategoria[]
    lancamentos: Array<DRELancamento & { categoria_nome: string; categoria_tipo: TipoLancamentoDRE }>
}

export default function DREAnalyticsTab({ categorias, lancamentos }: Props) {
    // Agrupar por categoria
    const porCategoria = categorias.map(cat => {
        const lancamentosCategoria = lancamentos.filter(l => l.categoria_id === cat.id)
        const total = lancamentosCategoria.reduce((sum, l) => sum + Math.abs(l.valor), 0)
        return {
            categoria: cat.nome,
            tipo: cat.tipo,
            total
        }
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analytics DRE
                </CardTitle>
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
