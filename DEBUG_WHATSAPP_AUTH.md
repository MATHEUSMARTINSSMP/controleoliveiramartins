# 🔍 Debug: Autenticação WhatsApp

## ❌ Autenticação que NÃO Funcionou

### Payload Recebido (que falhou):
```json
{
  "headers": {
    "host": "fluxos.eleveaagencia.com.br",
    "user-agent": "node",
    "content-length": "142",
    "accept": "*/*",
    "accept-encoding": "br, gzip, deflate",
    "accept-language": "*",
    "content-type": "application/json",
    "sec-fetch-mode": "cors",
    "x-app-key": "#mmP220411",
    "x-forwarded-for": "3.147.27.20",
    "x-forwarded-host": "fluxos.eleveaagencia.com.br",
    "x-forwarded-port": "443",
    "x-forwarded-proto": "https",
    "x-forwarded-server": "4ee9a9d9591d",
    "x-real-ip": "3.147.27.20"
  },
  "params": {},
  "query": {},
  "body": {
    "customer_id": "matheusmartinss@icloud.com",
    "site_slug": "loungerie",
    "uazapi_admin_token": "Ae2iqkYNCGGesMvNt8w9eCCNffK4cDvQfZ342FRAcTkrp2VZ7z"
  },
  "webhookUrl": "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect",
  "executionMode": "production"
}
```

### Análise do Payload:

#### ✅ Campos Corretos:
- **Webhook URL**: `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect` ✅
- **Headers**: 
  - `content-type`: `application/json` ✅
  - `x-app-key`: `#mmP220411` ✅ (presente)
- **Body**:
  - `customer_id`: `matheusmartinss@icloud.com` ✅
  - `site_slug`: `loungerie` ✅
  - `uazapi_admin_token`: Presente ✅

#### ⚠️ Problemas Identificados nos Screenshots:

1. **Schema do Banco de Dados Incorreto**:
   - O workflow está usando `elevea.uazapi_config` e `elevea.whatsapp_credentials`
   - **CORRETO deveria ser**: `sistemaretiradas.uazapi_config` e `sistemaretiradas.whatsapp_credentials`

2. **Erro no Workflow n8n**:
   - Node "Code - Extract Inbox ID" tem erro: "Referenced node doesn't exist [line 2]"
   - Está tentando acessar node `'HTTP - Create Inbox'` que pode não existir ou ter nome diferente

3. **URL com Typo no webhook_metadata**:
   - Em um dos nodes, o `webhookUrl` dentro do `webhook_metadata` está como `/auth/commec` ao invés de `/auth/connect`
   - Isso pode ser um problema interno do workflow

---

## ✅ Autenticação que FUNCIONOU

*(Aguardando informações do usuário para comparação)*

---

## 📋 Checklist de Verificação

- [ ] Comparar payloads (funcionou vs não funcionou)
- [ ] Verificar schema do banco de dados no workflow n8n (`elevea` vs `sistemaretiradas`)
- [ ] Verificar nomes de nodes no workflow n8n (especialmente "HTTP - Create Inbox")
- [ ] Verificar se todos os campos necessários estão sendo passados
- [ ] Verificar se o webhook está registrado corretamente no n8n
- [ ] Verificar se há diferenças nos headers
- [ ] Verificar se há diferenças no body
- [ ] Verificar se o workflow está usando o schema correto

---

## 🔧 Correções Necessárias Identificadas

### 1. Schema do Banco de Dados no Workflow n8n
**PROBLEMA**: O workflow está usando schema `elevea` quando deveria usar `sistemaretiradas`

**Nodes afetados:**
- `PostgreSQL - Get Config`: Usa `elevea.uazapi_config`
- `PostgreSQL - Get Token`: Usa `elevea.whatsapp_credentials`

**SOLUÇÃO**: Atualizar queries SQL para usar `sistemaretiradas.uazapi_config` e `sistemaretiradas.whatsapp_credentials`

### 2. Nome do Node no Workflow
**PROBLEMA**: Node "Code - Extract Inbox ID" referencia um node que não existe

**SOLUÇÃO**: Verificar o nome exato do node "HTTP - Create Inbox" no workflow

---

## 📝 Notas

- O payload enviado pelo Netlify Function está **CORRETO**
- O problema está provavelmente no **workflow do n8n**:
  - Schema errado nas queries PostgreSQL
  - Nodes com nomes incorretos ou não encontrados
  - Possível typo na URL do webhook dentro do workflow
