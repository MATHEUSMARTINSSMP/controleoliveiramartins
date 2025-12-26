# 🎯 Capacidades do Google Meu Negócio - O Que Você Pode Fazer

## 📋 Escopos OAuth Aprovados

Com as credenciais configuradas, você tem acesso aos seguintes escopos:

1. ✅ `https://www.googleapis.com/auth/business.manage`
   - **Permissão:** Ver, editar, criar e excluir informações comerciais do Google
   - **Nível:** Acesso completo ao Google My Business

2. ✅ `https://www.googleapis.com/auth/userinfo.email`
   - **Permissão:** Ver o endereço de e-mail principal da Conta do Google
   - **Uso:** Identificar o usuário conectado

3. ✅ `https://www.googleapis.com/auth/userinfo.profile`
   - **Permissão:** Ver informações pessoais públicas
   - **Uso:** Exibir nome e foto do perfil

4. ✅ `openid`
   - **Permissão:** Associar informações pessoais ao usuário
   - **Uso:** Autenticação e identificação

---

## 🚀 FUNCIONALIDADES DISPONÍVEIS

### 1. 📍 GERENCIAR INFORMAÇÕES DO NEGÓCIO

#### 1.1 Informações Básicas
Com o escopo `business.manage`, você pode:

- ✅ **Ver todas as informações do negócio:**
  - Nome do negócio
  - Endereço completo
  - Telefone
  - Website
  - Categoria do negócio
  - Descrição
  - Horário de funcionamento
  - Coordenadas (latitude/longitude)
  - Área de cobertura de entrega/serviço

- ✅ **Editar informações do negócio:**
  - Atualizar nome, endereço, telefone
  - Modificar horário de funcionamento
  - Alterar categoria
  - Atualizar descrição
  - Mudar website
  - Ajustar área de cobertura

- ✅ **Criar novos negócios:**
  - Adicionar novas locations
  - Criar novos perfis de negócio

- ✅ **Excluir informações:**
  - Remover locations
  - Deletar informações específicas

#### 1.2 O Que o Usuário Pode Fazer na Interface

**Na aba "Locations" (a implementar):**
```
┌─────────────────────────────────────────┐
│ 📍 Minhas Locations                     │
├─────────────────────────────────────────┤
│                                         │
│ 🏢 Loja Principal                       │
│    Rua das Flores, 123                  │
│    📞 (11) 99999-9999                   │
│    🌐 www.meusite.com.br                │
│    ⏰ Seg-Sex: 9h-18h                   │
│    [✏️ Editar] [📸 Fotos] [📊 Stats]   │
│                                         │
│ 🏢 Filial Centro                        │
│    Av. Central, 456                     │
│    ...                                  │
│                                         │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver lista de todas as locations conectadas
- Editar informações de cada location
- Ver estatísticas de cada location
- Gerenciar fotos de cada location
- Definir location padrão

---

### 2. ⭐ GERENCIAR REVIEWS (AVALIAÇÕES)

#### 2.1 O Que Você Pode Fazer com Reviews

- ✅ **Ver todas as reviews:**
  - Lista completa de avaliações
  - Filtros por data, rating, status
  - Busca por texto
  - Ordenação (mais recentes, mais antigas, melhor/menor rating)

- ✅ **Responder reviews:**
  - Responder avaliações públicas
  - Editar respostas existentes
  - Ver histórico de respostas

- ✅ **Analisar reviews:**
  - Ver média de avaliações
  - Distribuição de estrelas (1-5)
  - Taxa de resposta
  - Análise temporal (evolução ao longo do tempo)
  - Reviews por location

#### 2.2 O Que o Usuário Pode Fazer na Interface

**Na aba "Reviews":**
```
┌─────────────────────────────────────────┐
│ ⭐ Reviews do Google                    │
│ [🔍 Buscar] [📅 Filtros] [🔄 Atualizar]│
├─────────────────────────────────────────┤
│                                         │
│ ⭐⭐⭐⭐⭐ João Silva                     │
│    "Excelente atendimento!..."          │
│    há 2 dias                            │
│    [💬 Responder] [🔗 Ver no Google]   │
│                                         │
│ ⭐⭐⭐ Maria Santos                      │
│    "Produtos de qualidade..."           │
│    há 1 semana                          │
│    ✅ Respondido                       │
│    "Obrigado pelo feedback!"           │
│                                         │
│ ⭐⭐ Pedro Costa                         │
│    "Demorou muito para entregar..."     │
│    há 3 semanas                         │
│    [💬 Responder] [⚠️ Revisar]         │
│                                         │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver todas as reviews em cards organizados
- Filtrar por:
  - Rating (1-5 estrelas)
  - Data (últimos 7 dias, 30 dias, 90 dias, 1 ano)
  - Status (respondidas, não respondidas)
  - Location (se múltiplas)
