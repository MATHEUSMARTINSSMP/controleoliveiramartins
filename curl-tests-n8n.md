# Testes cURL para Endpoints N8N WhatsApp

## Configuração

```bash
# Definir variáveis de ambiente
export N8N_BASE_URL="https://fluxos.eleveaagencia.com.br"
export N8N_WEBHOOK_AUTH="seu-token-aqui"  # Opcional, se configurado no N8N
export SITE_SLUG="mrkitsch"  # Ajustar conforme necessário
export CUSTOMER_ID="matheusmartinss@icloud.com"  # Ajustar conforme necessário
```

## 1. Verificar Status do WhatsApp

```bash
curl -X GET \
  "${N8N_BASE_URL}/webhook/api/whatsapp/auth/status?siteSlug=${SITE_SLUG}&customerId=${CUSTOMER_ID}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-app-key: ${N8N_WEBHOOK_AUTH}" \
  -v
```

**Resposta esperada:**
```json
{
  "success": true,
  "connected": true,
  "status": "connected",
  "phoneNumber": "559699741090",
  "instanceId": "mr_kitsch_matheusmartinss_icloud_com",
  "token": "..."
}
```

## 2. Conectar WhatsApp (Gerar QR Code)

```bash
curl -X POST \
  "${N8N_BASE_URL}/webhook/api/whatsapp/auth/connect" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-app-key: ${N8N_WEBHOOK_AUTH}" \
  -d '{
    "siteSlug": "'${SITE_SLUG}'",
    "customerId": "'${CUSTOMER_ID}'"
  }' \
  -v
```

**Resposta esperada (se desconectado):**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "status": "qr_required",
  "instanceId": "..."
}
```

## 3. Enviar Mensagem WhatsApp

```bash
curl -X POST \
  "${N8N_BASE_URL}/webhook/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-app-key: ${N8N_WEBHOOK_AUTH}" \
  -d '{
    "siteSlug": "'${SITE_SLUG}'",
    "customerId": "'${CUSTOMER_ID}'",
    "phone_number": "559681032928",
    "message": "Teste de mensagem via curl - $(date)"
  }' \
  -v
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso"
}
```

## 4. Verificar Status com Número Reserva (Backup)

```bash
# Substituir WHATSAPP_ACCOUNT_ID pelo UUID da conta backup
export WHATSAPP_ACCOUNT_ID="uuid-do-numero-reserva"

curl -X GET \
  "${N8N_BASE_URL}/webhook/api/whatsapp/auth/status?siteSlug=${SITE_SLUG}&customerId=${CUSTOMER_ID}&whatsapp_account_id=${WHATSAPP_ACCOUNT_ID}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-app-key: ${N8N_WEBHOOK_AUTH}" \
  -v
```

## 5. Teste Específico: Mr. Kitsch (Status)

```bash
curl -X GET \
  "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -v | jq '.'
```

**Observação:** O endpoint do N8N retorna um formato diferente do esperado:
- **Resposta atual do N8N:** `{"admin_id":"...","site_slug":"...","uazapi_status":"connected"}`
- **Resposta esperada pelo código:** `{"status":"connected","connected":true,"phoneNumber":"...","instanceId":"..."}`

Isso pode causar problemas na normalização do status.

## 6. Teste Específico: Sacada (Status)

```bash
curl -X GET \
  "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=sacadaohboy&customerId=matheusmartinss@icloud.com" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -v | jq '.'
```

## 7. Teste com Autenticação (se necessário)

```bash
# Se o N8N requer autenticação via header
curl -X GET \
  "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "x-app-key: SEU_TOKEN_AQUI" \
  -v | jq '.'
```

## Troubleshooting

### Erro 401/403
- Verificar se `x-app-key` está correto
- Verificar se o header está sendo enviado corretamente

### Erro 404
- Verificar se a URL do endpoint está correta
- Verificar se o webhook existe no N8N

### Erro 500
- Verificar logs do N8N
- Verificar se os parâmetros estão no formato correto

### Status sempre retorna "disconnected"
- Verificar se o número está realmente conectado no UazAPI
- Verificar se o `siteSlug` e `customerId` correspondem aos registros no N8N

## Comandos Rápidos

```bash
# Status rápido (sem autenticação)
curl -s "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com" | jq '.'

# Status com formatação bonita
curl -s "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com" | jq '.status, .connected, .phoneNumber'

# Teste todos os slugs
for slug in mrkitsch sacadaohboy loungerie; do
  echo "=== $slug ==="
  curl -s "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=$slug&customerId=matheusmartinss@icloud.com" | jq '.status, .connected, .phoneNumber'
  echo ""
done
```

