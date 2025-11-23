# 📱 Configuração de WhatsApp - Envio Automático de Mensagens

Este documento explica como configurar o envio automático de mensagens WhatsApp quando uma venda é lançada.

## 🎯 Funcionalidade

Quando uma venda é lançada no sistema, uma mensagem WhatsApp é enviada automaticamente para o **administrador** com os detalhes da venda:
- Nome da colaboradora
- Nome da loja
- Valor da venda
- Quantidade de peças
- Data da venda

## 🔧 Pré-requisitos

1. **Tabela de destinatários WhatsApp**: Execute a migration `20251122200000_create_whatsapp_recipients.sql` no Supabase
2. **Webhook n8n**: O webhook n8n já está configurado para buscar credenciais UAZAPI do banco de dados
3. **Credenciais no banco**: Certifique-se de que existe um registro ativo em `elevea.whatsapp_credentials` com:
   - `customer_id = 'mathmartins@gmail.com'`
   - `site_slug = 'elevea'`
   - `status = 'active'`

## 📋 Passo a Passo

### 1. Executar Migration SQL

Execute a migration no Supabase SQL Editor:

```sql
-- Arquivo: supabase/migrations/20251122190000_add_phone_to_profiles.sql
```

Isso adiciona o campo `phone` (TEXT, opcional) na tabela `profiles`.

### 2. Configurar Destinatários WhatsApp

Os números que receberão as mensagens estão cadastrados na tabela `whatsapp_recipients` no banco de dados.

**Números destinatários configurados:**
- `5596981113307`
- `5596981032928`

Estes números já estão cadastrados na migration inicial para o administrador do sistema.

**Para adicionar ou remover destinatários:**

Execute no Supabase SQL Editor:
```sql
-- Adicionar destinatário
INSERT INTO sistemaretiradas.whatsapp_recipients (admin_id, phone, name, active)
VALUES ('7391610a-f83b-4727-875f-81299b8bfa68', '55XXXXXXXXXXX', 'Nome do Destinatário', true);

-- Desativar destinatário
UPDATE sistemaretiradas.whatsapp_recipients
SET active = false
WHERE phone = '55XXXXXXXXXXX';
```

### 3. Configurar Webhook n8n

A função Netlify usa um webhook n8n que busca as credenciais UAZAPI do banco de dados PostgreSQL.

**Configuração do webhook:**
- Webhook URL: `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send`
- Auth Header: `x-app-key: #mmP220411`
- Customer ID: `mathmartins@gmail.com` (usado para buscar credenciais no banco)
- Site Slug: `elevea` (usado para buscar credenciais no banco)

**⚠️ IMPORTANTE - Configuração CORS no webhook n8n:**

O webhook n8n precisa estar configurado para aceitar requisições da origem do seu site. No painel de configuração do webhook n8n:

1. **Allowed Origins (CORS)**: Adicione a URL do seu site Netlify
   - Exemplo: `https://controleoliveiramartins.netlify.app` ou `https://eleveaagencia.netlify.app`
   - Para aceitar múltiplas origens, adicione cada uma separadamente
   - Para desenvolvimento local, também adicione: `http://localhost:8888` (Netlify Dev)

2. **Response Headers**: Configure os seguintes headers:
   - `Access-Control-Allow-Origin`: URL do seu site (ou `*` para permitir todas)
   - `Access-Control-Allow-Methods`: `POST, OPTIONS`
   - `Access-Control-Allow-Headers`: `Content-Type, X-APP-KEY`

**Como verificar qual é a URL do seu site:**
- Acesse o Netlify Dashboard → Site Settings → Domain management
- Ou verifique a URL no navegador quando acessar o site em produção

**Exemplo de configuração no webhook n8n:**
```
Allowed Origins (CORS): *
Response Headers:
  - Access-Control-Allow-Origin: https://seu-site.netlify.app
  - Access-Control-Allow-Methods: POST, OPTIONS
  - Access-Control-Allow-Headers: Content-Type, X-APP-KEY
```

**O webhook n8n executa esta query no PostgreSQL:**
```sql
SELECT
  customer_id,
  site_slug,
  uazapi_instance_id,
  uazapi_token
FROM elevea.whatsapp_credentials
WHERE customer_id = $1 AND site_slug = $2 AND status = 'active'
LIMIT 1
```

**Configurar variáveis no Netlify (opcional):**

1. Acesse: Netlify Dashboard → Site Settings → Environment variables
2. Adicione as seguintes variáveis (valores padrão já estão no código):
   ```
   WHATSAPP_WEBHOOK_URL=https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send
   WHATSAPP_WEBHOOK_AUTH=#mmP220411
   WHATSAPP_SITE_SLUG=elevea
   WHATSAPP_CUSTOMER_ID=mathmartins@gmail.com
   ```

   **Nota:** O código já tem valores padrão configurados, mas é recomendável usar variáveis de ambiente para maior segurança.

### 4. Testar

1. Cadastre o telefone de uma colaboradora no banco de dados
2. Lance uma venda para essa colaboradora
3. Verifique se a mensagem foi enviada