- Buscar por texto no conteúdo do review
- Ordenar por:
  - Mais recentes
  - Mais antigas
  - Melhor rating
  - Menor rating
- Responder reviews diretamente na interface
- Ver preview da resposta antes de enviar
- Usar templates de resposta
- Ver histórico de respostas
- Link direto para ver review no Google Maps

---

### 3. 📊 ESTATÍSTICAS E ANALYTICS

#### 3.1 Métricas Disponíveis

Com o escopo `business.manage`, você pode acessar:

- ✅ **Estatísticas de Reviews:**
  - Total de reviews
  - Média de avaliações
  - Distribuição de ratings (1-5 estrelas)
  - Taxa de resposta
  - Número de reviews respondidas
  - Evolução temporal de reviews

- ✅ **Insights do Google My Business:**
  - Visualizações do perfil
  - Cliques no site
  - Cliques em "Ligar"
  - Cliques em "Como chegar"
  - Solicitações de direções
  - Visualizações de fotos
  - Comparação com período anterior

#### 3.2 O Que o Usuário Pode Fazer na Interface

**Na aba "Estatísticas":**
```
┌─────────────────────────────────────────┐
│ 📊 Estatísticas de Reviews              │
│ Período: [Últimos 30 dias ▼]           │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Total   │ │ Média   │ │ Resposta│   │
│ │ 247     │ │ 4.7 ⭐  │ │ 89%     │   │
│ └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│ 📈 Evolução de Reviews                  │
│    [Gráfico de linha]                  │
│                                         │
│ ⭐ Distribuição de Ratings              │
│    5 ⭐ ████████████ 120 (48%)         │
│    4 ⭐ ████████ 80 (32%)              │
│    3 ⭐ ███ 30 (12%)                   │
│    2 ⭐ █ 10 (4%)                      │
│    1 ⭐ █ 7 (3%)                       │
│                                         │
│ 📱 Insights do Google                  │
│    👁️ Visualizações: 1.2k              │
│    🌐 Cliques no site: 340             │
│    📞 Cliques em ligar: 89             │
│    🗺️ Solicitações de direções: 156    │
│                                         │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver estatísticas em tempo real
- Selecionar período (7d, 30d, 90d, 1 ano)
- Gráficos interativos:
  - Evolução de reviews ao longo do tempo
  - Distribuição de ratings (gráfico de pizza)
  - Comparação com período anterior
- Exportar relatórios (PDF, Excel)
- Filtrar por location (se múltiplas)
- Ver insights do Google My Business

---

### 4. 📸 GERENCIAR FOTOS

#### 4.1 O Que Você Pode Fazer com Fotos

- ✅ **Ver fotos:**
  - Lista de todas as fotos do negócio
  - Fotos do perfil
  - Fotos de clientes
  - Fotos do Google Street View

- ✅ **Gerenciar fotos:**
  - Fazer upload de novas fotos
  - Definir foto de perfil
  - Deletar fotos
  - Organizar fotos

#### 4.2 O Que o Usuário Pode Fazer na Interface

**Na aba "Fotos" (a implementar):**
```
┌─────────────────────────────────────────┐
│ 📸 Fotos do Negócio                     │
│ [+ Adicionar Foto]                      │
├─────────────────────────────────────────┤
│                                         │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │ 📷 │ │ 📷 │ │ 📷 │ │ 📷 │           │
│ └────┘ └────┘ └────┘ └────┘           │
│                                         │
│ Foto de Perfil                          │
│ [Definir como perfil] [🗑️ Deletar]    │
│                                         │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver galeria de fotos
- Upload de novas fotos
- Definir foto de perfil
- Deletar fotos
- Organizar ordem das fotos

---

### 5. 📝 GERENCIAR POSTS

#### 5.1 O Que Você Pode Fazer com Posts

- ✅ **Ver posts:**
  - Lista de posts publicados
  - Posts agendados
  - Posts expirados

- ✅ **Criar posts:**
  - Posts de ofertas
  - Posts de eventos
  - Posts de atualizações
  - Posts de produtos

- ✅ **Gerenciar posts:**
  - Editar posts
  - Deletar posts
  - Agendar posts

#### 5.2 O Que o Usuário Pode Fazer na Interface

