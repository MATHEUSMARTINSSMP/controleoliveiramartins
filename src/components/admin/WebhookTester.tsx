import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
}

export const WebhookTester = () => {
  const [gateway, setGateway] = useState("STRIPE");
  const [eventType, setEventType] = useState("payment_intent.succeeded");
  const [eventData, setEventData] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const sampleEvents: Record<string, Record<string, any>> = {
    STRIPE: {
      "payment_intent.succeeded": {
        id: "evt_test_" + Date.now(),
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_" + Date.now(),
            amount: 10000,
            currency: "brl",
            status: "succeeded",
            subscription: "sub_test_" + Date.now(),
          },
        },
      },
      "invoice.payment_failed": {
        id: "evt_test_" + Date.now(),
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_test_" + Date.now(),
            subscription: "sub_test_" + Date.now(),
            amount_due: 10000,
            status: "open",
          },
        },
      },
      "customer.subscription.deleted": {
        id: "evt_test_" + Date.now(),
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_test_" + Date.now(),
            status: "canceled",
          },
        },
      },
    },
    MERCADO_PAGO: {
      payment: {
        action: "payment",
        api_version: "v1",
        data: {
          id: "mp_test_" + Date.now(),
        },
        date_created: new Date().toISOString(),
        id: Date.now(),
        live_mode: false,
        type: "payment",
        user_id: "test_user",
      },
    },
    CAKTO: {
      payment_success: {
        event: "payment_success",
        data: {
          subscription_id: "cakto_sub_" + Date.now(),
          payment_id: "cakto_pay_" + Date.now(),
          amount: 10000,
          status: "paid",
        },
      },
    },
  };

  const handleLoadSample = () => {
    const sample = sampleEvents[gateway]?.[eventType];
    if (sample) {
      setEventData(JSON.stringify(sample, null, 2));
    } else {
      toast.error("Evento de exemplo não disponível para este gateway/tipo");
    }
  };

  const handleTest = async () => {
    if (!eventData.trim()) {
      toast.error("Por favor, insira os dados do evento");
      return;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(eventData);
    } catch (e) {
      toast.error("JSON inválido. Por favor, verifique a formatação.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `/.netlify/functions/payment-webhook?gateway=${gateway}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": gateway === "STRIPE" ? "test_signature" : "",
            "x-signature": gateway === "MERCADO_PAGO" ? "test_signature" : "",
            "x-cakto-signature": gateway === "CAKTO" ? "test_signature" : "",
          },
          body: JSON.stringify(parsedData),
        }
      );

      const responseData = await response.json();

      setResult({
        success: response.ok,
        statusCode: response.status,
        response: responseData,
        error: response.ok ? undefined : responseData.error || "Erro desconhecido",
      });

      if (response.ok) {
        toast.success("Webhook testado com sucesso!");
      } else {
        toast.error("Erro ao testar webhook: " + (responseData.error || "Erro desconhecido"));
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "Erro ao enviar requisição",
      });
      toast.error("Erro ao testar webhook: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Webhook</CardTitle>
          <CardDescription>
            Simule eventos de webhook de diferentes gateways de pagamento para testar o processamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seleção de Gateway */}
          <div className="space-y-2">
            <Label>Gateway de Pagamento</Label>
            <Select value={gateway} onValueChange={setGateway}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STRIPE">Stripe</SelectItem>
                <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                <SelectItem value="CAKTO">CAKTO</SelectItem>
                <SelectItem value="ASAAS">Asaas</SelectItem>
                <SelectItem value="PAGSEGURO">PagSeguro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Tipo de Evento */}
          <div className="space-y-2">
            <Label>Tipo de Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gateway === "STRIPE" && (
                  <>
                    <SelectItem value="payment_intent.succeeded">
                      Payment Intent Succeeded
                    </SelectItem>
                    <SelectItem value="invoice.payment_failed">
                      Invoice Payment Failed
                    </SelectItem>
                    <SelectItem value="customer.subscription.deleted">
                      Subscription Deleted
                    </SelectItem>
                  </>
                )}
                {gateway === "MERCADO_PAGO" && (
                  <SelectItem value="payment">Payment</SelectItem>
                )}
                {gateway === "CAKTO" && (
                  <SelectItem value="payment_success">Payment Success</SelectItem>
                )}
                <SelectItem value="custom">Custom (JSON Manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dados do Evento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dados do Evento (JSON)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                disabled={eventType === "custom"}
              >
                Carregar Exemplo
              </Button>
            </div>
            <Textarea
              value={eventData}
              onChange={(e) => setEventData(e.target.value)}
              placeholder='{"id": "evt_...", "type": "...", "data": {...}}'
              rows={15}
              className="font-mono text-xs"
            />
          </div>

          {/* Botão de Teste */}
          <Button onClick={handleTest} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Testar Webhook
              </>
            )}
          </Button>

          {/* Resultado */}
          {result && (
            <Card className={result.success ? "border-green-500" : "border-red-500"}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <CardTitle className="text-sm">
                    {result.success ? "Sucesso" : "Erro"}
                  </CardTitle>
                  {result.statusCode && (
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.statusCode}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {result.error && (
                  <div className="mb-4">
                    <Label className="text-red-600">Erro:</Label>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                )}
                {result.response && (
                  <div>
                    <Label>Resposta:</Label>
                    <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(result.response, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

