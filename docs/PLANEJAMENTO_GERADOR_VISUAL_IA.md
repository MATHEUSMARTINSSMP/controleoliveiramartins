# 🎨 Planejamento: Gerador de Conteúdo Visual com IA

## 🎯 Objetivo

Criar um módulo **simples** que permite aos usuários **gerar** imagens e vídeos para redes sociais usando IA:
- ✅ **Geração de imagens** a partir de texto (prompt)
- ✅ **Geração de vídeos** a partir de texto (prompt)
- ✅ **Geração de carrosséis** (múltiplas imagens combinadas)
- ✅ Suporte a múltiplas APIs: OpenAI, Google Imagen/Veo
- ⚠️ **NÃO inclui editor** (apenas geração por enquanto)

**Foco inicial**: Gerar conteúdo do zero, não editar existente.

## 💡 Funcionalidades Principais

### **1. Gerador de Imagens**

#### **Comandos de Geração**
```
"Gere uma imagem de um produto elegante com fundo branco"
"Crie uma imagem promocional para Black Friday com cores vibrantes"
"Faça uma imagem de uma loja de moda moderna e minimalista"
"Gere um banner vertical (9:16) para Instagram Stories"
```

#### **Opções de Geração**
- Texto para imagem (Text-to-Image)
- Diferentes estilos (fotográfico, ilustração, 3D)
- Formatos: quadrado (1:1), retrato (9:16), paisagem (16:9)
- Aplicação automática de cores da marca (pós-processamento)

### **2. Gerador de Vídeos**

#### **Comandos de Geração**
```
"Faça um carrossel com 5 slides mostrando: 
- Slide 1: Produto X com preço R$ 199,90
- Slide 2: Benefícios do produto
- Slide 3: Depoimento de cliente
- Slide 4: Como comprar
- Slide 5: Contato e redes sociais"

"Gere um carrossel promocional com 3 slides para Black Friday"
"Crie um carrossel educativo sobre [tema]"
```

#### **Componentes de Carrossel**
- Layout automático baseado em quantidade de slides
- Tipografia consistente
- Elementos visuais (ícones, shapes)
- Informações estruturadas (preços, listas, CTA)

### **3. Gerador de Vídeos com IA**

#### **Comandos de Geração de Vídeo**
```
"Crie um vídeo de 30 segundos mostrando o produto X com música de fundo"
"Transforme esse carrossel em um vídeo com transições suaves"
"Faça um Reels mostrando: slide 1 [imagem], slide 2 [texto], slide 3 [CTA]"
"Gere um vídeo promocional de 15 segundos com as cores da marca"
"Crie um Stories de 5 segundos com esse produto destacado"
```

#### **Funcionalidades de Vídeo**
- **Animações automáticas**: Transições entre imagens
- **Text-to-Video**: Gerar vídeo a partir de texto/prompt
- **Legendas automáticas**: Adicionar legendas sincronizadas
- **Música de fundo**: Bibliotecas de áudio ou gerar com IA
- **Efeitos visuais**: Zoom, pan, fade, etc
- **Formato Stories/Reels**: 9:16 vertical automaticamente

#### **Tipos de Vídeo Suportados**
- **Reels** (15-60s, vertical)
- **Stories** (5-15s, vertical)
- **Vídeos de Feed** (até 60s, qualquer formato)
- **Carrosséis de vídeo** (múltiplos vídeos curtos)

### **4. Aplicação de Identidade Visual (Pós-processamento)**

#### **Aplicação Automática**
- Extrair cores da logo automaticamente
- Aplicar overlay/filtro com cores da marca
- Adicionar logo em posições pré-definidas (opcional)
- Manter consistência visual entre gerações

**Nota**: Isso é feito **depois** da geração, como um step de pós-processamento simples (Canvas API).

## 🛠️ Tecnologias e APIs

### **APIs para Geração de Imagens**

#### **1. OpenAI DALL-E 3** ✅ RECOMENDADO PARA MVP
- ✅ API simples e bem documentada
- ✅ Excelente qualidade
- ✅ Custo: ~$0.040/imagem (1024x1024)
- ✅ Estável e confiável
- ⚠️ **Vídeo**: Não tem API pública ainda (apenas Sora em preview)

#### **2. Google Imagen** 🌟 MELHOR PARA IMAGENS REALISTAS
- ✅ Qualidade fotográfica excepcional
- ✅ Ideal para produtos, moda, marketing
- ✅ Custo competitivo
- ✅ Via Google Cloud Vertex AI
- ⚠️ Requer conta Google Cloud

#### **3. Stability AI / Replicate**
- ✅ Open source (Stable Diffusion)
- ✅ Mais barato
- ✅ Boa qualidade
- ⚠️ Menos consistente que DALL-E/Imagen

### **APIs para Geração de Vídeos**

