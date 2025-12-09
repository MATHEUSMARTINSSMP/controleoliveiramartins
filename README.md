# 🚀 Controle Oliveira Martins - Sistema de Gestão para Varejo

Bem-vindo ao repositório oficial do **Controle Oliveira Martins**. Este documento está dividido em duas partes:
1.  **Documentação Técnica:** Para desenvolvedores e arquitetos de sistema.
2.  **Apresentação Comercial:** Para lojistas e parceiros de negócios.

---

# 🛠️ Documentação Técnica

## 1. Visão Geral da Arquitetura
O sistema é uma aplicação **SaaS Multi-Tenant** construída sobre uma arquitetura moderna e serverless, garantindo escalabilidade infinita e baixo custo de manutenção.

*   **Frontend:** Single Page Application (SPA) em **React** com **Vite**, estilizada com **TailwindCSS** e componentes **ShadcnUI**.
*   **Backend:** **Supabase** (Backend-as-a-Service) fornecendo Banco de Dados PostgreSQL, Autenticação e Realtime.
*   **Serverless Functions:** **Netlify Functions** (Node.js) para lógica de negócios complexa, integrações e webhooks.
*   **Edge Functions:** **Supabase Edge Functions** (Deno) para operações de baixa latência.

## 2. Estrutura do Repositório
```bash
├── src/                  # Código fonte do Frontend (React)
│   ├── components/       # Componentes reutilizáveis (UI, Forms, Charts)
│   ├── pages/            # Páginas da aplicação (Rotas)
│   ├── hooks/            # Custom Hooks (useAuth, useToast)
│   └── lib/              # Utilitários e cliente Supabase
├── supabase/             # Configurações do Supabase
│   ├── migrations/       # Migrations SQL (Schema, RLS, Functions)
│   └── functions/        # Edge Functions (Deno)
├── netlify/              # Serverless Functions (Node.js)
│   └── functions/        # API Endpoints e Background Jobs
└── public/               # Assets estáticos
```

## 3. Banco de Dados e Schema (`sistemaretiradas`)
O banco de dados PostgreSQL é o coração do sistema, organizado no schema `sistemaretiradas`.

### Tabelas Principais

#### Core do Sistema
*   `stores`: Tabela raiz de tenants. Cada loja é um registro aqui.
*   `profiles`: Usuários do sistema (Admins, Gerentes, Vendedoras), vinculados à `auth.users`.
*   `sales`: Registro de vendas, vinculadas a `store_id` e `colaboradora_id`.
*   `goals`: Metas de vendas (individuais e da loja).
*   `tiny_orders` / `tiny_contacts`: Espelhos de dados sincronizados do ERP para performance.

#### Cashback e Fidelidade
*   `cashback_settings`: Configurações de fidelidade por loja.
*   `cashback_balance`: Saldo atual de cashback dos clientes finais.
*   `cashback_transactions`: Histórico de geração e resgate de cashback.
*   `cashback_whatsapp_queue`: Fila de mensagens de WhatsApp para notificações de cashback.

#### CRM (Customer Relationship Management)
*   `crm_contacts`: Contatos do CRM vinculados à loja.
*   `crm_tasks`: Tarefas e lembretes do CRM.
*   `crm_commitments`: Compromissos agendados com clientes.
*   `crm_post_sales`: Agendamentos automáticos de pós-venda.

#### Wishlist (Lista de Desejos)
*   `wishlist_items`: Produtos desejados por clientes (quando não estão disponíveis).

#### WhatsApp e Notificações
*   `whatsapp_credentials`: Credenciais de integração WhatsApp (UazAPI) por loja.
*   `uazapi_config`: Configurações de instância UazAPI.
*   `daily_goal_checks`: Sistema de check de meta diária com bônus.

#### Controle de Ponto (Time Clock)
*   `time_clock_records`: Registros de ponto (entrada, saída, intervalos).
*   `time_clock_digital_signatures`: Assinaturas digitais dos registros (compliance REP-P).
*   `time_clock_pins`: PINs de assinatura digital (separados da senha de acesso).
*   `time_clock_pin_audit_log`: Log de auditoria de alterações de PIN.
*   `time_clock_change_requests`: Solicitações de alteração de registros de ponto.
*   `colaboradora_work_schedules`: Jornadas de trabalho configuradas.
*   `work_schedule_templates`: Templates de jornada reutilizáveis.
*   `time_clock_hours_balance`: Banco de horas das colaboradoras.
*   `time_clock_occurrences`: Ocorrências e ajustes de ponto.
*   `collaborator_off_days`: Dias de folga e ausências.