**Na aba "Posts" (a implementar):**
```
┌─────────────────────────────────────────┐
│ 📝 Posts do Google My Business          │
│ [+ Criar Post]                          │
├─────────────────────────────────────────┤
│                                         │
│ 🎉 Oferta Especial                      │
│    "Desconto de 20% em todos..."       │
│    Publicado há 2 dias                  │
│    [✏️ Editar] [🗑️ Deletar]            │
│                                         │
│ 📅 Evento: Black Friday                 │
│    "Grande promoção no dia 25..."      │
│    Agendado para 25/11                  │
│    [✏️ Editar] [🗑️ Cancelar]          │
│                                         │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver todos os posts
- Criar novos posts
- Editar posts existentes
- Agendar posts
- Deletar posts
- Ver estatísticas de cada post (visualizações, cliques)

---

### 6. 🔔 NOTIFICAÇÕES E ALERTAS

#### 6.1 O Que Você Pode Receber

- ✅ **Notificações em tempo real:**
  - Novo review recebido
  - Review respondida
  - Pergunta de cliente
  - Atualização de informações

- ✅ **Alertas configuráveis:**
  - Review negativa (≤ 2 estrelas)
  - Review não respondida há X dias
  - Múltiplas reviews negativas em sequência

#### 6.2 O Que o Usuário Pode Fazer na Interface

**Notificações:**
```
┌─────────────────────────────────────────┐
│ 🔔 Notificações (3)                     │
├─────────────────────────────────────────┤
│                                         │
│ ⭐ Nova review recebida                 │
│    "João Silva deixou uma avaliação"    │
│    há 5 minutos                         │
│    [Ver Review]                         │
│                                         │
│ ⚠️ Review negativa                      │
│    "Pedro Costa deixou 1 estrela"      │
│    há 1 hora                            │
│    [Responder]                          │
│                                         │
│ 📧 Pergunta de cliente                  │
│    "Qual o horário de funcionamento?"   │
│    há 2 horas                           │
│    [Responder]                          │
│                                         │
└─────────────────────────────────────────┘
```

**Configurações de Alertas:**
```
┌─────────────────────────────────────────┐
│ ⚙️ Configurações de Notificações       │
├─────────────────────────────────────────┤
│                                         │
│ ☑️ Notificar sobre novos reviews        │
│ ☑️ Alertar sobre reviews negativas      │
│    Rating mínimo: [2 ⭐ ▼]              │
│                                         │
│ ☑️ Alertar reviews não respondidas      │
│    Após: [3 dias ▼] sem resposta       │
│                                         │
│ 📧 Notificações por email:              │
│    ☑️ Novos reviews                     │
│    ☐ Reviews respondidas                │
│    ☐ Perguntas de clientes             │
│                                         │
└─────────────────────────────────────────┘
```

---

### 7. 🤖 AUTOMAÇÕES E IA

#### 7.1 O Que Você Pode Automatizar

- ✅ **Respostas automáticas:**
  - Respostas baseadas em rating
  - Respostas geradas por IA
  - Templates personalizados

- ✅ **Análise inteligente:**
  - Análise de sentimento dos reviews
  - Extração de tópicos principais
  - Sugestões de melhorias

#### 7.2 O Que o Usuário Pode Fazer na Interface

**Templates de Resposta:**
```
┌─────────────────────────────────────────┐
│ 📝 Templates de Resposta                │
│ [+ Criar Template]                      │
├─────────────────────────────────────────┤
│                                         │
│ ✅ Agradecimento (5 estrelas)          │
│    "Obrigado pelo feedback positivo!..."│
│    [Usar] [Editar] [Deletar]           │
│                                         │
│ ✅ Resposta a crítica (1-2 estrelas)   │
│    "Lamentamos sua experiência..."     │
│    [Usar] [Editar] [Deletar]           │
│                                         │
└─────────────────────────────────────────┘
```

**Respostas Automáticas:**
```
┌─────────────────────────────────────────┐
│ 🤖 Respostas Automáticas                │
├─────────────────────────────────────────┤
│                                         │
│ ☑️ Ativar respostas automáticas        │
│                                         │
│ ⭐⭐⭐⭐⭐ (5 estrelas)                   │
│    Template: [Agradecimento ▼]         │
│    [✏️ Editar]                         │
│                                         │
│ ⭐⭐ (1-2 estrelas)                      │
│    Template: [Resposta a crítica ▼]   │
│    ☑️ Requer aprovação manual          │
│    [✏️ Editar]                         │
│                                         │
│ 🤖 Respostas com IA                     │
│    ☑️ Gerar resposta personalizada      │
│    ☑️ Requer aprovação antes de enviar │
│                                         │
└─────────────────────────────────────────┘
```

---

### 8. 📈 RELATÓRIOS E EXPORTAÇÃO

#### 8.1 O Que Você Pode Exportar

- ✅ **Relatórios de reviews:**
  - Lista completa de reviews
  - Estatísticas agregadas
  - Análise de sentimento

- ✅ **Relatórios de performance:**
  - Insights do Google My Business
  - Comparação de períodos
  - Métricas de engajamento

#### 8.2 O Que o Usuário Pode Fazer na Interface

**Exportar Dados:**
```
┌─────────────────────────────────────────┐
│ 📊 Exportar Relatórios                  │
├─────────────────────────────────────────┤
│                                         │
│ Tipo de Relatório:                      │
│ ○ Reviews completos                     │
│ ○ Estatísticas agregadas                │
│ ○ Insights do Google                    │
│                                         │
│ Período: [Últimos 30 dias ▼]          │
│                                         │
│ Formato:                                │
│ ○ PDF                                   │
│ ○ Excel (XLSX)                          │
│ ○ CSV                                   │
│                                         │
│ [📥 Exportar]                           │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎯 RESUMO: O QUE O USUÁRIO PODE FAZER

