import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Adiantamento {
  id: string;
  valor: number;
  data_solicitacao: string;
  mes_competencia: string;
  status: string;
  observacoes: string | null;
  motivo_recusa: string | null;
  profiles: {
    name: string;
  };
}

export default function Adiantamentos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "aprovar" | "recusar" | "descontar" | null;
    adiantamento: Adiantamento | null;
    motivo: string;
  }>({
    open: false,
    type: null,
    adiantamento: null,
    motivo: "",
  });

  useEffect(() => {
    fetchAdiantamentos();
  }, []);

  const fetchAdiantamentos = async () => {
    setLoading(true);
    try {
      // Buscar adiantamentos
      const { data: adiantamentosData, error: adiantamentosError } = await supabase
        .from("adiantamentos")
        .select("*")
        .order("data_solicitacao", { ascending: false });

      if (adiantamentosError) throw adiantamentosError;

      // Buscar perfis das colaboradoras
      const colaboradoraIds = [...new Set(adiantamentosData?.map(a => a.colaboradora_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      if (profilesError) throw profilesError;

      // Mapear nomes aos adiantamentos
      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
      const adiantamentosComNomes = adiantamentosData?.map(a => ({
        ...a,
        profiles: { name: profilesMap.get(a.colaboradora_id) || "Desconhecido" }
      })) || [];

      setAdiantamentos(adiantamentosComNomes);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar adiantamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.adiantamento) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let updateData: any = {};

    if (actionDialog.type === "aprovar") {
      updateData = {
        status: "APROVADO",
        aprovado_por_id: user.id,
        data_aprovacao: new Date().toISOString(),
      };
    } else if (actionDialog.type === "recusar") {
      if (!actionDialog.motivo.trim()) {
        toast({
          title: "Motivo obrigatório",
          description: "Informe o motivo da recusa",
          variant: "destructive",
        });
        return;
      }
      updateData = {
        status: "RECUSADO",
        motivo_recusa: actionDialog.motivo,
        aprovado_por_id: user.id,
        data_aprovacao: new Date().toISOString(),
      };
    } else if (actionDialog.type === "descontar") {
      updateData = {
        status: "DESCONTADO",
        descontado_por_id: user.id,
        data_desconto: new Date().toISOString(),
      };
    }

    const { error } = await supabase
      .from("adiantamentos")
      .update(updateData)
      .eq("id", actionDialog.adiantamento.id);

    if (error) {
      toast({
        title: "Erro ao processar ação",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Ação realizada com sucesso!",
      });
      fetchAdiantamentos();
    }

    setActionDialog({ open: false, type: null, adiantamento: null, motivo: "" });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDENTE: "secondary",
      APROVADO: "default",
      RECUSADO: "destructive",
      DESCONTADO: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/admin/novo-adiantamento")}>
            + Novo Adiantamento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Adiantamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaboradora</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Mês Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adiantamentos.map((adiantamento) => (
                    <TableRow key={adiantamento.id}>
                      <TableCell>{adiantamento.profiles.name}</TableCell>
                      <TableCell>R$ {parseFloat(adiantamento.valor.toString()).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(adiantamento.data_solicitacao).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{adiantamento.mes_competencia}</TableCell>
                      <TableCell>{getStatusBadge(adiantamento.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {adiantamento.status === "PENDENTE" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    type: "aprovar",
                                    adiantamento,
                                    motivo: "",
                                  })
                                }
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setActionDialog({
                                    open: true,
                                    type: "recusar",
                                    adiantamento,
                                    motivo: "",
                                  })
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {adiantamento.status === "APROVADO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setActionDialog({
                                  open: true,
                                  type: "descontar",
                                  adiantamento,
                                  motivo: "",
                                })
                              }
                            >
                              <DollarSign className="h-4 w-4" />
                              Descontar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, adiantamento: null, motivo: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "aprovar" && "Aprovar Adiantamento"}
              {actionDialog.type === "recusar" && "Recusar Adiantamento"}
              {actionDialog.type === "descontar" && "Efetivar Desconto"}
            </DialogTitle>
          </DialogHeader>

          {actionDialog.type === "recusar" && (
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Recusa *</Label>
              <Textarea
                id="motivo"
                value={actionDialog.motivo}
                onChange={(e) => setActionDialog({ ...actionDialog, motivo: e.target.value })}
                placeholder="Informe o motivo..."
                rows={4}
              />
            </div>
          )}

          {actionDialog.type === "aprovar" && (
            <p>Confirma a aprovação deste adiantamento?</p>
          )}

          {actionDialog.type === "descontar" && (
            <p>Confirma a efetivação do desconto deste adiantamento?</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, adiantamento: null, motivo: "" })}>
              Cancelar
            </Button>
            <Button onClick={handleAction}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