## 📝 Exemplo de Mensagem

A mensagem enviada para o administrador segue este formato:

```
🛒 *Nova Venda Lançada*

*Colaboradora:* Nome da Colaboradora
*Loja:* Nome da Loja
*Valor:* R$ 1.234,56
*Quantidade de Peças:* 5
*Data:* 22/11/2025 18:30

Sistema EleveaOne 📊
```

## ⚠️ Notas Importantes

1. **Apenas administrador recebe**: Apenas o telefone do perfil ADMIN precisa estar cadastrado. Todas as vendas serão notificadas ao administrador.

2. **Não bloqueia a UI**: O envio de WhatsApp acontece em background e não afeta o fluxo da aplicação

3. **Erros silenciosos**: Se houver erro no envio de WhatsApp, ele é logado no console mas não interrompe o processo

4. **Normalização automática**: O sistema normaliza o telefone automaticamente:
   - Remove caracteres especiais
   - Adiciona código do país (55) se necessário
   - Formato final: `55XXXXXXXXXXX@s.whatsapp.net`

5. **Busca automática**: O sistema busca automaticamente o perfil com `role = 'ADMIN'` e `active = true`. Se houver múltiplos admins, será usado o primeiro encontrado.

## 🔍 Troubleshooting

### Mensagem não está sendo enviada

1. **Verifique o console do navegador**: Procure por erros relacionados ao WhatsApp
   - Erro CORS: Se aparecer "CORS policy" ou "Access-Control-Allow-Origin", o webhook n8n não está configurado para aceitar requisições da origem do seu site
   - **Solução**: Adicione a URL do seu site nas configurações CORS do webhook n8n (veja seção "Configurar Webhook n8n" acima)

2. **Verifique se há destinatários cadastrados**: Execute no Supabase:
   ```sql
   SELECT wr.*, p.name as admin_name
   FROM sistemaretiradas.whatsapp_recipients wr
   JOIN sistemaretiradas.profiles p ON p.id = wr.admin_id
   WHERE wr.active = true AND p.role = 'ADMIN' AND p.active = true;
   ```
   - Se não houver resultados, adicione destinatários na tabela `whatsapp_recipients`

3. **Verifique as credenciais no banco**: Execute no Supabase:
   ```sql
   SELECT * FROM elevea.whatsapp_credentials
   WHERE customer_id = 'mathmartins@gmail.com' 
     AND site_slug = 'elevea' 
     AND status = 'active';
   ```
   - O webhook n8n precisa encontrar estas credenciais para funcionar

4. **Verifique as variáveis de ambiente no Netlify** (opcional): Certifique-se de que as variáveis estão configuradas ou que os valores padrão no código estão corretos

5. **Teste a função Netlify diretamente**: Use o Netlify Dev local ou faça uma requisição direta para `.netlify/functions/send-whatsapp-message`

6. **Verifique o webhook n8n**:
   - Confira se o workflow do n8n está ativo e funcionando corretamente
   - **Verifique as configurações CORS**: O webhook deve aceitar requisições da origem do seu site
   - Verifique se o header `X-APP-KEY` está configurado corretamente

### Erro CORS (Cross-Origin Resource Sharing)

**Sintomas:**
- Erro no console: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`
- Requisição não chega ao webhook n8n

**Solução:**
1. Acesse o painel de configuração do webhook n8n
2. Adicione a URL do seu site Netlify no campo "Allowed Origins (CORS)"
3. Certifique-se de que os Response Headers estão configurados corretamente:
   - `Access-Control-Allow-Origin`: URL do seu site
   - `Access-Control-Allow-Methods`: `POST, OPTIONS`
   - `Access-Control-Allow-Headers`: `Content-Type, X-APP-KEY`
4. Para permitir desenvolvimento local, também adicione: `http://localhost:8888`

**URLs comuns do Netlify:**
- `https://controleoliveiramartins.netlify.app`
- `https://eleveaagencia.netlify.app`
- `https://[seu-site].netlify.app`

### Erro ao normalizar telefone

O sistema tenta normalizar automaticamente, mas se houver problemas:
- Certifique-se de que o telefone está no formato correto
- O telefone deve conter apenas números (sem letras ou caracteres especiais estranhos)

## 🔐 Segurança

- As variáveis de API são armazenadas como variáveis de ambiente no Netlify (não são expostas no código)
- A função Netlify valida os dados antes de enviar
- Mensagens são enviadas apenas para o administrador cadastrado no sistema

## 📚 Arquivos Relacionados

- `netlify/functions/send-whatsapp-message.js` - Função Netlify para enviar WhatsApp via webhook n8n
- `src/lib/whatsapp.ts` - Helper frontend para chamar a função
- `src/pages/LojaDashboard.tsx` - Integração após criar venda
- `supabase/migrations/20251122200000_create_whatsapp_recipients.sql` - Migration para criar tabela de destinatários
- `WHATSAPP_SETUP.md` - Este arquivo de documentação