#### **1. Google Veo** 🎬 DISPONÍVEL VIA API GEMINI
- ✅ **Veo 3.1** (preview) - Mais moderno, 8s em 720p/1080p
- ✅ **Veo 3.0** (estável) - 8s, alta qualidade
- ✅ **Veo 2.0** (estável) - Texto ou imagem para vídeo
- ✅ Text-to-Video e Imagem-to-Vídeo
- ✅ Áudio gerado nativamente
- ✅ Via API Gemini (https://ai.google.dev/gemini-api)
- ✅ Processo assíncrono (operation polling)

#### **2. OpenAI (Futuro)**
- ⚠️ **Sora** ainda não tem API pública
- ✅ Quando disponível, será integrado

#### **3. Runway ML API** ✅ DISPONÍVEL AGORA
- ✅ Text-to-Video (Gen-2)
- ✅ Imagem-to-Vídeo
- ⚠️ Caro: ~$0.05-0.25/segundo de vídeo
- ✅ API estável

#### **4. Pika Labs API**
- ✅ Text-to-Video
- ✅ Animate imagens
- ⚠️ Beta, acesso limitado
- ⚠️ Preço variável

#### **5. Remotion + IA (Híbrido)**
- ✅ Gerar imagens com IA primeiro
- ✅ Animar com Remotion (React)
- ✅ Gratuito para animações simples
- ✅ Controle total

### **Recomendação: Stack Multi-Provider com Adapter**

```
IMAGENS:
Opção 1 (RECOMENDADO): Google Nano Banana → Mesma API do Veo, fácil integração
Opção 2 (MVP): OpenAI DALL-E 3 → Simples, rápido, confiável
Opção 3 (Qualidade): Google Imagen → Melhor para produtos/moda (Vertex AI)
Opção 4 (Econômico): Replicate (Stable Diffusion)

VÍDEOS:
Opção 1 (RECOMENDADO): Google Veo 2.0/3.0 → Estável, mesma API do Nano Banana
Opção 2 (Alternativa): Runway ML → Text-to-Video (provider diferente)
Opção 3 (Híbrido): Gerar imagens (IA) + Animar (Remotion)
```

**🌟 Vantagem de usar Nano Banana + Veo:**
- ✅ Mesma API (Gemini)
- ✅ Mesma chave de autenticação
- ✅ Mesmo processo (assíncrono para ambos)
- ✅ Mesma documentação/stack
- ✅ Código mais simples e unificado

PÓS-PROCESSAMENTO:
Aplicação de cores da marca → Canvas API (navegador)
Adicionar logo → Canvas API
Formatar para carrossel → Canvas API
```

**Estratégia**: Criar um **adapter pattern** para trocar entre providers sem mudar o frontend.

## 🏗️ Arquitetura

    ### **Fluxo de Geração (Padrão Recomendado)**

```
FLUXO IMAGENS:
1. Frontend: Usuário faz upload OU escolhe template OU descreve imagem
2. Frontend: Envia POST /api/generate com {type: "image", prompt, ...}
3. Backend (Netlify Function):
   - Valida prompt e autenticação
   - Chama OpenAI DALL-E ou Replicate
   - Recebe imagem (bytes/base64 ou URL temporária)
   - Faz upload para Supabase Storage
   - Gera URL pública/assinada
   - Salva referência em marketing_assets
   - Retorna {status: "done", mediaUrl: "...", type: "image"}
4. Frontend: Renderiza <img src={mediaUrl} />
5. Usuário: Preview, edita, ou agenda publicação

FLUXO VÍDEOS (Assíncrono):
1. Frontend: POST /api/generate-video com {type: "video", prompt, duration, ...}
2. Backend: Retorna {status: "processing", jobId: "..."}
3. Backend: Processa em background:
   - Gera imagens/componentes
   - Cria animações (Remotion/FFmpeg)
   - Renderiza vídeo
   - Upload para Supabase Storage
   - Atualiza job status
4. Frontend: Polling GET /api/jobs/:jobId a cada 2-3s
5. Quando pronto: Retorna {status: "done", mediaUrl: "...", type: "video"}
6. Frontend: Renderiza <video src={mediaUrl} controls />
```

### **Armazenamento: Supabase Storage (Já temos!)**

```
Estrutura de pastas:
marketing/
  {store_id}/
    {user_id}/
      {year}/{month}/
        {uuid}.png          # Imagens
        {uuid}.mp4          # Vídeos
        {uuid}-thumbnail.jpg # Thumbnails

URLs:
- Públicas: https://{project}.supabase.co/storage/v1/object/public/marketing/...
- Assinadas (24h): https://{project}.supabase.co/storage/v1/object/sign/marketing/...?token=...
```

### **Componentes Necessários**

#### **Frontend (React)** - Simplificado (sem editor)

```
src/components/marketing/
├── ImageGeneratorIA/
│   ├── PromptInput.tsx            # Campo de texto para prompt
│   ├── ProviderSelector.tsx       # Escolher: DALL-E, Imagen, etc
│   ├── ImageSettings.tsx          # Tamanho, formato, estilo
│   ├── ImagePreview.tsx           # Preview da imagem gerada
│   ├── BrandColorsToggle.tsx      # Aplicar cores da marca (on/off)
│   └── DownloadButton.tsx         # Baixar ou salvar
│
├── VideoGeneratorIA/
│   ├── PromptInput.tsx            # Prompt para vídeo
│   ├── ProviderSelector.tsx       # Runway, Veo, etc
│   ├── VideoSettings.tsx          # Duração, formato (Reels/Stories)
│   ├── VideoPreview.tsx           # Preview do vídeo
│   └── JobStatus.tsx              # Status de processamento (polling)
│
├── CarouselGeneratorIA/
│   ├── SlidesConfig.tsx           # Definir quantidade de slides
│   ├── PromptPerSlide.tsx         # Prompt para cada slide
│   ├── CarouselPreview.tsx        # Preview do carrossel
│   └── ExportCarousel.tsx         # Baixar todas as imagens
│
└── Shared/
    ├── ProviderAdapter.ts         # Adapter para trocar providers
    └── BrandColorsConfig.tsx      # Configurar cores da marca
```

#### **Backend (Netlify Functions)**

**Endpoints Principais:**
```
netlify/functions/
├── generate-image.js              # POST: Gerar imagem
│   ├── Input: {prompt, provider, size, style, applyBrand}
│   ├── Chama provider (DALL-E, Imagen, etc) via adapter
│   ├── Aplica cores da marca (se solicitado)
│   ├── Upload para Supabase Storage
│   └── Retorna: {status: "done", mediaUrl, type: "image"}
│
├── generate-video.js              # POST: Iniciar geração de vídeo (assíncrono)
│   ├── Input: {prompt, provider, duration, type, applyBrand}
│   ├── Cria job no banco
│   └── Retorna: {status: "processing", jobId}
│
├── job-status.js                  # GET: Consultar status do job
│   ├── Input: ?jobId=xxx
│   └── Retorna: {status, mediaUrl?, progress?}
│
├── generate-carousel.js           # POST: Gerar múltiplas imagens
│   ├── Input: {slides: [{prompt, ...}], provider}
│   ├── Gera cada imagem em paralelo
│   ├── Aplica marca (opcional)
│   └── Retorna: {mediaUrls: [...], type: "carousel"}
│
└── apply-brand-colors.js          # POST: Pós-processamento (opcional)
    ├── Input: {mediaUrl, storeId}
    ├── Extrai cores da logo
    ├── Aplica overlay/filtro (Canvas)
    └── Retorna: {mediaUrl} (nova versão)
```

**Adapter Pattern para Providers:**
```typescript
// lib/ai-providers/adapter.ts
interface AIImageProvider {
  generateImage(prompt: string, options: ImageOptions): Promise<ImageResult>;
}

class DalleProvider implements AIImageProvider { ... }
class ImagenProvider implements AIImageProvider { ... }
class ReplicateProvider implements AIImageProvider { ... }
```

**Contrato Padrão de Resposta:**
```typescript
// Sucesso (imagem)
{
  status: "done",
  type: "image",
  mediaUrl: "https://...supabase.co/storage/.../image.png",
  thumbnailUrl?: "https://...",
  mime: "image/png",
  width: 1024,
  height: 1024,
  size: 245760, // bytes
  assetId: "uuid" // ID em marketing_assets
}

// Processando (vídeo)
{
  status: "processing",
  jobId: "uuid",
  estimatedTime: 30 // segundos
}

// Erro
{
  status: "error",
  error: "Rate limit exceeded",
  code: "RATE_LIMIT"
}
```

#### **Banco de Dados**

**Tabelas Existentes (marketing_module.sql):**
- ✅ `marketing_assets` - Armazenar referências de mídia gerada
- ✅ `marketing_templates` - Templates salvos
- ✅ `marketing_posts` - Posts criados

**Novas Tabelas/Colunas Necessárias:**
```sql
-- Atualizar stores para identidade visual
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS brand_fonts JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Tabela para jobs assíncronos (vídeos)
CREATE TABLE sistemaretiradas.marketing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id),
  user_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('video', 'carousel', 'batch')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  input JSONB NOT NULL, -- Prompt, configurações
  result JSONB, -- mediaUrl, progress, etc
  error_message TEXT,
  progress INTEGER DEFAULT 0, -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Atualizar marketing_assets para incluir storage_path
