import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, Gift, Check, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Bonus {
    id: string;
    name: string;
    description: string;
    tipo: string;
    valor_bonus: number;
    condicao_valor: number;
    ativo: boolean;
    store_id: string | null;
    stores?: { name: string };
}

export default function BonusManagement() {
    const [bonuses, setBonuses] = useState<Bonus[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
    const [storeFilter, setStoreFilter] = useState<string>('');

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        tipo: "META_PERCENTUAL",
        valor_bonus: "",
        condicao_valor: "",
        store_id: "TODAS",
    });

    useEffect(() => {
        console.log("BonusManagement mounted");
        fetchBonuses();
        fetchStores();
    }, []);

    const fetchBonuses = async () => {
        try {
            const { data, error } = await supabase
                .from("bonuses")
                .select(`
                *,
                stores (name)
            `)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching bonuses:", error);
                return;
            }

            if (data) {
                setBonuses(data as any);
            }
        } catch (err) {
            console.error("Exception fetching bonuses:", err);
        }
    };

    const fetchStores = async () => {
        const { data } = await supabase
            .from("stores")
            .select("*")
            .eq("active", true);
        if (data) setStores(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            name: formData.name,
            description: formData.description,
            tipo: formData.tipo,
            valor_bonus: parseFloat(formData.valor_bonus),
            condicao_valor: parseFloat(formData.condicao_valor),
            store_id: formData.store_id === "TODAS" ? null : formData.store_id,
            ativo: true,
        };

        if (editingBonus) {
            const { error } = await supabase
                .from("bonuses")
                .update(payload)
                .eq("id", editingBonus.id);

            if (error) {
                toast.error("Erro ao atualizar bônus");
                return;
            }
            toast.success("Bônus atualizado!");
        } else {
            const { error } = await supabase.from("bonuses").insert([payload]);

            if (error) {
                toast.error("Erro ao criar bônus");
                return;
            }
            toast.success("Bônus criado!");
        }

        setDialogOpen(false);
        setEditingBonus(null);
        resetForm();
        fetchBonuses();
    };

    const handleEdit = (bonus: Bonus) => {
        setEditingBonus(bonus);
        setFormData({
            name: bonus.name,
            description: bonus.description || "",
            tipo: bonus.tipo,
            valor_bonus: bonus.valor_bonus.toString(),
            condicao_valor: bonus.condicao_valor.toString(),
            store_id: bonus.store_id || "TODAS",
        });
        setDialogOpen(true);
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from("bonuses")
            .update({ ativo: !currentStatus })
            .eq("id", id);

        if (error) {
            toast.error("Erro ao atualizar status");
            return;
        }

        toast.success(currentStatus ? "Bônus desativado" : "Bônus ativado");
        fetchBonuses();
    };

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            tipo: "META_PERCENTUAL",
            valor_bonus: "",
            condicao_valor: "",
            store_id: "TODAS",
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-6 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Gerenciar Bônus
                </h1>
            </div>
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
                <Button className="ml-auto" onClick={() => { setEditingBonus(null); resetForm(); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Bônus
                </Button>
            </div>

            {/* Cards grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bonuses
                    .filter((b) => (storeFilter ? b.store_id === storeFilter : true))
                    .map((bonus) => (
                        <Card key={bonus.id} className="relative group hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Gift className="h-4 w-4 text-primary" />
                                    {bonus.name}
                                </CardTitle>
                                <Badge variant={bonus.ativo ? "default" : "destructive"} className="absolute top-2 right-2">
                                    {bonus.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="text-muted-foreground">{bonus.description}</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="bg-muted p-2 rounded">
                                        <span className="text-xs text-muted-foreground block">Tipo</span>
                                        <span className="font-medium">{bonus.tipo}</span>
                                    </div>
                                    <div className="bg-muted p-2 rounded">
                                        <span className="text-xs text-muted-foreground block">Valor Bônus</span>
                                        <span className="font-medium text-green-600">
                                            {bonus.tipo.includes('PERCENTUAL') ? `${bonus.valor_bonus}%` : `R$ ${bonus.valor_bonus}`}
                                        </span>
                                    </div>
                                    <div className="bg-muted p-2 rounded col-span-2">
                                        <span className="text-xs text-muted-foreground block">Condição</span>
                                        <span className="font-medium">
                                            {bonus.tipo === 'META_PERCENTUAL' && `Atingir ${bonus.condicao_valor}% da Meta`}
                                            {bonus.tipo === 'RANKING' && `Ficar em ${bonus.condicao_valor}º Lugar`}
                                            {bonus.tipo === 'VALOR_FIXO' && `Vender R$ ${bonus.condicao_valor}`}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Loja:</strong> {bonus.stores?.name || "Todas"}
                                </p>
                            </CardContent>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/20 transition-opacity rounded-lg">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(bonus)} className="mr-2">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant={bonus.ativo ? "destructive" : "default"}
                                    onClick={() => handleToggleActive(bonus.id, bonus.ativo)}
                                >
                                    {bonus.ativo ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </Button>
                            </div>
                        </Card>
                    ))}
                {bonuses.length === 0 && (
                    <p className="text-center text-muted-foreground col-span-full">Nenhum bônus cadastrado.</p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingBonus ? "Editar Bônus" : "Novo Bônus"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>Nome do Bônus</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Bônus Meta Batida"
                                required
                            />
                        </div>

                        <div>
                            <Label>Descrição</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Ex: Bônus para quem atingir 100% da meta"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo</Label>
                                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="META_PERCENTUAL">Meta Percentual</SelectItem>
                                        <SelectItem value="RANKING">Ranking</SelectItem>
                                        <SelectItem value="VALOR_FIXO">Valor Fixo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Loja</Label>
                                <Select value={formData.store_id} onValueChange={(v) => setFormData({ ...formData, store_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TODAS">Todas</SelectItem>
                                        {stores.map((store) => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Condição (Valor/%)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.condicao_valor}
                                    onChange={(e) => setFormData({ ...formData, condicao_valor: e.target.value })}
                                    placeholder="Ex: 100 (para 100%)"
                                    required
                                />
                            </div>

                            <div>
                                <Label>Valor do Bônus</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.valor_bonus}
                                    onChange={(e) => setFormData({ ...formData, valor_bonus: e.target.value })}
                                    placeholder="Ex: 500 ou 10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    setEditingBonus(null);
                                    resetForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {editingBonus ? "Atualizar" : "Criar"} Bônus
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
