# 🚀 Plano de Implementação - Sistema Próprio de Validação PIX

## 📋 Visão Geral

Este documento detalha o plano completo de implementação do sistema próprio de validação de pagamentos PIX, utilizando **arquitetura de adaptadores** (similar à integração ERP) para suportar múltiplos bancos/gateways.

**Objetivo:** Criar uma solução robusta e segura para validação automática de pagamentos PIX em tempo real, sem depender de dados bancários sensíveis. O sistema deve suportar múltiplos bancos/gateways através de adaptadores personalizados.

**Arquitetura:**
- **Adaptadores por Banco/Gateway**: Cada banco (C6 Bank, Itaú, Bradesco, Pagou.ai, etc) tem seu próprio adapter
- **Normalização de Dados**: Cada adapter recebe dados no formato específico do banco e normaliza para formato interno único
- **Consolidador**: Sistema interno que trabalha sempre com dados normalizados, independente do banco origem

**Analogia com ERP:**
- Assim como `erp_integrations` suporta Tiny, Bling, Microvix, etc., cada um com sua própria documentação
- O sistema PIX suportará C6 Bank, Itaú, Bradesco, Pagou.ai, etc., cada um com seu próprio adapter
- Dados recebidos são normalizados (ex: `txid` → `transaction_id`, `TRANSACAO_ID` → `transaction_id`)

**Tecnologias Principais:**
- Adaptadores personalizados por banco/gateway
- Supabase (banco de dados)
- Netlify Functions (backend serverless)
- React/TypeScript (frontend)

---

## 🎯 Fases de Implementação

### FASE 1 - PREPARAÇÃO E PLANEJAMENTO

#### 1.1 Documentação e Pesquisa
- [ ] Revisar documentação existente:
  - `ESTUDO_MERCADO_VALIDACAO_PIX.md`
  - `INTEGRACAO_C6_BANK_PIX.md`
- [ ] Estudar documentação oficial da API C6 Bank
- [ ] Identificar todos os endpoints necessários
- [ ] Documentar formato dos payloads de webhook

#### 1.2 Cadastro e Homologação C6 Bank
- [ ] Cadastrar empresa no portal C6 Developers
  - URL: https://developers.c6bank.com.br/
- [ ] Solicitar processo de homologação
- [ ] Realizar testes em ambiente sandbox
- [ ] Obter credenciais de produção após homologação

#### 1.3 Configuração de Credenciais
- [ ] Obter credenciais de API do C6 Bank:
  - Client ID
  - Client Secret
  - API Key
  - Webhook Secret (para validação de assinatura)
- [ ] Configurar variáveis de ambiente no Netlify:
  ```
  C6_BANK_CLIENT_ID=
  C6_BANK_CLIENT_SECRET=
  C6_BANK_API_KEY=
  C6_BANK_WEBHOOK_SECRET=
  C6_BANK_API_BASE_URL=https://baas-api.c6bank.info/v2
  C6_BANK_WEBHOOK_URL=https://eleveaone.com.br/.netlify/functions/pix-webhook
  ```

---

### FASE 2 - BANCO DE DADOS

#### 2.1 Tabela: `pix_events`
Armazenar todos os eventos de webhook recebidos (auditoria completa).

