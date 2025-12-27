# 🏦 Integração C6 Bank - Validação PIX

## 📋 Visão Geral

Documentação sobre integração com a API de PIX do C6 Bank para validação de pagamentos.

**Referência**: https://developers.c6bank.com.br

---

## ✅ Vantagens do C6 Bank

1. **Pix Gratuito Ilimitado** ⭐
   - Não cobra taxas para PIX via API
   - Vantagem competitiva significativa

2. **API de PIX Completa**
   - Envio e recebimento de PIX
   - Integração com sistema do Banco Central

3. **Automação Financeira**
   - Emissão de boletos (até 2.000 grátis/mês com recebimento em D0)
   - Pagamentos e cobrança
   - E-commerce

4. **Segurança**
   - Portal de desenvolvedores
   - Processo de homologação
   - Credenciais seguras

---

## 🔄 Processo de Integração

### 1. Cadastro no Portal C6 Developers

**URL**: https://developers.c6bank.com.br

**Passos**:
1. Acessar o portal
2. Cadastrar empresa
3. Obter acesso à documentação
4. Acessar ambiente de testes (sandbox)

### 2. Homologação

**Processo**:
1. Enviar solicitação de homologação
2. Validar compatibilidade do sistema com as APIs
3. Testes em ambiente sandbox
4. Certificação
5. Validação final

**Após homologação**:
- Receber credenciais de autenticação
- Credenciais necessárias para integração segura

### 3. Integração das APIs

**APIs Disponíveis**:
- **API de PIX**: Integração com pagamentos instantâneos
- **API de Pagamentos e Cobrança**: Automatiza pagamentos e recebimentos
- **API de E-commerce**: Pagamentos digitais
- **API de Boleto**: Emissão e gestão de boletos

---

## ✅ Webhooks Disponíveis!

**ÓTIMA NOTÍCIA**: O C6 Bank **OFERECE WEBHOOKS** para notificações de PIX! 🎉

### Endpoints de Webhook

Conforme a documentação da API (seção "Notificações (Webhook)"):

1. **PUT `/webhook/{chave}`** - Configurar webhook para uma chave PIX
2. **GET `/webhook/{chave}`** - Consultar webhook configurado
3. **DELETE `/webhook/{chave}`** - Remover webhook
4. **GET `/webhook`** - Listar todos os webhooks configurados

### Como Funciona

- Configura uma URL do webhook para cada chave PIX
- Quando um PIX é recebido naquela chave, o C6 Bank envia uma notificação POST para a URL configurada
- Notificações automáticas em tempo real sobre eventos Pix

### Vantagens

✅ **Não precisa fazer polling** - Notificações em tempo real
✅ **Mais eficiente** - Apenas recebe quando há evento
✅ **Sem dados bancários sensíveis** - Apenas recebe notificações
✅ **Conforme padrão PIX** - Segue especificação do Banco Central

---

## 🏗️ Arquitetura de Integração

### Arquitetura com Webhooks (CONFIRMADO ✅)

```
Cliente faz PIX na conta C6 Bank
    ↓
C6 Bank envia webhook para nosso sistema
    ↓
/netlify/functions/payment-webhook?gateway=C6_BANK
    ↓
Valida assinatura (se aplicável)
    ↓
Processa evento PIX recebido
    ↓
Busca vendas pendentes (match: chave + valor)
    ↓
Atualiza venda no banco como paga
    ↓
Notifica vendedor/cliente (opcional)
```

**Endpoints do C6 Bank para Webhook**:
- `PUT /webhook/{chave}` - Configurar webhook
- `GET /webhook/{chave}` - Consultar configuração
- `DELETE /webhook/{chave}` - Remover webhook
- `GET /webhook` - Listar todos os webhooks

---

## 🔧 Implementação no Nosso Sistema

### 1. Adicionar C6 Bank aos Gateways

**Arquivo**: `supabase/migrations/XXXXXX_add_c6bank_gateway.sql`

```sql
-- Adicionar C6 Bank aos gateways disponíveis
INSERT INTO sistemaretiradas.payment_gateways (id, name, display_name, is_active, webhook_url)
VALUES
    ('C6_BANK', 'C6_BANK', 'C6 Bank', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=C6_BANK')
ON CONFLICT (id) DO NOTHING;
```

### 2. Handler no Webhook

**Arquivo**: `netlify/functions/payment-webhook.js`

```javascript
// Adicionar handler para C6 Bank
switch (gateway.toUpperCase()) {
  case 'C6_BANK':
    result = await handleC6BankEvent(supabase, eventData);
    break;
  // ... outros gateways
}

async function handleC6BankEvent(supabase, eventData) {
  // Processar evento do C6 Bank (webhook de PIX recebido)
  // Estrutura baseada na documentação: https://developers.c6bank.com.br
  
  // O webhook do C6 Bank deve seguir padrão PIX do Banco Central
  // Verificar documentação completa para estrutura exata do payload
  
  // Exemplo esperado (confirmar na documentação):
  const { e2eid, valor, horario, chave, pagador } = eventData;
  
  if (e2eid && valor) {
    // Processar PIX recebido
    // Similar ao exemplo em EXEMPLO_IMPLEMENTACAO_PIX_WEBHOOK.md
    
    // Buscar vendas pendentes correspondentes
    // Match por chave PIX + valor aproximado
    // Atualizar status da venda como paga
  }
  
  return { success: true };
}
```