ALTER TABLE sistemaretiradas.marketing_assets
ADD COLUMN IF NOT EXISTS storage_path TEXT, -- Path no Supabase Storage
ADD COLUMN IF NOT EXISTS url_signed TEXT, -- URL assinada (se temporária)
ADD COLUMN IF NOT EXISTS url_signed_expires_at TIMESTAMPTZ; -- Expiração da URL
```

## 📋 Funcionalidades Detalhadas

### **1. Detecção Automática de Cores da Marca**

```javascript
// Extrair cores dominantes da logo
async function extractBrandColors(logoUrl) {
  // 1. Download da logo
  // 2. Processar imagem (Canvas)
  // 3. Usar algoritmo de quantização de cores
  // 4. Retornar paleta: {primary, secondary, accent, background}
}
```

### **2. Aplicação de Cores com IA**

```javascript
// Comando: "aplicar cores da minha marca"
async function applyBrandColors(imageUrl, brandColors) {
  // Opção 1: Canvas API (rápido, no navegador)
  // - Overlay com cores
  // - Ajuste de matiz/saturação
  // - Aplicar gradientes
  
  // Opção 2: IA (mais inteligente)
  // - Usar Stable Diffusion ControlNet
  // - Color transfer learning
  // - Recolorização inteligente
}
```

### **3. Geração de Carrosséis**

```javascript
// Comando: "carrossel com 5 slides sobre produto X"
async function generateCarousel(specs) {
  // specs = {
  //   slides: [
  //     {type: "product", data: {...}},
  //     {type: "benefits", data: {...}},
  //     {type: "testimonial", data: {...}}
  //   ],
  //   brandColors: {...},
  //   style: "minimalist"
  // }
  
  // Para cada slide:
  // 1. Gerar imagem base (DALL-E ou template)
  // 2. Adicionar texto (Canvas)
  // 3. Aplicar elementos visuais
  // 4. Aplicar cores da marca
  // 5. Combinar em carrossel
}
```

### **4. Geração de Vídeos**

```javascript
// Comando: "vídeo de 30s mostrando produto X"
async function generateVideo(specs) {
  // specs = {
  //   type: "reels" | "stories" | "feed",
  //   duration: 30, // segundos
  //   prompt: "vídeo mostrando produto X",
  //   images: [...], // Imagens para animar
  //   music: "upbeat" | "calm" | "custom",
  //   subtitles: true,
  //   brandColors: {...}
  // }
  
  // Opção 1: Text-to-Video (Runway/Pika)
  // 1. Enviar prompt para API
  // 2. Receber vídeo gerado
  // 3. Aplicar marca (overlay, logo)
  
  // Opção 2: Animar imagens (Remotion)
  // 1. Pegar imagens fornecidas
  // 2. Criar composição Remotion
  // 3. Adicionar animações (zoom, pan, fade)
  // 4. Adicionar música
  // 5. Renderizar vídeo
}
```

### **5. Templates Inteligentes**

```javascript
// Templates baseados em contexto
const templates = {
  promocao: {
    layout: "preco_destaque",
    elementos: ["produto", "preco_antes", "preco_depois", "cta"],
    estilo: "energico"
  },
  educativo: {
    layout: "texto_central",
    elementos: ["titulo", "lista", "icones"],
    estilo: "limpo"
  },
  produto: {
    layout: "imagem_lateral",
    elementos: ["foto_produto", "nome", "beneficios", "preco"],
    estilo: "elegante"
  }
};
```

## 💰 Custos Estimados

### **Custos por Provider**

#### **Imagens**
| Provider | Custo/Imagem | Qualidade | Facilidade | Integração |
|----------|--------------|-----------|------------|------------|
| **Google Nano Banana** | ? (verificar) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Mesma API do Veo |
| OpenAI DALL-E 3 | $0.040 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ Provider diferente |
| Google Imagen | ~$0.02-0.05 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Vertex AI (setup complexo) |
| Replicate SDXL | ~$0.003 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Provider diferente |

**💡 Recomendação**: Se já vamos usar Veo (Google), usar **Nano Banana** para imagens facilita muito (mesma API, mesma chave, mesmo processo).

#### **Vídeos**
| Provider | Modelo | Duração | Qualidade | Disponibilidade |
|----------|--------|---------|-----------|----------------|
| Google Veo | Veo 3.1 | 8s (720p/1080p) | ⭐⭐⭐⭐⭐ | Preview |
| Google Veo | Veo 3.0 | 8s | ⭐⭐⭐⭐⭐ | ✅ Estável |
| Google Veo | Veo 2.0 | 5-8s (720p) | ⭐⭐⭐⭐ | ✅ Estável |
| Runway ML | Gen-2 | Variável | ⭐⭐⭐⭐ | ✅ Disponível |
| Remotion (híbrido) | - | Variável | ⭐⭐⭐ | ✅ Disponível |

### **Custo Médio por Post**
- **Imagem** (DALL-E 3): ~$0.04
- **Imagem** (Google Imagen): ~$0.03
- **Carrossel 5 slides** (DALL-E): ~$0.20
- **Vídeo 15s** (Runway): ~$0.75-3.75
- **Vídeo 15s** (Remotion + IA): ~$0.20 (5 imagens + renderização)

### **Recomendação de Modelo**
- Plano Básico: 50 posts/mês incluídos
- Plano Pro: 200 posts/mês incluídos
- Pagamento por uso além do limite

## 🚀 Roadmap de Implementação

### **Fase 1: MVP - Editor Básico**
- [ ] Upload de imagem
- [ ] Extração de cores da logo
- [ ] Aplicação de cores básica (Canvas API)
- [ ] Preview em tempo real
- [ ] Download de imagem editada

### **Fase 2: IA de Edição**
- [ ] Integração com Replicate/Clipdrop
- [ ] Comandos de texto para edição
- [ ] Aplicação inteligente de filtros
- [ ] Remoção/adicionar elementos

### **Fase 3: Gerador de Carrosséis**
- [ ] Interface para definir slides
- [ ] Geração de múltiplas imagens
- [ ] Layout automático
- [ ] Combinação em carrossel

### **Fase 4: Templates e Automação**
- [ ] Biblioteca de templates
- [ ] Aplicação automática de identidade visual
- [ ] Salvamento de projetos
- [ ] Reutilização de designs

### **Fase 5: Gerador de Vídeos Básico**
- [ ] Interface de criação de vídeo
- [ ] Remotion setup (renderização)
- [ ] Animações simples (zoom, pan, fade)
- [ ] Adicionar música de fundo
- [ ] Export de vídeo

### **Fase 6: Vídeos com IA**
- [ ] Integração Runway ML ou Pika Labs
- [ ] Text-to-Video
- [ ] Transformar imagem em vídeo
- [ ] Legendas automáticas
- [ ] Otimização de custos

### **Fase 7: Integração com Marketing**
- [ ] Salvar em marketing_posts
- [ ] Agendamento de publicação
- [ ] Integração com Instagram (futuro)

## ❓ Decisões Técnicas (Definidas)

### **✅ 1. API de IA para Geração (Atualizado)**

**Imagens:**
- **Padrão recomendado**: **Google Nano Banana** (mesma API do Veo, fácil integração)
- **Alternativa**: OpenAI DALL-E 3 (simples, rápido, MVP)
- **Alternativa premium**: Google Imagen (melhor qualidade realista, mas setup mais complexo)
- **Alternativa econômica**: Replicate/Stable Diffusion

**Vídeos:**
- **Padrão**: Google Veo 2.0 (estável, disponível agora via Gemini API)
- **Alternativa premium**: Veo 3.1/3.0 (melhor qualidade, preview/estável)
- **Alternativa**: Runway ML (se preferir outro provider)
- **Híbrido**: Gerar imagens (IA) + Animar (Remotion)

**Estratégia**: Suportar múltiplos providers via adapter pattern

### **✅ 2. Processamento**
- **IA pesada**: Servidor (Netlify Functions)
- **Ajustes simples**: Navegador (Canvas API) para preview rápido
- **Renderização vídeo**: Servidor (Remotion em Netlify Function ou job assíncrono)

### **✅ 3. Armazenamento** 
- **Escolhido**: Supabase Storage (já temos no projeto)
- **Estrutura**: `/marketing/{store_id}/{user_id}/{year}/{month}/{uuid}.ext`
- **URLs**: Públicas para imagens, assinadas (24h) para vídeos

### **✅ 4. Delivery Pattern**
- **Padrão**: Backend gera → Upload Storage → Retorna URL → Front renderiza
- **NÃO usar**: Base64 para vídeos (só imagens pequenas)
- **Vídeos**: Jobs assíncronos com polling

### **✅ 5. Limites e Quotas**
- **Por loja** (multi-tenant já implementado)
- **Rate limit**: 10 requisições/minuto por loja
- **Soft limit**: Aviso quando próximo do limite
- **Hard limit**: Bloqueio temporário
- **Cobrança**: Por plano + uso extra

### **✅ 6. Renderização de Vídeo (Decidido)**
- **Opção escolhida**: Remotion em Netlify Function (serverless)
- **Alternativa**: Job assíncrono com Railway/Render (se muito pesado)
- **Fallback**: FFmpeg.wasm para edições simples no navegador

### **✅ 7. Formato de Vídeo (Decidido)**
- **Escolhido**: MP4 (H.264) - máxima compatibilidade
- **Resolução**: 1080p (1920x1080 para feed, 1080x1920 para Stories/Reels)
- **Bitrate**: 5-8 Mbps (boa qualidade, tamanho razoável)

### **8. Segurança e Autenticação**
- ✅ JWT/Session já implementado no projeto
- ✅ Rate limiting por loja
- ✅ Validação de payload (tamanho prompt, tipo permitido)
- ✅ Antifraude: limite diário por usuário/loja
- ✅ Logs de uso (para billing e analytics)

## 🎨 Exemplos de Uso

### **Caso 1: Editar Foto de Produto**
```
Usuário: "Use essa foto do produto, aplique cores rosa e dourado da marca, 
          adicione um texto 'Novo Lançamento' em cima"
