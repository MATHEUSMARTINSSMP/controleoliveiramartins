import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Store as StoreIcon, Plus, Edit, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Store {
    id: string;
    name: string;
    active: boolean;
    admin_id: string;
    sistema_erp: string | null;
    whatsapp: string | null;
    created_at: string;
}

interface StoreManagementProps {
    adminId: string;
}

export function StoreManagement({ adminId }: StoreManagementProps) {
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        sistema_erp: "",
        whatsapp: "",
    });

    // Limites do plano
    const [limits, setLimits] = useState<{
        max_stores: number;
        max_colaboradoras_total: number;
    } | null>(null);

    useEffect(() => {
        fetchStores();
        fetchLimits();
    }, [adminId]);

    const fetchLimits = async () => {
        try {
            const { data, error } = await supabase
                .rpc('get_admin_limits', { p_admin_id: adminId });

            if (error) throw error;

            if (data && data.length > 0) {
                const limitsData = data[0] as any;
                setLimits({
                    max_stores: limitsData.max_stores,
                    max_colaboradoras_total: limitsData.max_colaboradoras_total,
                });
            }
        } catch (error: any) {
            console.error("Erro ao buscar limites:", error);
        }
    };

    const fetchStores = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .select("*")
                .eq("admin_id", adminId)
                .order("name");

            if (error) throw error;
            setStores(data || []);
        } catch (error: any) {
            toast.error("Erro ao carregar lojas: " + error.message);
            setStores([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (store?: Store) => {
        if (store) {
            setEditMode(true);
            setSelectedId(store.id);
            setFormData({
                name: store.name,
                sistema_erp: store.sistema_erp || "",
                whatsapp: store.whatsapp || "",
            });
        } else {
            setEditMode(false);
            setSelectedId(null);
            setFormData({
                name: "",
                sistema_erp: "",
                whatsapp: "",
            });
        }
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        try {
            if (!formData.name.trim()) {
                toast.error("Nome da loja é obrigatório");
                return;
            }

            if (editMode && selectedId) {
                // Normalizar WhatsApp (remover caracteres não numéricos, exceto se vazio)
                const whatsappNormalizado = formData.whatsapp.trim() 
                    ? formData.whatsapp.replace(/\D/g, '') 
                    : null;

                // Editar loja existente
                const { error } = await supabase
                    .schema("sistemaretiradas")
                    .from("stores")
                    .update({
                        name: formData.name,
                        sistema_erp: formData.sistema_erp || null,
                        whatsapp: whatsappNormalizado,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", selectedId);

                if (error) throw error;
                toast.success("Loja atualizada com sucesso!");
            } else {
                // Verificar limite antes de criar
                const { data: canCreate } = await supabase
                    .rpc('can_create_store', { p_admin_id: adminId });

                if (!canCreate) {
                    toast.error("Limite de lojas atingido! Faça upgrade do seu plano ou contrate o addon 'Loja Extra'.");
                    return;
                }

                // Normalizar WhatsApp (remover caracteres não numéricos, exceto se vazio)
                const whatsappNormalizado = formData.whatsapp.trim() 
                    ? formData.whatsapp.replace(/\D/g, '') 
                    : null;

                // Criar nova loja
                const { error } = await supabase
                    .schema("sistemaretiradas")
                    .from("stores")
                    .insert({
                        name: formData.name,
                        admin_id: adminId,
                        sistema_erp: formData.sistema_erp || null,
                        whatsapp: whatsappNormalizado,
                        active: true,
                    });

                if (error) throw error;
                toast.success("Loja criada com sucesso!");
            }

            setDialogOpen(false);
            fetchStores();
            fetchLimits(); // Atualizar limites
        } catch (error: any) {
            toast.error("Erro: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .update({ active: false })
                .eq("id", id);

            if (error) throw error;
            toast.success("Loja desativada com sucesso!");
            fetchStores();
        } catch (error: any) {
            toast.error("Erro ao desativar loja: " + error.message);
        } finally {
            setDeleteDialog(null);
        }
    };

    const handleReactivate = async (id: string) => {
        try {
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .update({ active: true })
                .eq("id", id);

            if (error) throw error;
            toast.success("Loja reativada com sucesso!");
            fetchStores();
        } catch (error: any) {
            toast.error("Erro ao reativar loja: " + error.message);
        }
    };

    const activeStores = stores.filter(s => s.active).length;

    return (
        <div className="space-y-4">
            {/* Header com limites */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Minhas Lojas</h3>
                    {limits && (
                        <p className="text-sm text-muted-foreground">
                            {activeStores} / {limits.max_stores} lojas utilizadas
                        </p>
                    )}
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-primary to-accent">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Loja
                </Button>
            </div>

            {/* Tabela de lojas */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : stores.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 border border-dashed rounded-lg">
                    <StoreIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhuma loja cadastrada</p>
                    <Button onClick={() => handleOpenDialog()} variant="outline" className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira loja
                    </Button>
                </div>
            ) : (
                <div className="rounded-lg border border-primary/10 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Nome</TableHead>
                                <TableHead className="font-semibold">Sistema ERP</TableHead>
                                <TableHead className="font-semibold">WhatsApp</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stores.map((store) => (
                                <TableRow key={store.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium">{store.name}</TableCell>
                                    <TableCell>{store.sistema_erp || "-"}</TableCell>
                                    <TableCell>{store.whatsapp || "-"}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${store.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                                            }`}>
                                            {store.active ? "Ativa" : "Inativa"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenDialog(store)}
                                                className="hover:bg-primary/10"
                                                title="Editar"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            {store.active ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteDialog(store.id)}
                                                    className="hover:bg-destructive/10 text-destructive"
                                                    title="Desativar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleReactivate(store.id)}
                                                    className="hover:bg-success/10 text-success"
                                                    title="Reativar"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Dialog de criar/editar */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editMode ? "Editar Loja" : "Nova Loja"}</DialogTitle>
                        <DialogDescription>
                            {editMode ? "Atualize as informações da loja" : "Preencha os dados para criar uma nova loja"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome da Loja *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Loja Centro"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sistema_erp">Sistema ERP (opcional)</Label>
                            <Input
                                id="sistema_erp"
                                value={formData.sistema_erp}
                                onChange={(e) => setFormData({ ...formData, sistema_erp: e.target.value })}
                                placeholder="Ex: TINY, BLING"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">Telefone WhatsApp (opcional)</Label>
                            <Input
                                id="whatsapp"
                                type="tel"
                                value={formData.whatsapp}
                                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                placeholder="Ex: 5598987654321"
                            />
                            <p className="text-xs text-muted-foreground">
                                Formato: código do país (55) + DDD + número (ex: 5598987654321). Usado para notificações de tarefas atrasadas.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editMode ? "Salvar" : "Criar Loja"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmação de exclusão */}
            <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desativar Loja</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja desativar esta loja? Ela não será deletada, apenas marcada como inativa.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDialog && handleDelete(deleteDialog)}>
                            Desativar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
