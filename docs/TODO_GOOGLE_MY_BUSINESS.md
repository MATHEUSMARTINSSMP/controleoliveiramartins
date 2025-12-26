# TODO: Implementação Completa - Google Meu Negócio

## 📋 Status Geral
- ✅ Estrutura básica criada (tabelas, hooks, componente)
- ✅ Integração OAuth configurada (Netlify Functions)
- ✅ Implementação do frontend modularizado (16 componentes)
- ✅ Estatísticas avançadas com gráficos
- ✅ Exportação de relatórios (CSV e PDF)
- ✅ Comparação de períodos
- ⚠️ Funcionalidades avançadas em andamento

---

## 🔐 1. AUTENTICAÇÃO E CREDENCIAIS

### 1.1 Backend (n8n) - ✅ CONCLUÍDO
- [x] Webhook `/api/auth/google/start` - Iniciar OAuth
- [x] Webhook `/api/auth/google/callback` - Processar callback
- [x] Geração de PKCE (code_verifier, code_challenge)
- [x] Armazenamento de tokens no Redis (temporário)
- [x] Salvamento de credenciais no PostgreSQL (`elevea.google_credentials`)
- [x] Refresh token automático
- [x] Validação de expiração de tokens

### 1.2 Frontend - ⚠️ PARCIAL
- [x] Hook `useGoogleAuth` criado
- [x] Função `startAuth()` - Iniciar autenticação
- [x] Função `checkStatus()` - Verificar status da conexão
- [x] Função `disconnect()` - Desconectar conta
- [x] **CONCLUÍDO:** Feedback visual durante o processo de autenticação (loading state) - ConnectionStatus
- [x] **CONCLUÍDO:** Modal de confirmação antes de desconectar - ConnectionStatus (AlertDialog)
- [x] **CONCLUÍDO:** Exibir informações do perfil Google conectado (email) - ConnectionStatus
- [ ] **FALTA:** Tratamento de erro quando OAuth é cancelado pelo usuário
- [ ] **FALTA:** Verificação automática de expiração e refresh automático no frontend
- [ ] **FALTA:** Exibir foto do perfil Google

### 1.3 Banco de Dados - ✅ CONCLUÍDO
- [x] Tabela `elevea.google_credentials` criada
- [x] RLS policies configuradas
- [x] Índices criados
- [x] Triggers para `updated_at`

---

## 📊 2. BUSCAR E EXIBIR REVIEWS

### 2.1 Backend (n8n) - ⚠️ PARCIAL
- [x] Webhook `/api/google/reviews` - Buscar reviews
- [x] Integração com Google My Business API
- [x] Busca de contas (`accounts`)
- [x] **CONCLUÍDO:** Buscar locations de cada account (google-oauth-callback salva accounts/locations)
- [x] **CONCLUÍDO:** Buscar reviews de cada location (google-reviews-fetch)
- [ ] **FALTA:** Paginação de reviews (Google retorna paginado) - Backend
- [x] **CONCLUÍDO:** Filtros (por data, rating, respondidas/não respondidas) - Frontend
- [ ] **FALTA:** Cache de reviews (evitar chamadas excessivas à API)
- [x] **CONCLUÍDO:** Sincronização automática periódica de reviews (Migration criada)

### 2.2 Frontend - ⚠️ PARCIAL
- [x] Hook `useGoogleReviews` criado
- [x] Função `fetchReviews()` - Buscar reviews
- [x] Exibição básica de reviews em cards
- [x] Renderização de estrelas (rating)
- [x] Exibição de data relativa
- [x] **CONCLUÍDO:** Paginação de reviews no frontend
- [x] **CONCLUÍDO:** Filtros visuais (rating, data, status de resposta)
- [x] **CONCLUÍDO:** Busca por texto nos reviews
- [x] **CONCLUÍDO:** Ordenação (mais recentes, mais antigos, melhor/menor rating)
- [x] **CONCLUÍDO:** Indicador de reviews não lidas/novas (badge "Nova")
- [x] **CONCLUÍDO:** Badge de "Nova resposta" quando review é respondida - ReviewCard
- [x] **CONCLUÍDO:** Preview expandido do review (ver mais/menos) - ReviewCard
- [x] **CONCLUÍDO:** Link para ver review no Google Maps
- [x] **CONCLUÍDO:** Exportar reviews (CSV)
- [x] **CONCLUÍDO:** Exportar reviews (PDF) - ReviewsExportPDF

