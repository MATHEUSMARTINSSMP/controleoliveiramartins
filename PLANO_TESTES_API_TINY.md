# 🧪 Plano de Testes - Integração API Tiny ERP

## 📋 Objetivo

Testar e validar toda a integração com a API do Tiny ERP, incluindo:
- Autenticação OAuth
- Callbacks e troca de tokens
- Chamadas de API
- Renovação de tokens
- Isolamento multi-tenant

---

## ✅ Checklist de Preparação

### Fase 1: Configuração Inicial
- [ ] **1.1** Criar aplicativo no Tiny ERP
  - [ ] Acessar: https://erp.tiny.com.br → Configurações → Aplicativos API
  - [ ] Preencher nome: "EleveaOne - Sistema de Gestão"
  - [ ] URL de redirecionamento: `https://eleveaone.com.br/api/tiny/callback`
  - [ ] Selecionar permissões (Produtos, Pedidos, Estoque, Contatos)
  - [ ] Salvar e copiar **Client ID** e **Client Secret**

- [ ] **1.2** Configurar variáveis de ambiente no Netlify
  - [ ] `VITE_TINY_API_CLIENT_ID`
  - [ ] `VITE_TINY_API_CLIENT_SECRET`
  - [ ] `VITE_TINY_API_BASE_URL=https://api.tiny.com.br`
  - [ ] `VITE_TINY_ERP_URL=https://erp.tiny.com.br`

- [ ] **1.3** Executar migration de credenciais
  - [ ] Verificar que tabela `tiny_api_credentials` foi criada
  - [ ] Verificar RLS policies

---

## 🧪 Fase 2: Testes de Autenticação OAuth

### Teste 2.1: Gerar URL de Autorização
- [ ] Criar função `getTinyAuthorizationUrl()` em `src/lib/tinyApi.ts`
- [ ] Testar geração da URL
- [ ] Validar parâmetros (client_id, redirect_uri, scope, response_type)
- [ ] Verificar que URL está correta

**URL esperada:**
```
https://erp.tiny.com.br/oauth/authorize?
  response_type=code&
  client_id=SEU_CLIENT_ID&
  redirect_uri=https://eleveaone.com.br/api/tiny/callback&
  scope=produtos pedidos estoque contatos
```

### Teste 2.2: Fluxo de Autorização
- [ ] Acessar URL de autorização no navegador
- [ ] Fazer login no Tiny ERP
- [ ] Autorizar aplicativo
- [ ] Verificar redirecionamento para callback com `code` na URL
- [ ] Validar formato do código recebido

**URL de callback esperada:**
```
https://eleveaone.com.br/api/tiny/callback?code=CODIGO_AQUI
```

---

## 🧪 Fase 3: Testes de Callback e Token

### Teste 3.1: Netlify Function - Callback OAuth
- [ ] Criar `netlify/functions/tiny-oauth-callback.js`
- [ ] Implementar troca de código por token
- [ ] Salvar token no Supabase (`tiny_api_credentials`)
- [ ] Redirecionar para página de sucesso

**Endpoint a chamar:**
```
POST https://api.tiny.com.br/oauth/access_token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "CODIGO_RECEBIDO",
  "client_id": "SEU_CLIENT_ID",
  "client_secret": "SEU_CLIENT_SECRET",
  "redirect_uri": "https://eleveaone.com.br/api/tiny/callback"
}
```

