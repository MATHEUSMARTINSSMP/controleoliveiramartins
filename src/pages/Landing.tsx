import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Check, 
  Zap, 
  BarChart3, 
  Target, 
  Trophy, 
  Users, 
  Shield, 
  Clock, 
  TrendingUp,
  Smartphone,
  Globe,
  ChevronRight,
  Star,
  Sparkles,
  Gift,
  MessageSquare,
  DollarSign,
  Activity,
  RefreshCw,
  ChevronDown,
  ShoppingCart,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Lock,
  Wallet,
  PiggyBank,
  Users2,
  Bell,
  Timer,
  TrendingDown,
  Heart,
  Eye,
  Repeat,
  Send,
  ClipboardCheck,
  Building2,
  Award,
  Flame,
  ArrowUpRight,
  Play,
  Quote,
  Headphones,
  Percent,
  LayoutDashboard,
  Store,
  Fingerprint,
  LineChart,
  Package,
  Banknote
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import heroImage from '@assets/stock_images/professional_woman_b_4e935334.jpg';
import storeImage from '@assets/stock_images/modern_retail_store__7569e2ea.jpg';
import teamImage from '@assets/stock_images/team_celebrating_suc_98e01156.jpg';

export default function Landing() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [animatedStats, setAnimatedStats] = useState({ vendas: 0, tempo: 0, retorno: 0, lojas: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        vendas: Math.round(35 * progress),
        tempo: Math.round(10 * progress),
        retorno: Math.round(67 * progress),
        lojas: Math.round(150 * progress)
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  const painPoints = [
    {
      icon: <AlertTriangle className="h-8 w-8 text-red-500" />,
      problem: "Colaboradoras solicitam adiantamentos frequentes e você perdeu o controle dos valores pendentes?",
      consequence: "O fechamento da folha revela déficits inesperados, gerando conflitos trabalhistas e prejuízos financeiros recorrentes.",
      solution: "Sistema inteligente de adiantamentos com limites automáticos, parcelamento controlado e notificações instantâneas via WhatsApp. Cada colaboradora visualiza em tempo real seu limite disponível e histórico de débitos."
    },
    {
      icon: <TrendingDown className="h-8 w-8 text-red-500" />,
      problem: "Incerteza sobre a rentabilidade real da operação ao final de cada período?",
      consequence: "Esforço intenso sem retorno proporcional. Despesas se acumulam sem visibilidade, comprometendo a saúde financeira do negócio.",
      solution: "DRE (Demonstrativo de Resultado) automatizado com integração completa. Visualize receitas, despesas e lucro líquido em tempo real, com precisão contábil e sem necessidade de planilhas manuais."
    },
    {
      icon: <Eye className="h-8 w-8 text-red-500" />,
      problem: "Vendas realizadas sem seu conhecimento imediato, descobertas apenas dias depois?",
      consequence: "Perda de controle operacional, vendas não contabilizadas, metas desacompanhadas e equipe desmotivada pela falta de reconhecimento.",
      solution: "Notificação instantânea via WhatsApp a cada venda concluída. Receba no celular: identificação do vendedor, valor da transação, forma de pagamento e progresso da meta diária."
    },
    {
      icon: <Users className="h-8 w-8 text-red-500" />,
      problem: "Clientes que realizam uma compra e desaparecem, sem nunca retornar à loja?",
      consequence: "Custo de aquisição elevado, vendas esporádicas e faturamento instável. Oportunidades de fidelização desperdiçadas.",
      solution: "Programa de cashback automatizado com comunicação via WhatsApp. O cliente recebe: \"Você possui R$ 50,00 de crédito disponível, válido até [data]\". O retorno acontece naturalmente, sem esforço adicional."
    },
    {
      icon: <Clock className="h-8 w-8 text-red-500" />,
      problem: "Impossibilidade de comprovar horários de entrada e saída das colaboradoras?",
      consequence: "Exposição a processos trabalhistas, pagamento de horas extras indevidas e ausência de controle efetivo sobre a jornada de trabalho.",
      solution: "Ponto digital com assinatura eletrônica por PIN, em total conformidade com a CLT e Portaria 671/2021. Registro completo de entrada, saída e intervalos, com relatórios em PDF prontos para fiscalização."
    },
    {
      icon: <Target className="h-8 w-8 text-red-500" />,
      problem: "Equipe operando sem clareza sobre metas diárias, em modo automático?",
      consequence: "Performance abaixo do potencial, ausência de foco direcionado e resultados medianos consistentes.",
      solution: "Metas diárias inteligentes com ponderação por dia da semana (sábado representa 15%, segunda-feira 8%). A colaboradora visualiza ao abrir o aplicativo: \"Sua meta para hoje: R$ 2.500,00\". Objetivo claro e mensurável."
    }
  ];

  const transformations = [
    {
      before: "Planilhas desatualizadas e dados fragmentados",
      after: "Dashboard centralizado com atualização em tempo real",
      icon: <BarChart3 className="h-6 w-6" />
    },
    {
      before: "Equipe desmotivada sem reconhecimento adequado",
      after: "Gincanas gamificadas com premiações e ranking dinâmico",
      icon: <Trophy className="h-6 w-6" />
    },
    {
      before: "Clientes com compra única, sem retorno à loja",
      after: "Programa de fidelização que gera retorno automático",
      icon: <Repeat className="h-6 w-6" />
    },
    {
      before: "Horas dedicadas a relatórios manuais",
      after: "Relatórios automatizados em PDF e Excel com um clique",
      icon: <FileText className="h-6 w-6" />
    },
    {
      before: "Metas fixas desconectadas da realidade operacional",
      after: "Metas dinâmicas com ponderação inteligente por período",
      icon: <Calendar className="h-6 w-6" />
    },
    {
      before: "Comunicação dispersa em grupos desordenados",
      after: "Notificações WhatsApp estruturadas e automatizadas",
      icon: <MessageSquare className="h-6 w-6" />
    }
  ];

  const modules = [
    {
      title: "Monitoramento de Vendas em Tempo Real",
      description: "Cada transação registrada dispara uma notificação instantânea via WhatsApp. Acompanhe de qualquer localização: identificação do vendedor, valor transacionado, método de pagamento e status da meta diária. Histórico completo com filtros avançados e exportação para análise.",
      icon: <TrendingUp className="h-8 w-8" />,
      highlight: "Notificação Instantânea",
      details: ["Alertas em tempo real via WhatsApp", "Dashboard com métricas atualizadas", "Histórico detalhado por colaborador", "Comparativo com períodos anteriores"]
    },
    {
      title: "Sistema de Metas Inteligentes",
      description: "Abandone metas lineares e inflexíveis. Configure ponderações específicas para cada dia da semana (sábado com peso de 15%, segunda-feira com 8%). O sistema redistribui automaticamente os valores quando colaboradoras estão em período de folga, mantendo a equidade e motivação da equipe.",
      icon: <Target className="h-8 w-8" />,
      highlight: "Redistribuição Automática",
      details: ["Ponderação por dia da semana", "Redistribuição em folgas e férias", "Acompanhamento individual e coletivo", "Alertas de performance em tempo real"]
    },
    {
      title: "Gincanas e Competições Gamificadas",
      description: "Crie dinâmicas competitivas semanais ou mensais com premiações configuráveis. Ranking atualizado em tempo real, definição de meta e super-meta com bonificações progressivas. Primeiro a atingir o objetivo garante o prêmio. Engajamento natural sem necessidade de cobrança direta.",
      icon: <Trophy className="h-8 w-8" />,
      highlight: "Gamificação Avançada",
      details: ["Ranking em tempo real", "Premiações configuráveis", "Metas e super-metas", "Histórico de conquistas"]
    },
    {
      title: "Cashback Automatizado com WhatsApp",
      description: "Cliente realiza compra de R$ 500, automaticamente recebe R$ 25 de cashback. Mensagem enviada via WhatsApp: \"Você possui crédito de R$ 25,00, válido até o dia 15\". O cliente retorna naturalmente, você não precisa executar nenhuma ação manual. Taxa de retorno média: 67%.",
      icon: <Gift className="h-8 w-8" />,
      highlight: "Fidelização Automática",
      details: ["Percentuais configuráveis por categoria", "Validade personalizada", "Notificações automáticas de lembrete", "Relatório de ROI do programa"]
    },
    {
      title: "Gestão de Adiantamentos e Benefícios",
      description: "Colaboradora solicita adiantamento diretamente pelo aplicativo. Sistema verifica automaticamente o limite disponível, aprova ou recusa com base em regras predefinidas. Parcelas são descontadas automaticamente na folha. Zero surpresas no fechamento mensal, controle total sobre o passivo.",
      icon: <Wallet className="h-8 w-8" />,
      highlight: "Controle Automatizado",
      details: ["Limites configuráveis por colaborador", "Parcelamento automático", "Histórico completo de transações", "Integração com folha de pagamento"]
    },
    {
      title: "Ponto Digital — Conformidade REP-P",
      description: "Sistema de registro de ponto em total conformidade com a Portaria 671/2021 do MTE e legislação CLT. Assinatura digital via PIN pessoal, registro de entrada, saída e intervalos. Solicitação de alterações pelo aplicativo com aprovação do gestor. Relatório em PDF pronto para apresentação em fiscalizações.",
      icon: <ClipboardCheck className="h-8 w-8" />,
      highlight: "100% Legal",
      details: ["Assinatura digital por PIN", "Conformidade Portaria 671/2021", "Relatórios para fiscalização", "Gestão de banco de horas"]
    },
    {
      title: "CRM Completo para Relacionamento",
      description: "Conheça profundamente cada cliente: data de aniversário, histórico completo de compras, tempo desde última visita, preferências registradas. Crie tarefas automatizadas: \"Contatar Maria no dia 15 para apresentar nova coleção\". Nunca mais perca uma oportunidade de follow-up ou data especial.",
      icon: <Heart className="h-8 w-8" />,
      highlight: "Relacionamento 360°",
      details: ["Perfil completo do cliente", "Histórico de interações", "Tarefas e lembretes automáticos", "Segmentação por comportamento"]
    },
    {
      title: "DRE Financeiro Automatizado",
      description: "Conecte suas fontes de dados financeiros e visualize em tempo real: receitas por categoria, despesas detalhadas e lucro líquido efetivo. Sem necessidade de conhecimento contábil avançado — o sistema estrutura o relatório de forma intuitiva. Comparativos mensais e projeções baseadas em tendências.",
      icon: <PiggyBank className="h-8 w-8" />,
      highlight: "Lucro Real Visível",
      details: ["Integração com fontes financeiras", "Categorização automática", "Comparativos de período", "Projeções e tendências"]
    },
    {
      title: "Integração Nativa com Tiny ERP",
      description: "Sincronização bidirecional em tempo real com o Tiny ERP. Pedido registrado no ERP aparece instantaneamente no EleveaOne. Mapeamento inteligente entre vendedores do ERP e colaboradoras do sistema. Monitoramento de erros de sincronização com alertas automáticos.",
      icon: <RefreshCw className="h-8 w-8" />,
      highlight: "Sync em Segundos",
      details: ["Sincronização automática", "Mapeamento de vendedores", "Monitoramento de erros", "Logs detalhados de transações"]
    },
    {
      title: "Sistema de Alertas e Tarefas",
      description: "Configure lembretes recorrentes personalizados: \"Todos os dias às 9h enviar briefing para a equipe via WhatsApp\", \"Toda segunda às 8h lembrar check de estoque\". O sistema executa automaticamente, você nunca mais esquece uma rotina operacional crítica.",
      icon: <Bell className="h-8 w-8" />,
      highlight: "Automação Total",
      details: ["Agendamento recorrente", "Múltiplos canais de notificação", "Templates personalizáveis", "Confirmação de execução"]
    },
    {
      title: "Check de Meta Diária Gamificado",
      description: "Colaboradora acessa o aplicativo e confirma visualização da meta do dia. Quem confirmar até o horário limite (ex: 10h) acumula pontos que convertem em bonificação ao final do mês. Gamificação que cria consistência comportamental e garante alinhamento diário da equipe.",
      icon: <CheckCircle2 className="h-8 w-8" />,
      highlight: "Bonificação por Consistência",
      details: ["Horário limite configurável", "Sistema de pontuação", "Conversão em bonificação", "Ranking de consistência"]
    },
    {
      title: "Gestão Multi-Loja Centralizada",
      description: "Administre uma unidade ou uma rede completa. Cada loja opera com suas próprias metas, equipe e credenciais de WhatsApp dedicadas. Dados completamente isolados por segurança, com visão consolidada para a gestão. Escalabilidade sem limites técnicos.",
      icon: <Building2 className="h-8 w-8" />,
      highlight: "Escale Sem Limites",
      details: ["Dados isolados por unidade", "WhatsApp dedicado por loja", "Dashboard consolidado", "Permissões granulares"]
    }
  ];

  const stats = [
    { value: animatedStats.vendas, suffix: "%", label: "Aumento médio em vendas", sublabel: "nos primeiros 90 dias de uso" },
    { value: animatedStats.tempo, suffix: "h", label: "Economizadas semanalmente", sublabel: "em processos operacionais" },
    { value: animatedStats.retorno, suffix: "%", label: "Taxa de retorno de clientes", sublabel: "com programa de cashback ativo" },
    { value: animatedStats.lojas, suffix: "+", label: "Lojas utilizam a plataforma", sublabel: "em todo o território nacional" }
  ];

  const plans = [
    {
      name: "Starter",
      price: "249",
      period: "/mês",
      description: "Para operações que buscam organização e controle inicial",
      features: [
        "1 Loja",
        "Até 5 colaboradoras",
        "Dashboard completo de vendas",
        "Sistema de metas diárias",
        "Controle de ponto digital (CLT)",
        "Relatórios básicos em PDF",
        "Suporte por e-mail em horário comercial"
      ],
      notIncluded: [
        "Integração WhatsApp",
        "Programa de cashback",
        "DRE financeiro automatizado",
        "Integração Tiny ERP"
      ],
      popular: false,
      cta: "Iniciar Período de Testes"
    },
    {
      name: "Business",
      price: "499",
      period: "/mês",
      description: "Para negócios em crescimento que exigem automação completa",
      features: [
        "Até 3 Lojas",
        "Até 25 colaboradoras",
        "Todas as funcionalidades Starter",
        "Integração WhatsApp Business",
        "Programa de cashback automatizado",
        "Integração completa Tiny ERP",
        "Gincanas e competições gamificadas",
        "CRM completo com histórico de clientes",
        "Suporte prioritário via WhatsApp"
      ],
      notIncluded: [
        "DRE financeiro avançado"
      ],
      popular: true,
      cta: "Começar Agora — 14 Dias Grátis"
    },
    {
      name: "Enterprise",
      price: "799",
      period: "/mês",
      description: "Para redes que dominam o mercado e exigem excelência operacional",
      features: [
        "Até 10 Lojas (7 + 3 bônus)",
        "Até 90 colaboradoras (80 + 10 bônus)",
        "Todas as funcionalidades Business",
        "DRE financeiro automatizado completo",
        "Suporte prioritário 24/7",
        "Treinamento completo da equipe",
        "Onboarding dedicado com especialista",
        "Consultoria mensal de performance",
        "API para integrações personalizadas"
      ],
      notIncluded: [],
      popular: false,
      cta: "Falar com Especialista"
    }
  ];

  const testimonials = [
    {
      quote: "Antes eu dedicava semanas inteiras cobrando metas individualmente. Agora o sistema automatiza completamente esse processo. As colaboradoras visualizam suas metas diárias no celular e se autogerenciam. Meu papel mudou de fiscal para estrategista.",
      author: "Patrícia Silveira",
      role: "Proprietária de 2 lojas de moda feminina — São Paulo, SP",
      highlight: "Equipe autogerenciável",
      avatar: "PS"
    },
    {
      quote: "O cashback automatizado transformou nosso índice de recompra. Clientes que nunca retornavam agora voltam sozinhos — recebem a notificação no WhatsApp e aparecem. Nosso faturamento mensal aumentou 42% em apenas 4 meses.",
      author: "Roberto Carvalho",
      role: "Diretor de rede com 4 lojas — Curitiba, PR",
      highlight: "42% de aumento em faturamento",
      avatar: "RC"
    },
    {
      quote: "A conformidade do ponto digital com a Portaria 671 foi determinante. Tivemos uma fiscalização surpresa e apresentamos os relatórios em PDF diretamente do sistema. Zero pendências, zero multas. Investimento que se paga sozinho.",
      author: "Fernanda Almeida",
      role: "Gerente de RH — Rede de franquias, BH",
      highlight: "Conformidade total em fiscalização",
      avatar: "FA"
    }
  ];

  const faqs = [
    {
      question: "É necessário conhecimento técnico para utilizar o sistema?",
      answer: "Absolutamente não. O EleveaOne foi desenvolvido especificamente para gestores e proprietários de varejo, não para profissionais de tecnologia. A interface é intuitiva e autoexplicativa — se você utiliza WhatsApp, você domina o EleveaOne. Além disso, oferecemos treinamento completo durante o onboarding."
    },
    {
      question: "Quais sistemas ERP são compatíveis com a integração?",
      answer: "Atualmente oferecemos integração nativa e completa com o Tiny ERP, incluindo sincronização bidirecional de pedidos, clientes e vendedores. Integração com Bling está em desenvolvimento avançado. Para outros sistemas, disponibilizamos API documentada que permite integrações personalizadas."
    },
    {
      question: "O sistema funciona adequadamente em dispositivos móveis?",
      answer: "Sim, 100% responsivo e otimizado para qualquer dispositivo. Colaboradoras registram vendas e ponto diretamente pelo celular. Gestores acompanham métricas e recebem notificações em tempo real de qualquer localização. Não é necessário instalação de aplicativo — funciona no navegador."
    },
    {
      question: "Como funciona tecnicamente o programa de cashback automatizado?",
      answer: "Você define o percentual de cashback (exemplo: 5% sobre valor da compra). A cada venda registrada, o sistema calcula e credita automaticamente o valor na conta do cliente. Uma mensagem é enviada via WhatsApp informando o crédito disponível e data de validade. Quando o cliente retorna, o sistema aplica o desconto automaticamente. Relatórios completos de ROI do programa estão disponíveis."
    },
    {
      question: "O controle de ponto digital está em conformidade com a legislação trabalhista?",
      answer: "Sim, em total conformidade com a Portaria 671/2021 do Ministério do Trabalho e normas da CLT. O sistema opera como REP-P (Registrador Eletrônico de Ponto via Programa), com assinatura digital por PIN individual, registros inalteráveis e relatórios em formato aceito pela fiscalização. Auditoria completa de todas as alterações."
    },
    {
      question: "Existe período de teste gratuito antes da contratação?",
      answer: "Sim. Oferecemos 14 dias de acesso completo e gratuito para avaliação de todas as funcionalidades. Não solicitamos dados de cartão de crédito para o período de testes. Ao final, você decide se deseja continuar — sem compromisso e sem pressão."
    },
    {
      question: "Como funciona o suporte técnico e operacional?",
      answer: "O nível de suporte varia conforme o plano contratado. Starter: suporte por e-mail em horário comercial. Business: suporte prioritário via WhatsApp. Enterprise: suporte 24/7 com tempo de resposta garantido, além de consultoria mensal e treinamento contínuo da equipe."
    },
    {
      question: "Meus dados estão seguros na plataforma?",
      answer: "Segurança é prioridade absoluta. Utilizamos criptografia de ponta a ponta, servidores com certificação de segurança, backups automáticos diários e política rigorosa de privacidade conforme LGPD. Dados de cada loja são completamente isolados no sistema multi-tenant."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">EleveaOne</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#desafios" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-desafios">Desafios</a>
            <a href="#solucoes" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-solucoes">Soluções</a>
            <a href="#modulos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-modulos">Módulos</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-planos">Planos</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-faq">Dúvidas</a>
          </nav>
          <Button onClick={() => navigate('/auth')} size="sm" data-testid="button-header-login">
            Acessar Plataforma
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section with Image */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Gestora utilizando tecnologia para gerenciar sua loja"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Animated Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-1">
          <div 
            className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
            style={{ transform: `translateY(${scrollY * 0.2}px)` }}
          />
          <div 
            className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
            style={{ transform: `translateY(${-scrollY * 0.1}px)` }}
          />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="max-w-3xl space-y-8">
            {/* Social Proof Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Mais de 150 lojas confiam no EleveaOne</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Transforme sua operação de varejo com{" "}
              <span className="text-primary">automação inteligente</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
              Centralize gestão de vendas, metas, cashback, controle de ponto e relacionamento com clientes em uma única plataforma. 
              <strong className="text-foreground"> Resultados mensuráveis desde o primeiro mês.</strong>
            </p>

            {/* Value Proposition List */}
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              {[
                "Aumento médio de 35% nas vendas",
                "10 horas semanais economizadas",
                "67% de retorno com cashback",
                "100% conformidade trabalhista"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm md:text-base">{item}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4 pt-4">
              <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate('/auth')} data-testid="button-hero-cta">
                Iniciar Período Gratuito de 14 Dias
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 backdrop-blur-sm" onClick={() => document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-hero-secondary">
                <Play className="mr-2 h-5 w-5" />
                Conhecer Funcionalidades
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-6 pt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <span>Criptografia de ponta a ponta</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                <span>Implementação em 15 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Sem fidelidade contratual</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  {stat.value}{stat.suffix}
                </div>
                <div className="font-medium">{stat.label}</div>
                <div className="text-sm text-primary-foreground/70">{stat.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="desafios" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Identificação de Desafios</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Reconhece alguma dessas situações no seu dia a dia?
            </h2>
            <p className="text-xl text-muted-foreground">
              O problema não é falta de dedicação — é ausência de processos automatizados e ferramentas adequadas.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {painPoints.map((point, index) => (
              <Card key={index} className="group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      {point.icon}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg leading-tight">{point.problem}</h3>
                    <p className="text-sm text-red-500/80 flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {point.consequence}
                    </p>
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {point.solution}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Store Image Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline">A Solução Completa</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                Uma plataforma unificada para toda a operação do seu varejo
              </h2>
              <p className="text-lg text-muted-foreground">
                O EleveaOne integra todas as áreas críticas do seu negócio: vendas, metas, fidelização, controle de jornada, relacionamento com clientes e análise financeira. Tudo sincronizado, automatizado e acessível de qualquer dispositivo.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Store className="h-5 w-5" />, text: "Gestão multi-loja com dados isolados e seguros" },
                  { icon: <MessageSquare className="h-5 w-5" />, text: "Integração nativa com WhatsApp Business" },
                  { icon: <Fingerprint className="h-5 w-5" />, text: "Conformidade total com legislação trabalhista" },
                  { icon: <LineChart className="h-5 w-5" />, text: "Relatórios automatizados e análises preditivas" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">{item.icon}</div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => navigate('/auth')} data-testid="button-solution-cta">
                Experimentar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-2xl" />
              <img 
                src={storeImage} 
                alt="Interior de loja de varejo moderna"
                className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Transformation Section */}
      <section id="solucoes" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Transformação Operacional</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Do caos operacional ao controle estratégico
            </h2>
            <p className="text-xl text-muted-foreground">
              Veja a evolução concreta que nossos clientes experimentam após a implementação
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transformations.map((item, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center mb-6">
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      {item.icon}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <span className="text-sm line-through text-muted-foreground">{item.before}</span>
                    </div>
                    <div className="flex justify-center">
                      <ArrowUpRight className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.after}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modulos" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Funcionalidades Completas</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              12 módulos integrados que automatizam sua operação
            </h2>
            <p className="text-xl text-muted-foreground">
              Cada funcionalidade foi desenvolvida para resolver desafios reais do varejo brasileiro, com base em feedback de mais de 150 operações
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-primary/20">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {module.icon}
                    </div>
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">{module.highlight}</Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{module.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{module.description}</p>
                    <div className="space-y-2">
                      {module.details.map((detail, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Depoimentos Reais</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Gestores como você já transformaram suas operações
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <Quote className="h-8 w-8 text-primary/20" />
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-semibold">{testimonial.author}</div>
                        <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-3 text-xs">{testimonial.highlight}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Image Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-2xl" />
              <img 
                src={teamImage} 
                alt="Equipe celebrando conquistas e metas atingidas"
                className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <Badge variant="outline">Cultura de Alta Performance</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">
                Equipes engajadas entregam resultados extraordinários
              </h2>
              <p className="text-lg text-muted-foreground">
                O EleveaOne não é apenas uma ferramenta de gestão — é um catalisador de cultura organizacional. Com gamificação inteligente, transparência de metas e reconhecimento automatizado, sua equipe desenvolve autonomia e senso de propriedade.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Trophy className="h-5 w-5" />, text: "Gincanas com premiações que motivam de verdade" },
                  { icon: <Target className="h-5 w-5" />, text: "Metas claras e visíveis para toda a equipe" },
                  { icon: <Award className="h-5 w-5" />, text: "Ranking dinâmico que celebra as conquistas" },
                  { icon: <Users className="h-5 w-5" />, text: "Comunicação automatizada e estruturada" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">{item.icon}</div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Investimento</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Planos desenvolvidos para cada estágio do seu negócio
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha o plano adequado à sua operação atual — você pode escalar a qualquer momento
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative overflow-hidden ${plan.popular ? 'border-2 border-primary shadow-xl scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg">Mais Popular</Badge>
                  </div>
                )}
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate('/auth')}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                  >
                    {plan.cta}
                  </Button>
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Incluso no plano:</div>
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {plan.notIncluded.length > 0 && (
                      <>
                        <div className="text-sm font-medium pt-2 text-muted-foreground">Não incluso:</div>
                        {plan.notIncluded.map((feature, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Guarantee */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-green-500/10 border border-green-500/20">
              <Shield className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Garantia de 14 dias — teste sem compromisso, cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Perguntas Frequentes</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Tire suas dúvidas antes de começar
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card 
                key={index} 
                className={`cursor-pointer transition-all duration-200 ${openFaq === index ? 'border-primary' : ''}`}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                data-testid={`card-faq-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold">{faq.question}</h3>
                    <ChevronDown className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </div>
                  {openFaq === index && (
                    <p className="mt-4 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para transformar a gestão do seu varejo?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Comece hoje mesmo com 14 dias gratuitos. Sem cartão de crédito, sem compromisso. 
            Veja na prática como o EleveaOne pode elevar os resultados da sua operação.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/auth')}
              data-testid="button-final-cta"
            >
              Começar Período Gratuito
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              data-testid="button-contact-specialist"
            >
              <Headphones className="mr-2 h-5 w-5" />
              Falar com Especialista
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Implementação em 15 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Suporte durante o teste</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">EleveaOne</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plataforma completa de gestão para varejo. Automatize operações, fidelize clientes e escale resultados.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#modulos" className="hover:text-foreground transition-colors" data-testid="link-footer-funcionalidades">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-foreground transition-colors" data-testid="link-footer-planos">Planos e Preços</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors" data-testid="link-footer-faq">Perguntas Frequentes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-sobre">Sobre Nós</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-blog">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-contato">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-termos">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-privacidade">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-lgpd">LGPD</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} EleveaOne. Todos os direitos reservados. CNPJ: XX.XXX.XXX/0001-XX</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o EleveaOne."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors"
        data-testid="button-whatsapp-float"
      >
        <MessageSquare className="h-6 w-6" />
      </a>
    </div>
  );
}
