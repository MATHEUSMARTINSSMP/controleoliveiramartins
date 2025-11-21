import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, ShoppingBag, TrendingUp, Users, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Sale {
    id: string;
    colaboradora_id: string;
    valor: number;
    qtd_pecas: number;
    data_venda: string;
    observacoes: string | null;
    colaboradora: {
        name: string;
    };
}

interface Colaboradora {
    id: string;
    name: string;
    active: boolean;
}

export default function LojaDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [sales, setSales] = useState<Sale[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        colaboradora_id: "",
        valor: "",
        qtd_pecas: "",
        data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        observacoes: "",
    });

    useEffect(() => {
        if (!profile || profile.role !== 'ADMIN') {
            navigate('/');
            return;
        }
        fetchData();
    }, [profile, navigate]);

    const fetchData = async () => {
        await Promise.all([fetchSales(), fetchColaboradoras()]);
        setLoading(false);
    };

    const fetchSales = async () => {
        if (!profile?.store_default) return;

        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('sales')
            .select(`
        *,
        colaboradora:profiles!colaboradora_id(name)
      `)
            .eq('store_id', getStoreId())
            .gte('data_venda', `${today}T00:00:00`)
            .order('data_venda', { ascending: false });

        if (error) {
            toast.error('Erro ao carregar vendas');
            console.error(error);
        } else {
            setSales(data || []);
        }
    };

    const fetchColaboradoras = async () => {
        if (!profile?.store_default) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, active')
            .eq('role', 'COLABORADORA')
            .eq('store_default', profile.store_default)
            .eq('active', true)
            .order('name');

        if (error) {
            toast.error('Erro ao carregar colaboradoras');
        } else {
            setColaboradoras(data || []);
        }
    };

    const getStoreId = () => {
        const storeMap: Record<string, string> = {
            'Loungerie': '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b',
            'Mr. Kitsch': 'c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3',
            'Sacada | Oh, Boy': 'cee7d359-0240-4131-87a2-21ae44bd1bb4',
        };
        return storeMap[profile?.store_default || ''] || '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const { error } = await supabase.from('sales').insert({
            colaboradora_id: formData.colaboradora_id,
            store_id: getStoreId(),
            valor: parseFloat(formData.valor),
            qtd_pecas: parseInt(formData.qtd_pecas),
            data_venda: formData.data_venda,
            observacoes: formData.observacoes || null,
            lancado_por_id: profile?.id,
        });

        if (error) {
            toast.error('Erro ao lançar venda');
            console.error(error);
        } else {
            toast.success('Venda lançada com sucesso!');
            setDialogOpen(false);
            resetForm();
            fetchSales();
        }
    };

    const resetForm = () => {
        setFormData({
            colaboradora_id: "",
            valor: "",
            qtd_pecas: "",
            data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            observacoes: "",
        });
        setEditingSaleId(null);
    };

    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

    const handleEdit = (sale: Sale) => {
        setFormData({
            colaboradora_id: sale.colaboradora_id,
            valor: sale.valor.toString(),
            qtd_pecas: sale.qtd_pecas.toString(),
            data_venda: format(new Date(sale.data_venda), "yyyy-MM-dd'T'HH:mm"),
            observacoes: sale.observacoes || "",
        });
        setEditingSaleId(sale.id);
        setDialogOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const { error } = await supabase
            .from('sales')
            .update({
                colaboradora_id: formData.colaboradora_id,
                valor: parseFloat(formData.valor),
                qtd_pecas: parseInt(formData.qtd_pecas),
                data_venda: formData.data_venda,
                observacoes: formData.observacoes || null,
            })
            .eq('id', editingSaleId!);

        if (error) {
            toast.error('Erro ao atualizar venda');
            console.error(error);
        } else {
            toast.success('Venda atualizada com sucesso!');
            setDialogOpen(false);
            resetForm();
            fetchSales();
        }
    };

    const handleDelete = async (saleId: string) => {
        if (!confirm('Tem certeza que deseja deletar esta venda?')) return;

        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleId);

        if (error) {
            toast.error('Erro ao deletar venda');
            console.error(error);
        } else {
            toast.success('Venda deletada com sucesso!');
            fetchSales();
        }
    };

    const ticketMedio = formData.valor && formData.qtd_pecas
        ? (parseFloat(formData.valor) / parseInt(formData.qtd_pecas)).toFixed(2)
        : "0,00";

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Carregando...</div>;
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">🏪 {profile?.store_default}</h1>
                    <p className="text-muted-foreground">Gestão de Vendas</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Venda
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingSaleId ? 'Editar' : 'Lançar Nova'} Venda</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={editingSaleId ? handleUpdate : handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="colaboradora">Vendedora *</Label>
                                <Select
                                    value={formData.colaboradora_id}
                                    onValueChange={(value) => setFormData({ ...formData, colaboradora_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a vendedora" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colaboradoras.map((colab) => (
                                            <SelectItem key={colab.id} value={colab.id}>
                                                {colab.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="valor">Valor Total (R$) *</Label>
                                    <Input
                                        id="valor"
                                        type="number"
                                        step="0.01"
                                        value={formData.valor}
                                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                                        placeholder="0,00"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="qtd_pecas">Qtd Peças *</Label>
                                    <Input
                                        id="qtd_pecas"
                                        type="number"
                                        value={formData.qtd_pecas}
                                        onChange={(e) => setFormData({ ...formData, qtd_pecas: e.target.value })}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">
                                    💡 Ticket Médio Calculado: <span className="text-primary">R$ {ticketMedio}</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="data_venda">Data/Hora</Label>
                                <Input
                                    id="data_venda"
                                    type="datetime-local"
                                    value={formData.data_venda}
                                    onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="observacoes">Observações</Label>
                                <Input
                                    id="observacoes"
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                    placeholder="Observações opcionais"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1">
                                    Lançar Venda
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Vendas de Hoje</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Horário</TableHead>
                                <TableHead>Vendedora</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Peças</TableHead>
                                <TableHead>Ticket</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        Nenhuma venda lançada hoje
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell>{format(new Date(sale.data_venda), 'HH:mm')}</TableCell>
                                        <TableCell>{sale.colaboradora.name}</TableCell>
                                        <TableCell>R$ {sale.valor.toFixed(2)}</TableCell>
                                        <TableCell>{sale.qtd_pecas}</TableCell>
                                        <TableCell>R$ {(sale.valor / sale.qtd_pecas).toFixed(2)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(sale)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(sale.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
