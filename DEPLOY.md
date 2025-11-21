# 🚀 Guia de Deploy - Sistema Oliveira Martins

## 📋 Pré-requisitos

- Conta Netlify
- Conta Supabase
- Repositório Git configurado
- Variáveis de ambiente coletadas

## 🔐 Configuração de Variáveis de Ambiente

### No Netlify:

1. Acesse: [Netlify Dashboard](https://app.netlify.com)
2. Vá em: Site Settings → Build & Deploy → Environment variables
3. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### Onde encontrar as variáveis no Supabase:

1. Acesse: [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em: Settings → API
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys** → `anon public` → `VITE_SUPABASE_ANON_KEY`

## 🗄 Configuração do Banco de Dados (Supabase)

### 1. Aplicar Migrations

Execute as migrations na ordem cronológica:

1. Acesse: Supabase Dashboard → SQL Editor
2. Execute cada arquivo de migration em ordem:
   - `20251121000000_add_daily_weights.sql`
   - `20251121100000_add_store_id_to_profiles.sql`
   - `20251121101500_populate_store_id.sql`
   - `20251121120000_add_goals_admin_policies.sql`
   - `20251121130000_add_goals_unique_constraints.sql`
   - `20251121133000_fix_goals_upsert_index.sql`
   - `20251121140000_create_analytics_structure.sql`
   - `20251121141500_populate_benchmarks.sql`
   - `20251121150000_create_performance_rpcs.sql`
   - `20251121151000_add_performance_indexes.sql`

### 2. Verificar RLS (Row Level Security)

As políticas RLS já estão configuradas nas migrations. Verifique em:
- Supabase Dashboard → Authentication → Policies

## 🌐 Deploy no Netlify

### Opção 1: Conectar Repositório Git (Recomendado)

1. **Acesse Netlify Dashboard:**
   - https://app.netlify.com

2. **Add new site → Import from Git:**
   - Conecte GitHub/GitLab/Bitbucket
   - Autorize acesso ao repositório

3. **Configure Build Settings:**
   ```
   Build command: npm run build
   Publish directory: dist
   Node version: 18
   ```

4. **Configure Environment Variables:**
   - Site Settings → Environment variables
   - Adicione: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

5. **Deploy:**
   - Clique em "Deploy site"
   - O deploy será automático a cada push

### Opção 2: Deploy Manual

1. **Build local:**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy no Netlify:**
   - Arraste a pasta `dist` para Netlify Drop
   - Ou use Netlify CLI:
     ```bash
     npm install -g netlify-cli
     netlify deploy --prod --dir=dist
     ```

3. **Configure Environment Variables:**
   - Site Settings → Environment variables

## ✅ Verificações Pós-Deploy

### 1. Verificar Build

- Deploy deve completar sem erros
- Logs devem mostrar "Build succeeded"

### 2. Verificar Variáveis de Ambiente

- Acesse: Site Settings → Environment variables
- Verifique se todas as variáveis estão configuradas

### 3. Testar Aplicação

- Acesse a URL do site no Netlify
- Teste login/logout
- Verifique se dados carregam corretamente

### 4. Verificar Erros no Console

- Abra DevTools (F12)
- Verifique Console e Network
- Não deve haver erros de conexão com Supabase

## 🔍 Troubleshooting

### Erro: "Failed to connect to Supabase"

**Solução:**
- Verifique se `VITE_SUPABASE_URL` está correto
- Verifique se `VITE_SUPABASE_ANON_KEY` está configurada
- Certifique-se de que as variáveis não têm espaços extras

### Erro: "Build failed"

**Solução:**
- Verifique Node version (deve ser 18)
- Verifique logs do build no Netlify
- Certifique-se de que todas as dependências estão no `package.json`

### Erro: "RLS policy violation"

**Solução:**
- Verifique se todas as migrations foram aplicadas
- Verifique políticas RLS no Supabase
- Certifique-se de que usuário está autenticado

### Erro: "Module not found"

**Solução:**
- Execute `npm install` localmente
- Verifique se todos os imports estão corretos
- Commit e push novamente

## 📝 Checklist de Deploy

- [ ] Migrations aplicadas no Supabase
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Build passando sem erros
- [ ] Site acessível e funcionando
- [ ] Login/logout funcionando
- [ ] Dashboards carregando dados
- [ ] Gráficos renderizando corretamente
- [ ] Sem erros no console do navegador

## 🔄 Deploy Automático

O deploy automático está configurado via `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

A cada push para `main`, o Netlify:
1. Detecta o push
2. Executa `npm run build`
3. Publica a pasta `dist`
4. Atualiza o site automaticamente

## 📞 Suporte

Para problemas:
1. Verifique logs no Netlify Dashboard
2. Verifique console do navegador
3. Verifique logs do Supabase
4. Consulte a documentação do README.md

