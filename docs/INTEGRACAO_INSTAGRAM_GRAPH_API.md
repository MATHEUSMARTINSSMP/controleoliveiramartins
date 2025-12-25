# 📸 Integração Instagram Graph API - Módulo de Marketing

## 🎯 Objetivo

Integrar o Instagram Graph API ao módulo de marketing para permitir:
- ✅ **Publicação automática** de posts agendados
- ✅ **Agendamento** de Stories, Reels e Posts
- ✅ **Coleta de métricas** (likes, comentários, alcance)
- ✅ **Gerenciamento** de múltiplas contas Instagram

## 📚 Instagram Graph API - Funcionalidades

### **1. Autenticação OAuth 2.0**
- Fluxo similar ao que já temos para ERPs (Tiny, Bling)
- Usuário autoriza o app a publicar em nome da conta Instagram Business
- Token de acesso com refresh automático

### **2. Publicação de Conteúdo**

#### **Posts de Feed (Photos)**
```javascript
POST /{ig-user-id}/media
{
  image_url: "https://...",
  caption: "Legenda do post #hashtag",
  location_id: "..." // Opcional
}

POST /{ig-user-id}/media_publish
{
  creation_id: "{media-id}"
}
```

#### **Stories**
```javascript
POST /{ig-user-id}/media
{
  media_type: "STORIES",
  image_url: "https://...",
  // Stories expiram em 24h
}
```

#### **Reels**
```javascript
POST /{ig-user-id}/media
{
  media_type: "REELS",
  video_url: "https://...",
  caption: "Legenda do reel",
  cover_url: "https://..." // Thumbnail
}
```

### **3. Agendamento**
- Instagram não suporta agendamento nativo via API
- **Solução**: Usar fila de jobs (Netlify Functions + Cron)
- Publicar no horário agendado automaticamente

### **4. Métricas e Analytics**
```javascript
GET /{ig-media-id}/insights
?metric=impressions,reach,likes,comments,shares,saved
```

**Métricas disponíveis:**
- `impressions` - Impressões
- `reach` - Alcance
- `likes` - Curtidas
- `comments` - Comentários
- `shares` - Compartilhamentos
- `saved` - Salvos
- `video_views` - Visualizações (vídeos)

## 🏗️ Arquitetura de Integração

### **1. Tabela de Integrações Instagram**

```sql
CREATE TABLE sistemaretiradas.instagram_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  instagram_account_id TEXT NOT NULL, -- Instagram Business Account ID
  instagram_username TEXT, -- @username
  access_token TEXT NOT NULL, -- Token de acesso
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT, -- Se disponível
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  error_message TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, instagram_account_id)
);
```

### **2. Fluxo de Autenticação**

```
1. Usuário clica "Conectar Instagram"
2. Redireciona para Facebook OAuth
3. Usuário autoriza permissões:
   - instagram_basic
   - instagram_content_publish
   - pages_read_engagement
4. Callback recebe código
5. Troca código por access_token
6. Busca Instagram Business Account ID
7. Salva integração no banco
```

### **3. Netlify Function: Instagram OAuth**

```javascript
// netlify/functions/instagram-oauth-callback.js
exports.handler = async (event, context) => {
  // Similar ao erp-oauth-callback.js
  // 1. Receber código OAuth
  // 2. Trocar por access_token
  // 3. Buscar Instagram Account ID
  // 4. Salvar em instagram_integrations
  // 5. Redirecionar para página de sucesso
};
```

### **4. Netlify Function: Publicar Post**

```javascript
// netlify/functions/instagram-publish-post.js
exports.handler = async (event, context) => {
  // 1. Receber post_id do marketing_posts
  // 2. Buscar integração Instagram da loja
  // 3. Upload de mídia (se necessário)
  // 4. Criar media container
  // 5. Publicar post
  // 6. Atualizar marketing_posts com instagram_post_id
  // 7. Retornar resultado
};
```

### **5. Netlify Function: Sincronizar Métricas**

```javascript
// netlify/functions/instagram-sync-metrics.js
exports.handler = async (event, context) => {
  // 1. Buscar posts publicados sem métricas recentes
  // 2. Para cada post, buscar insights via API
  // 3. Atualizar marketing_posts.metrics
  // 4. Atualizar last_metrics_sync_at
};
```