**Resposta esperada:**
```json
{
  "access_token": "TOKEN_AQUI",
  "refresh_token": "REFRESH_TOKEN_AQUI",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Teste 3.2: Salvar Token no Banco
- [ ] Verificar que token foi salvo em `tiny_api_credentials`
- [ ] Validar campos: `access_token`, `refresh_token`, `token_expires_at`
- [ ] Verificar `sync_status = 'CONNECTED'`
- [ ] Validar `tenant_id` (se multi-tenant)

---

## 🧪 Fase 4: Testes de Chamadas de API

### Teste 4.1: Função Helper para Chamadas API
- [ ] Criar função `callTinyAPI()` em `src/lib/tinyApi.ts`
- [ ] Implementar autenticação com Bearer token
- [ ] Tratar renovação automática de token se expirado
- [ ] Tratar erros (401, 403, 500, etc)

### Teste 4.2: Teste de Listagem de Produtos
- [ ] Chamar endpoint: `GET /api/produtos.pesquisa.php`
- [ ] Validar resposta
- [ ] Verificar estrutura dos dados retornados

**Exemplo de chamada:**
```typescript
const produtos = await callTinyAPI('/api/produtos.pesquisa.php', {
  formato: 'JSON',
  pesquisa: ''
});
```

### Teste 4.3: Teste de Listagem de Pedidos
- [ ] Chamar endpoint: `GET /api/pedidos.pesquisa.php`
- [ ] Validar resposta
- [ ] Testar filtros (data, status, etc)

### Teste 4.4: Teste de Estoque
- [ ] Chamar endpoint: `GET /api/estoque.consultar.php`
- [ ] Validar resposta

---

## 🧪 Fase 5: Testes de Renovação de Token

### Teste 5.1: Detectar Token Expirado
- [ ] Verificar `token_expires_at` antes de chamada
- [ ] Se expirado, renovar automaticamente

### Teste 5.2: Renovar Token
- [ ] Chamar endpoint de renovação:
```
POST https://api.tiny.com.br/oauth/access_token
{
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH_TOKEN",
  "client_id": "CLIENT_ID",
  "client_secret": "CLIENT_SECRET"
}
```
- [ ] Atualizar token no banco
- [ ] Continuar chamada original

---

## 🧪 Fase 6: Testes Multi-Tenant

### Teste 6.1: Isolamento de Credenciais
- [ ] Criar segundo tenant de teste
- [ ] Configurar credenciais Tiny diferentes para cada tenant
- [ ] Verificar que cada tenant usa suas próprias credenciais
- [ ] Testar que chamadas de um tenant não afetam outro

### Teste 6.2: Detecção Automática de Tenant
- [ ] Verificar que `useTenant()` detecta tenant correto
- [ ] Validar que credenciais corretas são carregadas
- [ ] Testar troca de tenant (se aplicável)

---

## 🧪 Fase 7: Testes de Interface

### Teste 7.1: Página de Configuração
- [ ] Criar `src/pages/TinyApiConfig.tsx`
- [ ] Exibir status da conexão
- [ ] Botão "Conectar com Tiny ERP"
- [ ] Exibir última sincronização
- [ ] Botão "Testar Conexão"

### Teste 7.2: Fluxo Completo na UI
- [ ] Acessar página de configuração
- [ ] Clicar em "Conectar"
- [ ] Ser redirecionado para Tiny
- [ ] Autorizar
- [ ] Voltar para sistema
- [ ] Ver status "Conectado"
- [ ] Testar conexão

---

## 📊 Checklist de Validação

### ✅ Critérios de Sucesso:
- [ ] OAuth funciona end-to-end
- [ ] Token é salvo corretamente no banco
- [ ] Chamadas de API retornam dados
- [ ] Renovação de token funciona automaticamente
- [ ] Multi-tenant isolado corretamente
- [ ] Interface de configuração funcional
- [ ] Erros são tratados adequadamente
- [ ] Logs ajudam no debug

---

## 🐛 Cenários de Erro a Testar

1. **Token expirado**
   - [ ] Sistema detecta e renova automaticamente
   - [ ] Chamada original continua após renovação

2. **Refresh token inválido**
   - [ ] Sistema detecta erro
   - [ ] Solicita nova autorização
   - [ ] Exibe mensagem ao usuário

3. **Erro de permissão (403)**
   - [ ] Sistema detecta erro de permissão
   - [ ] Exibe mensagem clara
   - [ ] Sugere verificar permissões no Tiny

4. **Erro de rede**
   - [ ] Sistema trata timeout
   - [ ] Exibe mensagem de erro
   - [ ] Permite retry

5. **Callback sem código**
   - [ ] Sistema detecta erro
   - [ ] Exibe mensagem
   - [ ] Permite tentar novamente

---

## 📝 Próximos Passos Após Testes

1. ✅ Documentar endpoints usados
2. ✅ Criar funções helper para endpoints comuns
3. ✅ Implementar sincronização de produtos
4. ✅ Implementar sincronização de vendas
5. ✅ Implementar sincronização de estoque

---

**Vamos começar pelos testes! 🚀**

