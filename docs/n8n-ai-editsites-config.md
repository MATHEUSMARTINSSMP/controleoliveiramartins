# Configuracao n8n - AI Edit Sites

## 1. NODE "Preparar Contexto Execute" - CODIGO COMPLETO

Copie e cole este codigo no node "Preparar Contexto Execute":

```javascript
// Preparar contexto completo para edicao
// CORRIGIDO: Acessa dados do node correto e inclui imagens

const htmlData = $('Processar HTML').item.json;
// CORRIGIDO: Usa o node "Extrair Dados Execute1" que contem todos os dados extraidos
const siteData = $('Extrair Dados Execute1').item.json;
const filesNode = $('List Files');

// LOG para debug - ver o que esta chegando
console.log('=== DEBUG IMAGENS ===');
console.log('logo_url recebido:', siteData.logo_url);
console.log('hero_image_url recebido:', siteData.hero_image_url);
console.log('assets recebido:', JSON.stringify(siteData.assets || []).substring(0, 200));

// Formatar lista de arquivos do repositorio
let filesArray = [];
if (filesNode && filesNode.all) {
  const filesItems = filesNode.all();
  filesArray = filesItems.flatMap(item => {
    const data = item.json;
    if (Array.isArray(data)) return data;
    return [data];
  });
}

// Separar imagens do repositorio
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
const allFiles = filesArray
  .filter(file => file && file.path)
  .map(file => ({
    path: file.path,
    name: file.name || file.path.split('/').pop(),
    type: file.type || 'file',
    sha: file.sha || ''
  }));

const imageFiles = allFiles.filter(f => 
  imageExtensions.some(ext => f.path.toLowerCase().endsWith(ext))
);

// =====================================================
// FUNCOES DE FORMATACAO
// =====================================================

// Formatar horarios de funcionamento
const formatBusinessHours = (businessHours) => {
  if (!businessHours || Object.keys(businessHours).length === 0) return 'Nao informado';
  const days = {
    monday: 'Segunda-feira',
    tuesday: 'Terca-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sabado',
    sunday: 'Domingo'
  };
  return Object.entries(businessHours)
    .map(([day, hours]) => {
      const label = days[day] || day;
      if (!hours || hours.closed || (hours.open === '00:00' && hours.close === '00:00')) {
        return `- ${label}: Fechado`;
      }
      return `- ${label}: ${hours.open} as ${hours.close}`;
    })
    .join('\n');
};

// Formatar produtos em destaque
const formatProducts = (products) => {
  if (!products || products.length === 0) return 'Nenhum produto cadastrado';
  return products.map((p, i) => 
    `${i+1}. ${p.name}${p.price ? ` - ${p.price}` : ''}${p.description ? `: ${p.description}` : ''}`
  ).join('\n');
};

// Formatar servicos em destaque
const formatServices = (services) => {
  if (!services || services.length === 0) return 'Nenhum servico cadastrado';
  return services.map((s, i) => 
    `${i+1}. ${s.name}${s.price ? ` - ${s.price}` : ''}${s.description ? `: ${s.description}` : ''}`
  ).join('\n');
};

// Formatar depoimentos
const formatTestimonials = (testimonials) => {
  if (!testimonials || testimonials.length === 0) return 'Nenhum depoimento cadastrado';
  return testimonials.map(t => 
    `"${t.text}" - ${t.name}${t.role ? `, ${t.role}` : ''}`
  ).join('\n\n');
};

// Montar endereco completo
const formatAddress = (data) => {
  if (data.address_full) return data.address_full;
  if (data.address_street) {
    return `${data.address_street}, ${data.address_number || 'S/N'}${data.address_complement ? ` - ${data.address_complement}` : ''}, ${data.address_neighborhood || ''}, ${data.address_city || ''} - ${data.address_state || ''}, CEP: ${data.address_zip || ''}`;
  }
  return 'Nao informado';
};

// Formatar assets enviados pelo frontend
const formatAssets = (assets) => {
  if (!assets || assets.length === 0) return 'Nenhum asset enviado pelo frontend';
  return assets.map(a => {
    const hasBase64 = a.base64 ? ' [COM BASE64]' : ' [URL]';
    const urlPreview = a.base64 
      ? `data:image/...${a.base64.substring(0, 30)}...` 
      : (a.url || 'sem url');
    return `- ${a.type || 'unknown'}: ${urlPreview}${hasBase64}`;
  }).join('\n');
};

// =====================================================
// PREPARAR DADOS DE IMAGENS - CRITICO!
// =====================================================

// Funcao para extrair URL valida de um asset ou campo
const getValidImageUrl = (assets, type, fallbackUrl) => {
  if (assets && Array.isArray(assets)) {
    const asset = assets.find(a => a.type === type);
    if (asset) {
      // Prioridade: base64 > url (se nao for blob)
      if (asset.base64 && asset.base64.length > 0) {
        // Se base64 ja tem o prefixo data:image, use direto
        if (asset.base64.startsWith('data:image')) {
          return asset.base64;
        }
        // Senao, adicione o prefixo
        return `data:image/webp;base64,${asset.base64}`;
      }
      if (asset.url && !asset.url.startsWith('blob:')) {
        return asset.url;
      }
    }
  }
  // Fallback para URL direta (se nao for blob)
  if (fallbackUrl && !fallbackUrl.startsWith('blob:')) {
    return fallbackUrl;
  }
  return '';
};

// Assets do frontend
const assets = Array.isArray(siteData.assets) ? siteData.assets : [];

// Imagens principais - extrair corretamente
const logo_url = getValidImageUrl(assets, 'logo', siteData.logo_url);
const hero_image_url = getValidImageUrl(assets, 'hero', siteData.hero_image_url);
const about_image_url = siteData.about_image_url || '';

// Arrays de imagens
const gallery_images = Array.isArray(siteData.gallery_images) 
  ? siteData.gallery_images.filter(url => url && !url.startsWith('blob:'))
  : [];
const product_images = Array.isArray(siteData.product_images) 
  ? siteData.product_images.filter(url => url && !url.startsWith('blob:'))
  : [];
const ambient_images = Array.isArray(siteData.ambient_images) 
  ? siteData.ambient_images.filter(url => url && !url.startsWith('blob:'))
  : [];

// LOG apos processamento
console.log('=== IMAGENS PROCESSADAS ===');
console.log('logo_url final:', logo_url ? logo_url.substring(0, 80) + '...' : 'VAZIO');
console.log('hero_image_url final:', hero_image_url ? hero_image_url.substring(0, 80) + '...' : 'VAZIO');

// Limpar WhatsApp para link
const whatsappClean = (siteData.whatsapp || '').replace(/\D/g, '');

// Mensagem CTA codificada
const ctaMessageEncoded = encodeURIComponent(siteData.cta_whatsapp_message || 'Ola! Vim pelo site.');

// =====================================================
// CRIAR INVENTARIO DE IMAGENS DISPONIVEIS
// =====================================================
let imageInventory = '=== IMAGENS DISPONIVEIS PARA USO ===\n\n';

if (logo_url) {
  const logoPreview = logo_url.startsWith('data:') 
    ? 'data:image/...[BASE64]' 
    : logo_url;
  imageInventory += `LOGO:\n- URL: ${logoPreview.substring(0, 100)}${logoPreview.length > 100 ? '...' : ''}\n- USAR NO HTML: <img src="${logo_url.substring(0, 50)}..." alt="Logo">\n\n`;
}

if (hero_image_url) {
  const heroPreview = hero_image_url.startsWith('data:') 
    ? 'data:image/...[BASE64]' 
    : hero_image_url;
  imageInventory += `HERO/BANNER:\n- URL: ${heroPreview.substring(0, 100)}${heroPreview.length > 100 ? '...' : ''}\n\n`;
}

if (gallery_images.length > 0) {
  imageInventory += `GALERIA (${gallery_images.length} imagens):\n`;
  gallery_images.forEach((img, i) => {
    if (img) imageInventory += `- Imagem ${i+1}: ${img.substring(0, 80)}...\n`;
  });
  imageInventory += '\n';
}

if (product_images.length > 0) {
  imageInventory += `PRODUTOS (${product_images.length} imagens):\n`;
  product_images.forEach((img, i) => {
    if (img) imageInventory += `- Produto ${i+1}: ${img.substring(0, 80)}...\n`;
  });
  imageInventory += '\n';
}

if (ambient_images.length > 0) {
  imageInventory += `AMBIENTE (${ambient_images.length} imagens):\n`;
  ambient_images.forEach((img, i) => {
    if (img) imageInventory += `- Ambiente ${i+1}: ${img.substring(0, 80)}...\n`;
  });
  imageInventory += '\n';
}

if (assets.length > 0) {
  imageInventory += `ASSETS ESTRUTURADOS (${assets.length}):\n${formatAssets(assets)}\n\n`;
}

imageInventory += `\nARQUIVOS NO REPOSITORIO GITHUB:\n${imageFiles.map(f => f.path).join('\n') || 'Nenhum arquivo de imagem no repositorio'}`;

// =====================================================
// RETORNO FINAL
// =====================================================
return {
  json: {
    // === DADOS DO SITE (para o Agent) ===
    siteSlug: htmlData.siteSlug,
    siteName: htmlData.siteName,
    command: siteData.command || htmlData.command,
    githubOwner: htmlData.githubOwner,
    githubRepo: htmlData.githubRepo,
    githubFullName: htmlData.githubFullName,
    githubBranch: htmlData.githubBranch || 'main',
    
    // HTML atual
    currentHtml: htmlData.currentHtml,
    currentHtmlLength: htmlData.currentHtmlLength,
    fileSha: htmlData.fileSha,
    
    // === DADOS ATUALIZADOS DA EMPRESA ===
    company_name: siteData.company_name || htmlData.siteName,
    slogan: siteData.slogan || '',
    tagline: siteData.tagline || '',
    company_description: siteData.company_description || '',
    company_history: siteData.company_history || '',
    mission: siteData.mission || '',
    vision: siteData.vision || '',
    company_values: siteData.company_values || '',
    differentials: siteData.differentials || '',
    founding_year: siteData.founding_year || '',
    team_size: siteData.team_size || '',
    awards: siteData.awards || '',
    certifications: siteData.certifications || '',
    
    // Produtos e Servicos
    services_description: siteData.services_description || '',
    products_description: siteData.products_description || '',
    featured_products: siteData.featured_products || [],
    featured_services: siteData.featured_services || [],
    testimonials: siteData.testimonials || [],
    featured_products_formatted: formatProducts(siteData.featured_products),
    featured_services_formatted: formatServices(siteData.featured_services),
    testimonials_formatted: formatTestimonials(siteData.testimonials),
    
    // Contato
    whatsapp: siteData.whatsapp || '',
    whatsapp_clean: whatsappClean,
    phone: siteData.phone || '',
    email: siteData.email || '',
    instagram: siteData.instagram || '',
    facebook: siteData.facebook || '',
    tiktok: siteData.tiktok || '',
    youtube: siteData.youtube || '',
    linkedin: siteData.linkedin || '',
    website: siteData.website || '',
    
    // Endereco
    address_full: formatAddress(siteData),
    address_street: siteData.address_street || '',
    address_number: siteData.address_number || '',
    address_complement: siteData.address_complement || '',
    address_neighborhood: siteData.address_neighborhood || '',
    address_city: siteData.address_city || '',
    address_state: siteData.address_state || '',
    address_zip: siteData.address_zip || '',
    google_maps_embed: siteData.google_maps_embed || '',
    google_maps_url: siteData.google_maps_url || '',
    
    // Horarios
    business_hours: siteData.business_hours || {},
    business_hours_formatted: formatBusinessHours(siteData.business_hours),
    
    // Cores
    color_primary: siteData.color_primary || '#8B5CF6',
    color_secondary: siteData.color_secondary || '#1F2937',
    color_accent: siteData.color_accent || '#10B981',
    color_background: siteData.color_background || '#FFFFFF',
    
    // =====================================================
    // IMAGENS - CRITICO PARA A IA
    // =====================================================
    logo_url: logo_url,
    hero_image_url: hero_image_url,
    about_image_url: about_image_url,
    gallery_images: JSON.stringify(gallery_images),
    product_images: JSON.stringify(product_images),
    ambient_images: JSON.stringify(ambient_images),
    assets: JSON.stringify(assets),
    
    // Inventario formatado para a IA entender
    imageInventory: imageInventory,
    
    // CTA
    cta_button_text: siteData.cta_button_text || 'Fale Conosco',
    cta_whatsapp_message: siteData.cta_whatsapp_message || 'Ola! Vim pelo site.',
    cta_message_encoded: ctaMessageEncoded,
    
    // Inventario de assets do repositorio GitHub
    images: imageFiles,
    imagesCount: imageFiles.length,
    allFiles: allFiles,
    totalFilesCount: allFiles.length,
    assetsInventory: imageFiles.map(f => f.path).join('\n')
  }
};
```

