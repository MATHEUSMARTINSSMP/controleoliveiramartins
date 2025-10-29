import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { format } from "date-fns";

interface Parcela {
  id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  data_baixa: string | null;
  motivo_estorno: string | null;
  compra_id: string;
  purchases: {
    colaboradora_id: string;
    item: string;
    profiles: {
      name: string;
    };
  };
}

const Lancamentos = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcela, setSelectedParcela] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [mesAtual] = useState(format(new Date(), "yyyyMM"));

  useEffect(() => {
    if (!authLoading) {
      if (!profile || profile.role !== "ADMIN") {
        navigate("/");
      } else {
        fetchParcelas();
      }
    }
  }, [profile, authLoading, navigate]);

  const fetchParcelas = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          purchases!inner(
            colaboradora_id,
            item,
            profiles!purchases_colaboradora_id_fkey(name)
          )
        `)
        .order("competencia", { ascending: true })
        .order("n_parcela", { ascending: true });

      if (error) throw error;
      setParcelas(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar parcelas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDescontar = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status_parcela: "DESCONTADO",
          data_baixa: new Date().toISOString(),
          baixado_por_id: profile!.id,
        })
        .eq("id", parcelaId);

      if (error) throw error;
      toast.success("Parcela descontada com sucesso!");
      fetchParcelas();
    } catch (error: any) {
      toast.error("Erro ao descontar parcela");
    }
  };

  const handleEstornar = async () => {
    if (!selectedParcela || !motivoEstorno.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }

    try {
      const { error } = await supabase
        .from("parcelas")
        .update({
          status_parcela: "ESTORNADO",
          motivo_estorno: motivoEstorno,
          baixado_por_id: profile!.id,
        })
        .eq("id", selectedParcela);

      if (error) throw error;
      toast.success("Parcela estornada com sucesso!");
      setSelectedParcela(null);
      setMotivoEstorno("");
      fetchParcelas();
    } catch (error: any) {
      toast.error("Erro ao estornar parcela");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDENTE: { variant: "outline", label: "Pendente" },
      AGENDADO: { variant: "secondary", label: "Agendado" },
      DESCONTADO: { variant: "default", label: "Descontado" },
      ESTORNADO: { variant: "destructive", label: "Estornado" },
      CANCELADO: { variant: "destructive", label: "Cancelado" },
    };
    const config = variants[status] || variants.PENDENTE;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (authLoading || loading) {
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
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Lançamentos e Descontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaboradora</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell className="font-medium">
                        {parcela.purchases.profiles.name}
                      </TableCell>
                      <TableCell>{parcela.purchases.item}</TableCell>
                      <TableCell>{parcela.n_parcela}</TableCell>
                      <TableCell>
                        {parcela.competencia.slice(0, 4)}/{parcela.competencia.slice(4)}
                      </TableCell>
                      <TableCell>R$ {Number(parcela.valor_parcela).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(parcela.status_parcela)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {parcela.status_parcela === "PENDENTE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDescontar(parcela.id)}
                              className="border-primary/20"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Descontar
                            </Button>
                          )}
                          {parcela.status_parcela === "DESCONTADO" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedParcela(parcela.id)}
                                  className="border-destructive/20"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Estornar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Estornar Parcela</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="motivo">Motivo do Estorno *</Label>
                                    <Textarea
                                      id="motivo"
                                      value={motivoEstorno}
                                      onChange={(e) => setMotivoEstorno(e.target.value)}
                                      placeholder="Descreva o motivo do estorno"
                                      rows={4}
                                    />
                                  </div>
                                  <Button
                                    onClick={handleEstornar}
                                    className="w-full"
                                    variant="destructive"
                                  >
                                    Confirmar Estorno
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Lancamentos;