```sql
CREATE TABLE sistemaretiradas.pix_events (
  id SERIAL PRIMARY KEY,
  gateway VARCHAR(50) NOT NULL DEFAULT 'C6_BANK',
  event_type VARCHAR(100) NOT NULL, -- 'pix_received', 'cob_status_changed', etc.
  payload_raw JSONB NOT NULL, -- Payload completo do webhook
  txid VARCHAR(255),
  valor DECIMAL(10,2),
  chave_pix VARCHAR(255),
  status VARCHAR(50), -- 'ATIVA', 'CONCLUIDA', 'REMOVIDA', etc.
  end_to_end_id VARCHAR(255),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
- `idx_pix_events_txid` ON (txid)
- `idx_pix_events_status` ON (status, processed)
- `idx_pix_events_created_at` ON (created_at DESC)
- `idx_pix_events_chave_pix` ON (chave_pix)

**RLS Policy:** Acesso por admin_id através de site_slug

#### 2.2 Tabela: `pix_validation_matches`
Registrar matches entre PIX recebidos e vendas.

```sql
CREATE TABLE sistemaretiradas.pix_validation_matches (
  id SERIAL PRIMARY KEY,
  pix_event_id INTEGER REFERENCES pix_events(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  match_criteria JSONB NOT NULL, -- {chave_pix: true, valor: true, data: true}
  confidence_score DECIMAL(3,2), -- 0.00 a 1.00
  matched_by UUID REFERENCES auth.users(id), -- NULL se automático
  notes TEXT
);
```

**Índices:**
- `idx_pix_validation_matches_pix_event` ON (pix_event_id)
- `idx_pix_validation_matches_sale` ON (sale_id)

#### 2.3 Tabela: `pix_gateways`
Gateways/bancos suportados (similar a como erp_integrations suporta múltiplos ERPs).

```sql
CREATE TABLE sistemaretiradas.pix_gateways (
  id VARCHAR(50) PRIMARY KEY, -- 'C6_BANK', 'ITAU', 'BRADESCO', 'PAGOU_AI', etc.
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  adapter_class VARCHAR(100) NOT NULL, -- 'C6BankAdapter', 'ItauAdapter', etc.
  config_schema JSONB NOT NULL, -- Schema de configuração específico do gateway
  is_active BOOLEAN DEFAULT true,
  webhook_url_template TEXT, -- Template da URL de webhook
  documentation_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Registros iniciais:**
```sql
INSERT INTO sistemaretiradas.pix_gateways (id, name, display_name, adapter_class, config_schema, webhook_url_template) VALUES
('C6_BANK', 'C6_BANK', 'C6 Bank PIX', 'C6BankAdapter', 
 '{"client_id": "string", "client_secret": "string", "api_key": "string", "webhook_secret": "string"}',
 'https://eleveaone.com.br/.netlify/functions/pix-webhook?gateway=C6_BANK'),
('ITAU', 'ITAU', 'Itaú PIX', 'ItauAdapter',
 '{"api_key": "string", "client_id": "string"}',
 'https://eleveaone.com.br/.netlify/functions/pix-webhook?gateway=ITAU'),
('PAGOU_AI', 'PAGOU_AI', 'Pagou.ai', 'PagouAiAdapter',
 '{"api_key": "string", "secret_key": "string"}',
 'https://eleveaone.com.br/.netlify/functions/pix-webhook?gateway=PAGOU_AI');
```

#### 2.4 Tabela: `pix_settings`
Configurações por loja/customer (usa gateway_id para referenciar o gateway).

```sql
CREATE TABLE sistemaretiradas.pix_settings (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  gateway_id VARCHAR(50) NOT NULL REFERENCES pix_gateways(id),
  chave_pix VARCHAR(255) NOT NULL, -- Chave PIX da loja
  tipo_chave VARCHAR(50), -- 'CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'EVP'
  gateway_config JSONB NOT NULL, -- Configuração específica do gateway (credenciais, etc)
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  auto_confirm BOOLEAN DEFAULT true, -- Confirmar automaticamente quando match
  tolerancia_minutos INTEGER DEFAULT 30, -- Janela de tempo para matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, site_slug, gateway_id) -- Uma loja pode ter múltiplos gateways
);
```

#### 2.4 Atualizar Tabela: `sales`
Adicionar campos relacionados a PIX.

```sql
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS pix_txid VARCHAR(255),
ADD COLUMN IF NOT EXISTS pix_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pix_confirmation_method VARCHAR(50), -- 'AUTOMATIC', 'MANUAL'
ADD COLUMN IF NOT EXISTS pix_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS pix_payer_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS pix_expected_key VARCHAR(255), -- Chave PIX esperada
ADD COLUMN IF NOT EXISTS pix_expected_amount DECIMAL(10,2);
```

**Índices:**
- `idx_sales_pix_txid` ON (pix_txid) WHERE pix_txid IS NOT NULL
- `idx_sales_pix_confirmed_at` ON (pix_confirmed_at) WHERE pix_confirmed_at IS NOT NULL
- `idx_sales_pix_expected` ON (pix_expected_key, pix_expected_amount) WHERE pix_expected_key IS NOT NULL

#### 2.5 Função SQL: `pix_match_sale`
Função para matching automático de PIX com vendas.

```sql
CREATE OR REPLACE FUNCTION sistemaretiradas.pix_match_sale(
  p_txid VARCHAR(255),
  p_valor DECIMAL(10,2),
  p_chave_pix VARCHAR(255),
  p_tolerancia_minutos INTEGER DEFAULT 30
)
RETURNS TABLE (
  sale_id INTEGER,
  confidence_score DECIMAL(3,2),
  match_criteria JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    -- Calcular confidence score baseado em critérios
    CASE 
      WHEN s.pix_expected_key = p_chave_pix AND s.pix_expected_amount = p_valor THEN 1.00
      WHEN s.pix_expected_key = p_chave_pix THEN 0.75
      WHEN s.pix_expected_amount = p_valor THEN 0.50
      ELSE 0.25
    END as confidence_score,
    jsonb_build_object(
      'chave_match', s.pix_expected_key = p_chave_pix,
      'valor_match', s.pix_expected_amount = p_valor,
      'tempo_match', ABS(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60) <= p_tolerancia_minutos
    ) as match_criteria
  FROM sistemaretiradas.sales s
  WHERE s.status = 'PENDENTE'
    AND s.pix_expected_key IS NOT NULL
    AND s.pix_expected_amount IS NOT NULL
    AND (
      s.pix_expected_key = p_chave_pix 
      OR s.pix_expected_amount = p_valor
    )
    AND ABS(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 60) <= p_tolerancia_minutos
  ORDER BY confidence_score DESC, s.created_at DESC
  LIMIT 1;
END;
$$;
```

---

### FASE 3 - BACKEND WEBHOOK E ADAPTERS

#### 3.1 Criar Estrutura de Adaptadores
**Arquitetura baseada em adapters (similar a erp_integrations)**

**Estrutura de pastas:**
```
netlify/functions/
  adapters/
    PixAdapter.ts          # Interface base
    C6BankAdapter.ts       # Adapter C6 Bank
    ItauAdapter.ts         # Adapter Itaú (futuro)
    BradescoAdapter.ts     # Adapter Bradesco (futuro)
    PagouAiAdapter.ts      # Adapter Pagou.ai (futuro)
    types.ts               # Tipos normalizados
    index.ts               # Factory de adapters
```

#### 3.2 Interface Base: `PixAdapter`
Definir interface comum para todos os adapters:
- `parseWebhookPayload()` - Parse específico do formato do banco
- `validateWebhookSignature()` - Validação de assinatura específica
- `normalizeEvent()` - Normalização para formato interno
- `queryPix()` - Consulta direta na API do banco

#### 3.3 Formato Normalizado Interno
Definir estrutura de dados normalizada que será usada internamente:
```typescript
interface NormalizedPixEvent {
  transaction_id: string;    // txid, TRANSACAO_ID, transactionId → transaction_id
  amount: number;            // valor, VALOR, value → amount
  pix_key: string;           // chave, CHAVE_PIX, key → pix_key
  status: 'RECEIVED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
  received_at: Date;
  gateway: string;
  gateway_metadata: jsonb;   // Dados originais preservados
}
```

#### 3.4 Implementar C6BankAdapter
- Parse do payload C6 Bank (`txid`, `valor`, `chave`)
- Validação de assinatura HMAC
- Normalização para formato interno
- Consulta API C6 Bank (GET /pix/{txid})

#### 3.5 Netlify Function: `pix-webhook.js`
Receber e processar eventos de QUALQUER gateway via adapters.

**Estrutura:**
1. Identificar gateway via query param (`?gateway=C6_BANK`)
2. Obter adapter correspondente (factory pattern)
3. Parse do payload usando adapter específico
4. Validar assinatura usando método do adapter
5. Normalizar evento para formato interno
6. Salvar evento normalizado em `pix_events`
7. Chamar função de matching (usa dados normalizados)
8. Atualizar venda se match encontrado
9. Retornar 200 OK para o gateway

**Casos de tratamento:**
- Gateway não suportado
- Payload inválido (adapter lança erro)
- Assinatura inválida
- PIX duplicado (mesmo transaction_id já processado)

#### 3.2 Validação de Assinatura
Implementar validação HMAC ou header de autenticação conforme documentação C6 Bank.

```javascript
function validateWebhookSignature(payload, signature, secret) {
  // Implementar conforme documentação C6 Bank
  // Exemplo: HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### 3.3 Lógica de Matching
Implementar algoritmo de matching:
1. Buscar vendas pendentes com chave PIX esperada
2. Filtrar por valor (exato ou próximo)
3. Filtrar por janela de tempo (±30 minutos por padrão)
4. Calcular confidence score
5. Selecionar melhor match (maior score)
6. Se score >= 0.75, confirmar automaticamente

#### 3.4 Netlify Function: `pix-validate-manual.js`
Validação manual de PIX (consulta direta na API).

**Parâmetros:**
- `txid` (opcional)
- `chave_pix` (opcional)
- `valor` (opcional)
- `data_inicio`, `data_fim` (opcional)

**Fluxo:**
1. Autenticar com C6 Bank (obter access_token)
2. Consultar PIX na API (GET /pix/{txid} ou GET /pix com filtros)
3. Retornar dados do PIX encontrado
4. Opcionalmente, tentar fazer matching com vendas

#### 3.5 Configuração de Webhook no C6 Bank
- Configurar URL: `https://eleveaone.com.br/.netlify/functions/pix-webhook`
- Configurar eventos: `pix_received`, `cob_status_changed`
- Salvar webhook_id para gerenciamento futuro

---

### FASE 4 - INTEGRAÇÃO C6 BANK API

#### 4.1 Autenticação OAuth 2.0
Criar função para obter/renovar access_token.

```javascript
// netlify/functions/c6-bank-auth.js
async function getAccessToken() {
  // Implementar OAuth 2.0 flow
  // Client Credentials Grant
  // Salvar token em cache (memória/Redis) com expires_at
  // Renovar automaticamente quando próximo de expirar
}
```

#### 4.2 Endpoints da API C6 Bank

**GET /pix/{txid}**
- Consultar PIX específico por txid

**GET /pix**
- Listar PIX recebidos com filtros:
  - `inicio`, `fim` (datas)
  - `cpf`, `cnpj` (devedor)
  - Paginação

**POST /cob** ou **PUT /cob/{txid}**
- Criar/atualizar cobrança PIX (para QR Code dinâmico futuro)

#### 4.3 Tabela: `c6_bank_credentials` (se necessário)
Armazenar tokens de acesso.

```sql
CREATE TABLE IF NOT EXISTS sistemaretiradas.c6_bank_credentials (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id)
);
```

---

### FASE 5 - FRONTEND

#### 5.1 Componente: `PixSettings.tsx`
Configurações de PIX por loja.

**Funcionalidades:**
- Cadastrar/editar chave PIX
- Selecionar tipo de chave (CPF, CNPJ, Email, Telefone, EVP)
- Configurar gateway (C6 Bank)
- Ativar/desativar auto-confirmação
- Configurar tolerância de tempo (minutos)

**Localização:** `/admin/pix-settings` ou aba em configurações existente

#### 5.2 Componente: `PixValidationStatus.tsx`
Exibir status de validação PIX na tela de vendas.

**Funcionalidades:**
- Badge/indicador visual: Pendente / Confirmado / Erro
- Exibir txid quando confirmado
- Botão "Validar Manualmente"
- Exibir data/hora da confirmação

#### 5.3 Tela de Vendas
Adicionar campos relacionados a PIX:

- Campo: "Chave PIX esperada" (opcional)
- Campo: "Valor esperado" (auto-preenchido do total da venda)
- Status visual do PIX
- Botão: "Validar PIX Manualmente"

#### 5.4 Página: `/admin/pix-dashboard`
Dashboard completo de PIX.

**Seções:**
1. **Resumo/Estatísticas:**
   - Total de PIX recebidos (hoje/semana/mês)
   - Valor total
   - Taxa de confirmação automática vs manual
   - PIX não identificados

2. **Lista de PIX:**
   - Tabela com: Data, Valor, Chave PIX, Status, Venda associada
   - Filtros: Período, Status, Loja, Valor mínimo/máximo
   - Busca por txid, chave PIX

3. **PIX Não Identificados:**
   - Lista de PIX recebidos mas sem match com vendas
   - Opção de associar manualmente a uma venda
   - Opção de marcar como "descartado"

4. **Gráficos:**
   - PIX por dia (linha)
   - Distribuição por status (pizza)
   - Valor total por período (barra)

#### 5.5 Hooks: `usePixValidation.ts`
Hook React para gerenciar validação de PIX.

**Funções:**
- `validatePix(txid, chavePix, valor)`
- `getPixStatus(saleId)`
- `listPixRecebidos(filtros)`
- `associatePixManually(pixEventId, saleId)`

---

### FASE 6 - NOTIFICAÇÕES

#### 6.1 Notificação: PIX Confirmado
Quando PIX for confirmado (automático ou manual):
- Notificar vendedor/admin responsável pela venda
- Mensagem: "PIX de R$ X confirmado para venda #Y"
- Link para visualizar detalhes da venda

#### 6.2 Notificação: PIX Não Identificado
Quando PIX for recebido mas não tiver match:
- Notificar admin(s) da loja
- Mensagem: "PIX de R$ X recebido mas não identificado. Revisar?"
- Link para dashboard de PIX

#### 6.3 Integração com Sistema de Notificações
Usar sistema de notificações existente (`store_notifications`):
- Criar notificação no banco
- Exibir no frontend (toast/banner)
- Opcional: Email/SMS para casos críticos

---

### FASE 7 - TESTES

#### 7.1 Testes Unitários
- Função de matching (diferentes cenários)
- Validação de assinatura de webhook
- Parsing de payload C6 Bank
- Cálculo de confidence score

#### 7.2 Testes de Integração
- Webhook completo (sandbox C6 Bank → Netlify → Supabase)
- Validação manual (Frontend → Netlify → C6 Bank API → Frontend)
- Matching automático (PIX recebido → Venda confirmada)
- Notificações disparadas

#### 7.3 Testes de Cenários
- ✅ Match perfeito (chave + valor + tempo)
- ✅ Match parcial (apenas chave ou apenas valor)
- ✅ Múltiplos matches possíveis (escolher melhor)
- ✅ PIX duplicado (mesmo txid processado 2x)
- ✅ PIX com valor diferente (tolerância)
- ✅ PIX fora da janela de tempo
- ✅ PIX sem venda correspondente
- ✅ Venda sem PIX (após timeout)
- ✅ Webhook com payload inválido
- ✅ Falha de autenticação C6 Bank
- ✅ Timeout de API

#### 7.4 Testes de Performance
- Múltiplos webhooks simultâneos (10, 50, 100)
- Consulta de PIX com muitos registros (pagination)
- Matching com muitas vendas pendentes

#### 7.5 Testes de Segurança
- Validação de RLS policies
- Tentativa de acesso não autorizado
- Webhook com assinatura inválida
- SQL injection (se aplicável)
- Rate limiting

---

### FASE 8 - SEGURANÇA E AUDITORIA

#### 8.1 Logging Completo
- Todos os eventos PIX salvos em `pix_events`
- Log de erros detalhado (stack trace, contexto)
- Log de tentativas de validação manual
- Log de matches criados/modificados

#### 8.2 Rate Limiting
- Limitar chamadas ao webhook (prevenir spam)
- Limitar validações manuais por usuário (ex: 10/min)
- Implementar usando Netlify Edge Functions ou middleware

#### 8.3 Validação de IP (se disponível)
- Whitelist de IPs do C6 Bank
- Validar origem do webhook antes de processar

#### 8.4 Criptografia de Credenciais
- Armazenar credenciais C6 Bank criptografadas
- Usar Supabase Vault ou similar
- Nunca logar credenciais em texto plano

#### 8.5 Auditoria
- Rastrear todas as ações relacionadas a PIX:
  - Quem validou (usuário)
  - Quando validou (timestamp)
  - Método usado (automático/manual)
  - Dados alterados (antes/depois)

---

### FASE 9 - MELHORIAS E OTIMIZAÇÕES

#### 9.1 Cache
- Cache de consultas de PIX por txid (evitar múltiplas chamadas)
- Cache de access_token C6 Bank (renovar apenas quando necessário)
- Usar Redis ou memória compartilhada

#### 9.2 Otimização de Queries
- Índices compostos para matching (chave + valor + data)
- Prepared statements para queries frequentes
- Pagination eficiente para listagens grandes

#### 9.3 Reconciliação Periódica
- Cron job para buscar PIX que podem ter sido perdidos
- Rodar diariamente: consultar PIX das últimas 24h
- Tentar fazer matching retroativo

#### 9.4 Métricas e Monitoramento
- Dashboard de métricas:
  - Tempo médio de confirmação
  - Taxa de sucesso (automático vs manual)
  - PIX não identificados (últimos 7 dias)
  - Erros por tipo
- Alertas para anomalias (muitos erros, PIX não identificados acumulando)

---

### FASE 10 - DOCUMENTAÇÃO

#### 10.1 Documentação Técnica
- Fluxo completo do sistema (diagrama)
- Arquitetura de componentes
- API endpoints (webhooks + REST)
- Estrutura do banco de dados
- Configuração e deploy

#### 10.2 Documentação de Usuário
- Guia de configuração inicial
- Como cadastrar chave PIX
- Como validar PIX manualmente
- Como revisar PIX não identificados
- Interpretar dashboard e métricas

#### 10.3 Documentação de Troubleshooting
- Problemas comuns e soluções
- Como debugar webhook
- Como verificar logs
- Como reportar bugs

---

### FASE 11 - DEPLOY E PRODUÇÃO

#### 11.1 Preparação de Deploy
- [ ] Executar todas as migrations no banco de produção
- [ ] Verificar se todas as migrations rodaram sem erros
- [ ] Validar estrutura do banco (tabelas, índices, RLS)

#### 11.2 Configuração de Produção
- [ ] Configurar variáveis de ambiente no Netlify (produção)
- [ ] Configurar webhook de produção no portal C6 Bank
- [ ] Testar conexão com API C6 Bank (produção)
- [ ] Validar assinatura de webhook (produção)

#### 11.3 Testes em Produção
- [ ] Teste de smoke: validar PIX de valor baixo (R$ 1,00)
- [ ] Verificar se evento foi salvo em `pix_events`
- [ ] Verificar se matching funcionou (se aplicável)
- [ ] Verificar se notificação foi enviada
- [ ] Verificar logs de erro (deve estar vazio)

#### 11.4 Monitoramento Inicial
- [ ] Monitorar logs nas primeiras 24h
- [ ] Verificar métricas (taxa de sucesso, erros)
- [ ] Verificar performance (tempo de resposta)
- [ ] Coletar feedback dos usuários

#### 11.5 Plano de Rollback
- [ ] Documentar como desabilitar webhook (C6 Bank)
- [ ] Documentar como desabilitar função Netlify
- [ ] Documentar como reverter migrations (se necessário)
- [ ] Ter backup do banco antes de deploy

---

## 🎯 Priorização (MVP vs Completo)

### MVP (Fase 1 - Produção Básica)
Para entrar em produção rapidamente, focar em:

1. **FASE 2** - Banco de dados (mínimo)
2. **FASE 3** - Webhook básico (receber e salvar)
3. **FASE 4** - Validação manual (consulta API)
4. **FASE 5** - Frontend básico (validar manualmente na tela de vendas)
5. **FASE 11** - Deploy

**Funcionalidade MVP:**
- Vendedor pode validar PIX manualmente inserindo txid
- Sistema consulta C6 Bank e confirma se PIX foi recebido
- Status da venda é atualizado

### Completo (Todas as Fases)
Para solução completa e robusta:

- Matching automático via webhook
- Dashboard completo
- Notificações
- Reconciliação automática
- Métricas e monitoramento

---

## 📊 Cronograma Estimado

- **FASE 1:** 1-2 semanas (depende de homologação C6 Bank)
- **FASE 2:** 2-3 dias
- **FASE 3:** 3-5 dias
- **FASE 4:** 2-3 dias
- **FASE 5:** 5-7 dias
- **FASE 6:** 1-2 dias
- **FASE 7:** 3-5 dias
- **FASE 8:** 2-3 dias
- **FASE 9:** 2-3 dias (pode ser incremental)
- **FASE 10:** 1-2 dias (paralelo com outras fases)
- **FASE 11:** 1 dia

**Total MVP:** ~3-4 semanas  
**Total Completo:** ~6-8 semanas

---

## ✅ Checklist de Entrada em Produção

Antes de ativar em produção, verificar:

- [ ] Todas as migrations executadas
- [ ] Variáveis de ambiente configuradas
- [ ] Webhook configurado no C6 Bank
- [ ] Testes em sandbox passaram
- [ ] Teste de smoke em produção passou
- [ ] Logs monitorados (sem erros críticos)
- [ ] Documentação atualizada
- [ ] Plano de rollback documentado
- [ ] Equipe treinada (se aplicável)

---

## 🔗 Referências

- [Documentação C6 Bank API](https://developers.c6bank.com.br/)
- [ESTUDO_MERCADO_VALIDACAO_PIX.md](./ESTUDO_MERCADO_VALIDACAO_PIX.md)
- [INTEGRACAO_C6_BANK_PIX.md](./INTEGRACAO_C6_BANK_PIX.md)

---

**Última atualização:** 2025-12-27  
**Status:** Planejamento completo