### 2.3 Banco de Dados - ✅ CONCLUÍDO
- [x] Tabela `elevea.google_reviews` criada
- [x] Webhook `/api/google/reviews/save` - Salvar reviews
- [x] RLS policies configuradas
- [x] **CONCLUÍDO:** Campo `is_read` (marcar reviews como lidas) - Migration 20251226000004
- [x] **CONCLUÍDO:** Campo `location_id` (associar review à location específica) - Migration 20251226000004
- [x] **CONCLUÍDO:** Campo `account_id` (associar review à account específica) - Migration 20251226000004
- [x] **CONCLUÍDO:** Tabela `elevea.google_business_accounts` criada - Migration 20251226000004
- [x] **CONCLUÍDO:** Índices compostos para queries de filtros - Migration 20251226000006

---

## 💬 3. RESPONDER REVIEWS

### 3.1 Backend (n8n) - ⚠️ PARCIAL
- [x] Webhook `/api/google/reviews/respond` - Responder review (Netlify Function)
- [x] Integração com Google My Business API v4
- [x] **CONCLUÍDO:** Validação de tamanho máximo da resposta (4096 caracteres - Frontend e Backend)
- [ ] **FALTA:** Validação de conteúdo (palavras proibidas, spam)
- [x] **CONCLUÍDO:** Template de respostas pré-definidas (Frontend)
- [ ] **FALTA:** Respostas automáticas baseadas em rating (IA)
- [ ] **FALTA:** Histórico de respostas (editar resposta anterior)
- [x] **CONCLUÍDO:** Notificação quando resposta é enviada com sucesso (toast)

### 3.2 Frontend - ⚠️ PARCIAL
- [x] Dialog para responder review
- [x] Textarea para escrever resposta
- [x] Função `respondToReview()` no hook
- [x] **CONCLUÍDO:** Contador de caracteres (limite do Google) - ReviewReplyDialog
- [x] **CONCLUÍDO:** Preview da resposta antes de enviar - ReviewReplyDialog
- [x] **CONCLUÍDO:** Templates de resposta pré-definidos (dropdown) - ReviewReplyDialog
- [x] **CONCLUÍDO:** Validação de tamanho mínimo/máximo (10-4096 caracteres) - ReviewReplyDialog
- [x] **CONCLUÍDO:** Indicador visual de resposta sendo enviada - ReviewReplyDialog
- [x] **CONCLUÍDO:** Confirmação de sucesso após envio (toast) - ReviewReplyDialog
- [ ] **FALTA:** Sugestões de resposta usando IA (baseado no conteúdo do review)
- [ ] **FALTA:** Opção de editar resposta existente
- [ ] **FALTA:** Opção de deletar resposta (se permitido pelo Google)
- [ ] **FALTA:** Histórico de respostas enviadas

### 3.3 Problema Crítico - ✅ RESOLVIDO
- [x] **CONCLUÍDO:** Tabela `elevea.google_business_accounts` criada - Migration 20251226000004
- [x] **CONCLUÍDO:** `accountId` e `locationId` salvos na tabela `google_reviews` - Migration 20251226000004
- [x] **CONCLUÍDO:** Google OAuth callback salva accounts/locations automaticamente - google-oauth-callback.js

---

## 📈 4. ESTATÍSTICAS E ANALYTICS