Sistema: 
  1. Detecta cores rosa e dourado da logo
  2. Aplica overlay com essas cores
  3. Adiciona texto estilizado
  4. Retorna imagem editada
```

### **Caso 2: Carrossel Promocional**
```
Usuário: "Crie um carrossel de 4 slides para promoção de Black Friday:
          - Slide 1: Título 'Black Friday'
          - Slide 2: Lista de produtos em promoção
          - Slide 3: Descontos (50% OFF)
          - Slide 4: Como comprar e contato"
Sistema:
  1. Gera 4 imagens baseadas em template promocional
  2. Aplica cores da marca
  3. Adiciona textos e elementos
  4. Retorna carrossel pronto
```

### **Caso 3: Aplicar Estilo**
```
Usuário: "Transforme essa imagem em estilo minimalista com cores da marca"
Sistema:
  1. Usa IA para simplificar imagem
  2. Remove elementos desnecessários
  3. Aplica paleta de cores da marca
  4. Retorna versão minimalista
```

### **Caso 4: Gerar Vídeo Reels**
```
Usuário: "Crie um Reels de 30 segundos mostrando 3 produtos em destaque 
          com música animada e legendas"
Sistema:
  1. Gera/usa imagens dos produtos
  2. Cria animações (zoom, pan entre produtos)
  3. Adiciona música de fundo
  4. Adiciona legendas sincronizadas
  5. Aplica cores da marca
  6. Renderiza vídeo 9:16 (1080x1920)
  7. Retorna vídeo pronto para Instagram
