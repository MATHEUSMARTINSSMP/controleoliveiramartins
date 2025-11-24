# 🔐 Segurança: Gerenciamento de Secrets

## ⚠️ REGRA DE OURO

**NUNCA commitar secrets hardcoded no código!**

## ✅ Forma Correta: Variáveis de Ambiente

### Frontend (Vite/React)
```typescript
// ✅ CORRETO
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ❌ ERRADO
const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...';
```

### Backend (Node.js/Netlify Functions)
```javascript
// ✅ CORRETO
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ❌ ERRADO
const supabase = createClient(
  'https://xxx.supabase.co',
  'eyJhbGci...'
);
```

### Supabase Edge Functions (Deno)
```typescript
// ✅ CORRETO
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ❌ ERRADO
const supabase = createClient(
  'https://xxx.supabase.co',
  'eyJhbGci...'
);
```

## 📋 Checklist Antes de Commitar

- [ ] Nenhum secret hardcoded no código
- [ ] Todos os secrets vêm de variáveis de ambiente
- [ ] Arquivo `.env.local` está no `.gitignore`
- [ ] Arquivos temporários de debug foram removidos
- [ ] Secrets não aparecem em logs/console.log

## 🚨 O que fazer se encontrar secret no código

1. **Remover imediatamente** do código
2. **Rotacionar a secret** (gerar nova no Supabase/Netlify)
3. **Atualizar variáveis de ambiente** nos serviços
4. **Fazer commit** da remoção
5. **Verificar histórico Git** (se necessário, usar `git filter-branch` ou BFG)

## 📁 Arquivos que NUNCA devem ter secrets

- `*.js`, `*.ts`, `*.tsx`, `*.jsx` (código fonte)
- `*.json` (configurações)
- `*.md` (documentação)
- `*.sql` (scripts SQL - pode ter dados de teste, mas não secrets de produção)

## 🔒 Onde configurar variáveis de ambiente

### Desenvolvimento Local
- Arquivo `.env.local` (já está no `.gitignore`)
- Nunca commitar `.env` ou `.env.local`

### Netlify
- Dashboard → Site Settings → Environment variables
- Configurar: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.

### Supabase Edge Functions
- Dashboard → Edge Functions → Settings → Secrets
- Ou via CLI: `supabase secrets set KEY=value`

## 🛡️ Proteções Adicionais

### .gitignore
- Já protege arquivos `.env*`
- Bloqueia arquivos temporários de debug
- Mas **não é suficiente sozinho** - sempre usar env vars!

### Netlify Secrets Scanning
- Detecta automaticamente secrets no build
- Bloqueia deploy se encontrar
- Configurável via `SECRETS_SCAN_OMIT_KEYS` (apenas para keys públicas)

## 📚 Referências

- [Supabase: Environment Variables](https://supabase.com/docs/guides/functions/secrets)
- [Netlify: Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