### 4.1 Backend (n8n) - ⚠️ PARCIAL
- [x] Webhook `/api/google/reviews/stats` - Estatísticas básicas
- [x] Cálculo de média de ratings
- [x] Distribuição de ratings (1-5 estrelas)
- [x] Taxa de resposta
- [x] **CONCLUÍDO:** Gráficos de evolução temporal (reviews ao longo do tempo) - Frontend
- [x] **CONCLUÍDO:** Comparação de períodos (mês atual vs mês anterior) - Frontend
- [x] **CONCLUÍDO:** Exportar relatórios PDF - Frontend
- [ ] **FALTA:** Insights do Google My Business (visualizações, cliques, etc.)
- [ ] **FALTA:** Análise de sentimento dos reviews (positivo/negativo/neutro)
- [ ] **FALTA:** Palavras-chave mais mencionadas nos reviews
- [ ] **FALTA:** Tempo médio de resposta
- [ ] **FALTA:** Reviews por location (se múltiplas locations)
- [ ] **FALTA:** Exportar relatórios Excel

### 4.2 Frontend - ⚠️ PARCIAL
- [x] Exibição básica de estatísticas (cards)
- [x] Distribuição de ratings (barra visual)
- [x] Seleção de período (7d, 30d, 90d, 1y)
- [x] **CONCLUÍDO:** Gráfico de linha (evolução de reviews ao longo do tempo) - ReviewsTimeSeriesChart
- [x] **CONCLUÍDO:** Gráfico de pizza (distribuição de ratings) - RatingDistributionChart
- [x] **CONCLUÍDO:** Gráfico de barras (distribuição de ratings) - RatingDistributionChart
- [x] **CONCLUÍDO:** Gráfico de evolução da média de ratings - RatingEvolutionChart
- [x] **CONCLUÍDO:** Comparação com período anterior (↑/↓ com percentual) - PeriodComparison
- [x] **CONCLUÍDO:** Exportar relatório PDF (botão de download) - StatsExportButton
- [ ] **FALTA:** Cards de insights adicionais:
  - Total de visualizações do perfil
  - Total de cliques no site
  - Total de cliques em "Ligar"
  - Total de cliques em "Como chegar"
- [ ] **FALTA:** Análise de sentimento visual (cores, badges)
- [ ] **FALTA:** Nuvem de palavras (palavras-chave mais mencionadas)
- [ ] **FALTA:** Filtro por location (se múltiplas)

---

## 🏢 5. GERENCIAR LOCATIONS E ACCOUNTS

### 5.1 Backend (n8n) - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Endpoint para listar accounts conectadas
- [ ] **FALTA:** Endpoint para listar locations de uma account
- [ ] **FALTA:** Endpoint para buscar informações de uma location
- [ ] **FALTA:** Endpoint para atualizar informações da location (nome, endereço, horário, etc.)
- [ ] **FALTA:** Endpoint para buscar fotos da location
- [ ] **FALTA:** Endpoint para fazer upload de fotos
- [ ] **FALTA:** Endpoint para gerenciar posts no Google My Business

### 5.2 Frontend - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Aba "Locations" no componente GoogleIntegration
- [ ] **FALTA:** Lista de accounts conectadas
- [ ] **FALTA:** Lista de locations por account
- [ ] **FALTA:** Card de informações da location:
  - Nome
  - Endereço
  - Telefone
  - Horário de funcionamento
  - Website
  - Categoria
- [ ] **FALTA:** Formulário para editar informações da location
- [ ] **FALTA:** Galeria de fotos da location
- [ ] **FALTA:** Upload de novas fotos
- [ ] **FALTA:** Gerenciar posts do Google My Business
- [ ] **FALTA:** Seleção de location padrão (para reviews e stats)

### 5.3 Banco de Dados - ✅ CONCLUÍDO
- [x] **CONCLUÍDO:** Tabela `elevea.google_business_accounts` criada - Migration 20251226000004
- [x] RLS policies configuradas
- [x] Triggers para `updated_at` configurados

---

## 🔔 6. NOTIFICAÇÕES E ALERTAS

### 6.1 Backend - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Webhook do Google para notificar novos reviews (push notifications)
- [ ] **FALTA:** Sistema de notificações internas (novo review recebido)
- [ ] **FALTA:** Alertas para reviews negativas (rating <= 2)
- [ ] **FALTA:** Alertas para reviews não respondidas há X dias
- [ ] **FALTA:** Email/SMS quando novo review é recebido
- [ ] **FALTA:** Configurações de notificações por usuário

