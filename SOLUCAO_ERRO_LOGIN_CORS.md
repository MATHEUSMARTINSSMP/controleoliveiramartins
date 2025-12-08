# 🔧 Solução: Erro de Login - CORS Bloqueado

## ❌ Erro Identificado

```
Requisição cross-origin bloqueada: A diretiva Same Origin (mesma origem) não permite 
a leitura do recurso remoto em https://kktsbnrnlnzyofupegjc.supabase.co/auth/v1/token?grant_type=password 
(motivo: falta cabeçalho 'Access-Control-Allow-Origin' no CORS). 
Código de status: 520.
```

## 🔍 Causa do Problema

O erro **520** (Cloudflare) + **CORS bloqueado** indica que:

1. **Domínio não configurado no Supabase:** O domínio `eleveaone.com.br` não está na lista de URLs permitidas do Supabase
2. **Variáveis de ambiente:** As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` podem não estar configuradas no Netlify
3. **Configuração de CORS no Supabase:** O Supabase precisa ter o domínio autorizado

## ✅ Soluções

### 1. Configurar Domínio no Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Em **Site URL**, adicione:
   - `https://eleveaone.com.br`
   - `https://eleveaone.com.br/*`
5. Em **Redirect URLs**, adicione:
   - `https://eleveaone.com.br/**`
   - `https://eleveaone.com.br/auth/callback`
   - `https://eleveaone.com.br/loja`
   - `https://eleveaone.com.br/colaboradora`
   - `https://eleveaone.com.br/admin`

### 2. Verificar Variáveis de Ambiente no Netlify

1. Acesse: https://app.netlify.com
2. Selecione o site `eleveaone`
3. Vá em **Site settings** → **Environment variables**
4. Verifique se existem:
   - `VITE_SUPABASE_URL` = `https://kktsbnrnlnzyofupegjc.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (sua chave anon do Supabase)

### 3. Verificar Configuração do Supabase Client

O código em `src/integrations/supabase/client.ts` está correto:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
```

**Verificar no console do navegador:**
- Abra DevTools → Console
- Execute: `console.log(import.meta.env.VITE_SUPABASE_URL)`
- Se retornar `undefined`, as variáveis não estão configuradas no Netlify

### 4. Verificar Headers CORS no Supabase

O Supabase deve retornar os headers:
```
Access-Control-Allow-Origin: https://eleveaone.com.br
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept-Profile, Content-Profile
```

## 🧪 Teste Rápido

Execute no console do navegador (em `https://eleveaone.com.br`):

```javascript
// Verificar se as variáveis estão disponíveis
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✅ Configurada' : '❌ Não configurada');

// Testar conexão direta
fetch('https://kktsbnrnlnzyofupegjc.supabase.co/auth/v1/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## 📝 Checklist de Verificação

- [ ] Domínio `eleveaone.com.br` adicionado no Supabase Dashboard (Settings → API → Site URL)
- [ ] Redirect URLs configuradas no Supabase
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Deploy feito após configurar variáveis
- [ ] Teste de login realizado

## 🚨 Se o Problema Persistir

1. **Verificar logs do Netlify:**
   - Site → Functions → Logs
   - Verificar se há erros relacionados ao Supabase

2. **Verificar logs do Supabase:**
   - Dashboard → Logs → Auth Logs
   - Verificar tentativas de login bloqueadas

3. **Testar em modo local:**
   - Criar arquivo `.env.local` com as variáveis
   - Executar `npm run dev`
   - Testar login localmente

4. **Verificar Cloudflare:**
   - O erro 520 pode ser do Cloudflare
   - Verificar se há regras bloqueando requisições ao Supabase

## 🔗 Links Úteis

- Supabase Dashboard: https://supabase.com/dashboard
- Netlify Dashboard: https://app.netlify.com
- Documentação CORS Supabase: https://supabase.com/docs/guides/api/rest/cors



