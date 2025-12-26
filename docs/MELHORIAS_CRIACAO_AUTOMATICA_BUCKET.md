# 🚀 Melhorias: Criação Automática do Bucket e Organização por Site Slug

## ✅ O que foi implementado

### 1. **Criação Automática do Bucket**
- ✅ O bucket `marketing` é criado automaticamente quando necessário
- ✅ Não é mais necessário criar manualmente no Supabase Dashboard
- ✅ Retry automático se houver erro temporário
- ✅ Tratamento robusto de erros (ignora "already exists")

### 2. **Organização por `site_slug`**
- ✅ Arquivos organizados por `site_slug` quando disponível
- ✅ Fallback para `store_id` se `site_slug` não existir
- ✅ Estrutura mais legível e organizada

### 3. **Função Utilitária Compartilhada**
- ✅ Criado `src/lib/storage/ensure-bucket.ts` com funções reutilizáveis:
  - `ensureMarketingBucket()`: Garante que o bucket existe
  - `getStoreIdentifier()`: Obtém `site_slug` ou `store_id`

### 4. **Atualizações nos Módulos**

#### `src/lib/storage/upload-media.ts`
- ✅ Chama `ensureMarketingBucket()` antes de cada upload
- ✅ Usa `getStoreIdentifier()` para obter `site_slug`
- ✅ Retry automático se bucket não encontrado

#### `netlify/functions/marketing-worker.js`
- ✅ Função `ensureMarketingBucket()` melhorada
- ✅ Função `getStoreIdentifier()` adicionada
- ✅ Path usa `site_slug` quando disponível
- ✅ Tratamento robusto de erros

## 📁 Estrutura de Pastas

**Antes:**
```
marketing/
  └── {uuid-store-id}/
      └── {user_id}/
          └── image/
```

**Agora:**
```
marketing/
  └── {site_slug ou store_id}/
      └── {user_id}/
          └── {image|video}/
              └── {ano}/
                  └── {mês}/
                      └── {asset_id}.{ext}
```

**Exemplo real:**
```
marketing/
  └── mrkitsch/          ← site_slug (legível!)
      └── 7391610a-.../
          └── image/
              └── 2025/
                  └── 12/
                      └── abc123.png
```

## 🔄 Fluxo Automático

1. **Usuário gera imagem/vídeo**
2. **Sistema verifica se bucket existe**
   - Se não existe → cria automaticamente
   - Se existe → continua
3. **Sistema busca `site_slug` da loja**
   - Se existe → usa `site_slug`
   - Se não existe → usa `store_id`
4. **Upload do arquivo**
   - Se erro "Bucket not found" → retry após criar bucket
5. **Arquivo salvo na estrutura organizada**

## 🛡️ Tratamento de Erros

### Erros tratados automaticamente:
- ✅ Bucket não existe → cria automaticamente
- ✅ Bucket já existe (criado por outro processo) → ignora erro
- ✅ Erro temporário de listagem → tenta criar diretamente
- ✅ "Bucket not found" após criação → retry automático

### Logs informativos:
- ✅ `[ensureMarketingBucket] ✅ Bucket "marketing" já existe`
- ✅ `[ensureMarketingBucket] ✅ Bucket "marketing" criado com sucesso`
- ✅ `[getStoreIdentifier] Usando site_slug: mrkitsch`
- ✅ `[getStoreIdentifier] Usando store_id como fallback`

## 📝 Arquivos Modificados

1. **Novo**: `src/lib/storage/ensure-bucket.ts`
   - Funções utilitárias compartilhadas

2. **Atualizado**: `src/lib/storage/upload-media.ts`
   - Integração com criação automática
   - Uso de `site_slug`

3. **Atualizado**: `netlify/functions/marketing-worker.js`
   - Função `getStoreIdentifier()` adicionada
   - Path usa `site_slug`
   - Tratamento de erros melhorado

4. **Atualizado**: `docs/CRIAR_BUCKET_MARKETING.md`
   - Documentação atualizada para refletir criação automática

## 🎯 Benefícios

1. **Zero Configuração Manual**: Não precisa criar bucket manualmente
2. **Organização Melhor**: Arquivos por `site_slug` (mais legível)
3. **Robustez**: Retry automático e tratamento de erros
4. **Manutenibilidade**: Código reutilizável e bem documentado

## 🧪 Como Testar

1. **Deletar o bucket** (se existir) no Supabase Dashboard
2. **Gerar uma imagem** no sistema
3. **Verificar logs** no Netlify Functions:
   - Deve aparecer: `[marketing-worker] Bucket "marketing" não encontrado, criando...`
   - Depois: `[marketing-worker] ✅ Bucket "marketing" criado com sucesso`
4. **Verificar estrutura** no Supabase Storage:
   - Deve estar organizado por `site_slug` (ex: `mrkitsch/`)

## ⚠️ Notas Importantes

- O bucket só é criado quando você gera a primeira imagem/vídeo
- Se você ainda não gerou nenhum conteúdo, o bucket pode não existir (isso é normal)
- A criação automática requer permissões de `SERVICE_ROLE_KEY`
- Se houver problemas de permissão, você pode criar manualmente (veja `docs/CRIAR_BUCKET_MARKETING.md`)

