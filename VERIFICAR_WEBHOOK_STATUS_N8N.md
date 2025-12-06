# 🔍 Verificar Webhook de Status do WhatsApp

## ❌ Problema

O WhatsApp conectou no celular, mas o frontend continua mostrando o QR Code. O status não está sendo atualizado após a conexão ser estabelecida.

## 🔍 Diagnóstico

O problema é que o **webhook de status do UazAPI** precisa estar configurado no n8n para atualizar o banco de dados quando a conexão for estabelecida.

## 📋 O que verificar no n8n:

### 1. **Webhook do UazAPI para Status**

No workflow do n8n, verifique se existe um webhook que recebe atualizações do UazAPI quando a conexão é estabelecida.

**Estrutura esperada do webhook:**
```
POST /webhook/api/whatsapp/status
```

**Payload que o UazAPI deve enviar:**
```json
{
  "instance": {
    "id": "r8a3e27ff099098",
    "status": "connected",
    "phone_number": "+5511999999999",
    ...
  }
}
```

### 2. **Atualização no Banco de Dados**

O webhook do n8n deve atualizar a tabela `whatsapp_credentials`:

```sql
UPDATE sistemaretiradas.whatsapp_credentials
SET 
  uazapi_status = 'connected',
  uazapi_phone_number = '...',
  uazapi_qr_code = NULL,  -- Limpar QR Code após conexão
  updated_at = NOW()
WHERE 
  customer_id = $1 
  AND site_slug = $2;
```

### 3. **Verificar se o Webhook está ativo**

No n8n, verifique se:
- ✅ O webhook está ativo
- ✅ O webhook está recebendo requisições do UazAPI
- ✅ O webhook está atualizando o banco corretamente

## 🔧 Configuração no UazAPI

No painel da UazAPI, você precisa configurar o webhook de status para apontar para:

```
https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/status
```

**Eventos que devem disparar o webhook:**
- `connection.established` - Quando a conexão é estabelecida
- `connection.closed` - Quando a conexão é fechada
- `qr.code.generated` - Quando um novo QR Code é gerado

## ✅ Solução Temporária

Enquanto o webhook não está configurado, o polling (verificação a cada 5 segundos) deve detectar a mudança de status no banco, mas pode levar alguns segundos.

## 📝 Próximos Passos

1. Verificar no n8n se o webhook de status existe
2. Se não existir, criar o webhook para receber atualizações do UazAPI
3. Configurar o webhook no UazAPI para apontar para o n8n
4. Testar a conexão novamente

