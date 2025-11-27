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
import { ArrowLeft, CheckCircle2, Undo2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

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
  const [mesFiltro, setMesFiltro] = useState<string>("TODOS");
  const [adiantamentoParaExcluir, setAdiantamentoParaExcluir] = useState<string | null>(null);
  const [expandedParcelas, setExpandedParcelas] = useState<Set<string>>(new Set());

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
      const { data: parcelasData, error } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select(`
          *,
          purchases!inner(
            colaboradora_id,
            item
          )
        `)
        .order("competencia", { ascending: true })
        .order("n_parcela", { ascending: true });

      if (error) throw error;

      // Buscar perfis das colaboradoras separadamente
      const colaboradoraIds = [...new Set(parcelasData?.map((p: any) => p.purchases?.colaboradora_id).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      // Formatar dados com nomes das colaboradoras
      const formatted = parcelasData?.map((p: any) => ({
        ...p,
        purchases: {
          ...p.purchases,
          profiles: {
            name: profilesMap.get(p.purchases?.colaboradora_id) || "Desconhecido"
          }
        }
      })) || [];

      setParcelas(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar parcelas");
      console.error(error);
    }
  };

  const fetchAdiantamentos = async () => {
    try {
      const { data: adiantamentosData, error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("*")
        .eq("status", "APROVADO" as any)
        .order("mes_competencia", { ascending: true });

      if (error) throw error;

      // Buscar perfis separadamente
      const colaboradoraIds = [...new Set(adiantamentosData?.map(a => a.colaboradora_id) || [])];
      const { data: profilesData } = await supabase
        .schema("sistemaretiradas")
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
        .schema("sistemaretiradas")
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
        .schema("sistemaretiradas")
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
        .schema("sistemaretiradas")
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
        .schema("sistemaretiradas")
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

  const handleExcluirAdiantamento = async () => {
    if (!adiantamentoParaExcluir) return;

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .delete()
        .eq("id", adiantamentoParaExcluir);

      if (error) throw error;
      toast.success("Adiantamento excluído com sucesso!");
      setAdiantamentoParaExcluir(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir adiantamento");
      console.error(error);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="mb-6">
          <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
        </div>
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
              <div className="flex gap-2">
                <Select value={mesFiltro} onValueChange={setMesFiltro}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {Array.from(new Set([...parcelas.map(p => p.competencia), ...adiantamentos.map(a => a.mes_competencia)]))
                      .sort()
                      .reverse()
                      .map(mes => (
                        <SelectItem key={mes} value={mes}>
                          {mes.slice(4)}/{mes.slice(0, 4)}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
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
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>ID Compra</TableHead>
                        <TableHead>Colaboradora</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelas
                        .filter(p => mesFiltro === "TODOS" || p.competencia === mesFiltro)
                        .map((parcela) => {
                          const isExpanded = expandedParcelas.has(parcela.id);
                          const compraIdShort = parcela.compra_id.substring(0, 8).toUpperCase();
                          
                          return (
                            <Collapsible
                              key={parcela.id}
                              open={isExpanded}
                              onOpenChange={(open) => {
                                const newExpanded = new Set(expandedParcelas);
                                if (open) {
                                  newExpanded.add(parcela.id);
                                } else {
                                  newExpanded.delete(parcela.id);
                                }
                                setExpandedParcelas(newExpanded);
                              }}
                            >
                              <>
                                <TableRow>
                                  <TableCell>
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  </TableCell>
                                  <TableCell>
                                    <div 
                                      className="font-mono text-sm font-semibold text-primary cursor-pointer hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                                      onClick={() => {
                                        const newExpanded = new Set(expandedParcelas);
                                        if (!isExpanded) {
                                          newExpanded.add(parcela.id);
                                        } else {
                                          newExpanded.delete(parcela.id);
                                        }
                                        setExpandedParcelas(newExpanded);
                                      }}
                                    >
                                      <span className="bg-primary/10 px-2 py-1 rounded border border-primary/20">
                                        {compraIdShort}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {parcela.purchases.profiles.name}
                                  </TableCell>
                                  <TableCell>{parcela.n_parcela}</TableCell>
                                  <TableCell>
                                    {parcela.competencia.slice(0, 4)}/{parcela.competencia.slice(4)}
                                  </TableCell>
                                  <TableCell>{formatCurrency(parcela.valor_parcela)}</TableCell>
                                  <TableCell>{getStatusBadge(parcela.status_parcela)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      {parcela.status_parcela === "PENDENTE" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDescontar(parcela.id);
                                          }}
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
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedParcela(parcela.id);
                                              }}
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
                                <CollapsibleContent asChild>
                                  <TableRow>
                                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                                      <div className="space-y-3">
                                        <div className="text-sm font-semibold text-foreground mb-3">
                                          📦 Produtos da Compra <span className="font-mono text-xs text-muted-foreground">({compraIdShort})</span>
                                        </div>
                                        <div className="grid gap-2">
                                          {parcela.purchases.item.split(',').map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-2 py-2 px-3 bg-background/50 rounded-md border border-border/30">
                                              <span className="text-primary font-medium mt-0.5">•</span>
                                              <span className="text-sm text-foreground flex-1">{item.trim()}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </CollapsibleContent>
                              </>
                            </Collapsible>
                          );
                        })}
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
                      {adiantamentos
                        .filter(a => mesFiltro === "TODOS" || a.mes_competencia === mesFiltro)
                        .map((adiantamento) => (
                          <TableRow key={adiantamento.id}>
                            <TableCell className="font-medium">
                              {adiantamento.profiles.name}
                            </TableCell>
                            <TableCell>
                              {adiantamento.mes_competencia.slice(0, 4)}/{adiantamento.mes_competencia.slice(4)}
                            </TableCell>
                            <TableCell>{formatCurrency(adiantamento.valor)}</TableCell>
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
                                {/* Botão de excluir - apenas ADMIN pode excluir */}
                                {profile?.role === "ADMIN" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setAdiantamentoParaExcluir(adiantamento.id)}
                                    className="border-destructive/20 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                  </Button>
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

      {/* Dialog de confirmação para excluir adiantamento */}
      <AlertDialog open={!!adiantamentoParaExcluir} onOpenChange={(open) => !open && setAdiantamentoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Adiantamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este adiantamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirAdiantamento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Lancamentos;
