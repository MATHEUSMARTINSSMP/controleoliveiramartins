import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Mail, ShoppingBag, Key } from "lucide-react";

/**
 * Página de teste para verificar quais parâmetros o Cakto envia
 * URL: https://eleveaone.com.br/acesso-test?email=xxx&purchase_id=xxx
 */
const CaktoAccessTest = () => {
  const [searchParams] = useSearchParams();
  const [allParams, setAllParams] = useState<Record<string, string>>({});

  useEffect(() => {
    // Capturar TODOS os parâmetros da URL
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setAllParams(params);
    
    // Log no console para debug
    console.log('[CaktoAccessTest] Todos os parâmetros recebidos:', params);
  }, [searchParams]);

  const commonEmailKeys = ['email', 'customer_email', 'user_email', 'e', 'mail', 'customerEmail', 'userEmail'];
  const commonPurchaseKeys = ['purchase_id', 'purchaseId', 'order_id', 'orderId', 'purchase', 'order', 'transaction_id'];
  const commonTokenKeys = ['token', 'access_token', 'token_access', 'auth_token', 'key'];

  const foundEmail = commonEmailKeys.find(key => allParams[key]);
  const foundPurchase = commonPurchaseKeys.find(key => allParams[key]);
  const foundToken = commonTokenKeys.find(key => allParams[key]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Teste de Parâmetros do Cakto
          </CardTitle>
          <CardDescription>
            Esta página mostra todos os parâmetros recebidos na URL para testar variáveis do Cakto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Detectado */}
          {foundEmail && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-green-500" />
                <span className="font-semibold text-green-500">Email Detectado:</span>
              </div>
              <code className="text-sm text-green-400">{allParams[foundEmail]}</code>
              <Badge variant="outline" className="ml-2">Key: {foundEmail}</Badge>
            </div>
          )}

          {/* Purchase ID Detectado */}
          {foundPurchase && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-blue-500">Purchase ID Detectado:</span>
              </div>
              <code className="text-sm text-blue-400">{allParams[foundPurchase]}</code>
              <Badge variant="outline" className="ml-2">Key: {foundPurchase}</Badge>
            </div>
          )}

          {/* Token Detectado */}
          {foundToken && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-purple-500">Token Detectado:</span>
              </div>
              <code className="text-sm text-purple-400">
                {allParams[foundToken].substring(0, 20)}...
              </code>
              <Badge variant="outline" className="ml-2">Key: {foundToken}</Badge>
            </div>
          )}

          {/* Todos os Parâmetros */}
          <div>
            <h3 className="font-semibold mb-3">Todos os Parâmetros Recebidos:</h3>
            {Object.keys(allParams).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum parâmetro encontrado na URL
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(allParams).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3 bg-muted/50 rounded-lg border flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm font-semibold text-primary">{key}</div>
                      <div className="text-sm text-muted-foreground mt-1 break-all">
                        {value}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {value.length} chars
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* URL Completa */}
          <div>
            <h3 className="font-semibold mb-2">URL Completa:</h3>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <code className="text-xs break-all">
                {window.location.href}
              </code>
            </div>
          </div>

          {/* Instruções para Cakto */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <h3 className="font-semibold mb-2 text-yellow-600">📝 Como testar no Cakto:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Configure a URL no Cakto como: <code className="bg-muted px-1 rounded">https://eleveaone.com.br/acesso-test?email={{email}}&purchase_id={{purchase_id}}</code></li>
              <li>Substitua as variáveis conforme a documentação do Cakto</li>
              <li>Faça uma compra de teste</li>
              <li>Abra o link recebido no email</li>
              <li>Veja os parâmetros que apareceram nesta página</li>
              <li>Use os nomes corretos das variáveis na URL final</li>
            </ol>
          </div>

          {/* Sugestões de URLs para testar */}
          <div>
            <h3 className="font-semibold mb-2">🔧 URLs para testar no Cakto:</h3>
            <div className="space-y-2">
              {[
                'https://eleveaone.com.br/acesso-test?email={{email}}&purchase_id={{purchase_id}}',
                'https://eleveaone.com.br/acesso-test?email={email}&purchase_id={purchase_id}',
                'https://eleveaone.com.br/acesso-test?email=$email&purchase_id=$purchase_id',
                'https://eleveaone.com.br/acesso-test?email=%email%&purchase_id=%purchase_id%',
                'https://eleveaone.com.br/acesso-test?customer_email={{customer_email}}&order_id={{order_id}}',
              ].map((url, idx) => (
                <div key={idx} className="p-2 bg-muted/30 rounded border">
                  <code className="text-xs break-all">{url}</code>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaktoAccessTest;

