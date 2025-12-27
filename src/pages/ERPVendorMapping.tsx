import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, CheckCircle2, XCircle, RefreshCw, AlertTriangle, 
  User, Users, Link2, ArrowRight, Store, ChevronLeft 
} from "lucide-react";
import { toast } from "sonner";

interface Vendedor {
  tiny_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  mapeado: boolean;
  colaboradora_id: string | null;
  colaboradora_nome: string | null;
  pedidos_pendentes?: number;
  deletado_do_tiny?: boolean;
}

interface Colaboradora {
  id: string;
  nome: string;
  email: string | null;
}

interface Resumo {
  total_vendedores: number;
  mapeados: number;
  nao_mapeados: number;
  colaboradoras_sem_tiny: number;
  pedidos_sem_colaboradora: number;
}

interface StoreOption {
  id: string;
  name: string;
}

const ERPVendorMapping = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [colaboradorasNaoMapeadas, setColaboradorasNaoMapeadas] = useState<Colaboradora[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!profile) {
        navigate("/");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else {
        fetchStores();
      }
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchVendedores();
    }
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;

      setStores(data || []);
      
      if (data && data.length > 0) {
        setSelectedStoreId(data[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao carregar lojas");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendedores = async () => {
    if (!selectedStoreId) return;

    setRefreshing(true);
    try {
      const response = await fetch("/.netlify/functions/list-erp-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: selectedStoreId }),
      });

      // Tratar 404 graciosamente (função não disponível ou loja sem integração ERP)
      if (response.status === 404) {
        setVendedores([]);
        setColaboradorasNaoMapeadas([]);
        setResumo(null);
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao buscar vendedores");
      }

      setVendedores(data.vendedores || []);
      setColaboradorasNaoMapeadas(data.colaboradoras_nao_mapeadas || []);
      setResumo(data.resumo || null);

    } catch (error: any) {
      console.error("Erro ao buscar vendedores:", error);
      // Não mostrar toast para 404 (função não disponível não é um erro crítico)
      if (!error.message?.includes('404')) {
        toast.error(error.message || "Erro ao carregar vendedores");
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleMapVendor = async (tinyId: string) => {
    const colaboradoraId = mapping[tinyId];
    if (!colaboradoraId) {
      toast.error("Selecione uma colaboradora");
      return;
    }

    setSavingMap(tinyId);
    try {
      const response = await fetch("/.netlify/functions/map-erp-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: selectedStoreId,
          tiny_vendedor_id: tinyId,
          colaboradora_id: colaboradoraId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao mapear vendedor");
      }

      toast.success(data.message || "Vendedor mapeado com sucesso!");
      
      if (data.pedidos_atualizados > 0) {
        toast.success(`${data.pedidos_atualizados} pedidos atualizados!`);
      }

      setMapping(prev => {
        const newMapping = { ...prev };
        delete newMapping[tinyId];
        return newMapping;
      });

      fetchVendedores();

    } catch (error: any) {
      console.error("Erro ao mapear vendedor:", error);
      toast.error(error.message || "Erro ao mapear vendedor");
    } finally {
      setSavingMap(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const vendedoresNaoMapeados = vendedores.filter(v => !v.mapeado);
  const vendedoresMapeados = vendedores.filter(v => v.mapeado);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mapeamento ERP</h1>
            <p className="text-muted-foreground">
              Vincule vendedores do ERP as colaboradoras do sistema
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[240px]" data-testid="select-store">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={fetchVendedores}
            disabled={refreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{resumo.total_vendedores}</div>
                <p className="text-sm text-muted-foreground">Total Vendedores</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{resumo.mapeados}</div>
                <p className="text-sm text-muted-foreground">Mapeados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{resumo.nao_mapeados}</div>
                <p className="text-sm text-muted-foreground">Sem Mapeamento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{resumo.colaboradoras_sem_tiny}</div>
                <p className="text-sm text-muted-foreground">Colaboradoras Sem Tiny</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{resumo.pedidos_sem_colaboradora}</div>
                <p className="text-sm text-muted-foreground">Pedidos Pendentes</p>
              </CardContent>
            </Card>
          </div>
        )}

        {resumo && resumo.nao_mapeados > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Vendedores sem mapeamento</AlertTitle>
            <AlertDescription>
              Existem {resumo.nao_mapeados} vendedores do Tiny que não estão vinculados a nenhuma colaboradora.
              {resumo.pedidos_sem_colaboradora > 0 && (
                <> Isso está afetando {resumo.pedidos_sem_colaboradora} pedidos.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {vendedoresNaoMapeados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Vendedores Sem Mapeamento
              </CardTitle>
              <CardDescription>
                Selecione a colaboradora correspondente para cada vendedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {vendedoresNaoMapeados.map(vendedor => (
                    <div
                      key={vendedor.tiny_id}
                      className="flex flex-col md:flex-row md:items-center gap-4 p-4 border rounded-md"
                      data-testid={`vendor-row-${vendedor.tiny_id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{vendedor.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            ID: {vendedor.tiny_id}
                          </Badge>
                          {vendedor.pedidos_pendentes && vendedor.pedidos_pendentes > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {vendedor.pedidos_pendentes} pedidos
                            </Badge>
                          )}
                          {vendedor.deletado_do_tiny && (
                            <Badge variant="secondary" className="text-xs">
                              Deletado do Tiny
                            </Badge>
                          )}
                        </div>
                        {(vendedor.email || vendedor.cpf) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {vendedor.email && <span>{vendedor.email}</span>}
                            {vendedor.email && vendedor.cpf && <span> | </span>}
                            {vendedor.cpf && <span>CPF: {vendedor.cpf}</span>}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                        
                        <Select
                          value={mapping[vendedor.tiny_id] || ""}
                          onValueChange={(value) => setMapping(prev => ({ ...prev, [vendedor.tiny_id]: value }))}
                        >
                          <SelectTrigger className="w-[200px]" data-testid={`select-colaboradora-${vendedor.tiny_id}`}>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {colaboradorasNaoMapeadas.map(colab => (
                              <SelectItem key={colab.id} value={colab.id}>
                                {colab.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          onClick={() => handleMapVendor(vendedor.tiny_id)}
                          disabled={!mapping[vendedor.tiny_id] || savingMap === vendedor.tiny_id}
                          data-testid={`button-map-${vendedor.tiny_id}`}
                        >
                          {savingMap === vendedor.tiny_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden md:inline">Vincular</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {vendedoresMapeados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Vendedores Mapeados ({vendedoresMapeados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {vendedoresMapeados.map(vendedor => (
                    <div
                      key={vendedor.tiny_id}
                      className="flex items-center justify-between gap-4 p-3 border rounded-md bg-muted/30"
                      data-testid={`vendor-mapped-${vendedor.tiny_id}`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{vendedor.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {vendedor.tiny_id}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-600">
                          {vendedor.colaboradora_nome}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {vendedores.length === 0 && !refreshing && selectedStoreId && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum vendedor encontrado</h3>
              <p className="text-muted-foreground">
                Verifique se a loja tem integração ativa com o Tiny ERP
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ERPVendorMapping;