---

## 2. NODE "AI Agent Execute" - SYSTEM MESSAGE COMPLETO

Copie e cole este texto no campo "System Message" do AI Agent:

```
Voce e um editor especialista em HTML que faz modificacoes CIRURGICAS em sites existentes.

## REGRAS ABSOLUTAS - NUNCA VIOLE

1. **PRESERVACAO TOTAL**: Voce recebe o HTML completo atual do site. NUNCA delete secoes, elementos ou codigo que NAO foram mencionados no comando do usuario.
2. **EDICAO MINIMA**: Altere APENAS o que foi explicitamente solicitado. Se o usuario pedir "mudar o slogan", voce altera SOMENTE o texto do slogan - nada mais.
3. **RETORNO COMPLETO**: SEMPRE retorne o HTML COMPLETO do site, incluindo todo o codigo original com as modificacoes aplicadas.
4. **SEM REESCRITA**: Voce NAO esta criando um novo site. Voce esta EDITANDO um site existente.
5. **PRESERVAR ESTRUTURA**: Mantenha exatamente todas as tags HTML, estilos CSS, scripts JavaScript, comentarios e formatacao.
6. **NOME DA EMPRESA**: NUNCA abrevie ou corte o nome da empresa. Use sempre o nome completo.
7. **USAR DADOS ATUALIZADOS**: Quando o comando mencionar atualizar informacoes, use os valores dos DADOS ATUALIZADOS DA EMPRESA.

## INSTRUCOES CRITICAS PARA IMAGENS

### CAMPOS DE IMAGEM QUE VOCE RECEBE:
- logo_url: URL ou Base64 da logo da empresa
- hero_image_url: URL ou Base64 da imagem principal/banner
- gallery_images: Array JSON com URLs das imagens da galeria
- product_images: Array JSON com URLs das imagens de produtos
- ambient_images: Array JSON com URLs das imagens de ambiente

### COMO ADICIONAR A LOGO:

Quando o usuario pedir para "adicionar logo", "colocar logo", "usar logo", "atualizar logo":

1. VERIFIQUE se o campo logo_url tem valor (nao esta vazio)
2. Se logo_url contiver uma URL (comecando com http ou https) OU uma imagem Base64 (comecando com data:image), VOCE DEVE USAR ESSE VALOR
3. Localize o elemento de logo no header (geralmente <a class="logo"> ou similar)
4. SUBSTITUA o conteudo por uma tag <img> assim:

```html
<a href="/" class="logo">
  <img src="COLE_AQUI_O_VALOR_COMPLETO_DE_logo_url" alt="Nome da Empresa" style="max-height: 60px; width: auto; object-fit: contain;">
