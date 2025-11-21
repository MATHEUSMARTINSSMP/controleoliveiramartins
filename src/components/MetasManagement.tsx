import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, UserCheck, Calendar, ClipboardList, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge"; interface Goal {
    id: string;
    tipo: string;
    mes_referencia: string;
    store_id: string;
    colaboradora_id: string | null;
    meta_valor: number;
    super_meta_valor: number;
    peso_domingo: number;
    peso_segunda: number;
    peso_terca: number;
    peso_quarta: number;
    peso_quinta: number;
    peso_sexta: number;
    peso_sabado: number;
    ativo: boolean;
}

export default function MetasManagement() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [colaboradoras, setColaboradoras] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [storeFilter, setStoreFilter] = useState<string>('');
    const [colabFilter, setColabFilter] = useState<string>('');

    const [formData, setFormData] = useState({
        tipo: "MENSAL",
        mes_referencia: format(new Date(), "yyyyMM"),
        store_id: "",
        colaboradora_id: "",
        meta_valor: "",
        super_meta_valor: "",
        peso_domingo: "1.2",
        peso_segunda: "1.0",
        peso_terca: "1.0",
        peso_quarta: "1.0",
        peso_quinta: "1.0",
        peso_sexta: "1.5",
        peso_sabado: "2.0",
    });

    useEffect(() => {
        fetchGoals();
        fetchStores();
        fetchColaboradoras();
    }, []);

    const fetchGoals = async () => {
        const { data, error } = await supabase
            .from("goals")
            .select(`
        *,
        stores (name),
        profiles (name)
      `)
            .order("mes_referencia", { ascending: false });

        if (!error && data) {
            setGoals(data as any);
        }
    };

    const fetchStores = async () => {
        const { data } = await supabase
            .from("stores")
            .select("*")
            .eq("active", true);
        if (data) setStores(data);
    };

    const fetchColaboradoras = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("profiles")
            .select("*")
            .eq("role", "COLABORADORA")
            .eq("active", true);
        if (data) setColaboradoras(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            tipo: formData.tipo,
            mes_referencia: formData.mes_referencia,
            store_id: formData.store_id || null,
            colaboradora_id: formData.tipo === "INDIVIDUAL" ? formData.colaboradora_id : null,
            meta_valor: parseFloat(formData.meta_valor),
            super_meta_valor: parseFloat(formData.super_meta_valor),
            peso_domingo: parseFloat(formData.peso_domingo),
            peso_segunda: parseFloat(formData.peso_segunda),
            peso_terca: parseFloat(formData.peso_terca),
            peso_quarta: parseFloat(formData.peso_quarta),
            peso_quinta: parseFloat(formData.peso_quinta),
            peso_sexta: parseFloat(formData.peso_sexta),
            peso_sabado: parseFloat(formData.peso_sabado),
            ativo: true,
        };

        if (editingGoal) {
            const { error } = await supabase
                .from("goals")
                .update(payload)
                .eq("id", editingGoal.id);

            if (error) {
                toast.error("Erro ao atualizar meta");
                return;
            }
            toast.success("Meta atualizada!");
        } else {
            const { error } = await supabase.from("goals").insert([payload]);

            if (error) {
                toast.error("Erro ao criar meta");
                return;
            }
            toast.success("Meta criada!");
        }

        setDialogOpen(false);
        setEditingGoal(null);
        resetForm();
        fetchGoals();
    };

    const handleEdit = (goal: Goal) => {
        setEditingGoal(goal);
        setFormData({
            tipo: goal.tipo,
            mes_referencia: goal.mes_referencia,
            store_id: goal.store_id || "",
            colaboradora_id: goal.colaboradora_id || "",
            meta_valor: goal.meta_valor.toString(),
            super_meta_valor: goal.super_meta_valor.toString(),
            peso_domingo: goal.peso_domingo.toString(),
            peso_segunda: goal.peso_segunda.toString(),
            peso_terca: goal.peso_terca.toString(),
            peso_quarta: goal.peso_quarta.toString(),
            peso_quinta: goal.peso_quinta.toString(),
            peso_sexta: goal.peso_sexta.toString(),
            peso_sabado: goal.peso_sabado.toString(),
        });
        setDialogOpen(true);
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from("goals")
            .update({ ativo: !currentStatus })
            .eq("id", id);

        if (error) {
            toast.error("Erro ao atualizar status");
            return;
        }

        toast.success(currentStatus ? "Meta desativada" : "Meta ativada");
        fetchGoals();
    };

    const resetForm = () => {
        setFormData({
            tipo: "MENSAL",
            mes_referencia: format(new Date(), "yyyyMM"),
            store_id: "",
            colaboradora_id: "",
            meta_valor: "",
            super_meta_valor: "",
            peso_domingo: "1.2",
            peso_segunda: "1.0",
            peso_terca: "1.0",
            peso_quarta: "1.0",
            peso_quinta: "1.0",
            peso_sexta: "1.5",
            peso_sabado: "2.0",
        });
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Todas as lojas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                                {store.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={colabFilter} onValueChange={setColabFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Todas as colaboradoras" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {colaboradoras.map((colab) => (
                            <SelectItem key={colab.id} value={colab.id}>
                                {colab.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button className="ml-auto" onClick={() => { setEditingGoal(null); resetForm(); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Meta
                </Button>
            </div>

            {/* Cards grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {goals
                    .filter((g) => (storeFilter ? g.store_id === storeFilter : true))
                    .filter((g) => (colabFilter ? g.colaboradora_id === colabFilter : true))
                    .map((goal: any) => (
                        <Card key={goal.id} className="relative group hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    {goal.tipo === "INDIVIDUAL" ? <UserCheck className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                                    {goal.tipo} – {goal.mes_referencia}
                                </CardTitle>
                                <Badge variant={goal.ativo ? "default" : "destructive"} className="absolute top-2 right-2">
                                    {goal.ativo ? "Ativa" : "Inativa"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p><strong>Loja:</strong> {goal.stores?.name || "-"}</p>
                                {goal.colaboradora_id && (
                                    <p><strong>Colab.:</strong> {goal.profiles?.name || "-"}</p>
                                )}
                                <p><strong>Meta:</strong> R$ {goal.meta_valor?.toLocaleString('pt-BR')}</p>
                                <p><strong>Super Meta:</strong> R$ {goal.super_meta_valor?.toLocaleString('pt-BR')}</p>
                            </CardContent>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/20 transition-opacity">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(goal)} className="mr-2">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant={goal.ativo ? "destructive" : "default"}
                                    onClick={() => handleToggleActive(goal.id, goal.ativo)}
                                >
                                    {goal.ativo ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </Button>
                            </div>
                        </Card>
                    ))}
                {goals.length === 0 && (
                    <p className="text-center text-muted-foreground col-span-full">Nenhuma meta encontrada.</p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo de Meta</Label>
                                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MENSAL">Mensal</SelectItem>
                                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Mês/Ano (YYYYMM)</Label>
                                <Input
                                    value={formData.mes_referencia}
                                    onChange={(e) => setFormData({ ...formData, mes_referencia: e.target.value })}
                                    placeholder="202512"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Loja</Label>
                                <Select value={formData.store_id} onValueChange={(v) => setFormData({ ...formData, store_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a loja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map((store) => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.tipo === "INDIVIDUAL" && (
                                <div>
                                    <Label>Colaboradora</Label>
                                    <Select
                                        value={formData.colaboradora_id}
                                        onValueChange={(v) => setFormData({ ...formData, colaboradora_id: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a colaboradora" />
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
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Meta (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.meta_valor}
                                    onChange={(e) => setFormData({ ...formData, meta_valor: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <Label>Super Meta (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.super_meta_valor}
                                    onChange={(e) => setFormData({ ...formData, super_meta_valor: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="mb-2 block">Pesos por Dia da Semana</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: "Dom", field: "peso_domingo" },
                                    { label: "Seg", field: "peso_segunda" },
                                    { label: "Ter", field: "peso_terca" },
                                    { label: "Qua", field: "peso_quarta" },
                                    { label: "Qui", field: "peso_quinta" },
                                    { label: "Sex", field: "peso_sexta" },
                                    { label: "Sab", field: "peso_sabado" },
                                ].map(({ label, field }) => (
                                    <div key={field}>
                                        <Label className="text-xs">{label}</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={formData[field as keyof typeof formData]}
                                            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    setEditingGoal(null);
                                    resetForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {editingGoal ? "Atualizar" : "Criar"} Meta
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