## 🔄 Integração com Módulo de Marketing

### **Atualizar `marketing_posts`**

Já temos os campos necessários:
- `instagram_post_id` ✅
- `instagram_media_id` ✅
- `metrics` (JSONB) ✅
- `platforms` (array) ✅

### **Fluxo Completo**

1. **Criar Post** (Frontend)
   - Usuário cria post no editor
   - Escolhe plataformas: `['instagram', 'tiktok']`
   - Define `scheduled_at`

2. **Agendar Publicação** (Backend)
   - Salvar em `marketing_posts` com `status = 'scheduled'`
   - Criar job agendado (Netlify Cron ou Supabase Cron)

3. **Publicar no Horário** (Netlify Function)
   - Job executa no `scheduled_at`
   - Chama `instagram-publish-post`
   - Atualiza `status = 'published'`
   - Salva `instagram_post_id`

4. **Sincronizar Métricas** (Periódico)
   - Cron job diário
   - Busca posts publicados
   - Atualiza métricas

## 📋 Requisitos e Limitações

### **Requisitos do Instagram**
- ✅ Conta Instagram Business ou Creator
- ✅ Conta conectada ao Facebook Page
- ✅ App Facebook criado e aprovado
- ✅ Permissões solicitadas e aprovadas

### **Limitações da API**
- ⚠️ **Rate Limits**: 200 requests/hora por usuário
- ⚠️ **Stories**: Expira em 24h automaticamente
- ⚠️ **Reels**: Requer vídeo (não apenas imagem)
- ⚠️ **Agendamento**: Não nativo - precisa de fila própria
- ⚠️ **Métricas**: Disponíveis apenas 24h após publicação

### **Formato de Mídia**
- **Imagens**: JPG, PNG (mín: 320x320, máx: 1440x1440)
- **Vídeos**: MP4, MOV (mín: 1s, máx: 60s para Reels)
- **Aspect Ratio**: 1:1 (feed), 9:16 (Stories/Reels)

## 🚀 Implementação Sugerida

### **Fase 1: Autenticação** (MVP)
- [ ] Criar tabela `instagram_integrations`
- [ ] Netlify Function: OAuth callback
- [ ] Página de configuração (similar a ERPConfig)
- [ ] Testar conexão

### **Fase 2: Publicação Básica**
- [ ] Netlify Function: Publicar post simples
- [ ] Integrar com `marketing_posts`
- [ ] Testar publicação manual

### **Fase 3: Agendamento**
- [ ] Sistema de fila (Supabase Cron ou Netlify Cron)
- [ ] Publicação automática no horário
- [ ] Tratamento de erros

### **Fase 4: Métricas**
- [ ] Netlify Function: Sincronizar métricas
- [ ] Dashboard de analytics
- [ ] Gráficos de performance

### **Fase 5: Recursos Avançados**
- [ ] Stories automáticos
- [ ] Reels com legendas
- [ ] Carrossel de imagens
- [ ] Localização automática

## 💡 Comparação com Repositório elevea2trabalho

Baseado na análise do repositório público, parece que:
- ✅ Já existe estrutura de OAuth (similar a ERPs)
- ✅ Já existe sistema de integrações
- ✅ Já existe Netlify Functions para webhooks

**Podemos reutilizar:**
1. **Padrão de OAuth** do `erp-oauth-callback.js`
2. **Estrutura de integrações** similar a `erp_integrations`
3. **Página de configuração** similar a `ERPConfig.tsx`

**Diferenças:**
- Instagram usa **Facebook OAuth** (não OAuth direto)
- Precisa de **Facebook Page** conectada
- API diferente (Graph API vs REST API)

## 📖 Documentação Oficial

- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Insights & Analytics](https://developers.facebook.com/docs/instagram-api/guides/insights)
- [Rate Limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)

## 🔐 Segurança

- ✅ Tokens armazenados criptografados
- ✅ Refresh automático de tokens
- ✅ RLS no Supabase (apenas loja vê suas integrações)
- ✅ Validação de permissões antes de publicar
- ✅ Rate limiting para evitar bloqueios

