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
*   `stores`: Tabela raiz de tenants. Cada loja é um registro aqui.
*   `profiles`: Usuários do sistema (Admins, Gerentes, Vendedoras), vinculados à `auth.users`.
*   `sales`: Registro de vendas, vinculadas a `store_id` e `colaboradora_id`.
*   `goals`: Metas de vendas (individuais e da loja).
*   `cashback_settings`: Configurações de fidelidade por loja.
*   `cashback_balance`: Saldo atual de cashback dos clientes finais.
*   `cashback_transactions`: Histórico de geração e resgate de cashback.
*   `tiny_orders` / `tiny_contacts`: Espelhos de dados sincronizados do ERP para performance.

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
| `process-cashback-whatsapp-queue` | Cron/API | Processa a fila de mensagens de WhatsApp pendentes. |
| `erp-api-proxy` | API | Gateway seguro para chamadas ao ERP, protegendo as credenciais. |
| `tiny-oauth-callback` | System | Callback de autenticação OAuth para conectar novas lojas ao Tiny ERP. |

### Automações (Cron Jobs)
*   **Expiração de Cashback:** Roda diariamente para invalidar saldos vencidos.
*   **Verificação de Metas:** Roda diariamente para calcular progresso e enviar notificações.

## 5. Integrações Externas
*   **Tiny ERP (API v3):** Sincronização bidirecional de pedidos, produtos e clientes.
*   **Bling (API v3):** Estrutura pronta para integração.
*   **WhatsApp API:** Integração para envio de notificações transacionais (Cashback, Metas).

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

### 2. 🎯 Gestão de Metas e Performance
Transforme suas vendedoras em consultoras de alta performance.
*   **Metas Individuais e de Loja:** Defina objetivos claros.
*   **Acompanhamento em Tempo Real:** Cada vendedora vê seu progresso diário.
*   **Super Meta:** Premie o esforço extraordinário.

### 3. 🔄 Integração ERP Transparente
Conecte-se ao **Tiny ERP** ou **Bling** em segundos.
*   Sincronização automática de **Pedidos, Produtos e Clientes**.
*   Sem digitação manual, sem erros humanos.

### 4. 📱 Interface Mobile-First Premium
Um sistema lindo, rápido e fácil de usar em qualquer dispositivo.
*   Design moderno e intuitivo.
*   Funciona no celular, tablet ou computador.

### 5. 🔐 Multi-Tenancy e Segurança Total
Seus dados são sagrados.
*   **Isolamento Total:** Cada loja vê apenas seus próprios dados.
*   **Controle de Acesso:** Níveis de permissão para Admin, Gerente e Vendedora.

## 🚀 Planos Comerciais

Escolha o plano ideal para o tamanho do seu sonho.

| Funcionalidade | **Starter** (R$ 97/mês) | **Pro** (R$ 197/mês) | **Enterprise** (R$ 497/mês) |
| :--- | :---: | :---: | :---: |
| **Lojas** | 1 Loja | Até 3 Lojas | Ilimitadas |
| **Colaboradoras** | Até 5 | Até 15 | Ilimitadas |
| **Cashback** | ✅ Sim | ✅ Sim | ✅ Sim |
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