### Segurança (RLS)
Utilizamos **Row Level Security (RLS)** para garantir isolamento total.
*   Todas as tabelas possuem `store_id`.
*   Policies garantem que `auth.uid()` só acesse linhas onde `store_id` corresponde ao perfil do usuário.

## 4. Funções Serverless e Automações

### Netlify Functions (Node.js)
Estas funções rodam na infraestrutura da Netlify e lidam com integrações e lógica pesada.

| Função | Tipo | Descrição |
| :--- | :--- | :--- |
| `cashback-redeem` | API | Processa o resgate de cashback, valida saldo e cria transação. |
| `create-colaboradora` | API | Cria novos usuários no Supabase Auth e Profiles, validando limites do plano. |
| `sync-tiny-orders` | Webhook | Recebe notificações de novos pedidos do Tiny ERP em tempo real. |
| `sync-tiny-contacts-background` | Background | Sincronização em massa de contatos do ERP (processamento assíncrono). |
| `process-cashback-whatsapp-queue` | Cron/API | Processa a fila de mensagens de WhatsApp pendentes para cashback. |
| `erp-api-proxy` | API | Gateway seguro para chamadas ao ERP, protegendo as credenciais. |
| `tiny-oauth-callback` | System | Callback de autenticação OAuth para conectar novas lojas ao Tiny ERP. |

### Supabase Edge Functions (Deno)
Funções de baixa latência rodando na edge do Supabase.

| Função | Tipo | Descrição |
| :--- | :--- | :--- |
| `sync-tiny-orders` | Edge | Sincronização em tempo real de pedidos do Tiny ERP. |

### Funções RPC (PostgreSQL)
Funções executadas diretamente no banco de dados PostgreSQL.

#### Sistema de Ponto (Time Clock)
*   `has_signature_pin(UUID)`: Verifica se colaboradora tem PIN cadastrado.
*   `set_signature_pin(UUID, UUID, TEXT)`: Cria ou atualiza PIN de assinatura digital.
*   `validate_signature_pin(UUID, TEXT)`: Valida PIN ao registrar ponto.
*   `insert_time_clock_digital_signature(...)`: Insere assinatura digital com validação de permissões.
*   `validate_time_clock_sequence(...)`: Valida sequência lógica de registros (ENTRADA → SAIDA_INTERVALO → etc).
*   `validate_time_clock_record_horario()`: Valida que registro não seja no futuro ou muito antigo.
*   `validate_max_records_per_day()`: Valida limite de 4 registros por dia.
*   `validate_change_request()`: Valida solicitação de alteração de registro.

#### Cashback
*   `expire_cashback()`: Expira saldos de cashback vencidos.
*   `count_total_orders(UUID, DATE, DATE)`: Conta total de pedidos de um cliente.

### Automações (Cron Jobs)
*   **Expiração de Cashback:** Roda diariamente para invalidar saldos vencidos.
*   **Verificação de Metas:** Roda diariamente para calcular progresso e enviar notificações.
*   **Processamento de Fila WhatsApp:** Processa mensagens pendentes de cashback e notificações.
*   **Sincronização Tiny Orders:** Sincronização automática de pedidos do ERP.
*   **Trigger de Pós-Venda:** Cria automaticamente agendamentos de pós-venda após vendas.

## 5. Módulos e Funcionalidades Principais

### 5.1. Sistema de Cashback e Fidelidade
*   Geração automática de cashback a cada compra.
*   Notificações via WhatsApp quando cashback é gerado.
*   Sistema de resgate com validação de saldo.
*   Configuração de percentual e validade por loja.
*   Histórico completo de transações.

### 5.2. CRM (Customer Relationship Management)
*   **Gestão de Contatos:** Cadastro completo de clientes com dados pessoais e preferências.
*   **Tarefas e Lembretes:** Sistema de tarefas com prioridades (ALTA, MÉDIA, BAIXA) e status.
*   **Compromissos Agendados:** Agendamento de contatos futuros com clientes.
*   **Pós-Venda Automático:** Criação automática de agendamentos após vendas (configurável por loja).
*   **Integração com Wishlist:** Vinculação automática de itens de wishlist com contatos CRM.

### 5.3. Wishlist (Lista de Desejos)
*   Cadastro de produtos desejados por clientes quando não estão disponíveis.
*   Busca inteligente com autocomplete de produtos.
*   Suporte a clientes registrados ou não registrados.
*   Especificações detalhadas (tamanho, cor, modelo).
*   Data limite para aviso opcional.
*   Integração com CRM para agendamento de contatos.
*   Botão WhatsApp direto para contato imediato.
*   Gestão completa no Admin Dashboard.

