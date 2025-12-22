# EleveaOne Sites - API Documentation

## Endpoints

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/elevea-sites/setup` | POST | Cria repo GitHub + vincula Netlify |
| `/elevea-sites/generate` | POST | AI gera HTML + commit + deploy |
| `/elevea-sites/update` | POST | Atualiza HTML manualmente |

---

## 1. Setup - Criar Infraestrutura

**Endpoint:** `POST /elevea-sites/setup`

### Request

```json
{
  "site_slug": "boutique-elegance",
  "site_name": "Boutique Elegance",
  "description": "Loja de moda feminina premium"
}
```

### Response

```json
{
  "success": true,
  "site_slug": "boutique-elegance",
  "site_name": "Boutique Elegance",
  "github": {
    "repo_id": 123456789,
    "full_name": "MatheusMartinsSMP/boutique-elegance",
    "url": "https://github.com/MatheusMartinsSMP/boutique-elegance"
  },
  "netlify": {
    "site_id": "abc123-def456",
    "site_name": "boutique-elegance",
    "url": "https://boutique-elegance.netlify.app",
    "admin_url": "https://app.netlify.com/sites/boutique-elegance"
  },
  "message": "Site configurado! Deploy automatico ativado."
}
```

---

## 2. Generate - Gerar Site com AI

**Endpoint:** `POST /elevea-sites/generate`

### Request Completo

```json
{
  "site_slug": "boutique-elegance",
  
  "business_type": "fisico",
  "segment_id": "moda",
  "segment_name": "Moda e Vestuario",
  "area_id": "moda-feminina",
  "area_name": "Moda Feminina",
  "custom_area": "",
  
  "company_name": "Boutique Elegance",
  "company_description": "A mais sofisticada loja de moda feminina da regiao",
  "company_history": "Fundada em 2010, a Boutique Elegance nasceu do sonho de trazer moda de alta qualidade...",
  "mission": "Vestir mulheres com elegancia e confianca",
  "vision": "Ser referencia em moda feminina no Brasil",
  "company_values": "Elegancia, Qualidade, Exclusividade",
  "products_description": "Vestidos, blusas, saias, calcas e acessorios das melhores marcas",
  "differentials": "Atendimento personalizado, pecas exclusivas, ambiente sofisticado",
  
  "whatsapp": "5511999999999",
  "phone": "1133334444",
  "email": "contato@boutique-elegance.com.br",
  "instagram": "@boutiqueelegance",
  "facebook": "boutiqueelegance",
  
  "address_full": "Rua Oscar Freire, 123 - Jardins - Sao Paulo/SP - CEP 01426-001",
  "google_maps_url": "https://maps.google.com/?q=...",
  "google_maps_embed": "<iframe src='...'></iframe>",
  "business_hours": "Seg a Sex: 10h-20h | Sab: 10h-18h",
  
  "logo_url": "https://storage.../logo.png",
  "hero_image_url": "https://storage.../hero.jpg",
  "about_image_url": "https://storage.../about.jpg",
  "product_images": [
    "https://storage.../produto1.jpg",
    "https://storage.../produto2.jpg"
  ],
  "ambient_images": [
    "https://storage.../loja1.jpg",
    "https://storage.../loja2.jpg"
  ],
  
  "color_primary": "#8B5CF6",
  "color_secondary": "#1F2937",
  "color_accent": "#10B981",
  "visual_style": "moderno"
}
```

### Response

```json
{
  "success": true,
  "site_slug": "boutique-elegance",
  "segment_id": "moda",
  "content_type": "produtos",
  "voice_tone": "elegante",
  "html_length": 15432,
  "github": {
    "commit_sha": "abc123def456...",
    "file_url": "https://github.com/MatheusMartinsSMP/boutique-elegance/blob/main/index.html"
  },
  "message": "Site gerado! O Netlify fara deploy automatico em ~30 segundos."
}
```

---

## 3. Update - Atualizar HTML Manualmente

**Endpoint:** `POST /elevea-sites/update`

### Request

```json
{
  "site_slug": "boutique-elegance",
  "html_content": "<!DOCTYPE html><html>...</html>",
  "commit_message": "Correcao de texto na secao Sobre"
}
```

### Response

```json
{
  "success": true,
  "site_slug": "boutique-elegance",
  "commit_sha": "xyz789...",
  "message": "Site atualizado! Deploy automatico em andamento."
}
```

---

## Segmentos Disponiveis

### Varejo - Produtos

| ID | Nome | Tom de Voz |
|----|------|------------|
| `moda` | Moda e Vestuario | elegante |
| `joias` | Joias e Acessorios | elegante |
| `calcados` | Calcados | dinamico |
| `esportes` | Artigos Esportivos | dinamico |
| `suplementos` | Suplementos | tecnico |
| `beleza` | Beleza e Cosmeticos | elegante |
| `alimentacao` | Alimentacao | acolhedor |
| `varejo` | Varejo Geral | popular |
| `casa` | Casa e Decoracao | elegante |
| `construcao` | Construcao e Reforma | profissional |
| `pets` | Pets | acolhedor |
| `tecnologia` | Tecnologia | tecnico |

### Servicos

| ID | Nome | Tom de Voz |
|----|------|------------|
| `advocacia` | Advocacia | profissional |
| `saude` | Saude | acolhedor |
| `contabilidade` | Contabilidade | profissional |
| `educacao` | Educacao | acolhedor |
| `imoveis` | Imobiliario | profissional |
| `eventos` | Eventos e Festas | dinamico |
| `servicos-gerais` | Servicos Gerais | profissional |

### Misto (Produtos + Servicos)

| ID | Nome | Tom de Voz |
|----|------|------------|
| `farmacia` | Farmacia e Saude | acolhedor |
| `veiculos` | Veiculos e Autopecas | profissional |
| `outros` | Outros | profissional |

---

## Areas de Atuacao por Segmento

### Moda
- moda-feminina, moda-masculina, moda-infantil, moda-plus-size
- moda-praia, moda-fitness, moda-intima, moda-noiva

### Saude (Servicos)
- dentista, ortodontista, implante, medico
- psicologia, fisioterapia, nutricao, pilates, academia-studio

### Advocacia
- adv-trabalhista, adv-familia, adv-civil, adv-criminal
- adv-empresarial, adv-previdenciario, adv-tributario

### Esportes
- academia, futebol, corrida, natacao
- ciclismo, lutas, outdoor

---

## Tons de Voz

| Tom | Descricao | Exemplo CTA |
|-----|-----------|-------------|
| `elegante` | Sofisticado, exclusivo | "Descubra a nova colecao" |
| `profissional` | Serio, confiavel | "Agende sua consulta" |
| `popular` | Acessivel, direto | "Aproveite as ofertas" |
| `tecnico` | Focado em resultados | "Otimize sua performance" |
| `acolhedor` | Caloroso, empatico | "Cuide-se com carinho" |
| `dinamico` | Energetico, motivacional | "Supere seus limites" |

---

## Tipo de Conteudo

O sistema adapta automaticamente:

| Tipo | Secao Principal | Exemplo |
|------|-----------------|---------|
| `produtos` | "Nossos Produtos" | Lojas, comercio |
| `servicos` | "Nossos Servicos" | Dentista, advogado |
| `misto` | "Produtos e Servicos" | Farmacia, pet shop |

---

## Upload de Arquivos

Os campos de imagem aceitam URLs do Supabase Storage:

1. **logo_url** - Logo da empresa
2. **hero_image_url** - Imagem principal do banner
3. **about_image_url** - Imagem da secao "Sobre"
4. **product_images[]** - Array de URLs de produtos
5. **ambient_images[]** - Array de fotos do ambiente/loja

### Fluxo de Upload

1. Frontend faz upload para Supabase Storage
2. Recebe URL publica
3. Envia URL no payload para n8n
4. AI Agent usa as URLs no HTML gerado

---

## Autenticacao

Todos os endpoints exigem Header Auth:

```
Authorization: Bearer SEU_TOKEN_N8N
```
