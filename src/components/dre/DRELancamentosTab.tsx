/**
 * Tab de Lançamentos DRE
 * Permite criar lançamentos manuais ou via IA
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Sparkles, Trash2, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import * as dre from '@/lib/n8n-dre'
import type { DRECategoria, DRELancamento, TipoLancamentoDRE } from '@/types/dre'

interface Props {
    categorias: DRECategoria[]
    lancamentos: Array<DRELancamento & { categoria_nome: string; categoria_tipo: TipoLancamentoDRE }>
    onRefresh: () => void
    storeId?: string
}

export default function DRELancamentosTab({ categorias, lancamentos, onRefresh, storeId }: Props) {
    const [novoManualDialog, setNovoManualDialog] = useState(false)
    const [novoIADialog, setNovoIADialog] = useState(false)
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Formulário manual
    const [formManual, setFormManual] = useState({
        categoria_id: '',
        descricao: '',
        valor: '',
        competencia: '',
        observacoes: ''
    })

    // Formulário IA
    const [promptIA, setPromptIA] = useState('')
    const [resultadoIA, setResultadoIA] = useState<DRELancamento | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState({
        competencia: 'all',
        tipo: 'all' as 'all' | TipoLancamentoDRE,
        categoria_id: 'all'
    })

    const handleNovoManual = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formManual.categoria_id || !formManual.descricao || !formManual.valor || !formManual.competencia) {
            toast.error('Preencha todos os campos obrigatórios')
            return
        }

        setLoading(true)
        try {
            const competenciaNormalizada = formManual.competencia.replace(/[-/]/g, '').substring(0, 6)

            if (competenciaNormalizada.length !== 6) {
                toast.error('Competência inválida. Use o formato AAAAMM')
                return
            }

            const hoje = new Date()
            const dataLancamento = hoje.toISOString().split('T')[0]

            await dre.createDRELancamento({
                categoria_id: formManual.categoria_id,
                descricao: formManual.descricao,
                valor: parseFloat(formManual.valor) || 0,
                competencia: competenciaNormalizada,
                data_lancamento: dataLancamento,
                observacoes: formManual.observacoes,
                store_id: storeId
            })

            toast.success('Lançamento criado com sucesso!')
            setNovoManualDialog(false)
            setFormManual({
                categoria_id: '',
                descricao: '',
                valor: '',
                competencia: '',
                observacoes: ''
            })
            onRefresh()
        } catch (err: any) {
            toast.error('Erro ao criar lançamento: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleProcessarIA = async () => {
        if (!promptIA.trim()) {
            toast.error('Digite uma descrição do lançamento')
            return
        }

        setLoading(true)
        try {
            const resultado = await dre.createDRELancamentoIA({
                prompt: promptIA,
                store_id: storeId
            })

            setResultadoIA(resultado)
            toast.success('IA processou o lançamento! Revise antes de confirmar.')
        } catch (err: any) {
            toast.error('Erro ao processar com IA: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmarIA = () => {
        toast.success('Lançamento via IA criado com sucesso!')
        setNovoIADialog(false)
        setPromptIA('')
        setResultadoIA(null)
        onRefresh()
    }

    const handleDelete = async () => {
        if (!deleteDialog) return

        setLoading(true)
        try {
            await dre.deleteDRELancamento(deleteDialog)
            toast.success('Lançamento excluído com sucesso!')
            setDeleteDialog(null)
            onRefresh()
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // Filtrar lançamentos
    const filteredLancamentos = lancamentos.filter(l => {
        if (filtros.competencia !== 'all' && l.competencia !== filtros.competencia) return false
        if (filtros.tipo !== 'all' && l.categoria_tipo !== filtros.tipo) return false
        if (filtros.categoria_id !== 'all' && l.categoria_id !== filtros.categoria_id) return false
        return true
    })

    const competenciasDisponiveis = dre.getCompetenciasFuturas()

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Lançamentos DRE</CardTitle>
                    <div className="flex gap-2">
                        {/* Botão Lançamento Manual */}
                        <Dialog open={novoManualDialog} onOpenChange={setNovoManualDialog}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Novo Lançamento
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Novo Lançamento Manual</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleNovoManual} className="space-y-4">
                                    <div>
                                        <Label>Categoria *</Label>
                                        <Select value={formManual.categoria_id} onValueChange={(v) => setFormManual({ ...formManual, categoria_id: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione a categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categorias.filter(c => c.ativo).map(c => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.nome} ({c.tipo})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Descrição *</Label>
                                        <Input
                                            value={formManual.descricao}
                                            onChange={(e) => setFormManual({ ...formManual, descricao: e.target.value })}
                                            placeholder="Ex: Venda de produtos"
                                        />
                                    </div>

                                    <div>
                                        <Label>Valor (R$) *</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formManual.valor}
                                            onChange={(e) => setFormManual({ ...formManual, valor: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <Label>Competência *</Label>
                                        <Select value={formManual.competencia} onValueChange={(v) => setFormManual({ ...formManual, competencia: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o mês" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {competenciasDisponiveis.map(c => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Observações</Label>
                                        <Textarea
                                            value={formManual.observacoes}
                                            onChange={(e) => setFormManual({ ...formManual, observacoes: e.target.value })}
                                            placeholder="Informações adicionais (opcional)"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <Button type="button" variant="outline" onClick={() => setNovoManualDialog(false)}>
                                            Cancelar
                                        </Button>
                                        <Button type="submit" disabled={loading}>
                                            {loading ? 'Salvando...' : 'Salvar'}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>

                        {/* Botão Lançamento via IA */}
                        <Dialog open={novoIADialog} onOpenChange={setNovoIADialog}>
                            <DialogTrigger asChild>
                                <Button variant="secondary">
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Lançamento via IA
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5" />
                                        Lançamento via Inteligência Artificial
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    {!resultadoIA ? (
                                        <>
                                            <div>
                                                <Label>Descreva o lançamento em linguagem natural</Label>
                                                <Textarea
                                                    value={promptIA}
                                                    onChange={(e) => setPromptIA(e.target.value)}
                                                    placeholder="Ex: Recebi R$ 5.000 de vendas em novembro&#10;Ex: Paguei R$ 1.200 de aluguel em dezembro&#10;Ex: Investi R$ 3.000 em equipamentos este mês"
                                                    rows={5}
                                                    className="mt-2"
                                                />
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button type="button" variant="outline" onClick={() => setNovoIADialog(false)}>
                                                    Cancelar
                                                </Button>
                                                <Button onClick={handleProcessarIA} disabled={loading}>
                                                    {loading ? 'Processando...' : 'Processar com IA'}
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-muted p-4 rounded-lg space-y-2">
                                                <p className="text-sm font-medium">IA identificou:</p>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div><strong>Categoria:</strong> {resultadoIA.categoria_nome}</div>
                                                    <div><strong>Tipo:</strong> {resultadoIA.categoria_tipo}</div>
                                                    <div><strong>Valor:</strong> R$ {resultadoIA.valor.toFixed(2)}</div>
                                                    <div><strong>Competência:</strong> {dre.formatCompetencia(resultadoIA.competencia)}</div>
                                                    <div className="col-span-2"><strong>Descrição:</strong> {resultadoIA.descricao}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button type="button" variant="outline" onClick={() => setResultadoIA(null)}>
                                                    Tentar Novamente
                                                </Button>
                                                <Button onClick={handleConfirmarIA}>
                                                    Confirmar e Salvar
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Filtros */}
                <div className="flex gap-4 mb-4">
                    <Select value={filtros.competencia} onValueChange={(v) => setFiltros({ ...filtros, competencia: v })}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Competência" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as competências</SelectItem>
                            {competenciasDisponiveis.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filtros.tipo} onValueChange={(v) => setFiltros({ ...filtros, tipo: v as any })}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="RECEITA">Receitas</SelectItem>
                            <SelectItem value="DESPESA">Despesas</SelectItem>
                            <SelectItem value="INVESTIMENTO">Investimentos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Tabela */}
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLancamentos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        Nenhum lançamento encontrado
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLancamentos.map(l => (
                                    <TableRow key={l.id}>
                                        <TableCell>{format(new Date(l.data_lancamento), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{l.descricao}</TableCell>
                                        <TableCell>{l.categoria_nome}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                l.categoria_tipo === 'RECEITA' ? 'default' :
                                                    l.categoria_tipo === 'DESPESA' ? 'destructive' : 'secondary'
                                            }>
                                                {l.categoria_tipo}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteDialog(l.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Dialog de Confirmação de Exclusão */}
            <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