```

### **Caso 5: Transformar Carrossel em Vídeo**
```
Usuário: "Transforme esse carrossel de 5 slides em um vídeo Stories"
Sistema:
  1. Pega cada slide do carrossel
  2. Cria transições suaves entre slides
  3. Adiciona animações de entrada/saída
  4. Adiciona música (opcional)
  5. Renderiza formato Stories (9:16, 15s)
  6. Retorna vídeo Stories
```

### **Caso 6: Text-to-Video com IA**
```
Usuário: "Gere um vídeo de 20 segundos mostrando uma loja elegante 
          com produtos de moda, estilo minimalista"
Sistema:
  1. Envia prompt para Runway ML
  2. Recebe vídeo gerado pela IA
  3. Aplica logo da marca
  4. Ajusta cores para paleta da marca
  5. Adiciona texto/CTA se necessário
  6. Retorna vídeo personalizado
```

## 📝 Próximos Passos (Priorizados)

### **Fase 0: Setup e Infraestrutura** ✅
1. [x] Planejamento completo
2. [ ] Configurar Supabase Storage bucket `marketing`
3. [ ] Criar tabela `marketing_jobs` (vídeos assíncronos)
4. [ ] Adicionar colunas de identidade visual em `stores`

### **Fase 1: MVP - Geração de Imagens**
1. [ ] Criar Netlify Function `generate-media.js`
   - Integrar OpenAI DALL-E 3
   - Upload para Supabase Storage
   - Retornar URL pública
2. [ ] Criar componente React `ImageGeneratorIA`
   - Input de prompt
   - Loading state
   - Preview da imagem gerada
3. [ ] Testar fluxo completo end-to-end

### **Fase 2: Edição de Imagens**
1. [ ] Netlify Function `edit-image.js`
   - Integrar Replicate (Stable Diffusion)
   - Aplicar edições solicitadas
2. [ ] Componente `ImageEditorIA`
   - Upload de imagem existente
   - Campo de instruções de edição

### **Fase 3: Carrosséis**
1. [ ] Função para extrair cores da logo
2. [ ] Aplicação automática de cores da marca
3. [ ] Interface para configurar cores manualmente

### **Fase 4: Identidade Visual (Pós-processamento)**
1. [ ] Netlify Function `generate-video.js` (criar job)
2. [ ] Netlify Function `job-status.js` (consultar status)
3. [ ] Worker/Job processor (Remotion ou Runway)
4. [ ] Componente `VideoGeneratorIA` com polling

### **Fase 5: Vídeos (Assíncrono)**
1. [ ] Geração de múltiplas imagens
2. [ ] Combinação em carrossel
3. [ ] Templates pré-definidos

---

## 🔧 Exemplo de Implementação

### **Adapter Pattern (Multi-Provider)**

```typescript
// lib/ai-providers/adapter.ts
interface AIImageProvider {
  generateImage(prompt: string, options: {
    size?: string;
    style?: string;
  }): Promise<{
    imageUrl: string;
    width: number;
    height: number;
  }>;
}