### 6.2 Frontend - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Badge de notificações (número de reviews não lidas)
- [ ] **FALTA:** Lista de notificações (dropdown)
- [ ] **FALTA:** Página de configurações de notificações
- [ ] **FALTA:** Toggle para ativar/desativar notificações
- [ ] **FALTA:** Configurar alertas (rating mínimo, dias sem resposta)

---

## 🤖 7. AUTOMAÇÕES E IA

### 7.1 Respostas Automáticas - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Sistema de templates de resposta
- [ ] **FALTA:** Respostas automáticas baseadas em rating:
  - 5 estrelas: Template de agradecimento
  - 4 estrelas: Template de agradecimento + pedido de feedback
  - 3 estrelas: Template de desculpas + oferta de ajuda
  - 1-2 estrelas: Template de desculpas + contato direto
- [ ] **FALTA:** Geração de resposta usando IA (baseado no conteúdo do review)
- [ ] **FALTA:** Aprovação manual antes de enviar resposta automática
- [ ] **FALTA:** Personalização de templates (variáveis dinâmicas)

### 7.2 Análise com IA - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Análise de sentimento dos reviews (positivo/negativo/neutro)
- [ ] **FALTA:** Extração de tópicos principais mencionados
- [ ] **FALTA:** Sugestões de melhorias baseadas nos reviews
- [ ] **FALTA:** Comparação com concorrentes (se possível)

---

## 🔄 8. SINCRONIZAÇÃO E CACHE

### 8.1 Sincronização Automática - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Job agendado para sincronizar reviews periodicamente (cron)
- [ ] **FALTA:** Sincronização incremental (apenas reviews novos)
- [ ] **FALTA:** Retry automático em caso de falha
- [ ] **FALTA:** Log de sincronizações
- [ ] **FALTA:** Botão manual de sincronização no frontend

### 8.2 Cache - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Cache de reviews no Redis (evitar chamadas excessivas)
- [ ] **FALTA:** TTL apropriado para cache
- [ ] **FALTA:** Invalidação de cache quando novo review é recebido
- [ ] **FALTA:** Cache de estatísticas (atualizar a cada X minutos)

---

## 🛡️ 9. SEGURANÇA E VALIDAÇÕES

### 9.1 Validações - ⚠️ PARCIAL
- [x] Validação de autenticação (usuário logado)
- [x] RLS policies no banco de dados
- [ ] **FALTA:** Validação de rate limiting (evitar abuso da API)
- [ ] **FALTA:** Validação de permissões (apenas ADMIN pode gerenciar)
- [ ] **FALTA:** Sanitização de inputs (respostas, filtros)
- [ ] **FALTA:** Validação de tamanho de resposta (limite do Google: 4096 caracteres)
- [ ] **FALTA:** Validação de conteúdo (palavras proibidas, spam)

### 9.2 Tratamento de Erros - ⚠️ PARCIAL
- [x] Tratamento básico de erros nos hooks
- [x] **CONCLUÍDO:** Tratamento específico de erros da API do Google:
  - Rate limit excedido (429) - use-google-reviews.ts
  - Token expirado (401) - use-google-reviews.ts
  - Permissão negada (403) - use-google-reviews.ts
  - Recurso não encontrado (404) - use-google-reviews.ts
  - Erro no servidor (500+) - use-google-reviews.ts
- [x] **CONCLUÍDO:** Mensagens de erro amigáveis ao usuário - toast.error
- [x] **CONCLUÍDO:** Retry automático com backoff exponencial - google-api-retry.ts
- [ ] **FALTA:** Log de erros para debugging

---

## 📱 10. UX/UI MELHORIAS

