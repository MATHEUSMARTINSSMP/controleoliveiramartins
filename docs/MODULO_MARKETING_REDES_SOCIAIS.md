# 📱 Módulo de Marketing para Redes Sociais

## 🎯 Visão Geral

Módulo completo para criação, agendamento e publicação de conteúdo (imagens e vídeos) para TikTok e Instagram, com geração automática de legendas e templates personalizáveis.

## 🏗️ Arquitetura

### 1. **Geração de Imagens**
- **Canvas API** (browser) para criação programática
- **Templates pré-definidos** (formato vertical 9:16 para Stories/Reels)
- **Overlay de texto** com fontes customizáveis
- **Biblioteca de assets** (logos, ícones, backgrounds)

### 2. **Geração de Vídeos**
- **FFmpeg.wasm** (browser) ou **Netlify Function** (serverless)
- **Text-to-Speech** para narração automática
- **Legendas animadas** (overlay de texto sincronizado)
- **Transições e efeitos** básicos

### 3. **Integrações**
- **Instagram Graph API** (agendamento e publicação)
- **TikTok Business API** (quando disponível)
- **Buffer/Hootsuite** (alternativa via webhook)

### 4. **Funcionalidades Principais**
- ✅ Editor visual de posts
- ✅ Biblioteca de templates
- ✅ Geração automática de legendas
- ✅ Agendamento de posts
- ✅ Preview em tempo real
- ✅ Analytics básico (via APIs)

## 📊 Estrutura de Banco de Dados

```sql
-- Tabela de campanhas
marketing_campaigns (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT,
  description TEXT,
  status TEXT, -- 'draft', 'scheduled', 'published', 'archived'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Tabela de posts/creatives
marketing_posts (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  store_id UUID REFERENCES stores(id),
  type TEXT, -- 'image', 'video', 'carousel'
  platform TEXT[], -- ['instagram', 'tiktok']
  content JSONB, -- Template config, texto, assets
  media_url TEXT, -- URL do arquivo gerado
  caption TEXT,
  hashtags TEXT[],
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT, -- 'draft', 'scheduled', 'published', 'failed'
  instagram_post_id TEXT,
  tiktok_post_id TEXT,
  metrics JSONB, -- likes, views, comments, etc
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Tabela de templates
marketing_templates (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name TEXT,
  type TEXT, -- 'image', 'video'
  category TEXT, -- 'promocao', 'produto', 'lancamento', 'educativo'
  config JSONB, -- Layout, cores, fontes, posições
  preview_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
)

-- Tabela de assets (imagens, vídeos, áudios)
marketing_assets (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  type TEXT, -- 'image', 'video', 'audio', 'font'
  url TEXT,
  filename TEXT,
  size INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

## 🛠️ Stack Tecnológico

### Frontend
- **Canvas API** - Geração de imagens
- **FFmpeg.wasm** - Processamento de vídeo (ou Netlify Function)
- **React Canvas** - Editor visual
- **Framer Motion** - Animações de preview

### Backend
- **Supabase Storage** - Armazenamento de mídia
- **Netlify Functions** - Processamento pesado (FFmpeg)
- **Instagram Graph API** - Publicação
- **OpenAI API** (opcional) - Geração de legendas/copy

### Bibliotecas Sugeridas
```json
{
  "fabric": "^5.3.0", // Editor Canvas avançado
  "html2canvas": "^1.4.1", // Screenshot de componentes React
  "remotion": "^4.0.0", // Geração de vídeo programática (React)
  "react-canvas-draw": "^1.2.1", // Editor de desenho
  "jspdf": "^3.0.4" // Já existe - para PDFs de templates
}
```

## 🎨 Fluxo de Uso

1. **Criar Campanha**
   - Nome, descrição, período

2. **Criar Post**
   - Escolher template ou criar do zero
   - Adicionar texto, imagens, vídeos
   - Configurar legendas e hashtags
   - Preview em tempo real

3. **Agendar/Publicar**
   - Escolher plataformas (Instagram, TikTok)
   - Agendar data/hora
   - Publicar imediatamente ou agendar

4. **Monitorar**
   - Ver métricas (likes, views, comentários)
   - Analisar performance

## 🚀 Implementação Sugerida

### Fase 1: MVP (Imagens)
- ✅ Editor básico de imagens
- ✅ Templates simples
- ✅ Geração de imagem final
- ✅ Download/Preview

### Fase 2: Agendamento
- ✅ Integração Instagram Graph API
- ✅ Agendamento de posts
- ✅ Fila de publicação

### Fase 3: Vídeos
- ✅ Editor de vídeo básico
- ✅ Text-to-speech
- ✅ Legendas animadas
- ✅ Export para formato adequado

### Fase 4: Analytics
- ✅ Coleta de métricas
- ✅ Dashboard de performance
- ✅ Relatórios

## 💡 Ideias Avançadas

1. **IA para Geração de Conteúdo**
   - OpenAI para gerar copy/legendas
   - DALL-E/Midjourney para imagens
   - Análise de tendências

2. **Automação**
   - Posts automáticos baseados em eventos (nova venda, meta atingida)
   - Templates dinâmicos com dados da loja

3. **A/B Testing**
   - Testar diferentes versões
   - Analisar qual performa melhor

4. **Biblioteca de Conteúdo**
   - Reutilizar posts bem-sucedidos
   - Compartilhar templates entre lojas