class NanoBananaProvider implements AIImageProvider {
  async generateImage(prompt: string, options) {
    // Usar Google Gemini API - mesma estrutura do Veo
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const operation = await ai.models.generateImages({
      model: "nano-banana-generate-001", // Verificar nome exato na doc
      prompt: prompt,
      // options: size, style, etc
    });
    
    // Polling similar ao Veo
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      operation = await ai.operations.getImagesOperation({ operation });
    }
    
    return {
      imageUrl: operation.response.images[0].url,
      width: operation.response.images[0].width,
      height: operation.response.images[0].height,
    };
  }
}

class DalleProvider implements AIImageProvider {
  async generateImage(prompt: string, options) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: options.size || "1024x1024",
    });
    return {
      imageUrl: result.data[0].url,
      width: 1024,
      height: 1024,
    };
  }
}

class ImagenProvider implements AIImageProvider {
  async generateImage(prompt: string, options) {
    // Usar Google Cloud Vertex AI
    // Retorna mesma interface
  }
}

// Factory
export function getImageProvider(provider: 'nanobanana' | 'dalle' | 'imagen' | 'replicate') {
  switch(provider) {
    case 'nanobanana': return new NanoBananaProvider(); // RECOMENDADO (mesma API do Veo)
    case 'dalle': return new DalleProvider();
    case 'imagen': return new ImagenProvider();
    case 'replicate': return new ReplicateProvider();
  }
}

export function getVideoProvider(provider: 'veo' | 'runway' | 'remotion') {
  switch(provider) {
    case 'veo': return new VeoProvider();
    case 'runway': return new RunwayProvider();
    case 'remotion': return new RemotionProvider();
  }
}
```

### **Netlify Function - Gerar Vídeo com Veo (Assíncrono)**

```javascript
// netlify/functions/generate-video.js
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const { prompt, model = 'veo-2.0-generate-001', duration, storeId } = JSON.parse(event.body);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // 1. Iniciar geração (retorna operation)
  const operation = await ai.models.generateVideos({
    model: model, // veo-2.0-generate-001, veo-3.0-generate-001, etc
    prompt: prompt,
  });
  
  // 2. Salvar job no banco para polling
  const { data: job } = await supabase.from('marketing_jobs').insert({
    store_id: storeId,
    type: 'video',
    status: 'processing',
    input: { prompt, model, duration },
    provider: 'veo',
    // Armazenar operation.name para polling
  }).select().single();
  
  // 3. Retornar jobId para frontend fazer polling
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'processing',
      jobId: job.id,
      operationId: operation.name, // Para polling interno
      estimatedTime: 30, // segundos
    }),
  };
};

// netlify/functions/job-status.js - Polling
exports.handler = async (event) => {
  const { jobId } = event.queryStringParameters;
  const { GoogleGenAI } = require('@google/genai');
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // 1. Buscar job
  const { data: job } = await supabase.from('marketing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (job.status === 'done') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'done',
        mediaUrl: job.result.mediaUrl,
      }),
    };
  }
  
  // 2. Verificar status da operation do Veo
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const operation = await ai.operations.getVideosOperation({
    operation: { name: job.input.operationId },
  });
  
  if (operation.done) {
    // 3. Download do vídeo
    const videoFile = operation.response.generatedVideos[0].video;
    const videoBuffer = await ai.files.download({ file: videoFile });
    
    // 4. Upload para Supabase Storage
    const fileName = `${job.store_id}/${Date.now()}.mp4`;
    await supabase.storage.from('marketing').upload(fileName, videoBuffer);
    
    const { data: { publicUrl } } = supabase.storage
      .from('marketing')
      .getPublicUrl(fileName);
    
    // 5. Atualizar job
    await supabase.from('marketing_jobs').update({
      status: 'done',
      result: { mediaUrl: publicUrl },
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'done',
        mediaUrl: publicUrl,
        type: 'video',
      }),
    };
  }
  
  // Ainda processando
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'processing',
      progress: operation.metadata?.progress || 0,
    }),
  };
};
```

### **Referências da API Veo**

- **Documentação**: https://ai.google.dev/gemini-api/docs/video
- **Modelos disponíveis**:
  - `veo-3.1-generate-preview` (preview, melhor qualidade)
  - `veo-3.0-generate-001` (estável)
  - `veo-2.0-generate-001` (estável, mais antigo)
- **Características**:
  - Text-to-Video e Imagem-to-Vídeo
  - Áudio gerado nativamente
  - Processo assíncrono (operation polling)
  - Duração: 4-8 segundos (depende do modelo)
  - Resolução: 720p ou 1080p

---

**Status**: 🟡 Planejamento - Aguardando decisões

---

## 🚀 ESPECIFICAÇÃO TÉCNICA PRONTA PARA PRODUÇÃO

> Baseado em especificação completa multi-provider (Gemini + OpenAI) com endpoints padronizados, worker assíncrono e storage.

### **⚠️ ATUALIZAÇÕES IMPORTANTES**

1. **OpenAI DALL-E 3 está DEPRECADO** → Usar **GPT Image** (`gpt-image-*`) até 05/12/2026
2. **OpenAI Sora (vídeo)** → Preview disponível via `/v1/videos`
3. **Gemini Imagem** → `gemini-2.5-flash-image:generateContent` (Nano Banana)
4. **Gemini Vídeo** → Veo via `predictLongRunning` (assíncrono)

---

## 📐 ARQUITETURA DEFINITIVA

### **Padrão de Entrega (Obrigatório)**
```
Backend gera → Supabase Storage → URL (pública/assinada) → Frontend renderiza
```

### **Estrutura de Storage**
```
marketing/
  {store_id}/
    {user_id}/
      images/{yyyy}/{mm}/{asset_id}.png
      videos/{yyyy}/{mm}/{asset_id}.mp4
      thumbs/{yyyy}/{mm}/{asset_id}.jpg