### 5.4. Sistema de Controle de Ponto (Time Clock)
*   **Registro de Ponto:** Entrada, saída, saída para intervalo e retorno do intervalo.
*   **Assinatura Digital:** Sistema de PIN separado da senha (compliance REP-P - Portaria 671/2021).
*   **Validações Inteligentes:**
    *   Prevenção de registros duplicados no mesmo minuto.
    *   Validação de sequência lógica (ENTRADA → SAIDA_INTERVALO → ENTRADA_INTERVALO → SAIDA).
    *   Prevenção de registros no futuro (tolerância de 5 minutos).
    *   Limite de 4 registros por dia (exceto lançamento manual).
*   **Jornada de Trabalho:** Configuração de horários e carga horária diária.
*   **Banco de Horas:** Cálculo automático de saldo de horas (crédito/débito).
*   **Lançamento Manual:** Admin pode criar registros manualmente para colaboradoras.
*   **Solicitação de Alteração:** Colaboradoras podem solicitar correções em seus registros.
*   **Relatórios PDF:** Geração de relatórios mensais em formato retrato, uma página por mês.
*   **Indicadores Visuais:** Marcação clara de registros manuais e assinaturas digitais nos relatórios.

### 5.5. Sistema de Notificações e Avisos
*   **Notificações Push:** Notificações em tempo real de novas vendas.
*   **WhatsApp Integrado:** Envio automático de mensagens via WhatsApp para:
    *   Notificação de cashback gerado.
    *   Lembretes de metas diárias.
    *   Avisos de produtos disponíveis (wishlist).
    *   Notificações de compromissos agendados (CRM).
*   **Check de Meta Diária:** Sistema de confirmação de meta com bônus configurável.
*   **Alertas de Tarefas:** Notificações de tarefas pendentes no CRM.

### 5.6. Gestão de Metas e Performance
*   Metas individuais e de loja.
*   Acompanhamento em tempo real.
*   Sistema de Super Meta.
*   Gamificação com bônus e prêmios.
*   Relatórios de performance.

## 6. Integrações Externas
*   **Tiny ERP (API v3):** Sincronização bidirecional de pedidos, produtos e clientes em tempo real.
*   **Bling (API v3):** Estrutura pronta para integração.
*   **WhatsApp (UazAPI):** Integração completa para envio de mensagens transacionais:
    *   Notificações de cashback.
    *   Lembretes de metas.
    *   Avisos de produtos disponíveis.
    *   Mensagens de pós-venda.
    *   Notificações de compromissos.

---

# 💎 Apresentação Comercial

> **Transforme sua loja em uma máquina de vendas com automação, fidelização e gestão inteligente.**

O **Controle Oliveira Martins** é a plataforma definitiva para o varejo de moda. Resolvemos as dores operacionais para que você foque no crescimento.

## � Por Que Escolher o Controle Oliveira Martins?

Você, lojista, sabe que o varejo é dinâmico. Clientes exigentes, estoque complexo, equipe para gerenciar... É fácil se perder no operacional e esquecer do estratégico.

Nós resolvemos as dores que tiram o seu sono:
*   **"Minhas vendedoras não batem meta"** -> Nosso sistema de **Metas Inteligentes e Gamificação** mantém sua equipe engajada e focada no resultado diário.
*   **"O cliente compra uma vez e some"** -> O **Cashback Automatizado via WhatsApp** garante que ele volte, criando um ciclo vicioso de recompra.
*   **"Perco muito tempo com planilhas"** -> Integração total com **Tiny ERP e Bling**, automatizando 100% da entrada de dados.
*   **"Não sei se estou lucrando"** -> Dashboards em tempo real mostram a saúde financeira da sua loja na palma da mão.

## 🔥 Funcionalidades que Geram Lucro

### 1. 💰 Cashback Automatizado (A Máquina de Retenção)
Esqueça cartões fidelidade de papel. Nosso sistema gera cashback automaticamente a cada compra e envia uma notificação via **WhatsApp** para o cliente, criando um senso de urgência para o retorno.
*   **Gatilho Mental da Reciprocidade:** O cliente ganha um bônus e se sente compelido a usar.
*   **Gatilho da Escassez:** O cashback tem validade, acelerando a decisão de compra.
*   **Notificação Automática:** Cliente recebe mensagem no WhatsApp assim que o cashback é gerado.

### 2. 🎯 Gestão de Metas e Performance
Transforme suas vendedoras em consultoras de alta performance.
*   **Metas Individuais e de Loja:** Defina objetivos claros.
*   **Acompanhamento em Tempo Real:** Cada vendedora vê seu progresso diário.
*   **Super Meta:** Premie o esforço extraordinário.
*   **Check de Meta Diária:** Sistema de confirmação com bônus configurável.
*   **Notificações Push:** Avisos em tempo real de novas vendas e conquistas.

