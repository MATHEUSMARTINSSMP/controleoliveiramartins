# Guia Completo - Modulo WhatsApp Campaigns

## Visao Geral

O modulo de Campanhas WhatsApp permite:
- Criar campanhas de mensagens em massa
- Filtrar clientes via CRM (tabela `sales` unificada)
- Importar planilhas personalizadas (CSV/XLSX)
- Gerar variacoes de mensagens com IA (Gemini/OpenAI)
- Rotacao de numeros WhatsApp
- Monitoramento de risco de banimento
- Processamento de fila com throttling

---

## PARTE 1: SUPABASE (Banco de Dados)

### 1.1 Executar a Migration

Execute no SQL Editor do Supabase:

```sql
-- Arquivo: supabase/migrations/20251217200000_create_whatsapp_campaigns_module.sql
```

Esta migration cria:
- `whatsapp_accounts` - Contas WhatsApp conectadas
- `whatsapp_campaigns` - Campanhas
- `whatsapp_campaign_templates` - Templates de mensagens
- `whatsapp_campaign_messages` - Fila de mensagens
- `whatsapp_campaign_events` - Log de eventos
- `whatsapp_campaign_recipient_snapshots` - Snapshot de destinatarios

### 1.2 Executar as Funcoes RPC

Se a migration der erro nas policies, execute apenas as funcoes:

```sql
-- Arquivo: docs/sql-only-functions.sql
```

Funcoes criadas:
- `get_crm_customer_stats(p_store_id)` - Estatisticas CRM
- `get_next_campaign_messages(p_limit)` - Fila de envio
- `calculate_campaign_risk(...)` - Calculo de risco

### 1.3 Verificar Tabela Sales

A funcao CRM le da tabela `sistemaretiradas.sales`. Verifique se existe:

```sql
SELECT COUNT(*) FROM sistemaretiradas.sales WHERE store_id IS NOT NULL;
```

---

## PARTE 2: N8N (Automacao)

### 2.1 Credenciais Necessarias

Crie estas credenciais no n8n:

#### A) Postgres (Supabase)
- **Tipo**: Postgres
- **Name**: `Supabase DB`
- **Host**: `db.SEU-PROJETO.supabase.co`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: (senha do banco)
- **Port**: `5432`
- **SSL**: `Allow`

#### B) Gemini API
- **Tipo**: HTTP Query Auth
- **Name**: `Gemini API Key`
- **Parameter Name**: `key`
- **Parameter Value**: (sua chave API do Google AI Studio)

#### C) uazapi WhatsApp
- **Tipo**: HTTP Header Auth
- **Name**: `uazapi`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer SEU_TOKEN_UAZAPI`

### 2.2 Variaveis de Ambiente (n8n)

Configure em Settings > Variables:

| Variavel | Valor |
|----------|-------|
| `SUPABASE_URL` | https://seu-projeto.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | sua-service-role-key |

### 2.3 Importar Workflow

1. Abra n8n
2. Clique em "Import from File"
3. Selecione: `docs/n8n-whatsapp-campaigns-workflow.json`
4. Conecte as credenciais em cada node

### 2.4 Acoes Disponiveis

| Acao | Descricao | Payload |
|------|-----------|---------|
| `generate_variations` | Gera variacoes IA | `{action, store_id, data: {base_template, campaign_context}}` |
| `send_message` | Envia WhatsApp | `{action, data: {phone, message, instance_id}}` |
| `get_crm_stats` | Estatisticas CRM | `{action, store_id}` |
| `get_contacts_by_filter` | Contatos filtrados | `{action, store_id, data: {filters: {inactive_days, category, ...}}}` |
| `process_queue` | Processa fila | `{action}` |
| `update_campaign_status` | Atualiza status | `{action, campaign_id, data: {new_status}}` |
| `ai_chat` | Chat com IA | `{action, data: {user_message}, session_id}` |
| `analyze_crm` | Analise CRM | `{action, store_id, data: {campaign_objective}}` |

### 2.5 Exemplos de Requisicao

```bash
# Gerar variacoes
curl -X POST https://seu-n8n.app/webhook/whatsapp-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_variations",
    "store_id": "uuid-da-loja",
    "data": {
      "base_template": "Ola {primeiro_nome}! Sentimos sua falta.",
      "campaign_context": "Reativacao de clientes inativos ha 60 dias"
    }
  }'

# Buscar estatisticas CRM
curl -X POST https://seu-n8n.app/webhook/whatsapp-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_crm_stats",
    "store_id": "uuid-da-loja"
  }'

# Filtrar contatos
curl -X POST https://seu-n8n.app/webhook/whatsapp-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_contacts_by_filter",
    "store_id": "uuid-da-loja",
    "data": {
      "filters": {
        "inactive_days": 60,
        "category": "VIP",
        "min_ticket": 500
      }
    }
  }'

# Chat com IA
curl -X POST https://seu-n8n.app/webhook/whatsapp-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ai_chat",
    "session_id": "session_123",
    "data": {
      "user_message": "Me sugira uma estrategia para reativar clientes BLACK inativos"
    }
  }'