### 10.1 Interface - ⚠️ PARCIAL
- [x] Layout básico com cards
- [x] Tabs para Reviews e Estatísticas
- [x] **CONCLUÍDO:** Loading states (skeleton loaders existentes em skeleton-loaders.tsx)
- [x] **CONCLUÍDO:** Modularização completa (16 componentes modulares)
- [ ] **FALTA:** Empty states mais atrativos (ilustrações)
- [ ] **FALTA:** Animações de transição
- [ ] **FALTA:** Dark mode support
- [ ] **FALTA:** Responsividade mobile otimizada
- [ ] **FALTA:** Tooltips explicativos (alguns já implementados)
- [ ] **FALTA:** Tour guiado para novos usuários

### 10.2 Acessibilidade - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** ARIA labels apropriados
- [ ] **FALTA:** Navegação por teclado
- [ ] **FALTA:** Contraste de cores adequado
- [ ] **FALTA:** Textos alternativos para ícones

---

## 🧪 11. TESTES

### 11.1 Testes Unitários - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Testes dos hooks (`useGoogleAuth`, `useGoogleReviews`)
- [ ] **FALTA:** Testes das funções de formatação
- [ ] **FALTA:** Testes das validações

### 11.2 Testes de Integração - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Testes do fluxo completo de OAuth
- [ ] **FALTA:** Testes de busca de reviews
- [ ] **FALTA:** Testes de resposta a reviews
- [ ] **FALTA:** Testes de sincronização

### 11.3 Testes E2E - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Teste completo do fluxo de usuário
- [ ] **FALTA:** Teste de diferentes cenários de erro

---

## 📚 12. DOCUMENTAÇÃO

### 12.1 Documentação Técnica - ⚠️ PARCIAL
- [x] Documentação de configuração OAuth (`CONFIGURACAO_GOOGLE_OAUTH.md`)
- [ ] **FALTA:** Documentação da API do n8n (endpoints, parâmetros, respostas)
- [ ] **FALTA:** Diagrama de fluxo do OAuth
- [ ] **FALTA:** Diagrama de arquitetura do sistema
- [ ] **FALTA:** Documentação do schema do banco de dados

### 12.2 Documentação do Usuário - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Guia de uso para administradores
- [ ] **FALTA:** FAQ
- [ ] **FALTA:** Vídeo tutorial
- [ ] **FALTA:** Screenshots e exemplos

---

## 🚀 13. OTIMIZAÇÕES E PERFORMANCE

### 13.1 Performance - ⚠️ PARCIAL
- [x] **CONCLUÍDO:** Debounce em filtros e buscas - useDebounce hook (300ms)
- [ ] **FALTA:** Lazy loading de reviews (carregar sob demanda)
- [ ] **FALTA:** Virtualização de lista (para muitos reviews)
- [ ] **FALTA:** Otimização de queries do banco de dados
- [ ] **FALTA:** Compressão de respostas da API

### 13.2 Monitoramento - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Logging estruturado
- [ ] **FALTA:** Métricas de performance (tempo de resposta)
- [ ] **FALTA:** Alertas de erro crítico
- [ ] **FALTA:** Dashboard de monitoramento

---

## 🔧 14. CONFIGURAÇÕES E PERSONALIZAÇÃO

### 14.1 Configurações do Sistema - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Configuração de período padrão de sincronização
- [ ] **FALTA:** Configuração de templates de resposta padrão
- [ ] **FALTA:** Configuração de alertas padrão
- [ ] **FALTA:** Configuração de location padrão

### 14.2 Personalização por Usuário - ❌ NÃO IMPLEMENTADO
- [ ] **FALTA:** Preferências de exibição (itens por página)
- [ ] **FALTA:** Preferências de notificações
- [ ] **FALTA:** Templates personalizados por usuário

---

## 🆕 FUNCIONALIDADES INSPIRADAS NO GBP CHECK (Cliente Final)

### 📊 ANÁLISE E INSIGHTS AVANÇADOS

#### 15. Análise de Saúde Completa do Perfil
- [ ] **FALTA:** Sistema de pontuação de saúde do perfil (0-100)
- [ ] **FALTA:** Checklist visual de itens com oportunidade de melhoria
- [ ] **FALTA:** Identificar itens faltantes:
  - Informações básicas (nome, endereço, telefone, website)
  - Horário de funcionamento
  - Categorias (principal e adicionais)
  - Descrição do negócio
  - Fotos (quantidade e qualidade)
  - Posts recentes
  - Perguntas e respostas
  - Atributos do negócio
