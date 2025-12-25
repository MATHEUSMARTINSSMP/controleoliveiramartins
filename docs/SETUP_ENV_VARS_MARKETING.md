# Configuração de Variáveis de Ambiente - Módulo Marketing

## ✅ Variáveis Já Configuradas

Você já possui as seguintes variáveis que são usadas pelo módulo de marketing:

- ✅ `SUPABASE_URL` - Já configurada
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Já configurada

## ⚠️ Variáveis que Precisam Ser Adicionadas

Para o módulo de marketing funcionar, você precisa adicionar as seguintes variáveis de ambiente no Netlify:

### 1. Gemini API Key (Google AI)

**Nome**: `GEMINI_API_KEY`

**Onde obter**:
1. Acesse [Google AI Studio](https://aistudio.google.com/apikey)
2. Crie uma nova API Key ou use uma existente
3. Copie a chave

**Configuração no Netlify**:
- **Scope**: `Builds, Functions, Runtime`
- **Valor**: Cole a API Key do Gemini
- **Recomendação**: Configure por contexto de deploy se necessário

---

### 2. OpenAI API Key

**Nome**: `OPENAI_API_KEY`

**Onde obter**:
1. Acesse [OpenAI Platform](https://platform.openai.com/api-keys)
2. Crie uma nova API Key
3. Copie a chave (ela só aparece uma vez!)

**Configuração no Netlify**:
- **Scope**: `Builds, Functions, Runtime`
- **Valor**: Cole a API Key da OpenAI
- **Recomendação**: Configure por contexto de deploy se necessário

---

## 📋 Checklist de Configuração

### Passo 1: Obter API Keys
- [ ] Criar/obter `GEMINI_API_KEY` do Google AI Studio
- [ ] Criar/obter `OPENAI_API_KEY` da OpenAI Platform

### Passo 2: Configurar no Netlify
1. Acesse: **Site settings** → **Environment variables**
2. Adicione as variáveis:
   - [ ] `GEMINI_API_KEY` (Scope: Builds, Functions, Runtime)
   - [ ] `OPENAI_API_KEY` (Scope: Builds, Functions, Runtime)

### Passo 3: Verificar
- [ ] Variáveis estão visíveis nos escopos corretos
- [ ] Valores estão corretos (sem espaços extras)
- [ ] Redeploy do site após adicionar variáveis

---

## 🎯 Resumo das Variáveis Necessárias

| Variável | Status | Scope Recomendado |
|----------|--------|-------------------|
| `SUPABASE_URL` | ✅ Já existe | All scopes |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Já existe | Builds, Functions, Runtime |
| `GEMINI_API_KEY` | ⚠️ **ADICIONAR** | Builds, Functions, Runtime |
| `OPENAI_API_KEY` | ⚠️ **ADICIONAR** | Builds, Functions, Runtime |

---

## 🔒 Segurança

⚠️ **IMPORTANTE**:
- **NUNCA** commite as API keys no código
- Use variáveis de ambiente sempre
- As keys têm limites de uso e custos associados
- Monitore o uso nas dashboards:
  - [Google AI Studio](https://aistudio.google.com/app/apikey)
  - [OpenAI Usage](https://platform.openai.com/usage)

---

## 🧪 Teste Após Configuração

Após adicionar as variáveis:

1. **Redeploy** do site no Netlify
2. Teste um endpoint simples:
   ```bash
   curl -X POST https://seu-site.netlify.app/.netlify/functions/marketing-media \
     -H "Authorization: Bearer SEU_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "image",
       "provider": "gemini",
       "model": "gemini-2.5-flash-image",
       "prompt": "Teste de imagem"
     }'
   ```

3. Verifique os logs no Netlify Functions para confirmar que as keys estão sendo carregadas

---

## 💰 Custos Estimados

### Gemini (Google)
- **Imagens**: ~$0.02 por imagem
- **Vídeos (Veo)**: ~$0.05-0.20 por segundo (preview, quotas limitadas)

### OpenAI
- **GPT Image**: ~$0.02-0.04 por imagem
- **Sora (Vídeo)**: Preview, custos variáveis

⚠️ **Recomendação**: Configure quotas e limites no código para controlar gastos.

---

## 📚 Links Úteis

- [Google AI Studio - API Keys](https://aistudio.google.com/apikey)
- [OpenAI Platform - API Keys](https://platform.openai.com/api-keys)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Documentação Gemini API](https://ai.google.dev/gemini-api/docs)
- [Documentação OpenAI API](https://platform.openai.com/docs)

