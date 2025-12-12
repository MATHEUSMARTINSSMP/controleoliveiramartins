/**
 * Tab de Categorias DRE
 * Gerenciamento de categorias customizadas
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
import { Switch } from '@/components/ui/switch'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import * as dre from '@/lib/n8n-dre'
import type { DRECategoria, TipoLancamentoDRE } from '@/types/dre'

interface Props {
    categorias: DRECategoria[]
    onRefresh: () => void
}

export default function DRECategoriasTab({ categorias, onRefresh }: Props) {
    const [novaDialog, setNovaDialog] = useState(false)
    const [loading, setLoading] = useState(false)

    const [formNova, setFormNova] = useState({
        nome: '',
        tipo: 'DESPESA' as TipoLancamentoDRE,
        descricao: '',
        ordem: '0'
    })

    const handleNova = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formNova.nome || !formNova.tipo) {
            toast.error('Preencha todos os campos obrigatórios')
            return
        }

        setLoading(true)
        try {
            await dre.createDRECategoria({
                nome: formNova.nome,
                tipo: formNova.tipo,
                descricao: formNova.descricao,
                ordem: parseInt(formNova.ordem) || 0
            })

            toast.success('Categoria criada com sucesso!')
            setNovaDialog(false)
            setFormNova({
                nome: '',
                tipo: 'DESPESA',
                descricao: '',
                ordem: '0'
            })
            onRefresh()
        } catch (err: any) {
            toast.error('Erro ao criar categoria: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleAtivo = async (id: string, ativo: boolean) => {
        setLoading(true)
        try {
            await dre.updateDRECategoria(id, { ativo: !ativo })
            toast.success(`Categoria ${!ativo ? 'ativada' : 'desativada'} com sucesso!`)
            onRefresh()
        } catch (err: any) {
            toast.error('Erro ao atualizar categoria: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const categoriasCustomizadas = categorias.filter(c => !c.is_global)
    const categoriasGlobais = categorias.filter(c => c.is_global)

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Categorias DRE</CardTitle>
                    <Dialog open={novaDialog} onOpenChange={setNovaDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Categoria
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nova Categoria Customizada</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleNova} className="space-y-4">
                                <div>
                                    <Label>Nome *</Label>
                                    <Input
                                        value={formNova.nome}
                                        onChange={(e) => setFormNova({ ...formNova, nome: e.target.value })}
                                        placeholder="Ex: Despesas com Transporte"
                                    />
                                </div>

                                <div>
                                    <Label>Tipo *</Label>
                                    <Select value={formNova.tipo} onValueChange={(v: TipoLancamentoDRE) => setFormNova({ ...formNova, tipo: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="RECEITA">Receita</SelectItem>
                                            <SelectItem value="DESPESA">Despesa</SelectItem>
                                            <SelectItem value="INVESTIMENTO">Investimento</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Descrição</Label>
                                    <Textarea
                                        value={formNova.descricao}
                                        onChange={(e) => setFormNova({ ...formNova, descricao: e.target.value })}
                                        placeholder="Descrição opcional"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label>Ordem</Label>
                                    <Input
                                        type="number"
                                        value={formNova.ordem}
                                        onChange={(e) => setFormNova({ ...formNova, ordem: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setNovaDialog(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? 'Salvando...' : 'Salvar'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Categorias Customizadas */}
                {categoriasCustomizadas.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Categorias Customizadas</h3>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="text-center">Ativo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categoriasCustomizadas.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.nome}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    c.tipo === 'RECEITA' ? 'default' :
                                                        c.tipo === 'DESPESA' ? 'destructive' : 'secondary'
                                                }>
                                                    {c.tipo}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{c.descricao || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={c.ativo}
                                                    onCheckedChange={() => handleToggleAtivo(c.id, c.ativo)}
                                                    disabled={loading}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* Categorias Pré-Programadas */}
                <div>
                    <h3 className="text-lg font-semibold mb-3">Categorias Pré-Programadas</h3>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descrição</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categoriasGlobais.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.nome}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                c.tipo === 'RECEITA' ? 'default' :
                                                    c.tipo === 'DESPESA' ? 'destructive' : 'secondary'
                                            }>
                                                {c.tipo}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{c.descricao || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