- [ ] **FALTA:** Status visual (verde/amarelo/vermelho) para cada item
- [ ] **FALTA:** Histórico de evolução da pontuação ao longo do tempo
- [ ] **FALTA:** Exportar análise em PDF

#### 16. Insights Avançados com Comparativos
- [ ] **FALTA:** Comparativo de períodos (mês atual vs mês anterior, ano atual vs ano anterior)
- [ ] **FALTA:** Agregação de resultados (diária, semanal, mensal)
- [ ] **FALTA:** Gráficos interativos (zoom, hover, exportar como imagem)
- [ ] **FALTA:** Histórico de até 18 meses de dados
- [ ] **FALTA:** Métricas detalhadas:
  - Impressões por plataforma (Search, Maps)
  - Impressões por dispositivo (mobile, desktop, tablet)
  - Interações por tipo (chamadas, rotas, website, mensagens)
  - Interações por dia da semana
  - Evolução temporal de cada métrica
- [ ] **FALTA:** Download de insights em PDF e CSV
- [ ] **FALTA:** Comentários personalizados nos relatórios

#### 17. Análise de Avaliações Avançada
- [ ] **FALTA:** Evolução da quantidade de avaliações (último ano)
- [ ] **FALTA:** Evolução da média de avaliações (último ano)
- [ ] **FALTA:** Média por período (anual, últimos 12 meses)
- [ ] **FALTA:** Distribuição de avaliações por nota (gráfico de pizza/barras)
- [ ] **FALTA:** Votos positivos em avaliações (úteis/não úteis)
- [ ] **FALTA:** Análise de avaliações respondidas vs não respondidas
- [ ] **FALTA:** Análise de avaliações com comentários vs sem comentários
- [ ] **FALTA:** Análise de avaliações com imagens anexadas
- [ ] **FALTA:** Identificar avaliações de Local Guides
- [ ] **FALTA:** Extração de palavras-chave mais repetidas:
  - Palavras em avaliações positivas (4-5 estrelas)
  - Palavras em avaliações negativas (1-3 estrelas)
  - Nuvem de palavras visual
- [ ] **FALTA:** Gráficos de evolução temporal de avaliações

#### 18. Análise de Postagens
- [ ] **FALTA:** Evolução da quantidade e frequência de postagens
- [ ] **FALTA:** Análise de chamadas para ação (CTA) em postagens
- [ ] **FALTA:** Histórico das últimas 40 postagens
- [ ] **FALTA:** Métricas de engajamento por postagem
- [ ] **FALTA:** Identificar postagens antigas ou de baixa qualidade
- [ ] **FALTA:** Sugestões de melhorias para postagens

#### 19. Análise de Categorias
- [ ] **FALTA:** Análise de categorias por localização (comparar com concorrentes)
- [ ] **FALTA:** Análise de categorias por palavra-chave
- [ ] **FALTA:** Identificar categoria principal mais utilizada pelos concorrentes
- [ ] **FALTA:** Identificar categorias adicionais mais utilizadas
- [ ] **FALTA:** Sugestões de categorias adicionais baseadas na categoria principal
- [ ] **FALTA:** Lista de locais analisados ordenados por quantidade de categorias

#### 20. Gerenciador de Palavras-chave
- [ ] **FALTA:** Histórico de 18 meses de palavras-chave que acionaram o perfil
- [ ] **FALTA:** Filtros de palavras-chave:
  - Palavras novas (últimos meses)
  - Palavras que desapareceram
  - Palavras com crescimento/queda consecutiva
- [ ] **FALTA:** Quantidade de palavras que acionaram o perfil por mês
- [ ] **FALTA:** Comparativo de até 10 palavras-chave (ranking e impressões)
- [ ] **FALTA:** Desempenho individual de cada palavra-chave
- [ ] **FALTA:** Exportar dados em PDF e CSV

### 💬 GESTÃO DE CONTEÚDO

