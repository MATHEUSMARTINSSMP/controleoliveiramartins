# 📋 Estratégia: Site Slug para Lojas

## 🎯 Decisão Implementada

**Criar automaticamente no cadastro + Permitir edição nas configurações**

### Como Funciona:

1. **Criação Automática (Trigger no Banco)**:
   - Ao criar uma loja, se `site_slug` não for fornecido, o trigger gera automaticamente baseado no nome
   - Função: `sistemaretiradas.generate_site_slug(store_name)`
   - Remove espaços, caracteres especiais, converte para minúsculas

2. **Edição Manual (Opcional)**:
   - Admin pode editar o `site_slug` no cadastro da loja
   - Campo aparece no formulário de criar/editar loja
   - Se deixar vazio, o trigger gera automaticamente

3. **Uso no WhatsApp**:
   - O `site_slug` é usado para identificar a loja no workflow n8n
   - Cada loja tem seu próprio WhatsApp usando `customer_id + site_slug`

---

## 📝 Estrutura da Tabela `stores`

```sql
ALTER TABLE sistemaretiradas.stores 
  ADD COLUMN IF NOT EXISTS site_slug VARCHAR(255);
```

- **Tipo**: `VARCHAR(255)`
- **Índice Único**: Garante que cada slug seja único
- **Obrigatório**: Não (mas trigger sempre preenche)

---

## 🔧 Migração Criada

**Arquivo**: `supabase/migrations/20251205000014_add_site_slug_to_stores.sql`

### O que faz:

1. ✅ Adiciona coluna `site_slug` na tabela `stores`
2. ✅ Cria função `generate_site_slug()` para gerar slug automaticamente
3. ✅ Cria trigger que preenche `site_slug` automaticamente se estiver vazio
4. ✅ Atualiza lojas existentes com slug baseado no nome
5. ✅ Cria índices para performance

---

## 💻 Código Frontend Atualizado

### 1. `StoreManagement.tsx`

- ✅ Interface `Store` inclui `site_slug`
- ✅ Formulário tem campo para `site_slug` (opcional)
- ✅ Gerador automático de slug quando digita o nome
- ✅ Tabela mostra o `site_slug` de cada loja

### 2. `WhatsAppStoreConfig.tsx`

- ✅ Busca `site_slug` da tabela `stores`
- ✅ Usa `store.site_slug` ou fallback para nome normalizado
- ✅ Passa `site_slug` correto para o componente `WhatsAppAuth`

---

## 🔄 Workflow n8n

### Queries que DEVEM usar `sistemaretiradas`:

1. **PostgreSQL - Get Config**:
   ```sql
   SELECT config_value as uazapi_admin_token
   FROM sistemaretiradas.uazapi_config
   WHERE config_key = 'admin_token'
   LIMIT 1;
   ```

2. **PostgreSQL - Get Token**:
   ```sql
   SELECT uazapi_admin_token, uazapi_token, uazapi_instance_id, uazapi_status
   FROM sistemaretiradas.whatsapp_credentials
   WHERE customer_id = $1 
     AND site_slug = $2 
     AND status = 'active'
   LIMIT 1;
   ```

3. **PostgreSQL - Save Credentials**:
   ```sql
   INSERT INTO sistemaretiradas.whatsapp_credentials (...)
   VALUES (...)
   ON CONFLICT (customer_id, site_slug) DO UPDATE SET ...;
   ```

---

## ✅ Vantagens desta Abordagem

1. **Automático por padrão**: Não precisa configurar nada, funciona "out of the box"
2. **Flexível**: Admin pode customizar se quiser
3. **Consistente**: Trigger garante que sempre terá um slug
4. **Único**: Índice único previne duplicatas
5. **Fácil de usar**: Frontend já está preparado

---

## 📌 Próximos Passos

1. ✅ Migração criada e pronta para executar
2. ✅ Código frontend atualizado
3. ⏳ **Executar migração no Supabase**
4. ⏳ **Atualizar queries do workflow n8n** (documentado em `CORRECAO_QUERIES_N8N.md`)

---

## 🚀 Como Usar

### Criar Nova Loja:

1. Admin vai em "Gestão de Pessoas" > "Colaboradoras & Lojas"
2. Clica em "Nova Loja"
3. Digita o nome (ex: "Loja Centro")
4. O `site_slug` será gerado automaticamente (ex: "loja-centro")
5. Pode editar o slug se quiser customizar
6. Salva

### Configurar WhatsApp:

1. O `site_slug` já está na tabela
2. Ao configurar WhatsApp, usa automaticamente o `site_slug` da loja
3. Workflow n8n busca credenciais usando `customer_id + site_slug`

---

## 📚 Arquivos Modificados

- ✅ `supabase/migrations/20251205000014_add_site_slug_to_stores.sql`
- ✅ `src/components/admin/StoreManagement.tsx`
- ✅ `src/components/admin/WhatsAppStoreConfig.tsx`
- ✅ `CORRECAO_QUERIES_N8N.md` (documentação)

