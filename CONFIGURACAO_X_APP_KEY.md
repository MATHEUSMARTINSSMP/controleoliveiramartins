# 🔐 Configuração do X-APP-KEY (Token de Autenticação n8n)

## 📋 Como Funciona Atualmente

O sistema suporta **duas formas** de configurar o `X-APP-KEY`:

### 1. **Variáveis de Ambiente (Netlify)** - Prioridade Alta
- **Variável:** `N8N_WEBHOOK_AUTH`
- **Onde configurar:** Netlify Dashboard > Site Settings > Environment Variables
- **Prioridade:** ✅ **PRIMEIRA** - Se estiver configurada, será usada primeiro

### 2. **Tabela app_config (Painel Admin)** - Fallback
- **Chave:** `n8n_webhook_auth`
- **Onde configurar:** Admin Dashboard > Configurações > Configuração de Webhooks n8n
- **Prioridade:** ⚠️ **SEGUNDA** - Usada apenas se não estiver nas env vars

---

## 🔄 **Fluxo de Busca do X-APP-KEY**

```
1. Tentar buscar de process.env.N8N_WEBHOOK_AUTH (env vars Netlify)
   ↓ (se não encontrar)
2. Buscar da tabela app_config (key: 'n8n_webhook_auth')
   ↓ (se não encontrar)
3. Usar null (requisição será feita sem header X-APP-KEY)
```

---

## ✅ **RECOMENDAÇÃO: CONFIGURAR EM AMBOS**

### **Por que configurar nas Env Vars?**
- ✅ **Segurança:** Não fica exposto no código ou banco de dados
- ✅ **Performance:** Mais rápido (não precisa fazer query no banco)
- ✅ **Padrão:** É a forma recomendada para secrets

### **Por que configurar no Painel Admin também?**
- ✅ **Flexibilidade:** Permite mudar sem redeploy
- ✅ **Gestão:** Admins podem atualizar via UI
- ✅ **Fallback:** Se a env var não estiver configurada, usa do banco

---

## 📝 **INSTRUÇÕES DE CONFIGURAÇÃO**

### **Opção 1: Configurar nas Env Vars (Recomendado)**

1. Acesse **Netlify Dashboard**
2. Vá em **Site Settings > Environment Variables**
3. Adicione:
   ```
   N8N_WEBHOOK_AUTH = seu_token_aqui
   ```
4. Faça **redeploy** do site

### **Opção 2: Configurar no Painel Admin**

1. Acesse **Admin Dashboard > Configurações**
2. Vá em **Configuração de Webhooks n8n**
3. Preencha o campo **"Chave de Autenticação n8n (X-APP-KEY)"**
4. Clique em **"Salvar Configurações"**

### **Opção 3: Configurar em Ambos (Ideal)**

Configure nas **env vars** como principal e no **painel admin** como backup/fallback.

---

## 🔍 **Onde o X-APP-KEY é Usado**

### **Funções Netlify:**
- ✅ `whatsapp-auth.js` - Header `x-app-key` nas requisições de autenticação
- ✅ `send-whatsapp-message.js` - Header `x-app-key` nas requisições de envio
- ✅ `send-cashback-whatsapp.js` - Header `x-app-key` nas requisições de cashback

### **Formato do Header:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-app-key': webhookAuth  // Valor do X-APP-KEY
}
```

---

## ⚠️ **IMPORTANTE**

1. **Segurança:** O X-APP-KEY é um **secret** e não deve ser commitado no código
2. **Validação:** O n8n valida este token no webhook antes de processar a requisição
3. **Formato:** O token pode ser qualquer string (geralmente um hash ou UUID)

---

## 🧪 **Como Verificar se Está Funcionando**

1. Configure o X-APP-KEY nas env vars ou no painel admin
2. Tente fazer uma autenticação WhatsApp
3. Verifique os logs do Netlify Function:
   ```javascript
   console.log('[WhatsApp Auth] Headers:', { ...headers, 'x-app-key': '***' });
   ```
4. Se o n8n retornar erro de autenticação, verifique se o token está correto

---

**Data:** 2025-12-05  
**Status:** ✅ Sistema configurado para suportar ambas as formas

