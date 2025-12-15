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

    // Estado para ano e mês do formulário
    const anoAtual = new Date().getFullYear()
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')

    // Formulário manual
    const [formManual, setFormManual] = useState({
        categoria_id: '',
        descricao: '',
        valor: '',
        ano: String(anoAtual),
        mes: mesAtual,
        observacoes: ''
    })

    // Formulário IA
    const [promptIA, setPromptIA] = useState('')
    const [resultadoIA, setResultadoIA] = useState<DRELancamento | null>(null)

    // Filtros
    const [filtros, setFiltros] = useState({
        ano: 'all',
        mes: 'all',
        tipo: 'all' as 'all' | TipoLancamentoDRE,
        categoria_id: 'all'
    })

    const handleNovoManual = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formManual.categoria_id || !formManual.descricao || !formManual.valor || !formManual.ano || !formManual.mes) {
            toast.error('Preencha todos os campos obrigatórios')
            return
        }

        setLoading(true)
        try {
            const competencia = dre.buildCompetencia(parseInt(formManual.ano), formManual.mes)

            const hoje = new Date()
            const dataLancamento = hoje.toISOString().split('T')[0]

            await dre.createDRELancamento({
                categoria_id: formManual.categoria_id,
                descricao: formManual.descricao,
                valor: parseFloat(formManual.valor) || 0,
                competencia,
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
                ano: String(anoAtual),
                mes: mesAtual,
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

            // Debug: mostrar o que veio do N8N
            console.log('[DRE] Resultado bruto do N8N:', JSON.stringify(resultado, null, 2))
            console.log('[DRE] categoria_id do resultado:', resultado.categoria_id, typeof resultado.categoria_id)
            console.log('[DRE] Categorias disponíveis:', categorias.length, categorias.map(c => ({ id: c.id, tipo: typeof c.id, nome: c.nome })))

            // Buscar nome e tipo da categoria se não vieram do N8N
            if (resultado.categoria_id && !resultado.categoria_nome) {
                const catId = String(resultado.categoria_id)
                console.log('[DRE] Buscando categoria com id:', catId)
                const cat = categorias.find(c => String(c.id) === catId)
                console.log('[DRE] Categoria encontrada:', cat)
                if (cat) {
                    resultado.categoria_nome = cat.nome
                    resultado.categoria_tipo = cat.tipo
                } else {
                    console.warn('[DRE] Categoria NÃO encontrada! IDs disponíveis:', categorias.map(c => c.id))
                }
            }

            console.log('[DRE] Resultado final após busca categoria:', resultado)

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

    // Filtrar lançamentos por ano e mês
    const filteredLancamentos = lancamentos.filter(l => {
        if (filtros.ano !== 'all') {
            const lancamentoAno = l.competencia.substring(0, 4)
            if (lancamentoAno !== filtros.ano) return false
        }
        if (filtros.mes !== 'all') {
            const lancamentoMes = l.competencia.substring(4, 6)
            if (lancamentoMes !== filtros.mes) return false
        }
        if (filtros.tipo !== 'all' && l.categoria_tipo !== filtros.tipo) return false
        if (filtros.categoria_id !== 'all' && l.categoria_id !== filtros.categoria_id) return false
        return true
    })

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

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label>Ano *</Label>
                                            <Select value={formManual.ano} onValueChange={(v) => setFormManual({ ...formManual, ano: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Ano" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dre.getAnosDisponiveis().map(a => (
                                                        <SelectItem key={a.value} value={String(a.value)}>{a.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Mês *</Label>
                                            <Select value={formManual.mes} onValueChange={(v) => setFormManual({ ...formManual, mes: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Mês" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {dre.getMesesDisponiveis().map(m => (
                                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
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
                                                    <div><strong>Categoria:</strong> {resultadoIA.categoria_nome || categorias.find(c => c.id === resultadoIA.categoria_id)?.nome || 'Não identificada'}</div>
                                                    <div><strong>Tipo:</strong> {resultadoIA.categoria_tipo || (resultadoIA as any).tipo_detectado || categorias.find(c => c.id === resultadoIA.categoria_id)?.tipo || 'N/A'}</div>
                                                    <div><strong>Valor:</strong> R$ {(resultadoIA.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                    <div><strong>Competência:</strong> {dre.formatCompetencia(resultadoIA.competencia || '')}</div>
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
                <div className="flex flex-wrap gap-4 mb-4">
                    <Select value={filtros.ano} onValueChange={(v) => setFiltros({ ...filtros, ano: v })}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os anos</SelectItem>
                            {dre.getAnosDisponiveis().map(a => (
                                <SelectItem key={a.value} value={String(a.value)}>{a.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filtros.mes} onValueChange={(v) => setFiltros({ ...filtros, mes: v })}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os meses</SelectItem>
                            {dre.getMesesDisponiveis().map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filtros.tipo} onValueChange={(v) => setFiltros({ ...filtros, tipo: v as any })}>
                        <SelectTrigger className="w-[150px]">
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