### 3. Configurar Webhook no C6 Bank

Após homologação, configurar webhook para cada chave PIX:

```bash
# PUT /webhook/{chave}
curl -X PUT 'https://baas-api.c6bank.info/v2/pix/webhook/{chave_pix}' \
  -H 'Authorization: Bearer {access_token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "webhookUrl": "https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=C6_BANK"
  }'
```

### 3. Configuração no Frontend

**Arquivo**: `src/components/dev/PaymentGatewaysConfig.tsx`

```typescript
const PAYMENT_GATEWAYS = [
  // ... gateways existentes
  { 
    value: 'C6_BANK', 
    label: 'C6 Bank', 
    webhook_docs: 'https://developers.c6bank.com.br' 
  },
];
```

---

## 📝 Configuração Necessária

### Variáveis de Ambiente

```bash
# Credenciais C6 Bank (após homologação)
C6_BANK_CLIENT_ID=seu_client_id
C6_BANK_CLIENT_SECRET=seu_client_secret
C6_BANK_WEBHOOK_SECRET=seu_webhook_secret  # Se disponível
```

### URL do Webhook (se disponível)

Configurar no painel do C6 Bank:
```
https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=C6_BANK
```

---

## ✅ Próximos Passos

1. **Acessar Portal de Desenvolvedores**
   - https://developers.c6bank.com.br
   - Cadastrar empresa
   - Acessar documentação completa da API

2. **Revisar Documentação de Webhooks** ✅
   - ✅ **Confirmado**: C6 Bank oferece webhooks
   - Revisar estrutura exata do payload
   - Ver método de validação de assinatura (se houver)
   - Ver formato dos eventos (pix recebido, etc.)

3. **Iniciar Processo de Homologação**
   - Enviar solicitação
   - Realizar testes em sandbox
   - Configurar webhooks em ambiente de teste
   - Obter certificação

4. **Implementar Integração**
   - Adicionar handler C6_BANK ao `payment-webhook.js`
   - Implementar lógica de match (chave PIX + valor)
   - Configurar webhooks para cada chave PIX do cliente
   - Testar em ambiente de produção

5. **Configurar Webhooks por Cliente**
   - Criar interface para cliente configurar sua chave PIX
   - Automatizar criação de webhook via API do C6 Bank
   - Salvar configuração no banco de dados

---

## 🔗 Links Úteis

- **Portal de Desenvolvedores**: https://developers.c6bank.com.br
- **API PIX (Swagger/OpenAPI)**: Disponível no portal
- **Documentação Webhooks**: Seção "Notificações (Webhook)" na API
- **Blog sobre API**: https://www.c6bank.com.br/blog/api-c6-bank
- **Conta PJ**: https://www.c6bank.com.br/conta-pj

## 📚 Referências da API

**Base URL**: `https://baas-api.c6bank.info/v2/pix`

**Endpoints Principais**:
- `GET /pix` - Consultar PIX recebidos
- `GET /pix/{e2eid}` - Consultar PIX específico
- `PUT /webhook/{chave}` - Configurar webhook
- `GET /webhook/{chave}` - Consultar webhook
- `DELETE /webhook/{chave}` - Remover webhook
- `GET /webhook` - Listar todos os webhooks

---

## 💡 Vantagens Competitivas

1. **Custo Zero**
   - Pix gratuito ilimitado
   - Sem taxas para PIX via API
   - Economia significativa vs. outras soluções

2. **Integração Nativa**
   - Já temos estrutura de webhooks
   - Pode reutilizar código existente
   - Integração rápida

3. **Confiabilidade**
   - Banco regulado pelo Banco Central
   - Infraestrutura robusta
   - Suporte técnico

---

## ⚠️ Considerações

1. **Processo de Homologação**
   - Pode levar algum tempo
   - Requer documentação e testes
   - Necessário para produção
   - **Importante**: Obter credenciais de acesso após homologação

2. **Webhooks** ✅
   - ✅ **Confirmado**: C6 Bank oferece webhooks
   - Necessário configurar webhook para cada chave PIX
   - Verificar estrutura exata do payload na documentação
   - Implementar validação de assinatura (se aplicável)

3. **Chaves PIX**
   - Cada cliente pode ter múltiplas chaves PIX
   - Webhook deve ser configurado por chave
   - Sistema precisa gerenciar múltiplos webhooks por cliente

4. **Autenticação**
   - Usar Bearer token (access_token)
   - Token obtido após homologação
   - Verificar processo de refresh de token (se aplicável)

5. **Documentação Completa**
   - Acessar portal para documentação técnica completa
   - Swagger/OpenAPI disponível no portal
   - Testar endpoints em sandbox antes de produção