```

---

## 🗄️ BANCO DE DADOS - ESTRUTURA PRODUÇÃO

### **Tabela: `marketing_assets` (Resultado Final)**

```sql
CREATE TABLE sistemaretiradas.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id),
  user_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
  
  -- Tipo e provider
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel')),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai')),
  provider_model TEXT NOT NULL, -- ex: 'gemini-2.5-flash-image', 'gpt-image-001', 'veo-2.0-generate-001'
  
  -- Prompt e metadados
  prompt TEXT NOT NULL,
  prompt_hash TEXT, -- Para busca rápida
  meta JSONB DEFAULT '{}'::JSONB, -- {width, height, duration, seed, aspectRatio, etc}
  
  -- Storage
  storage_path TEXT NOT NULL,
  public_url TEXT, -- Se público
  signed_url TEXT, -- URL assinada
  signed_expires_at TIMESTAMPTZ, -- Expiração da URL assinada
  
  -- Job relacionado
  job_id UUID REFERENCES sistemaretiradas.marketing_jobs(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketing_assets_store_user ON sistemaretiradas.marketing_assets(store_id, user_id);
CREATE INDEX idx_marketing_assets_type ON sistemaretiradas.marketing_assets(type);
CREATE INDEX idx_marketing_assets_job ON sistemaretiradas.marketing_assets(job_id);
```

### **Tabela: `marketing_jobs` (Processos Assíncronos)**

```sql
CREATE TABLE sistemaretiradas.marketing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id),
  user_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
  
  -- Tipo e provider
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel', 'batch')),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai')),
  provider_model TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed', 'canceled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Input/Output
  input JSONB NOT NULL, -- {prompt, output: {aspectRatio, size, seconds}, brand: {...}}
  provider_ref TEXT, -- operation_name (Veo) ou video_id (Sora) para polling
  result JSONB, -- {assetId, mediaUrl, thumbnailUrl, meta}
  
  -- Erros
  error_message TEXT,
  error_code TEXT, -- RATE_LIMIT, PROVIDER_ERROR, VALIDATION_ERROR
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_marketing_jobs_store_user ON sistemaretiradas.marketing_jobs(store_id, user_id);
CREATE INDEX idx_marketing_jobs_status ON sistemaretiradas.marketing_jobs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_marketing_jobs_created ON sistemaretiradas.marketing_jobs(created_at DESC);
```

---

## 🔌 ENDPOINTS DO BACKEND (Contrato Definitivo)

### **1. POST /api/marketing/media** - Criar Mídia

**Body:**
```json
{
  "type": "image",
  "provider": "gemini",
  "model": "gemini-2.5-flash-image",
  "prompt": "Crie um banner 9:16 minimalista para promoção de verão",
  "output": {
    "aspectRatio": "9:16",
    "size": "1024x1024",
    "seconds": 8
  },
  "brand": {
    "apply": true,
    "storeId": "uuid"
  }
}
```

**Resposta:**
```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

**Validações:**
- Auth obrigatória (JWT)
- Rate limit por `store_id`
- Limite diário/mensal do plano
- Validação de `type`, `provider`, `model`

### **2. GET /api/marketing/jobs/{jobId}** - Status do Job

**Resposta (processing):**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "progress": 40
}
```

**Resposta (done):**
```json
{
  "jobId": "uuid",
  "status": "done",
  "asset": {
    "assetId": "uuid",
    "type": "image",
    "mediaUrl": "https://...signed-or-public...",
    "thumbnailUrl": null,
    "mime": "image/png",
    "meta": {
      "width": 768,
      "height": 1344
    }
  }
}
```

### **3. POST /api/marketing/assets/{assetId}/refresh-url** - Renovar URL Assinada

**Resposta:**
```json
{
  "mediaUrl": "https://...signed...",
  "expiresAt": "2025-12-25T12:00:00Z"
}
```

### **4. GET /api/marketing/assets** - Listar Assets (Galeria)

**Query params:** `?type=image&limit=50&cursor=...`

**Resposta:**
```json
{
  "assets": [...],
  "nextCursor": "..."
}
```

### **5. POST /api/marketing/jobs/{jobId}/cancel** - Cancelar Job

**Resposta:**
```json
{
  "jobId": "uuid",
  "status": "canceled"
}
```

---

## 🔧 WORKER/PROCESSOR (Componente Essencial)

### **Opção A: Worker Dedicado (Recomendado)**

Serviço Node.js (Railway/Render/Fly.io) que:
1. Pega jobs com `status = 'queued'`
2. Muda para `status = 'processing'`
3. Executa geração (chama provider)
4. Faz upload no Storage
5. Cria `marketing_assets`
6. Atualiza job para `done` ou `failed`

**Loop:**
```javascript
setInterval(async () => {
  const jobs = await getQueuedJobs(limit: 5);
  await Promise.all(jobs.map(processJob));
}, 5000); // A cada 5 segundos
```

### **Opção B: Netlify Scheduled Function (MVP)**

Netlify Cron a cada 1 minuto processa N jobs pendentes.

---

## 📞 CHAMADAS REAIS AOS PROVIDERS

### **6.1 Gemini: Text-to-Image (Nano Banana)**

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`

