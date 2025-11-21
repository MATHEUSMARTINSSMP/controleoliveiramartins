import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, Gift, Check, Trophy, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Bonus {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    tipo_condicao: string | null;
    meta_minima_percentual: number | null;
    vendas_minimas: number | null;
    valor_bonus: number;
    descricao_premio: string | null;
    ativo: boolean;
    store_id?: string | null;
    valor_condicao?: number | null;
    stores?: { name: string };
}

export default function BonusManagement() {
    const navigate = useNavigate();
    const [bonuses, setBonuses] = useState<Bonus[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
    const [storeFilter, setStoreFilter] = useState<string>('ALL');

    const [formData, setFormData] = useState({
        nome: "",
        descricao: "",
        tipo: "VALOR_FIXO",
        tipo_condicao: "PERCENTUAL_META",
        meta_minima_percentual: "",
        vendas_minimas: "",
        valor_bonus: "",
        descricao_premio: "",
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

        // Para bônus semanais, meta_minima_percentual é sempre 100 (atingir 100% da meta)
        const metaMinimaPercentual = (formData.tipo_condicao === 'META_SEMANAL' || formData.tipo_condicao === 'SUPER_META_SEMANAL') 
            ? 100 
            : formData.meta_minima_percentual ? parseFloat(formData.meta_minima_percentual) : null;

        const payload: any = {
            nome: formData.nome,
            descricao: formData.descricao || null,
            tipo: formData.tipo,
            tipo_condicao: formData.tipo_condicao,
            meta_minima_percentual: metaMinimaPercentual,
            vendas_minimas: formData.vendas_minimas ? parseFloat(formData.vendas_minimas) : null,
            valor_bonus: parseFloat(formData.valor_bonus),
            descricao_premio: formData.descricao_premio || null,
            valor_condicao: null, // Pode ser usado para outras condições no futuro
            ativo: true,
        };

        // Adicionar store_id se não for "TODAS"
        if (formData.store_id !== "TODAS") {
            payload.store_id = formData.store_id;
        }

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
            nome: bonus.nome,
            descricao: bonus.descricao || "",
            tipo: bonus.tipo || "VALOR_FIXO",
            tipo_condicao: bonus.tipo_condicao || "PERCENTUAL_META",
            meta_minima_percentual: bonus.meta_minima_percentual?.toString() || "",
            vendas_minimas: bonus.vendas_minimas?.toString() || "",
            valor_bonus: bonus.valor_bonus.toString(),
            descricao_premio: bonus.descricao_premio || "",
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
            nome: "",
            descricao: "",
            tipo: "VALOR_FIXO",
            tipo_condicao: "PERCENTUAL_META",
            meta_minima_percentual: "",
            vendas_minimas: "",
            valor_bonus: "",
            descricao_premio: "",
            store_id: "TODAS",
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-3 sm:p-6 space-y-4 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin")}
                        className="gap-2 text-xs sm:text-sm flex-shrink-0"
                    >
                        <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        Voltar
                    </Button>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent truncate flex-1 min-w-0">
                        Gerenciar Bônus
                    </h1>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                    <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm">
                        <SelectValue placeholder="Todas as lojas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                                {store.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto text-xs sm:text-sm ml-0 sm:ml-auto" size="sm" onClick={() => { setEditingBonus(null); resetForm(); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Novo Bônus
                </Button>
            </div>

            {/* Cards grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {bonuses
                    .filter((b) => (storeFilter && storeFilter !== "ALL" ? b.store_id === storeFilter : true))
                    .map((bonus) => (
                        <Card key={bonus.id} className="relative group hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2 p-3 sm:p-6">
                                <CardTitle className="flex items-center gap-2 text-sm sm:text-lg truncate">
                                    <Gift className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                    <span className="truncate">{bonus.nome}</span>
                                </CardTitle>
                                <Badge variant={bonus.ativo ? "default" : "destructive"} className="absolute top-2 right-2 text-[10px] sm:text-xs">
                                    {bonus.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs sm:text-sm p-3 sm:p-6 pt-0 sm:pt-0">
                                <p className="text-muted-foreground text-xs sm:text-sm">{bonus.descricao || "Sem descrição"}</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div className="bg-muted p-2 rounded">
                                        <span className="text-[10px] sm:text-xs text-muted-foreground block">Tipo</span>
                                        <span className="font-medium text-xs sm:text-sm truncate">{bonus.tipo || "VALOR_FIXO"}</span>
                                    </div>
                                    <div className="bg-muted p-2 rounded">
                                        <span className="text-[10px] sm:text-xs text-muted-foreground block">Valor Bônus</span>
                                        <span className="font-medium text-green-600 text-xs sm:text-sm">
                                            {bonus.tipo === 'PERCENTUAL' ? `${bonus.valor_bonus}%` : `R$ ${bonus.valor_bonus}`}
                                        </span>
                                    </div>
                                    <div className="bg-muted p-2 rounded col-span-2">
                                        <span className="text-[10px] sm:text-xs text-muted-foreground block">Condição</span>
                                        <span className="font-medium text-xs sm:text-sm">
                                            {bonus.tipo_condicao === 'PERCENTUAL_META' && bonus.meta_minima_percentual && `Atingir ${bonus.meta_minima_percentual}% da Meta`}
                                            {bonus.tipo_condicao === 'RANKING' && `Ficar em ${bonus.valor_condicao || bonus.meta_minima_percentual}º Lugar`}
                                            {bonus.tipo_condicao === 'VALOR_FIXO_VENDAS' && bonus.vendas_minimas && `Vender R$ ${bonus.vendas_minimas}`}
                                            {bonus.tipo_condicao === 'META_SEMANAL' && `🎯 Atingir 100% da Meta Semanal`}
                                            {bonus.tipo_condicao === 'SUPER_META_SEMANAL' && `🏆 Atingir 100% da Super Meta Semanal (não cumulativo)`}
                                            {!bonus.tipo_condicao && bonus.meta_minima_percentual && `Atingir ${bonus.meta_minima_percentual}% da Meta`}
                                        </span>
                                    </div>
                                </div>
                                {bonus.stores?.name && (
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                                        <strong>Loja:</strong> {bonus.stores.name}
                                    </p>
                                )}
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
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">{editingBonus ? "Editar Bônus" : "Novo Bônus"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <Label className="text-xs sm:text-sm">Nome do Bônus</Label>
                            <Input
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Bônus Meta Semanal"
                                required
                                className="text-xs sm:text-sm"
                            />
                        </div>

                        <div>
                            <Label className="text-xs sm:text-sm">Descrição</Label>
                            <Input
                                value={formData.descricao}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                placeholder="Ex: Bônus ao atingir meta semanal"
                                className="text-xs sm:text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <Label className="text-xs sm:text-sm">Tipo de Condição</Label>
                                <Select value={formData.tipo_condicao} onValueChange={(v) => {
                                    setFormData({ ...formData, tipo_condicao: v });
                                    // Para bônus semanais, meta_minima_percentual é sempre 100%
                                    if (v === 'META_SEMANAL' || v === 'SUPER_META_SEMANAL') {
                                        setFormData(prev => ({ ...prev, meta_minima_percentual: '100', tipo: 'VALOR_FIXO' }));
                                    }
                                }}>
                                    <SelectTrigger className="text-xs sm:text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERCENTUAL_META">Meta Percentual</SelectItem>
                                        <SelectItem value="RANKING">Ranking</SelectItem>
                                        <SelectItem value="VALOR_FIXO_VENDAS">Valor Fixo de Vendas</SelectItem>
                                        <SelectItem value="META_SEMANAL">Meta Semanal (Checkpoint 1)</SelectItem>
                                        <SelectItem value="SUPER_META_SEMANAL">Super Meta Semanal (Checkpoint Final)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs sm:text-sm">Loja</Label>
                                <Select value={formData.store_id} onValueChange={(v) => setFormData({ ...formData, store_id: v })}>
                                    <SelectTrigger className="text-xs sm:text-sm">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {(formData.tipo_condicao !== 'META_SEMANAL' && formData.tipo_condicao !== 'SUPER_META_SEMANAL') && (
                                <div>
                                    <Label className="text-xs sm:text-sm">
                                        {formData.tipo_condicao === 'PERCENTUAL_META' ? 'Meta Mínima (%)' : 'Condição'}
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.meta_minima_percentual}
                                        onChange={(e) => setFormData({ ...formData, meta_minima_percentual: e.target.value })}
                                        placeholder={formData.tipo_condicao === 'PERCENTUAL_META' ? "Ex: 100 (para 100%)" : "Valor da condição"}
                                        required={formData.tipo_condicao !== 'META_SEMANAL' && formData.tipo_condicao !== 'SUPER_META_SEMANAL'}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            )}

                            <div className={formData.tipo_condicao === 'META_SEMANAL' || formData.tipo_condicao === 'SUPER_META_SEMANAL' ? 'col-span-2' : ''}>
                                <Label className="text-xs sm:text-sm">
                                    {formData.tipo_condicao === 'META_SEMANAL' || formData.tipo_condicao === 'SUPER_META_SEMANAL' 
                                        ? 'Valor do Bônus (R$)' 
                                        : formData.tipo === 'PERCENTUAL' ? 'Valor do Bônus (%)' : 'Valor do Bônus (R$)'}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.valor_bonus}
                                    onChange={(e) => setFormData({ ...formData, valor_bonus: e.target.value })}
                                    placeholder={
                                        formData.tipo_condicao === 'META_SEMANAL' 
                                            ? 'Ex: 50 (bônus ao atingir meta semanal)' 
                                            : formData.tipo_condicao === 'SUPER_META_SEMANAL'
                                            ? 'Ex: 150 (bônus ao atingir super meta - não cumulativo)'
                                            : formData.tipo === 'PERCENTUAL' ? 'Ex: 10 (para 10%)' : 'Ex: 500'
                                    }
                                    required
                                    className="text-xs sm:text-sm"
                                />
                                {(formData.tipo_condicao === 'META_SEMANAL' || formData.tipo_condicao === 'SUPER_META_SEMANAL') && (
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                        {formData.tipo_condicao === 'META_SEMANAL' 
                                            ? '💡 Bônus pago quando atingir 100% da meta semanal'
                                            : '💡 Bônus pago quando atingir 100% da super meta (substitui bônus da meta se atingir super meta)'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    setEditingBonus(null);
                                    resetForm();
                                }}
                                className="w-full sm:w-auto text-xs sm:text-sm"
                                size="sm"
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                                {editingBonus ? "Atualizar" : "Criar"} Bônus
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
