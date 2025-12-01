# 🚀 Controle Oliveira Martins - O Sistema Definitivo para Varejo de Moda

> **Transforme sua loja em uma máquina de vendas com automação, fidelização e gestão inteligente.**

Bem-vindo ao **Controle Oliveira Martins**, a plataforma SaaS (Software as a Service) projetada especificamente para revolucionar a gestão de lojas de varejo de moda. Não somos apenas um sistema; somos o parceiro estratégico que faltava para escalar o seu negócio.

---

## 💎 Por Que Escolher o Controle Oliveira Martins?

Você, lojista, sabe que o varejo é dinâmico. Clientes exigentes, estoque complexo, equipe para gerenciar... É fácil se perder no operacional e esquecer do estratégico.

Nós resolvemos as dores que tiram o seu sono:
*   **"Minhas vendedoras não batem meta"** -> Nosso sistema de **Metas Inteligentes e Gamificação** mantém sua equipe engajada e focada no resultado diário.
*   **"O cliente compra uma vez e some"** -> O **Cashback Automatizado via WhatsApp** garante que ele volte, criando um ciclo vicioso de recompra.
*   **"Perco muito tempo com planilhas"** -> Integração total com **Tiny ERP e Bling**, automatizando 100% da entrada de dados.
*   **"Não sei se estou lucrando"** -> Dashboards em tempo real mostram a saúde financeira da sua loja na palma da mão.

---

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

---

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

## 🛠️ Documentação Técnica (Para Desenvolvedores)

### Stack Tecnológica
*   **Frontend:** React, Vite, TailwindCSS, ShadcnUI.
*   **Backend:** Supabase (PostgreSQL, Auth, Edge Functions), Netlify Functions (Node.js).
*   **Integrações:** Tiny ERP API v3, Bling API v3, WhatsApp API (WPPConnect/Twilio).

### Arquitetura Multi-Tenancy
O sistema utiliza **Row Level Security (RLS)** do PostgreSQL para garantir isolamento absoluto de dados.
*   Cada tabela possui colunas `store_id` obrigatórias.
*   Policies do Supabase garantem que um usuário só acesse dados vinculados ao seu `store_id`.

### Automações (Webhooks & Cron)
*   `sync-tiny-orders`: Webhook que recebe pedidos do ERP em tempo real.
*   `process-cashback-queue`: Cron job que processa e envia mensagens de cashback.
*   `check-goals`: Verifica atingimento de metas diariamente.

### Instalação e Deploy
1.  Clone o repositório.
2.  `npm install`
3.  Configure as variáveis de ambiente no `.env` (Supabase URL, Keys).
4.  `npm run dev` para rodar localmente.
5.  Deploy automático via Netlify ao fazer push na `main`.

---

## 📞 Contato e Suporte

Pronto para escalar? Entre em contato com nosso time comercial.
*   **Email:** comercial@controleoliveiramartins.com.br
*   **WhatsApp:** (11) 99999-9999

---

*Desenvolvido com ❤️ e tecnologia de ponta para o varejo brasileiro.*