```

---

## PARTE 3: FRONTEND (React)

### 3.1 Variaveis de Ambiente

No arquivo `.env` ou Secrets do Replit:

```env
VITE_N8N_BASE_URL=https://seu-n8n.app
VITE_N8N_AUTH_HEADER=Bearer seu-token-n8n (se usar autenticacao)
VITE_N8N_MODE=production
```

### 3.2 Componentes Criados

| Arquivo | Descricao |
|---------|-----------|
| `CampaignWizard.tsx` | Wizard principal de 4 passos |
| `steps/FilterStep.tsx` | Passo 1: Filtros CRM ou Import |
| `steps/TemplateStep.tsx` | Passo 2: Template + Variacoes IA |
| `steps/ScheduleStep.tsx` | Passo 3: Agendamento + Risco |
| `steps/ReviewStep.tsx` | Passo 4: Revisao final |
| `types.ts` | Tipos TypeScript |

### 3.3 Fluxo do Wizard

```
1. FilterStep
   - Escolhe: Filtros CRM OU Importar Planilha
   - Se CRM: seleciona filtros (dias inativos, categoria, ticket)
   - Se Import: upload CSV/XLSX com primeiro_nome + telefone

2. TemplateStep
   - Escreve template base com variaveis
   - Clica "Gerar Variacoes com IA"
   - Aprova variacoes geradas

3. ScheduleStep
   - Define limite diario, intervalo, rotacao
   - Ve matriz de risco (LOW/MEDIUM/HIGH)
   - Configura horarios e dias

4. ReviewStep
   - Revisa tudo
   - Cria campanha
```

---

## PARTE 4: FILTROS CRM

### 4.1 Filtros Disponiveis

| Filtro | Tipo | Exemplo |
|--------|------|---------|
| `inactive_days` | Dias sem comprar | `60` |
| `category` | Categoria cliente | `BLACK`, `PLATINUM`, `VIP`, `REGULAR` |
| `min_ticket` | Ticket medio minimo | `500` |
| `max_ticket` | Ticket medio maximo | `2000` |
| `min_purchases` | Minimo de compras | `3` |
| `top_spenders` | Top X por faturamento | `100` |

### 4.2 Categorias de Cliente

| Categoria | Criterio |
|-----------|----------|
| BLACK | Total gasto >= R$ 5.000 |
| PLATINUM | Total gasto >= R$ 2.000 |
| VIP | Total gasto >= R$ 500 |
| REGULAR | Total gasto < R$ 500 |

### 4.3 Variaveis de Template

Use nas mensagens:

| Variavel | Descricao |
|----------|-----------|
| `{primeiro_nome}` | Primeiro nome do cliente |
| `{nome_completo}` | Nome completo |
| `{ultima_compra}` | Data ultima compra |
| `{dias_sem_comprar}` | Dias desde ultima compra |
| `{total_gasto}` | Total gasto historico |
| `{categoria}` | BLACK/PLATINUM/VIP/REGULAR |
| `{loja}` | Nome da loja |

---

## PARTE 5: MATRIZ DE RISCO

### 5.1 Calculo

O risco e calculado baseado em:
- Limite diario de envios
- Intervalo entre mensagens
- Uso de rotacao de numeros

### 5.2 Niveis

| Nivel | Cor | Recomendacao |
|-------|-----|--------------|
| LOW | Verde | Seguro, pode enviar |
| MEDIUM | Amarelo | Cuidado, monitore |
| HIGH | Vermelho | Alto risco de banimento |

### 5.3 Boas Praticas

- Limite diario: 50-100 mensagens por numero
- Intervalo: 3-5 segundos entre mensagens
- Rotacao: usar 2+ numeros
- Horario: 9h-18h dias uteis
- Evitar links suspeitos

---

## PARTE 6: CHECKLIST DE IMPLEMENTACAO

### Supabase
- [ ] Executar migration das tabelas
- [ ] Executar funcoes RPC
- [ ] Verificar tabela `sales` existe
- [ ] Testar funcao `get_crm_customer_stats`

### n8n
- [ ] Criar credencial Postgres
- [ ] Criar credencial Gemini API
- [ ] Criar credencial uazapi
- [ ] Configurar variaveis ambiente
- [ ] Importar workflow
- [ ] Conectar credenciais aos nodes
- [ ] Testar cada acao

### Frontend
- [ ] Configurar variaveis VITE_N8N_*
- [ ] Testar wizard completo
- [ ] Verificar geracao de variacoes IA
- [ ] Verificar filtros CRM

---

## PARTE 7: TROUBLESHOOTING

### Erro: "Could not find property option" ao importar n8n
- O workflow pode ter nodes incompativeis com sua versao do n8n
- Solucao: Criar workflow manualmente seguindo a estrutura

### Erro: Policy already exists
- Execute `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
- Use o arquivo `docs/sql-only-functions.sql` que ja tem isso

### Gemini nao responde
- Verifique se a API Key esta correta
- Verifique se o projeto Google Cloud tem a API habilitada
- Verifique limites de uso

### Contatos nao aparecem
- Verifique se ha dados na tabela `sales`
- Verifique se `store_id` esta correto
- Verifique se clientes tem telefone cadastrado

---

## PARTE 8: ESTRUTURA DE ARQUIVOS

```
docs/
  n8n-whatsapp-campaigns-workflow.json  # Workflow n8n
  sql-only-functions.sql                 # Funcoes SQL separadas
  GUIA-WHATSAPP-CAMPAIGNS.md            # Este guia

supabase/migrations/
  20251217200000_create_whatsapp_campaigns_module.sql

src/components/admin/whatsapp-campaigns/
  CampaignWizard.tsx
  steps/
    FilterStep.tsx
    TemplateStep.tsx
    ScheduleStep.tsx
    ReviewStep.tsx
  types.ts
```