#### 21. Gerenciador de Perguntas e Respostas (FAQ)
- [ ] **FALTA:** Interface para visualizar todas as perguntas
- [ ] **FALTA:** Filtrar por: Todas, Não respondidas, Não respondidas pelo proprietário
- [ ] **FALTA:** Criar perguntas e respostas em 3 passos
- [ ] **FALTA:** Responder perguntas existentes
- [ ] **FALTA:** Ordenação de perguntas (mais recentes, mais antigas, não respondidas)
- [ ] **FALTA:** Editar perguntas e respostas existentes
- [ ] **FALTA:** Deletar perguntas e respostas

#### 22. Gerenciador de Postagens
- [ ] **FALTA:** Lista de todas as postagens publicadas
- [ ] **FALTA:** Criar novas postagens:
  - Postagens de ofertas
  - Postagens de eventos
  - Postagens de atualizações
  - Postagens de produtos
- [ ] **FALTA:** Editar postagens existentes
- [ ] **FALTA:** Deletar postagens
- [ ] **FALTA:** Agendar postagens
- [ ] **FALTA:** Ver estatísticas de cada postagem (visualizações, cliques)
- [ ] **FALTA:** Templates de postagens

#### 23. Gerenciador de Mídias (Fotos e Vídeos)
- [ ] **FALTA:** Galeria de todas as fotos do negócio
- [ ] **FALTA:** Upload de novas fotos
- [ ] **FALTA:** Definir foto de perfil
- [ ] **FALTA:** Deletar fotos
- [ ] **FALTA:** Organizar ordem das fotos
- [ ] **FALTA:** Ver fotos de clientes
- [ ] **FALTA:** Gerenciar vídeos (se suportado pela API)

### 🤖 INTELIGÊNCIA ARTIFICIAL

#### 24. Respostas Automáticas com IA
- [ ] **FALTA:** Gerar resposta para review usando IA
- [ ] **FALTA:** Considerar nome do cliente, conteúdo e nota na resposta
- [ ] **FALTA:** Personalização do tom (formal, informal, amigável)
- [ ] **FALTA:** Múltiplas opções de resposta geradas
- [ ] **FALTA:** Editar resposta gerada antes de enviar
- [ ] **FALTA:** Aprovação manual antes de enviar (opcional)

### 📈 RELATÓRIOS E EXPORTAÇÃO

#### 25. Relatório de Performance Completo
- [ ] **FALTA:** Relatório automático com todas as métricas:
  - Análise de Saúde do Perfil
  - Avaliações (8 aspectos)
  - Insights (3 aspectos principais)
  - Engajamento (4 aspectos)
  - Palavras-chave
  - Postagens (4 aspectos)
  - Mídias
  - Reputação
- [ ] **FALTA:** Configuração de envio automático por e-mail:
  - Quinzenal
  - Mensal
  - Múltiplos destinatários
- [ ] **FALTA:** Personalização do relatório (logo, cores, comentários)
- [ ] **FALTA:** Exportar em PDF com design profissional

#### 26. Cards de Avaliação Personalizados
- [ ] **FALTA:** Gerador de cards de avaliação visual
- [ ] **FALTA:** Personalização:
  - Logo do negócio
  - Imagem de fundo
  - Cor do plano de fundo
  - Opacidade
  - Cor do botão de avaliação
- [ ] **FALTA:** Download em formato digital (PNG, JPG)
- [ ] **FALTA:** Download em formato QR Code
- [ ] **FALTA:** Link direto para tela de avaliação do Google

### 🔍 FERRAMENTAS DE PESQUISA

#### 27. Pesquisar Categorias
- [ ] **FALTA:** Busca de categorias por termo ou parte da palavra
- [ ] **FALTA:** Lista de todas as categorias relacionadas
- [ ] **FALTA:** Comparar tendências de categorias via Google Trends
- [ ] **FALTA:** Comparar até 5 categorias simultaneamente
- [ ] **FALTA:** Visualizar evolução temporal das categorias

### 📊 RESUMO POR PRIORIDADE

