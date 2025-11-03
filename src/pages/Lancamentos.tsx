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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Undo2 } from "lucide-react";
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

interface Adiantamento {
  id: string;
  valor: number;
  mes_competencia: string;
  status: string;
  data_solicitacao: string;
  data_desconto: string | null;
  motivo_recusa: string | null;
  observacoes: string | null;
  profiles: {
    name: string;
  };
}

const Lancamentos = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcela, setSelectedParcela] = useState<string | null>(null);
  const [selectedAdiantamento, setSelectedAdiantamento] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"TODOS" | "COMPRAS" | "ADIANTAMENTOS">("TODOS");

  useEffect(() => {
    if (!authLoading) {
      if (!profile || profile.role !== "ADMIN") {
        navigate("/");
      } else {
        fetchData();
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
    }
  };

  const fetchAdiantamentos = async () => {
    try {
      const { data: adiantamentosData, error } = await supabase
        .from("adiantamentos")
        .select("*")
        .eq("status", "APROVADO" as any)
        .order("mes_competencia", { ascending: true });

      if (error) throw error;

      // Buscar perfis separadamente
      const colaboradoraIds = [...new Set(adiantamentosData?.map(a => a.colaboradora_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      const formatted = adiantamentosData?.map(a => ({
        ...a,
        profiles: { name: profilesMap.get(a.colaboradora_id) || "Desconhecido" }
      })) || [];

      setAdiantamentos(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar adiantamentos");
      console.error(error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchParcelas(), fetchAdiantamentos()]);
    setLoading(false);
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
      fetchData();
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
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao estornar parcela");
    }
  };

  const handleDescontarAdiantamento = async (adiantamentoId: string) => {
    try {
      const { error } = await supabase
        .from("adiantamentos")
        .update({
          status: "DESCONTADO" as any,
          data_desconto: new Date().toISOString(),
          descontado_por_id: profile!.id,
        })
        .eq("id", adiantamentoId);

      if (error) throw error;
      toast.success("Adiantamento descontado com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao descontar adiantamento");
    }
  };

  const handleEstornarAdiantamento = async () => {
    if (!selectedAdiantamento || !motivoEstorno.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }

    try {
      const { error } = await supabase
        .from("adiantamentos")
        .update({
          status: "APROVADO" as any,
          data_desconto: null,
          motivo_recusa: motivoEstorno,
        })
        .eq("id", selectedAdiantamento);

      if (error) throw error;
      toast.success("Adiantamento estornado com sucesso!");
      setSelectedAdiantamento(null);
      setMotivoEstorno("");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao estornar adiantamento");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDENTE: { variant: "outline", label: "Pendente" },
      AGENDADO: { variant: "secondary", label: "Agendado" },
      DESCONTADO: { variant: "default", label: "Descontado" },
      ESTORNADO: { variant: "destructive", label: "Estornado" },
      CANCELADO: { variant: "destructive", label: "Cancelado" },
      APROVADO: { variant: "secondary", label: "Aprovado" },
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Lançamentos e Descontos
              </CardTitle>
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="COMPRAS">Compras</SelectItem>
                  <SelectItem value="ADIANTAMENTOS">Adiantamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {(tipoFiltro === "TODOS" || tipoFiltro === "COMPRAS") && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Compras - Parcelas</h3>
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
              </div>
            )}

            {(tipoFiltro === "TODOS" || tipoFiltro === "ADIANTAMENTOS") && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Adiantamentos Salariais</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaboradora</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adiantamentos.map((adiantamento) => (
                        <TableRow key={adiantamento.id}>
                          <TableCell className="font-medium">
                            {adiantamento.profiles.name}
                          </TableCell>
                          <TableCell>
                            {adiantamento.mes_competencia.slice(0, 4)}/{adiantamento.mes_competencia.slice(4)}
                          </TableCell>
                          <TableCell>R$ {Number(adiantamento.valor).toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(adiantamento.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {adiantamento.status === "APROVADO" && !adiantamento.data_desconto && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDescontarAdiantamento(adiantamento.id)}
                                  className="border-primary/20"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Descontar
                                </Button>
                              )}
                              {adiantamento.status === "DESCONTADO" && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedAdiantamento(adiantamento.id)}
                                      className="border-destructive/20"
                                    >
                                      <Undo2 className="h-4 w-4 mr-1" />
                                      Estornar
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Estornar Adiantamento</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="motivoAd">Motivo do Estorno *</Label>
                                        <Textarea
                                          id="motivoAd"
                                          value={motivoEstorno}
                                          onChange={(e) => setMotivoEstorno(e.target.value)}
                                          placeholder="Descreva o motivo do estorno"
                                          rows={4}
                                        />
                                      </div>
                                      <Button
                                        onClick={handleEstornarAdiantamento}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Lancamentos;