### 3. 📋 CRM Completo (Gestão de Relacionamento)
Nunca mais perca um cliente. Gerencie todos os relacionamentos em um só lugar.
*   **Contatos Organizados:** Cadastro completo com dados pessoais, preferências e histórico.
*   **Tarefas e Lembretes:** Nunca esqueça de ligar para um cliente ou fazer um follow-up.
*   **Compromissos Agendados:** Agende contatos futuros e receba lembretes.
*   **Pós-Venda Automático:** Sistema cria automaticamente agendamentos após vendas.
*   **Integração com Wishlist:** Quando um produto desejado chega, o CRM avisa automaticamente.

### 4. 🛍️ Wishlist (Lista de Desejos)
Transforme "não temos" em vendas futuras garantidas.
*   **Cadastro Rápido:** Cliente quer algo que não está disponível? Cadastre na hora.
*   **Busca Inteligente:** Autocomplete de produtos para cadastro rápido.
*   **Aviso Automático:** Quando o produto chegar, o sistema avisa o cliente via WhatsApp.
*   **Integração CRM:** Cria automaticamente tarefa de contato quando produto chega.

### 5. ⏰ Controle de Ponto Digital (REP-P Compliance)
Sistema completo de controle de ponto em conformidade com a Portaria 671/2021.
*   **Registro Simples:** Colaboradoras registram ponto com PIN de assinatura digital.
*   **Validações Inteligentes:** Sistema previne erros e registros duplicados.
*   **Banco de Horas Automático:** Cálculo automático de saldo de horas.
*   **Relatórios Profissionais:** Geração de relatórios mensais em PDF.
*   **Lançamento Manual:** Admin pode criar registros quando necessário.
*   **Solicitação de Alteração:** Colaboradoras podem solicitar correções.

### 6. 📱 WhatsApp Próprio Integrado
Comunicação direta com clientes via WhatsApp da sua loja.
*   **Mensagens Automáticas:** Cashback, avisos de produtos, lembretes.
*   **Notificações Push:** Avisos de novas vendas em tempo real.
*   **Integração UazAPI:** Use seu próprio número de WhatsApp.
*   **Gestão Centralizada:** Todas as mensagens gerenciadas no sistema.

### 7. 🔄 Integração ERP Transparente
Conecte-se ao **Tiny ERP** ou **Bling** em segundos.
*   Sincronização automática de **Pedidos, Produtos e Clientes**.
*   Sem digitação manual, sem erros humanos.
*   Sincronização em tempo real via webhooks.

### 8. 📱 Interface Mobile-First Premium
Um sistema lindo, rápido e fácil de usar em qualquer dispositivo.
*   Design moderno e intuitivo.
*   Funciona no celular, tablet ou computador.
*   PWA (Progressive Web App) para instalação como app.

### 9. 🔐 Multi-Tenancy e Segurança Total
Seus dados são sagrados.
*   **Isolamento Total:** Cada loja vê apenas seus próprios dados.
*   **Controle de Acesso:** Níveis de permissão para Admin, Gerente e Vendedora.
*   **Assinatura Digital:** Sistema de PIN separado para maior segurança no ponto.

## 🚀 Planos Comerciais

Escolha o plano ideal para o tamanho do seu sonho.

| Funcionalidade | **Starter** (R$ 97/mês) | **Pro** (R$ 197/mês) | **Enterprise** (R$ 497/mês) |
| :--- | :---: | :---: | :---: |
| **Lojas** | 1 Loja | Até 3 Lojas | Ilimitadas |
| **Colaboradoras** | Até 5 | Até 15 | Ilimitadas |
| **Cashback** | ✅ Sim | ✅ Sim | ✅ Sim |
| **CRM** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Wishlist** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Controle de Ponto** | ✅ Sim | ✅ Sim | ✅ Sim |
| **WhatsApp Integrado** | ❌ | ✅ Sim | ✅ Sim |
| **Notificações Push** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Integração ERP** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Suporte** | Email | WhatsApp | Prioritário 24/7 |

> **Oferta Especial de Lançamento:** Assine o plano anual e ganhe **2 meses grátis**!

---

## 📞 Contato e Suporte

Pronto para escalar? Entre em contato com nosso time comercial.
*   **Email:** comercial@controleoliveiramartins.com.br
*   **WhatsApp:** (11) 99999-9999

---

*Desenvolvido com ❤️ e tecnologia de ponta para o varejo brasileiro.*