### ✅ Funcionalidades Básicas (Já Implementadas)
1. ✅ Conectar conta Google
2. ✅ Ver status da conexão
3. ✅ Desconectar conta
4. ✅ Ver reviews básicos
5. ✅ Ver estatísticas básicas

### 🚧 Funcionalidades em Desenvolvimento (Próximas)
6. ⏳ Responder reviews (precisa corrigir accountId/locationId)
7. ⏳ Filtrar e buscar reviews
8. ⏳ Ver insights do Google
9. ⏳ Gerenciar locations
10. ⏳ Templates de resposta

### 📋 Funcionalidades Planejadas (Futuras)
11. 📅 Gerenciar posts
12. 📸 Gerenciar fotos
13. 🔔 Notificações em tempo real
14. 🤖 Automações com IA
15. 📊 Relatórios avançados
16. 📈 Análise de sentimento
17. 🔄 Sincronização automática

---

## 🔒 LIMITAÇÕES E RESTRIÇÕES

### O Que NÃO É Possível Fazer

- ❌ **Não pode deletar reviews** - Apenas o Google pode remover reviews
- ❌ **Não pode editar reviews** - Reviews são imutáveis
- ❌ **Não pode responder reviews de outros negócios** - Apenas seus próprios
- ❌ **Não pode ver informações de concorrentes** - Apenas seus próprios dados
- ❌ **Não pode criar reviews falsas** - Violaria termos de serviço
- ❌ **Não pode acessar dados pessoais dos clientes** - Apenas informações públicas

### Limites da API

- ⚠️ **Rate Limits:** Google limita requisições por minuto/hora
- ⚠️ **Tamanho de Resposta:** Máximo 4096 caracteres por resposta
- ⚠️ **Fotos:** Limite de tamanho e quantidade
- ⚠️ **Posts:** Limite de posts por período

---

## 💡 CASOS DE USO PRÁTICOS

### Caso 1: Gerente de Marketing
**Necessidade:** Monitorar e responder reviews rapidamente

**O que pode fazer:**
- Receber notificação imediata de novos reviews
- Ver todos os reviews em um só lugar
- Responder reviews diretamente na plataforma
- Usar templates para respostas rápidas
- Ver estatísticas de performance

### Caso 2: Proprietário de Múltiplas Lojas
**Necessidade:** Gerenciar reviews de todas as locations

**O que pode fazer:**
- Ver reviews de todas as locations
- Filtrar por location específica
- Comparar performance entre locations
- Gerenciar informações de cada location
- Ver estatísticas agregadas e por location

### Caso 3: Analista de Dados
**Necessidade:** Analisar tendências e melhorias

**O que pode fazer:**
- Exportar dados completos
- Ver gráficos de evolução temporal
- Analisar distribuição de ratings
- Identificar palavras-chave mais mencionadas
- Comparar períodos diferentes

### Caso 4: Atendimento ao Cliente
**Necessidade:** Responder reviews de forma eficiente

**O que pode fazer:**
- Ver reviews não respondidas
- Usar templates personalizados
- Gerar respostas com IA
- Ver histórico de respostas
- Priorizar reviews negativas

---

## 🚀 PRÓXIMOS PASSOS

Para desbloquear todas essas funcionalidades, precisamos:

1. **Corrigir placeholders** (accountId/locationId) - CRÍTICO
2. **Implementar busca real de locations** - CRÍTICO
3. **Implementar busca real de reviews** - CRÍTICO
4. **Adicionar filtros e paginação** - ALTA PRIORIDADE
5. **Implementar templates de resposta** - ALTA PRIORIDADE
6. **Adicionar insights do Google** - MÉDIA PRIORIDADE
7. **Implementar gerenciamento de locations** - MÉDIA PRIORIDADE
8. **Adicionar notificações** - MÉDIA PRIORIDADE
9. **Implementar automações** - BAIXA PRIORIDADE
10. **Adicionar relatórios avançados** - BAIXA PRIORIDADE

---

## 📞 SUPORTE

Para dúvidas sobre as capacidades da API do Google My Business:
- [Documentação Oficial](https://developers.google.com/my-business/content/overview)
- [Referência da API](https://developers.google.com/my-business/reference/rest)

