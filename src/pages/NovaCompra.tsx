import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Store {
  id: string;
  name: string;
}

interface Colaboradora {
  id: string;
  name: string;
}

const NovaCompra = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [formData, setFormData] = useState({
    colaboradora_id: "",
    loja_id: "",
    data_compra: new Date().toISOString().split("T")[0],
    item: "",
    preco_venda: "",
    desconto_beneficio: "",
    num_parcelas: "1",
    primeiro_mes: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!authLoading) {
      if (!profile || profile.role !== "ADMIN") {
        navigate("/");
      } else {
        fetchStores();
        fetchColaboradoras();
      }
    }
  }, [profile, authLoading, navigate]);

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("id, name").eq("active", true);
    if (data) setStores(data);
  };

  const fetchColaboradoras = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "COLABORADORA")
      .eq("active", true);
    if (data) setColaboradoras(data);
  };

  const calcularPrecoFinal = () => {
    const venda = parseFloat(formData.preco_venda) || 0;
    const desconto = parseFloat(formData.desconto_beneficio) || 0;
    return Math.max(venda - desconto, 0).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const precoFinal = parseFloat(calcularPrecoFinal());
      const numParcelas = parseInt(formData.num_parcelas);
      
      // Calcular valor base da parcela com arredondamento bancário
      const valorBase = Math.round((precoFinal / numParcelas) * 100) / 100;
      const totalParcelas = valorBase * numParcelas;
      const diferenca = precoFinal - totalParcelas;

      // Criar compra
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          colaboradora_id: formData.colaboradora_id,
          loja_id: formData.loja_id,
          data_compra: new Date(formData.data_compra).toISOString(),
          item: formData.item,
          preco_venda: parseFloat(formData.preco_venda),
          desconto_beneficio: parseFloat(formData.desconto_beneficio),
          preco_final: precoFinal,
          num_parcelas: numParcelas,
          status_compra: "PENDENTE",
          observacoes: formData.observacoes || null,
          created_by_id: profile!.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Gerar parcelas
      const [ano, mes] = formData.primeiro_mes.split("-");
      const parcelas = [];
      
      for (let i = 0; i < numParcelas; i++) {
        const mesAtual = parseInt(mes) + i;
        const anoAtual = parseInt(ano) + Math.floor((mesAtual - 1) / 12);
        const mesFormatado = ((mesAtual - 1) % 12) + 1;
        const competencia = `${anoAtual}${mesFormatado.toString().padStart(2, "0")}`;
        
        // Ajustar diferença na última parcela
        const valorParcela = i === numParcelas - 1 ? valorBase + diferenca : valorBase;

        parcelas.push({
          compra_id: purchase.id,
          n_parcela: i + 1,
          competencia,
          valor_parcela: valorParcela,
          status_parcela: "PENDENTE",
        });
      }

      const { error: parcelasError } = await supabase.from("parcelas").insert(parcelas);
      if (parcelasError) throw parcelasError;

      toast.success("Compra criada com sucesso!");
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar compra");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Nova Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="colaboradora">Colaboradora *</Label>
                  <Select
                    value={formData.colaboradora_id}
                    onValueChange={(value) => setFormData({ ...formData, colaboradora_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradoras.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loja">Loja *</Label>
                  <Select
                    value={formData.loja_id}
                    onValueChange={(value) => setFormData({ ...formData, loja_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item">Item *</Label>
                <Input
                  id="item"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  placeholder="Descrição do item"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="preco_venda">Preço Venda (R$) *</Label>
                  <Input
                    id="preco_venda"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco_venda}
                    onChange={(e) => setFormData({ ...formData, preco_venda: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desconto">Desconto (R$) *</Label>
                  <Input
                    id="desconto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.desconto_beneficio}
                    onChange={(e) => setFormData({ ...formData, desconto_beneficio: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preço Final</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md font-semibold text-primary">
                    R$ {calcularPrecoFinal()}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="data_compra">Data Compra *</Label>
                  <Input
                    id="data_compra"
                    type="date"
                    value={formData.data_compra}
                    onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parcelas">Nº Parcelas *</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="1"
                    value={formData.num_parcelas}
                    onChange={(e) => setFormData({ ...formData, num_parcelas: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primeiro_mes">1º Mês Desconto *</Label>
                  <Input
                    id="primeiro_mes"
                    type="month"
                    value={formData.primeiro_mes}
                    onChange={(e) => setFormData({ ...formData, primeiro_mes: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais (opcional)"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Compra"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NovaCompra;
