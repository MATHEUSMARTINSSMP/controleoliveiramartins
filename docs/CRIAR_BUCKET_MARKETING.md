# 📦 Bucket "marketing" no Supabase Storage

O bucket `marketing` é necessário para armazenar as imagens e vídeos gerados pelo módulo de marketing.

## ✅ Criação Automática (Padrão)

**O sistema cria o bucket automaticamente quando necessário!** Não é necessário fazer nada manualmente.

### Como funciona:

1. **Primeira geração de imagem/vídeo**: O sistema detecta que o bucket não existe
2. **Criação automática**: O bucket é criado automaticamente com as configurações corretas:
   - Nome: `marketing`
   - Público: ✅ Sim (para imagens públicas)
   - Tamanho máximo: 50 MB
   - Tipos permitidos: PNG, JPEG, WebP, MP4, WebM
3. **Organização por `site_slug`**: Os arquivos são organizados por `site_slug` da loja (quando disponível), facilitando a navegação

### Estrutura de pastas:

```
marketing/
  └── {site_slug ou store_id}/
      └── {user_id}/
          └── {image|video}/
              └── {ano}/
                  └── {mês}/
                      └── {asset_id}.{ext}
```

**Exemplo:**
```
marketing/
  └── mrkitsch/
      └── 7391610a-f83b-4727-875f-81299b8bfa68/
          └── image/
              └── 2025/
                  └── 12/
                      └── abc123.png
```

### Retry automático:

Se houver algum erro temporário (ex: bucket ainda não visível após criação), o sistema tenta novamente automaticamente.

## 🔧 Criação Manual (Opcional - Apenas se necessário)

Se por algum motivo a criação automática falhar, você pode criar manualmente:

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Storage** → **Buckets**
4. Clique em **New bucket**
5. Configure:
   - **Name**: `marketing`
   - **Public bucket**: ✅ Sim (para imagens públicas)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: 
     - `image/png`
     - `image/jpeg`
     - `image/jpg`
     - `image/webp`
     - `video/mp4`
     - `video/webm`
6. Clique em **Create bucket**

## 🔧 Criação via API (Script - Opcional)

Execute este script Node.js para criar o bucket:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMarketingBucket() {
  const { data, error } = await supabase.storage.createBucket('marketing', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'video/mp4',
      'video/webm'
    ],
  });

  if (error) {
    console.error('Erro ao criar bucket:', error);
  } else {
    console.log('Bucket "marketing" criado com sucesso!');
  }
}

createMarketingBucket();
```

## ✅ Verificação

Para verificar se o bucket foi criado automaticamente:

1. No Supabase Dashboard, vá em **Storage** → **Buckets**
2. Verifique se o bucket `marketing` aparece na lista
3. Tente gerar uma imagem no sistema - ela deve aparecer automaticamente

**Nota**: O bucket só é criado quando você gera a primeira imagem/vídeo. Se você ainda não gerou nenhum conteúdo, o bucket pode não existir ainda (e isso é normal).

## 🔒 Políticas de Acesso

O bucket deve ter as seguintes políticas:

- **Imagens**: Públicas (qualquer um pode ler)
- **Vídeos**: Privados (requerem URL assinada)

O sistema gerencia essas políticas automaticamente.