### 🔴 CRÍTICO (Bloqueia funcionalidade básica)
1. ✅ **CONCLUÍDO:** Tabela `elevea.google_business_accounts` criada
2. ✅ **CONCLUÍDO:** `accountId` e `locationId` salvos corretamente
3. ✅ **CONCLUÍDO:** Busca real de locations e reviews implementada (Netlify Functions)
4. ✅ **CONCLUÍDO:** Tratamento adequado de erros da API do Google (401, 403, 404, 429, 500)

### 🟠 ALTA PRIORIDADE (Melhora significativamente a experiência)
5. ✅ Paginação e filtros de reviews (CONCLUÍDO)
6. ✅ Templates de resposta (CONCLUÍDO)
7. ✅ Sincronização automática periódica (CONCLUÍDO - Migration criada)
8. ✅ Estatísticas avançadas com gráficos (CONCLUÍDO - Gráficos de linha, pizza, barras, evolução)
9. ✅ Comparação de períodos (CONCLUÍDO - PeriodComparison)
10. ✅ Exportar reviews (CSV) (CONCLUÍDO)
11. ✅ Link para ver review no Google Maps (CONCLUÍDO)
12. ✅ Contador de caracteres e validações (CONCLUÍDO)
13. ✅ Preview de resposta antes de enviar (CONCLUÍDO)
14. ✅ Exportar relatórios PDF (CONCLUÍDO)
15. ✅ Modularização completa (CONCLUÍDO - 16 componentes modulares)
16. Notificações de novos reviews
17. **NOVO:** Análise de Saúde Completa do Perfil
18. **NOVO:** Insights Avançados com Comparativos
19. **NOVO:** Respostas Automáticas com IA
20. **NOVO:** Gerenciador de Perguntas e Respostas (FAQ)

### 🟡 MÉDIA PRIORIDADE (Melhorias importantes)
14. Gerenciamento de locations (editar informações)
15. Análise de sentimento
16. Exportação de relatórios
17. Cache e otimizações
18. **NOVO:** Análise de Avaliações Avançada
19. **NOVO:** Análise de Postagens
20. **NOVO:** Gerenciador de Postagens
21. **NOVO:** Gerenciador de Mídias (Fotos/Vídeos)
22. **NOVO:** Relatório de Performance Completo
23. **NOVO:** Cards de Avaliação Personalizados

### 🟢 BAIXA PRIORIDADE (Nice to have)
24. Testes automatizados
25. Documentação completa
26. Acessibilidade avançada
27. Dark mode
28. **NOVO:** Análise de Categorias
29. **NOVO:** Gerenciador de Palavras-chave
30. **NOVO:** Pesquisar Categorias

### 🟢 BAIXA PRIORIDADE (Nice to have)
15. Testes automatizados
16. Documentação completa
17. Acessibilidade avançada
18. Dark mode

---

## 📝 NOTAS IMPORTANTES

1. **API do Google My Business**: A API v4.9 é a versão mais recente. Alguns endpoints podem ter mudado.

2. **Rate Limits**: A API do Google tem limites de requisições. Implementar retry com backoff exponencial.

3. **Escopos OAuth**: Os escopos atuais são:
   - `openid`
   - `email`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/business.manage`

4. **Multi-tenant**: O sistema precisa suportar múltiplos `customer_id` e `site_slug`.

5. **Segurança**: Nunca expor `client_secret` no frontend. Sempre usar o n8n como proxy.

6. **Referência**: Funcionalidades inspiradas no [GBP Check](https://www.gbpcheck.com/pt/) - ferramenta líder de gestão de Google My Business. Ver `docs/FUNCIONALIDADES_GBP_CHECK.md` para detalhes completos.

## 📚 DOCUMENTAÇÃO RELACIONADA

- `docs/FUNCIONALIDADES_GBP_CHECK.md` - Análise detalhada das funcionalidades do GBP Check
- `docs/CAPACIDADES_GOOGLE_MY_BUSINESS.md` - O que é possível fazer com as credenciais OAuth
- `docs/INSTRUCOES_N8N_GOOGLE_ACCOUNTS.md` - Instruções para atualizar o n8n

