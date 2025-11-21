import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, UserPlus, Trash2, Edit, Mail, Loader2, UserCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { normalizeCPF } from "@/lib/cpf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Colaboradora {
  id: string;
  name: string;
  email: string;
  cpf: string;
  limite_total: number;
  limite_mensal: number;
  active: boolean;
  store_default: string | null;
  role?: string;
}

interface Loja {
  id: string;
  name: string;
  email: string;
  active: boolean;
  store_default: string | null;
  store_name?: string;
  role?: string;
}

const Colaboradores = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submit button
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("colaboradoras");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    password: "",
    limite_total: "1000.00",
    limite_mensal: "800.00",
    store: "",
  });

  useEffect(() => {
    if (!loading && (!profile || profile.role !== "ADMIN")) {
      navigate("/");
    } else if (profile) {
      setLoadingData(true);
      Promise.all([fetchColaboradoras(), fetchLojas()]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [profile, loading, navigate]);

  const fetchColaboradoras = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("role", "COLABORADORA")
        .order("name");

      if (error) {
        throw error;
      }

      setColaboradoras(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar colaboradoras: " + (error.message || String(error)));
      console.error("Error fetching colaboradoras:", error);
      setColaboradoras([]);
    }
  };

  const fetchLojas = async () => {
    try {
      const { data: lojasData, error: lojasError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("role", "LOJA")
        .order("name");

      if (lojasError) {
        throw lojasError;
      }

      // Buscar nomes das lojas
      const { data: storesData } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true);

      if (storesData && lojasData) {
        const storesMap = new Map(storesData.map(s => [s.id, s.name]));
        const lojasComNomes = lojasData.map((loja: any) => ({
          ...loja,
          store_name: storesMap.get(loja.store_default || '') || loja.store_default || 'Não definido'
        }));
        setLojas(lojasComNomes);
      } else {
        setLojas(lojasData || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar lojas: " + (error.message || String(error)));
      console.error("Error fetching lojas:", error);
      setLojas([]);
    }
  };

  const handleOpenDialog = (colaboradora?: Colaboradora) => {
    if (colaboradora) {
      setEditMode(true);
      setSelectedId(colaboradora.id);
      setFormData({
        name: colaboradora.name,
        email: colaboradora.email,
        cpf: colaboradora.cpf,
        password: "",
        limite_total: colaboradora.limite_total.toString(),
        limite_mensal: colaboradora.limite_mensal.toString(),
        store: colaboradora.store_default || "",
      });
    } else {
      setEditMode(false);
      setSelectedId(null);
      setFormData({
        name: "",
        email: "",
        cpf: "",
        password: "",
        limite_total: "1000.00",
        limite_mensal: "800.00",
        store: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true); // Start loading
    try {
      if (editMode && selectedId) {
        // Update existing colaboradora
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          limite_total: parseFloat(formData.limite_total),
          limite_mensal: parseFloat(formData.limite_mensal),
          store_default: formData.store,
        };

        // Buscar store_id dinamicamente da tabela stores
        if (formData.store) {
          const { data: storeData } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("id, name")
            .eq("active", true);
          
          if (storeData) {
            // Normalizar nome para busca flexível
            const normalizeName = (name: string) => {
              return name
                .toLowerCase()
                .replace(/[|,]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            };
            
            const normalizedStoreName = normalizeName(formData.store);
            const matchingStore = storeData.find(s => {
              const normalizedStore = normalizeName(s.name);
              return normalizedStore === normalizedStoreName || 
                     s.name === formData.store ||
                     normalizedStore.includes(normalizedStoreName) ||
                     normalizedStoreName.includes(normalizedStore);
            });
            
            if (matchingStore) {
              updateData.store_id = matchingStore.id;
            }
          }
        }

        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .update(updateData)
          .eq("id", selectedId);

        if (error) throw error;
        toast.success("Colaboradora atualizada com sucesso!");
      } else {
        // Validate required fields
        if (!formData.name || !formData.cpf || !formData.email || !formData.password || !formData.store) {
          toast.error("Todos os campos obrigatórios devem ser preenchidos");
          return;
        }

        // Buscar store_id dinamicamente da tabela stores
        let storeIdToSend: string | null = null;
        if (formData.store) {
          const { data: storeData } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("id, name")
            .eq("active", true);
          
          if (storeData) {
            // Normalizar nome para busca flexível
            const normalizeName = (name: string) => {
              return name
                .toLowerCase()
                .replace(/[|,]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            };
            
            const normalizedStoreName = normalizeName(formData.store);
            const matchingStore = storeData.find(s => {
              const normalizedStore = normalizeName(s.name);
              return normalizedStore === normalizedStoreName || 
                     s.name === formData.store ||
                     normalizedStore.includes(normalizedStoreName) ||
                     normalizedStoreName.includes(normalizedStore);
            });
            
            if (matchingStore) {
              storeIdToSend = matchingStore.id;
            }
          }
        }

        // Create new colaboradora via Netlify Function
        const response = await fetch('/.netlify/functions/create-colaboradora', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            cpf: normalizeCPF(formData.cpf),  // Normalize CPF before sending
            limite_total: formData.limite_total,
            limite_mensal: formData.limite_mensal,
            store_default: formData.store,
            store_id: storeIdToSend, // Add store_id
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || "Erro ao criar colaboradora");
        }

        toast.success("Colaboradora criada com sucesso! Email de boas-vindas enviado.");
      }

      setDialogOpen(false);
      fetchColaboradoras();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setIsSubmitting(false); // Reset submitting in finally block
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string, userName: string) => {
    try {
      const newPassword = prompt(`Digite a nova senha para ${userName} (mínimo 6 caracteres):`);

      if (!newPassword || newPassword.length < 6) {
        toast.error("Senha inválida. Mínimo 6 caracteres.");
        return;
      }

      // Call Netlify Function to reset password
      const response = await fetch('/.netlify/functions/reset-colaboradora-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword,
          email: userEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erro ao resetar senha");
      }

      toast.success("Senha resetada com sucesso! Email enviado.");
    } catch (error: any) {
      toast.error("Erro ao resetar senha: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Colaboradora desativada com sucesso!");
      fetchColaboradoras();
    } catch (error: any) {
      toast.error("Erro ao desativar colaboradora: " + error.message);
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleReactivate = async (id: string, type: "colaboradora" | "loja") => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: true })
        .eq("id", id);

      if (error) throw error;
      toast.success(`${type === "loja" ? "Loja" : "Colaboradora"} reativada com sucesso!`);
      if (type === "loja") {
        fetchLojas();
      } else {
        fetchColaboradoras();
      }
    } catch (error: any) {
      toast.error(`Erro ao reativar ${type === "loja" ? "loja" : "colaboradora"}: ` + error.message);
    }
  };

  const handleDeleteLoja = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Loja desativada com sucesso!");
      fetchLojas();
    } catch (error: any) {
      toast.error("Erro ao desativar loja: " + error.message);
    } finally {
      setDeleteDialog(null);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Gerenciar Perfis
              </CardTitle>
              {activeTab === "colaboradoras" ? (
                <Button onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-primary to-accent text-xs sm:text-sm">
                  <UserPlus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Nova Colaboradora
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
                <TabsTrigger value="colaboradoras" className="text-xs sm:text-sm">
                  <UserCheck className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Colaboradoras</span>
                  <span className="sm:hidden">Colabs</span>
                </TabsTrigger>
                <TabsTrigger value="lojas" className="text-xs sm:text-sm">
                  <Store className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Lojas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="colaboradoras" className="space-y-4">
                {loadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Nome</TableHead>
                          <TableHead className="font-semibold">CPF</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Loja</TableHead>
                          <TableHead className="font-semibold">Limite Total</TableHead>
                          <TableHead className="font-semibold">Limite Mensal</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {colaboradoras.map((colab) => (
                          <TableRow key={colab.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="font-medium">{colab.name}</TableCell>
                            <TableCell>{colab.cpf || "Não informado"}</TableCell>
                            <TableCell>{colab.email}</TableCell>
                            <TableCell>
                              <span className="text-xs font-medium px-2 py-1 bg-primary/10 rounded-full">
                                {colab.store_default || "-"}
                              </span>
                            </TableCell>
                            <TableCell>{formatCurrency(colab.limite_total)}</TableCell>
                            <TableCell>{formatCurrency(colab.limite_mensal)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${colab.active
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                                }`}>
                                {colab.active ? "Ativa" : "Inativa"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(colab)}
                                  className="hover:bg-primary/10"
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetPassword(colab.id, colab.email, colab.name)}
                                  className="hover:bg-warning/10 text-warning"
                                  title="Resetar Senha"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                {colab.active ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteDialog(colab.id)}
                                    className="hover:bg-destructive/10 text-destructive"
                                    title="Desativar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReactivate(colab.id, "colaboradora")}
                                    className="hover:bg-success/10 text-success"
                                    title="Reativar"
                                  >
                                    <UserCheck className="h-4 w-4" />
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
              </TabsContent>

              <TabsContent value="lojas" className="space-y-4">
                {lojas.length === 0 && !loadingData ? (
                  <div className="text-center text-muted-foreground py-12">
                    Nenhuma loja cadastrada
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Nome</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Loja</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lojas.map((loja: any) => (
                          <TableRow key={loja.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="font-medium">{loja.name}</TableCell>
                            <TableCell>{loja.email}</TableCell>
                            <TableCell>
                              <span className="text-xs font-medium px-2 py-1 bg-primary/10 rounded-full">
                                {loja.store_name || loja.store_default || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${loja.active
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                                }`}>
                                {loja.active ? "Ativa" : "Inativa"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetPassword(loja.id, loja.email, loja.name)}
                                  className="hover:bg-warning/10 text-warning"
                                  title="Resetar Senha"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                {loja.active ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteDialog(`loja_${loja.id}`)}
                                    className="hover:bg-destructive/10 text-destructive"
                                    title="Desativar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReactivate(loja.id, "loja")}
                                    className="hover:bg-success/10 text-success"
                                    title="Reativar"
                                  >
                                    <UserCheck className="h-4 w-4" />
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editMode ? "Editar Colaboradora" : "Nova Colaboradora"}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? "Atualize as informações da colaboradora"
                : "Preencha os dados para criar uma nova colaboradora"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                disabled={editMode}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store">Loja *</Label>
              <Select
                value={formData.store}
                onValueChange={(value) => setFormData({ ...formData, store: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr. Kitsch">Mr. Kitsch</SelectItem>
                  <SelectItem value="Loungerie">Loungerie</SelectItem>
                  <SelectItem value="Sacada Oh,Boy!">Sacada Oh,Boy!</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                required
              />
            </div>
            {!editMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha Inicial *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limite_total">Limite Total (R$)</Label>
                <Input
                  id="limite_total"
                  type="number"
                  step="0.01"
                  value={formData.limite_total}
                  onChange={(e) => setFormData({ ...formData, limite_total: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite_mensal">Limite Mensal (R$)</Label>
                <Input
                  id="limite_mensal"
                  type="number"
                  step="0.01"
                  value={formData.limite_mensal}
                  onChange={(e) => setFormData({ ...formData, limite_mensal: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                editMode ? "Atualizar" : "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.startsWith('loja_')
                ? "Tem certeza que deseja desativar esta loja? Ela não poderá mais acessar o sistema."
                : "Tem certeza que deseja desativar esta colaboradora? Ela não poderá mais acessar o sistema."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog?.startsWith('loja_')) {
                  const lojaId = deleteDialog.replace('loja_', '');
                  handleDeleteLoja(lojaId);
                } else if (deleteDialog) {
                  handleDelete(deleteDialog);
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Colaboradores;