</a>
```

EXEMPLO COM URL:
Se logo_url = "https://i.imgur.com/fouaCOL.png"
Resultado:
```html
<a href="/" class="logo">
  <img src="https://i.imgur.com/fouaCOL.png" alt="Loungerie" style="max-height: 60px; width: auto; object-fit: contain;">
</a>
```

EXEMPLO COM BASE64:
Se logo_url = "data:image/webp;base64,UklGRhYAAABXRU..."
Resultado:
```html
<a href="/" class="logo">
  <img src="data:image/webp;base64,UklGRhYAAABXRU..." alt="Loungerie" style="max-height: 60px; width: auto; object-fit: contain;">
</a>
```

### COMO ADICIONAR HERO/BANNER:

Quando o usuario pedir para adicionar/atualizar banner, hero, imagem principal:

1. VERIFIQUE se hero_image_url tem valor
2. Use como background-image na secao hero:

```html
<section class="hero" style="background-image: url('COLE_AQUI_hero_image_url'); background-size: cover; background-position: center; min-height: 500px;">
```

### REGRAS ABSOLUTAS PARA IMAGENS:

1. **NUNCA** diga "nao foi possivel adicionar a imagem" se voce recebeu uma URL valida
2. Se logo_url ou hero_image_url contem QUALQUER valor (URL ou Base64), USE ESSE VALOR
3. Copie a URL/Base64 EXATAMENTE como ela aparece, sem modificar
4. URLs que comecam com "data:image/" sao imagens Base64 validas - use diretamente no src
5. Se o usuario pedir para adicionar uma imagem e voce tem a URL disponivel, ADICIONE A IMAGEM

## ELEMENTOS PADRAO

### BOTAO WHATSAPP FLUTUANTE:
```html
<a href="https://wa.me/55NUMERO?text=MENSAGEM" target="_blank" class="whatsapp-float" aria-label="Falar no WhatsApp">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.789l4.89-1.56A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.137 0-4.146-.664-5.816-1.8l-.416-.262-3.015.965.897-2.903-.287-.456A9.946 9.946 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
</a>
```

CSS obrigatorio:
```css
.whatsapp-float { position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; background: #25D366; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; transition: transform 0.3s; text-decoration: none; }
.whatsapp-float:hover { transform: scale(1.1); }
```

## FORMATO DE RESPOSTA

Responda APENAS com um JSON no formato:

```json
{
  "success": true,
  "section": "header|hero|about|contact|footer|general",
  "action": "update_text|update_style|add_element|add_image",
  "reasoning": "Breve explicacao do que foi alterado",
  "changes_made": ["Lista das alteracoes especificas feitas"],
  "html": "O HTML COMPLETO DO SITE COM AS ALTERACOES"
}
```

## VALIDACAO ANTES DE RETORNAR

Verifique:
- HTML esta completo (nao falta nenhuma secao original)
- Apenas o que foi solicitado foi alterado
- Se pediu para adicionar imagem e tinha URL, a imagem FOI adicionada
- Nome da empresa esta completo (nao abreviado)
- Todas as tags estao fechadas corretamente
```

---

## 3. NODE "AI Agent Execute" - PROMPT TEXT

No campo de Prompt/User Message do AI Agent, use:

```
COMANDO DO USUARIO:
{{ $json.command }}

---

DADOS ATUALIZADOS DA EMPRESA:
Nome: {{ $json.company_name }}
Slogan: {{ $json.slogan }}
Tagline: {{ $json.tagline }}
Descricao: {{ $json.company_description }}
WhatsApp: {{ $json.whatsapp }} (limpo: {{ $json.whatsapp_clean }})
Email: {{ $json.email }}
Instagram: {{ $json.instagram }}
Endereco: {{ $json.address_full }}
Horarios: {{ $json.business_hours_formatted }}
Cor Primaria: {{ $json.color_primary }}

---

IMAGENS DISPONIVEIS PARA USO:
Logo: {{ $json.logo_url }}
Hero/Banner: {{ $json.hero_image_url }}
Galeria: {{ $json.gallery_images }}
Produtos: {{ $json.product_images }}
Ambiente: {{ $json.ambient_images }}

IMPORTANTE: Se algum campo de imagem acima contiver uma URL (http/https) ou Base64 (data:image), USE essa URL/Base64 no src da tag <img> quando o usuario solicitar.

---

HTML ATUAL DO SITE ({{ $json.currentHtmlLength }} caracteres):
{{ $json.currentHtml }}

---

INFORMACOES DO REPOSITORIO:
Owner: {{ $json.githubOwner }}
Repo: {{ $json.githubRepo }}
Branch: {{ $json.githubBranch }}
File SHA: {{ $json.fileSha }}

Aplique as alteracoes solicitadas e retorne o JSON com o HTML completo modificado.
```

---

## COMO TESTAR

1. Adicione a logo pelo campo URL no dashboard (use https://i.imgur.com/fouaCOL.png)
2. Clique em "Editar com IA" e digite: "adicionar a logo no header"
3. Verifique no n8n:
   - No output de "Preparar Contexto Execute", o campo `logo_url` deve ter a URL
   - A IA deve adicionar a tag `<img src="https://i.imgur.com/fouaCOL.png" ...>`
4. Se ainda nao funcionar, verifique os logs no node de Code para ver os console.log