**Headers:**
```
x-goog-api-key: {GEMINI_API_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "contents": [{
    "parts": [{
      "text": "Crie um banner vertical 9:16 minimalista para promoção de verão"
    }]
  }],
  "generationConfig": {
    "responseModalities": ["Image"]
  }
}
```

**Resposta:**
- Retorna `inlineData.data` em **base64**
- Decodificar e fazer upload no Storage

### **6.2 Gemini: Text-to-Video (Veo) - Assíncrono**

**1. Criar operação:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning
```

**Body:**
```json
{
  "instances": [{
    "prompt": "Vídeo vertical 8s, loja minimalista, iluminação suave"
  }]
}
```

**Retorna:** `{name: "operations/..."}`

**2. Polling:**
```
GET https://generativelanguage.googleapis.com/v1beta/{operation_name}
```

**Quando `done = true`:**
- Extrair `response.generateVideoResponse.generatedSamples[0].video.uri`
- Download com `x-goog-api-key` header
- Upload no Storage

### **6.3 OpenAI: Image Generation (GPT Image)**

**Endpoint:** `POST https://api.openai.com/v1/images/generations`

**Body:**
```json
{
  "model": "gpt-image-001", // ou outro modelo disponível
  "prompt": "Crie um banner vertical...",
  "size": "1024x1024",
  "response_format": "b64_json" // ou "url"
}
```

**Resposta:**
- `b64_json`: base64 inline
- `url`: URL temporária (válida por tempo curto)

### **6.4 OpenAI: Video Generation (Sora - Preview)**

**1. Criar job:**
```
POST https://api.openai.com/v1/videos
Content-Type: multipart/form-data

prompt: "Wide tracking shot..."
model: "sora-2-pro"
size: "1280x720"
seconds: 8
```

**Retorna:** `{id: "video_123"}`

**2. Polling:**
```
GET https://api.openai.com/v1/videos/{video_id}
```

**Quando `status = "completed"`:**
```
GET https://api.openai.com/v1/videos/{video_id}/content
```
- Download MP4
- Upload no Storage

---

## 🎨 FRONTEND (Componentes Mínimos)

### **1. Prompt Input + Provider Selector**

```tsx
<select value={provider} onChange={...}>
  <option value="gemini">Gemini (Nano Banana/Veo)</option>
  <option value="openai">OpenAI (GPT Image/Sora)</option>
</select>

<textarea 
  value={prompt}
  placeholder="Descreva a imagem/vídeo que deseja gerar..."
/>
```

### **2. Job Status com Polling**

```tsx
const [jobId, setJobId] = useState<string | null>(null);
const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');

useEffect(() => {
  if (!jobId || status === 'done') return;
  
  const interval = setInterval(async () => {
    const response = await fetch(`/api/marketing/jobs/${jobId}`);
    const data = await response.json();
    
    setStatus(data.status);
    if (data.status === 'done') {
      setMediaUrl(data.asset.mediaUrl);
    }
  }, 5000); // Poll a cada 5s
  
  return () => clearInterval(interval);
}, [jobId, status]);
```

### **3. Renderização de Resultado**

```tsx
{status === 'done' && mediaUrl && (
  type === 'image' ? (
    <img src={mediaUrl} alt="Gerado por IA" />
  ) : (
    <video src={mediaUrl} controls playsInline />
  )
)}
```

### **4. Refresh URL Assinada (quando expirar)**

```tsx
const refreshUrl = async (assetId: string) => {
  const response = await fetch(`/api/marketing/assets/${assetId}/refresh-url`, {
    method: 'POST'
  });
  const { mediaUrl } = await response.json();
  setMediaUrl(mediaUrl);
};
```

---

## ✅ CHECKLIST PRONTO PARA PRODUÇÃO

### **Infraestrutura**
- [ ] Bucket `marketing` criado no Supabase Storage
- [ ] Políticas RLS configuradas
- [ ] Tabelas `marketing_jobs` e `marketing_assets` criadas
- [ ] Índices criados (performance)

### **Backend**
- [ ] Endpoint `POST /api/marketing/media` implementado
- [ ] Endpoint `GET /api/marketing/jobs/:id` implementado
- [ ] Endpoint `POST /api/marketing/assets/:id/refresh-url` implementado
- [ ] Endpoint `GET /api/marketing/assets` implementado
- [ ] Endpoint `POST /api/marketing/jobs/:id/cancel` implementado

### **Adapters**
- [ ] `GeminiImageAdapter` (generateContent → base64 → Storage)
- [ ] `GeminiVideoAdapter` (predictLongRunning → poll → download → Storage)
- [ ] `OpenAIImageAdapter` (GPT Image → base64/url → Storage)
- [ ] `OpenAIVideoAdapter` (Sora /v1/videos → poll → download → Storage)

### **Worker**
- [ ] Worker rodando (Railway/Render/Fly ou Netlify Cron)
- [ ] Retry/backoff implementado
- [ ] Concorrência controlada (N jobs por vez)
- [ ] Idempotência (evitar duplicatas)

### **Segurança e Limites**
- [ ] Rate limit por `store_id`
- [ ] Quotas diárias/mensais por plano
- [ ] Logs de uso/custo
- [ ] Tratamento de erros padronizado

### **Frontend**
- [ ] Componente de prompt + provider selector
- [ ] Polling de status implementado
- [ ] Renderização de imagem/vídeo
- [ ] Refresh de URL assinada
- [ ] Tratamento de erros (RATE_LIMIT, PROVIDER_ERROR, etc)

---

**Status**: ✅ Especificação técnica completa - Pronto para implementação

