# 🔍 VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE

## ❌ ERRO: "No API key found in request"

Este erro indica que o Supabase client não está enviando o `apikey` header corretamente.

## 🔍 POSSÍVEIS CAUSAS

### 1. Variáveis de ambiente não configuradas no Netlify

Verifique se as seguintes variáveis estão configuradas no Netlify Dashboard:

1. Acesse: https://app.netlify.com/sites/[seu-site]/configuration/env
2. Verifique se existem:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. Variáveis de ambiente com valores incorretos

As variáveis devem ter os valores corretos:

```env
VITE_SUPABASE_URL=https://kktsbnrnlnzyofupegjc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp
```

### 3. Build antigo no Netlify

O Netlify pode estar usando um build antigo que não tem as variáveis.

**Solução:** Force um novo deploy:
- Vá em: Deploys > Trigger deploy > Deploy site

## ✅ COMO VERIFICAR

### Teste 1: Verificar se as variáveis estão disponíveis no build

Adicione temporariamente este código em qualquer página para verificar:

```typescript
console.log('SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('SUPABASE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'Configurado' : 'NÃO CONFIGURADO');
```

### Teste 2: Verificar no console do navegador

Execute no console:

```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env?.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ? 'Configurado' : 'NÃO CONFIGURADO');
```

Se retornar `undefined` ou `NÃO CONFIGURADO`, as variáveis não estão configuradas no Netlify.

## 🔧 SOLUÇÃO

1. **Configure as variáveis no Netlify:**
   - Acesse: Site settings > Environment variables
   - Adicione:
     - `VITE_SUPABASE_URL` = `https://kktsbnrnlnzyofupegjc.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp`

2. **Force um novo deploy:**
   - Vá em: Deploys > Trigger deploy > Deploy site

3. **Aguarde o deploy completar**

4. **Teste novamente**

## 📋 CHECKLIST

- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Valores das variáveis estão corretos
- [ ] Novo deploy foi feito após configurar as variáveis
- [ ] Teste no console mostra que as variáveis estão disponíveis

