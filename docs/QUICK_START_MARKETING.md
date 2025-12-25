# 🚀 Quick Start - Módulo Marketing

## Checklist Rápido de Deploy

### 1️⃣ Variáveis de Ambiente (Netlify)

Adicione no Netlify Dashboard → Site settings → Environment variables:

```
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Scope**: `Builds, Functions, Runtime` (ou por contexto se necessário)

✅ Veja: `docs/SETUP_ENV_VARS_MARKETING.md` para instruções detalhadas

---

### 2️⃣ Supabase Storage

Crie o bucket `marketing` no Supabase:

1. Acesse Supabase Dashboard → Storage
2. Crie novo bucket: `marketing`
3. Configure políticas:
   - **Público**: ✅ (para imagens) ou ❌ (para URLs assinadas)
   - **Privado**: ❌ (recomendado usar URLs assinadas)

✅ Migrations já criadas: `supabase/migrations/20251224000036_update_marketing_production_structure.sql`

---

### 3️⃣ Netlify Scheduled Function

Para o worker funcionar, configure o scheduled function:

**Opção A**: Via `netlify.toml` (recomendado)

```toml
[[plugins]]
package = "@netlify/plugin-scheduled-functions"

[functions.marketing-worker]
schedule = "cron(*/1 * * * *)"  # A cada 1 minuto
```

**Opção B**: Via Netlify Dashboard
1. Acesse Functions → Scheduled functions
2. Configure `marketing-worker` para executar a cada 1 minuto

---

### 4️⃣ Deploy

```bash
# Commit e push
git add .
git commit -m "feat: módulo marketing backend completo"
git push

# O Netlify fará deploy automaticamente
```

---

### 5️⃣ Teste Rápido

#### Teste 1: Criar Job de Imagem

```bash
curl -X POST https://seu-site.netlify.app/.netlify/functions/marketing-media \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "provider": "gemini",
    "model": "gemini-2.5-flash-image",
    "prompt": "Uma imagem minimalista de uma casa na árvore",
    "output": {
      "size": "1024x1024"
    },
    "storeId": "uuid-da-sua-loja"
  }'
```

**Resposta esperada**:
```json
{
  "jobId": "uuid-do-job",
  "status": "queued"
}
```

#### Teste 2: Verificar Status do Job

```bash
curl https://seu-site.netlify.app/.netlify/functions/marketing-jobs/JOB_ID \
  -H "Authorization: Bearer SEU_JWT_TOKEN"
```

#### Teste 3: Expansão de Prompt

```bash
curl -X POST https://seu-site.netlify.app/.netlify/functions/marketing-prompt-expand \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalPrompt": "quero uma casa na arvore",
    "storeId": "uuid-da-sua-loja"
  }'
```

---

## 📊 Status do Sistema

| Componente | Status |
|------------|--------|
| Banco de Dados | ✅ Migration aplicada |
| Variáveis de Ambiente | ⚠️ Adicionar GEMINI_API_KEY e OPENAI_API_KEY |
| Storage Bucket | ⚠️ Criar bucket `marketing` |
| Scheduled Function | ⚠️ Configurar worker |
| Endpoints | ✅ Implementados |
| Worker | ✅ Implementado |

---

## 🐛 Troubleshooting

### Erro: "GEMINI_API_KEY is not defined"
- ✅ Verifique se adicionou a variável no Netlify
- ✅ Faça redeploy do site
- ✅ Verifique o scope da variável

### Erro: "Bucket 'marketing' not found"
- ✅ Crie o bucket no Supabase Storage
- ✅ Verifique as políticas de acesso

### Worker não processa jobs
- ✅ Verifique se o scheduled function está configurado
- ✅ Verifique logs do worker no Netlify
- ✅ Confirme que há jobs com status `queued`

### Erro de autenticação
- ✅ Use JWT token válido no header `Authorization: Bearer TOKEN`
- ✅ Token deve ter acesso à loja (`store_id`)

---

## 📚 Documentação Completa

- `docs/BACKEND_MARKETING_IMPLEMENTADO.md` - Status completo da implementação
- `docs/SETUP_ENV_VARS_MARKETING.md` - Guia detalhado de variáveis de ambiente
- `docs/PLANEJAMENTO_GERADOR_VISUAL_IA.md` - Planejamento técnico completo

---

## ✅ Próximos Passos

1. ✅ Adicionar variáveis de ambiente
2. ✅ Criar bucket no Supabase
3. ✅ Configurar scheduled function
4. ⏭️ Testar endpoints
5. ⏭️ Desenvolver frontend React
6. ⏭️ Testes E2E

---

**🚀 O backend está pronto! Agora é só configurar e testar!**

