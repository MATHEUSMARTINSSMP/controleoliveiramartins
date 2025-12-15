/**
 * Gestão DRE - Demonstração do Resultado do Exercício
 * Página principal do sistema DRE no Dash Admin
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Sparkles, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import * as dre from '@/lib/n8n-dre'
import type { DRECategoria, DRELancamento } from '@/types/dre'

import DRELancamentosTab from '@/components/dre/DRELancamentosTab'
import DRECategoriasTab from '@/components/dre/DRECategoriasTab'
import DREAnalyticsTab from '@/components/dre/DREAnalyticsTab'
import DREDemonstrativoTab from '@/components/dre/DREDemonstrativoTab'
import DREAssistenteIA from '@/components/dre/DREAssistenteIA'
import DREStoreSelector from '@/components/dre/DREStoreSelector'

interface DRELancamentoCompleto extends DRELancamento {
    categoria_nome: string
    categoria_tipo: dre.TipoLancamentoDRE
}

export default function GestaoDRE() {
    const navigate = useNavigate()
    const [categorias, setCategorias] = useState<DRECategoria[]>([])
    const [lancamentos, setLancamentos] = useState<DRELancamentoCompleto[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all')

    useEffect(() => {
        loadData()
    }, [selectedStoreId])

    const loadData = async () => {
        setLoading(true)
        try {
            const storeId = selectedStoreId === 'all' ? undefined : selectedStoreId

            const [cats, lancs] = await Promise.all([
                dre.getDRECategorias({ store_id: storeId, incluir_globais: true }),
                dre.getDRELancamentos({ store_id: storeId })
            ])

            setCategorias(cats || [])

            // Enriquecer lançamentos com dados da categoria
            // Prioridade: 1) Tipo que já veio do N8N, 2) Tipo da categoria local, 3) DESPESA como fallback
            const lancamentosCompletos: DRELancamentoCompleto[] = (lancs || []).map(l => {
                const categoria = (cats || []).find(c => c.id === l.categoria_id)
                const lancAny = l as any
                return {
                    ...l,
                    categoria_nome: lancAny.categoria_nome || categoria?.nome || 'Desconhecido',
                    categoria_tipo: lancAny.categoria_tipo || categoria?.tipo || 'DESPESA'
                }
            })

            setLancamentos(lancamentosCompletos)
        } catch (err: any) {
            // Não mostrar erro se for erro de N8N não configurado (já retorna valores vazios)
            const errorMsg = err.message || 'Erro desconhecido'
            if (!errorMsg.includes('N8N não configurado')) {
                console.error('Erro ao carregar dados DRE:', err)
                toast.error('Erro ao carregar dados: ' + errorMsg)
            }
            // Se N8N não está configurado, simplesmente usar arrays vazios (já são os valores padrão)
        } finally {
            setLoading(false)
        }
    }

    // Calcular totais
    const totalReceitas = lancamentos
        .filter(l => l.categoria_tipo === 'RECEITA')
        .reduce((sum, l) => sum + l.valor, 0)

    const totalDespesas = lancamentos
        .filter(l => l.categoria_tipo === 'DESPESA')
        .reduce((sum, l) => sum + Math.abs(l.valor), 0)

    const totalInvestimentos = lancamentos
        .filter(l => l.categoria_tipo === 'INVESTIMENTO')
        .reduce((sum, l) => sum + Math.abs(l.valor), 0)

    const resultado = totalReceitas - totalDespesas - totalInvestimentos

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Botão Voltar */}
            <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-8 w-8" />
                        Gestão DRE
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Demonstração do Resultado do Exercício
                    </p>
                </div>
                <DREStoreSelector
                    value={selectedStoreId}
                    onChange={setSelectedStoreId}
                />
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Receitas */}
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            Receitas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>

                {/* Despesas */}
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            Despesas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>

                {/* Investimentos */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            Investimentos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            R$ {totalInvestimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>

                {/* Resultado */}
                <Card className={`border-l-4 ${resultado >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <DollarSign className={`h-4 w-4 ${resultado >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                            Resultado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {resultado >= 0 ? '+' : ''}R$ {resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="demonstrativo" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="demonstrativo">Demonstrativo</TabsTrigger>
                    <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="ia" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        IA
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="demonstrativo">
                    <DREDemonstrativoTab
                        categorias={categorias}
                        lancamentos={lancamentos}
                    />
                </TabsContent>

                <TabsContent value="lancamentos">
                    <DRELancamentosTab
                        categorias={categorias}
                        lancamentos={lancamentos}
                        onRefresh={loadData}
                        storeId={selectedStoreId === 'all' ? undefined : selectedStoreId}
                    />
                </TabsContent>

                <TabsContent value="categorias">
                    <DRECategoriasTab
                        categorias={categorias}
                        onRefresh={loadData}
                    />
                </TabsContent>

                <TabsContent value="analytics">
                    <DREAnalyticsTab
                        categorias={categorias}
                        lancamentos={lancamentos}
                    />
                </TabsContent>

                <TabsContent value="ia">
                    <DREAssistenteIA />
                </TabsContent>
            </Tabs>
        </div>
    )
}
