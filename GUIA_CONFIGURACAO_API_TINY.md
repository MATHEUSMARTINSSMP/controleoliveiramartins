# 🚀 Guia Completo - Configuração da API do Tiny ERP

## 📋 Visão Geral

Este guia vai te ajudar a configurar a integração com a API do Tiny ERP para sincronizar dados (produtos, vendas, estoque, etc.) com o sistema EleveaOne.

**Referência:** [Documentação Oficial Tiny API](https://ajuda.olist.com/kb/articles/erp/integracoes/gestao-de-integracoes/aplicativos-api-v3-configuracoes-e-utilizacao)

---

## 🎯 Objetivo

Configurar um aplicativo OAuth no Tiny ERP que permita ao EleveaOne:
- Ler dados de produtos
- Ler dados de vendas/pedidos
- Ler dados de estoque
- Sincronizar informações automaticamente

---

## 📝 PASSO 1: Criar Aplicativo no Tiny ERP

### 1.1. Acessar o Painel de Aplicativos API

1. Faça login no seu ERP Tiny: `https://erp.tiny.com.br`
2. Vá em **Configurações** → **Aplicativos API**
3. Clique em **"Adicionar Aplicativo"** ou **"Novo Aplicativo"**

### 1.2. Preencher Dados do Aplicativo

**Nome do Aplicativo:**
```
EleveaOne - Sistema de Gestão
```

**URL de Redirecionamento:**
```
https://eleveaone.com.br/api/tiny/callback
```
*Nota: Esta URL será criada no nosso sistema para receber o código de autorização OAuth*

### 1.3. Configurar Permissões

Marque as permissões necessárias:

#### ✅ Módulos Essenciais (Leitura + Incluir e Editar):

- ✅ **Produtos**
  - [x] Leitura
  - [x] Incluir e editar
  - [ ] Excluir (opcional)

- ✅ **Pedidos**
  - [x] Leitura
  - [x] Incluir e editar
  - [ ] Excluir (opcional)

- ✅ **Estoque**
  - [x] Leitura
  - [x] Incluir e editar
  - [ ] Excluir (opcional)

- ✅ **Contatos**
  - [x] Leitura
  - [ ] Incluir e editar (opcional)
  - [ ] Excluir (opcional)

- ✅ **Notas Fiscais**
  - [x] Leitura
  - [ ] Incluir e editar (opcional)
  - [ ] Excluir (opcional)

#### ⚠️ Módulos Opcionais:

- **Marcas** (Leitura)
- **Categorias** (Leitura)
- **Forma de Pagamento** (Leitura)
- **Forma de Envio** (Leitura)

### 1.4. Salvar e Obter Chaves

1. Clique em **"Salvar"**
2. Após salvar, o Tiny vai gerar:
   - **Client ID** (ID do Cliente)
   - **Client Secret** (Segredo do Cliente)
   - **Access Token** (Token de Acesso - pode ser gerado depois)

### 1.5. Copiar as Credenciais

⚠️ **IMPORTANTE:** Copie e guarde em local seguro:
- ✅ Client ID
- ✅ Client Secret

*Você vai precisar dessas informações no próximo passo.*

---

## 📝 PASSO 2: Configurar no Sistema EleveaOne

### 2.1. Adicionar Variáveis de Ambiente

No Netlify, adicione as seguintes variáveis de ambiente:

1. Acesse: **Netlify Dashboard** → **Site Settings** → **Environment variables**
2. Adicione:

```env
# Tiny ERP API Credentials
VITE_TINY_API_CLIENT_ID=seu_client_id_aqui
VITE_TINY_API_CLIENT_SECRET=seu_client_secret_aqui
VITE_TINY_API_BASE_URL=https://api.tiny.com.br
VITE_TINY_ERP_URL=https://erp.tiny.com.br
```

⚠️ **ATENÇÃO:** 
- `VITE_TINY_API_CLIENT_SECRET` é sensível - não commitar no código!
- No Netlify, marque como "Sensitive" se possível

### 2.2. Criar Tabela no Supabase para Armazenar Tokens

Vamos criar uma tabela para armazenar os tokens OAuth de forma segura:

```sql
-- Migration: Armazenar credenciais Tiny API
CREATE TABLE IF NOT EXISTS tiny_api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL, -- Criptografado
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- RLS: Apenas ADMIN pode acessar
ALTER TABLE tiny_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_tiny_api_credentials_all" ON tiny_api_credentials
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );
```

---

## 📝 PASSO 3: Criar Estrutura de Integração no Código

### 3.1. Criar Arquivo de Configuração

**Arquivo:** `src/lib/tinyApi.ts`

```typescript
// Configuração e funções para integração com Tiny ERP API
export const TINY_API_CONFIG = {
  baseUrl: import.meta.env.VITE_TINY_API_BASE_URL || 'https://api.tiny.com.br',
  erpUrl: import.meta.env.VITE_TINY_ERP_URL || 'https://erp.tiny.com.br',
  clientId: import.meta.env.VITE_TINY_API_CLIENT_ID,
  clientSecret: import.meta.env.VITE_TINY_API_CLIENT_SECRET,
};

// Função para obter URL de autorização OAuth
export function getTinyAuthorizationUrl(): string {
  const redirectUri = `${window.location.origin}/api/tiny/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TINY_API_CONFIG.clientId || '',
    redirect_uri: redirectUri,
    scope: 'produtos pedidos estoque contatos', // Escopos necessários
  });
  
  return `${TINY_API_CONFIG.erpUrl}/oauth/authorize?${params.toString()}`;
}

// Função para trocar código por token
export async function exchangeCodeForToken(code: string): Promise<any> {
  // Implementar chamada para trocar código OAuth por access token
  // Isso será feito no backend (Netlify Function)
}
```

### 3.2. Criar Netlify Function para OAuth Callback

**Arquivo:** `netlify/functions/tiny-oauth-callback.ts`

```typescript
// Netlify Function para processar callback OAuth do Tiny
import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Processar código OAuth e trocar por token
  // Salvar token no Supabase
  // Redirecionar para página de sucesso
};
```

---

## 📝 PASSO 4: Criar Interface de Configuração (Admin)

### 4.1. Criar Página de Configuração

**Arquivo:** `src/pages/TinyApiConfig.tsx`

Esta página permitirá ao admin:
- Ver status da conexão
- Iniciar processo de autorização OAuth
- Ver última sincronização
- Testar conexão

---

## 📝 PASSO 5: Testar a Integração

### 5.1. Teste de Conexão

1. Acesse a página de configuração no admin
2. Clique em "Conectar com Tiny ERP"
3. Será redirecionado para o Tiny para autorizar
4. Após autorizar, será redirecionado de volta
5. Verifique se o token foi salvo

### 5.2. Teste de API

1. Faça uma chamada de teste para buscar produtos
2. Verifique se os dados são retornados corretamente

---

## 🔐 Segurança

### Boas Práticas:

1. ✅ **Nunca commitar** `client_secret` no código
2. ✅ **Usar variáveis de ambiente** para credenciais
3. ✅ **Armazenar tokens** de forma criptografada no Supabase
4. ✅ **Renovar tokens** automaticamente quando expirarem
5. ✅ **RLS no Supabase** para proteger dados sensíveis

---

## 📚 Próximos Passos (Após Configuração)

1. ✅ Implementar sincronização de produtos
2. ✅ Implementar sincronização de vendas
3. ✅ Implementar sincronização de estoque
4. ✅ Criar jobs automáticos de sincronização
5. ✅ Criar logs de sincronização

---

## 🆘 Troubleshooting

### Erro: "Invalid client_id"
- Verifique se o Client ID está correto nas variáveis de ambiente
- Verifique se o aplicativo foi criado corretamente no Tiny

### Erro: "Redirect URI mismatch"
- Verifique se a URL de redirecionamento no Tiny é exatamente igual à configurada
- URLs devem ser idênticas (incluindo http/https, barras, etc.)

### Erro: "Token expired"
- Implemente renovação automática de token
- Use refresh_token para obter novo access_token

---

## 📞 Suporte

- **Documentação Tiny:** https://ajuda.olist.com/kb/articles/erp/integracoes
- **API Reference:** https://api.tiny.com.br/docs

---

## ✅ Checklist de Implementação

- [ ] Passo 1: Criar aplicativo no Tiny ERP
- [ ] Passo 2: Configurar variáveis de ambiente no Netlify
- [ ] Passo 3: Criar migration para tabela de credenciais
- [ ] Passo 4: Criar arquivo `src/lib/tinyApi.ts`
- [ ] Passo 5: Criar Netlify Function para OAuth callback
- [ ] Passo 6: Criar página de configuração no admin
- [ ] Passo 7: Adicionar rota no App.tsx
- [ ] Passo 8: Testar conexão OAuth
- [ ] Passo 9: Testar chamadas de API
- [ ] Passo 10: Implementar sincronização de dados

---

**Pronto para começar? Vamos começar pelo Passo 1! 🚀**

