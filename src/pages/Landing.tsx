import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, 
  Play, 
  Check, 
  Sparkles,
  Target,
  Users,
  MessageSquare,
  BarChart3,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Store,
  ChevronRight,
  Star,
  Phone,
  Mail,
  MapPin,
  Gift,
  Bell,
  Smartphone,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calculator,
  Wallet,
  Calendar,
  UserCheck,
  Award,
  Layers,
  Settings,
  Globe,
  Lock,
  Headphones,
  Building2,
  ShoppingBag,
  PieChart,
  LineChart,
  CreditCard,
  Percent,
  ClipboardList,
  Timer,
  Fingerprint,
  FileCheck
} from "lucide-react";
import { useRef, useEffect, useState } from "react";

import dashboardImage from "/images/modern_dashboard_laptop_mockup.png";
import mobileImage from "/images/mobile_app_interface_mockup.png";
import whatsappImage from "/images/whatsapp_automation_tablet_mockup.png";
import heroImage from "/images/futuristic_data_visualization_hero.png";

const AnimatedCounter = ({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count}{suffix}
    </span>
  );
};

const FloatingOrb = ({ delay, duration, size, color, position }: { 
  delay: number; 
  duration: number; 
  size: string; 
  color: string;
  position: { top?: string; left?: string; right?: string; bottom?: string };
}) => (
  <motion.div
    className={`absolute rounded-full blur-3xl opacity-30 ${size} ${color}`}
    style={position}
    animate={{
      y: [0, -30, 0],
      x: [0, 15, 0],
      scale: [1, 1.1, 1],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const problems = [
    {
      icon: AlertTriangle,
      problem: "Planilhas desorganizadas",
      solution: "Dashboard centralizado com todos os dados em tempo real"
    },
    {
      icon: XCircle,
      problem: "Vendedores sem metas claras",
      solution: "Sistema de metas dinâmicas com gamificação e bônus automáticos"
    },
    {
      icon: Clock,
      problem: "Ponto manual e fraudes",
      solution: "Ponto digital REP-P com PIN e conformidade legal total"
    },
    {
      icon: Users,
      problem: "Clientes esquecidos",
      solution: "CRM inteligente com histórico completo e segmentação VIP/Black/Gold"
    },
    {
      icon: MessageSquare,
      problem: "WhatsApp manual e demorado",
      solution: "Automação de mensagens, cashback e campanhas em massa"
    },
    {
      icon: Store,
      problem: "Múltiplas lojas, zero controle",
      solution: "Visão consolidada de todas as lojas em um único painel"
    }
  ];

  const features = [
    {
      icon: Target,
      title: "Metas Dinâmicas com Gamificação",
      description: "Defina metas mensais que se redistribuem automaticamente baseadas no fluxo real. Sistema de ranking, premiações e bônus que engajam vendedores.",
      benefits: ["Redistribuição automática", "Ranking em tempo real", "Bônus configuráveis", "Histórico de performance"]
    },
    {
      icon: Users,
      title: "CRM Completo e Inteligente",
      description: "Perfil 360° do cliente com histórico de compras, preferências, aniversários e segmentação automática por valor gasto.",
      benefits: ["Segmentação VIP/Black/Gold", "Histórico completo", "Tags personalizadas", "Alertas de aniversário"]
    },
    {
      icon: MessageSquare,
      title: "WhatsApp 100% Automatizado",
      description: "Envio automático de notificações de cashback, lembretes de aniversário, campanhas promocionais e rotação inteligente de números.",
      benefits: ["Cashback automático", "Campanhas em massa", "Rotação de números", "Templates personalizados"]
    },
    {
      icon: BarChart3,
      title: "Dashboards em Tempo Real",
      description: "Acompanhe vendas, metas, performance da equipe e indicadores financeiros com gráficos interativos e atualizações instantâneas.",
      benefits: ["Atualização em tempo real", "Gráficos interativos", "Exportação PDF/Excel", "Comparativos históricos"]
    },
    {
      icon: Clock,
      title: "Ponto Digital REP-P Homologado",
      description: "Controle de ponto em total conformidade com a Portaria 671/2021 do MTE. PIN digital, assinatura eletrônica e espelho automático.",
      benefits: ["Conformidade legal", "PIN seguro", "Espelho automático", "Relatórios para eSocial"]
    },
    {
      icon: Shield,
      title: "Gestão Financeira Transparente",
      description: "Controle de adiantamentos, compras de funcionários, fechamento de caixa e DRE completo com visão por loja ou consolidado.",
      benefits: ["Controle de adiantamentos", "Compras de funcionários", "DRE automático", "Fechamento de caixa"]
    }
  ];

  const integrationFeatures = [
    {
      icon: RefreshCw,
      title: "Sincronização Automática",
      description: "Pedidos do Tiny ERP importados automaticamente a cada 5 minutos"
    },
    {
      icon: Users,
      title: "Contatos Unificados",
      description: "Clientes sincronizados entre Tiny e CRM do EleveaOne"
    },
    {
      icon: FileText,
      title: "Notas e Pedidos",
      description: "Histórico completo de vendas vinculado ao perfil do cliente"
    },
    {
      icon: Zap,
      title: "Zero Trabalho Manual",
      description: "Configure uma vez, funciona para sempre automaticamente"
    }
  ];

  const whatsappFeatures = [
    {
      icon: Gift,
      title: "Cashback Automático",
      description: "Cliente faz compra, recebe WhatsApp com saldo de cashback instantaneamente"
    },
    {
      icon: Calendar,
      title: "Aniversários",
      description: "Mensagens personalizadas enviadas automaticamente na data de aniversário"
    },
    {
      icon: Bell,
      title: "Alertas de Tarefas",
      description: "Lembretes configuráveis para equipe sobre tarefas da loja"
    },
    {
      icon: Smartphone,
      title: "Campanhas em Massa",
      description: "Envie promoções para milhares de clientes com rotação inteligente de números"
    }
  ];

  const crmSegments = [
    { name: "VIP", color: "bg-amber-500", description: "Clientes premium com maior ticket médio" },
    { name: "Black", color: "bg-zinc-800 dark:bg-zinc-200", description: "Clientes frequentes e fiéis" },
    { name: "Gold", color: "bg-yellow-500", description: "Clientes com potencial de crescimento" },
    { name: "Padrão", color: "bg-blue-500", description: "Base geral de clientes" }
  ];

  const pointFeatures = [
    { icon: Fingerprint, text: "PIN digital seguro e individual" },
    { icon: FileCheck, text: "Espelho de ponto automático" },
    { icon: Timer, text: "Controle de horas extras" },
    { icon: ClipboardList, text: "Relatórios para eSocial" },
    { icon: Lock, text: "Conformidade Portaria 671/2021" },
    { icon: UserCheck, text: "Solicitações de ajuste com aprovação" }
  ];

  const comparisonItems = [
    { feature: "Dashboard de vendas em tempo real", elevea: true, others: "Parcial" },
    { feature: "Metas com redistribuição automática", elevea: true, others: false },
    { feature: "CRM com segmentação automática", elevea: true, others: "Limitado" },
    { feature: "WhatsApp automatizado", elevea: true, others: "Add-on pago" },
    { feature: "Ponto digital REP-P homologado", elevea: true, others: false },
    { feature: "Integração Tiny ERP nativa", elevea: true, others: false },
    { feature: "Multi-loja consolidado", elevea: true, others: "Parcial" },
    { feature: "Gamificação de vendedores", elevea: true, others: false },
    { feature: "Suporte brasileiro dedicado", elevea: true, others: "Chat bot" }
  ];

  const faqs = [
    {
      question: "O EleveaOne funciona com meu ERP atual?",
      answer: "Sim! Temos integração nativa com Tiny ERP e estamos constantemente adicionando novas integrações. Se você usa outro sistema, nossa API permite conexão com qualquer ERP."
    },
    {
      question: "Preciso instalar algo no computador?",
      answer: "Não! O EleveaOne é 100% na nuvem. Acesse de qualquer navegador, computador, tablet ou celular. Sem instalações, sem atualizações manuais."
    },
    {
      question: "Como funciona o ponto digital? É legal?",
      answer: "Nosso sistema de ponto é homologado conforme a Portaria 671/2021 do MTE. Utiliza PIN individual, armazena registros de forma segura e gera todos os relatórios exigidos por lei."
    },
    {
      question: "Posso usar meu próprio número de WhatsApp?",
      answer: "Sim! Você conecta o WhatsApp da sua loja e o sistema envia as mensagens automaticamente. Suportamos múltiplos números com rotação inteligente."
    },
    {
      question: "E se eu tiver mais de uma loja?",
      answer: "Perfeito! O EleveaOne foi feito para multi-loja. Você vê cada loja separadamente ou a visão consolidada de toda a rede em um único painel."
    },
    {
      question: "Tem período de teste?",
      answer: "Sim! Oferecemos 14 dias grátis em todos os planos. Sem compromisso, sem cartão de crédito. Cancele quando quiser."
    }
  ];

  const metrics = [
    { value: 70, suffix: "%", label: "Economia vs Stack Separado" },
    { value: 150, suffix: "+", label: "Lojas Ativas" },
    { value: 35, prefix: "+", suffix: "%", label: "Aumento em Vendas" },
    { value: 98, suffix: "%", label: "Satisfação" }
  ];

  const plans = [
    {
      name: "Starter",
      price: "249",
      description: "Para lojas que estão começando sua transformação digital",
      features: [
        "Até 3 colaboradores",
        "1 loja",
        "Dashboard de vendas",
        "Metas e gamificação",
        "CRM básico",
        "Relatórios essenciais",
        "Suporte por e-mail"
      ],
      cta: "Começar Agora",
      href: "https://pay.cakto.com.br/32v862z",
      popular: false
    },
    {
      name: "Business",
      price: "499",
      description: "Para operações que precisam de automação completa",
      features: [
        "Até 10 colaboradores",
        "Até 3 lojas",
        "Tudo do Starter +",
        "WhatsApp automatizado",
        "CRM completo com segmentação",
        "Ponto digital REP-P",
        "Integração Tiny ERP",
        "Cashback automático",
        "Suporte prioritário"
      ],
      cta: "Escolher Business",
      href: "https://pay.cakto.com.br/aapmyzd_625482",
      popular: true
    },
    {
      name: "Enterprise",
      price: "799",
      description: "Para redes que buscam escala e controle total",
      features: [
        "Colaboradores ilimitados",
        "Lojas ilimitadas",
        "Tudo do Business +",
        "API de integração",
        "Campanhas WhatsApp em massa",
        "DRE e relatórios avançados",
        "Múltiplos números WhatsApp",
        "Onboarding dedicado",
        "Gerente de conta exclusivo"
      ],
      cta: "Falar com Consultor",
      href: "https://pay.cakto.com.br/pzpdgb7",
      popular: false
    }
  ];

  const testimonials = [
    {
      name: "Mariana Costa",
      role: "Proprietária, Boutique Elegance",
      content: "Antes eu passava horas em planilhas. Agora vejo tudo em tempo real e meus vendedores estão mais engajados com o sistema de metas.",
      rating: 5
    },
    {
      name: "Roberto Silva",
      role: "Gerente, Rede SportMax",
      content: "O WhatsApp automático de cashback mudou nosso jogo. Os clientes adoram e voltam muito mais rápido.",
      rating: 5
    },
    {
      name: "Ana Paula Ferreira",
      role: "Diretora, Grupo ModaPlus",
      content: "Gerenciar 5 lojas era um caos. Com o EleveaOne, tenho visão consolidada e cada gerente tem seu painel individual.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <FloatingOrb delay={0} duration={20} size="w-96 h-96" color="bg-primary/20" position={{ top: "10%", left: "-10%" }} />
        <FloatingOrb delay={5} duration={25} size="w-80 h-80" color="bg-purple-500/20" position={{ top: "60%", right: "-5%" }} />
        <FloatingOrb delay={10} duration={30} size="w-64 h-64" color="bg-amber-500/10" position={{ bottom: "20%", left: "30%" }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="link-logo">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">EleveaOne</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#problemas" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-problemas">Problemas</a>
            <a href="#recursos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-recursos">Recursos</a>
            <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-precos">Preços</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-faq">FAQ</a>
            <a href="#contato" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contato">Contato</a>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy-nav">Privacidade</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" data-testid="button-login">Entrar</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" data-testid="button-start-free">
                Começar Grátis
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              style={{ y: heroY, opacity: heroOpacity }}
              className="text-center lg:text-left"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge variant="secondary" className="mb-6">
                  <Sparkles className="w-3 h-3 mr-1" />
                  A revolução do varejo brasileiro
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
              >
                Transforme sua loja em uma{" "}
                <span className="text-primary">máquina de vendas</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0"
              >
                O EleveaOne é a camada de inteligência que faltava sobre seu ERP. 
                Metas, cashback, CRM, ponto digital e automação WhatsApp em uma única plataforma.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link to="/login">
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-hero-cta">
                    Começar Agora
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" data-testid="button-hero-demo">
                  <Play className="w-4 h-4 mr-2" />
                  Ver Demonstração
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex items-center gap-6 mt-8 justify-center lg:justify-start text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  14 dias grátis
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Sem cartão de crédito
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Suporte brasileiro
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={heroImage} 
                  alt="EleveaOne Dashboard" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -right-4 top-1/4 bg-card border border-border rounded-lg p-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">WhatsApp enviado</p>
                    <p className="text-xs text-muted-foreground">Cashback notificado</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1 }}
                className="absolute -left-4 bottom-1/4 bg-card border border-border rounded-lg p-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Vendas hoje</p>
                    <p className="text-sm font-bold">R$ 12.450</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-16 border-y border-border/50 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="text-center"
                data-testid={`metric-${index}`}
              >
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2" data-testid={`metric-value-${index}`}>
                  <AnimatedCounter value={metric.value} prefix={metric.prefix} suffix={metric.suffix} />
                </div>
                <div className="text-sm text-muted-foreground" data-testid={`metric-label-${index}`}>{metric.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section id="problemas" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Problemas que Resolvemos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Chega de dor de cabeça com gestão
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sabemos exatamente os problemas que você enfrenta no dia a dia. 
              Cada funcionalidade foi criada para resolver uma dor real do varejo brasileiro.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {problems.map((item, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                data-testid={`problem-card-${index}`}
              >
                <Card className="h-full hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-destructive mb-2 line-through opacity-60">
                          {item.problem}
                        </p>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            {item.solution}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Recursos Completos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que sua loja precisa em um só lugar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cada módulo foi pensado para trabalhar em conjunto, 
              criando uma experiência integrada de gestão comercial.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                data-testid={`feature-card-${index}`}
              >
                <Card className="h-full hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{feature.description}</p>
                    <div className="space-y-2">
                      {feature.benefits.map((benefit, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp}>
              <Badge variant="outline" className="mb-4">Integração Nativa</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Conectado ao seu Tiny ERP
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Sem digitação manual, sem erros, sem retrabalho. O EleveaOne sincroniza 
                automaticamente com o Tiny ERP, importando pedidos, clientes e dados de vendas.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {integrationFeatures.map((item, index) => (
                  <motion.div
                    key={index}
                    {...fadeInUp}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...fadeInUp}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={dashboardImage} 
                  alt="Dashboard EleveaOne" 
                  className="w-full h-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* WhatsApp Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              {...fadeInUp}
              className="order-2 lg:order-1"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={whatsappImage} 
                  alt="Automação WhatsApp" 
                  className="w-full h-auto"
                />
              </div>
            </motion.div>

            <motion.div {...fadeInUp} className="order-1 lg:order-2">
              <Badge variant="outline" className="mb-4">Automação WhatsApp</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Seu WhatsApp trabalhando 24/7
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Enquanto você dorme, o EleveaOne cuida do relacionamento com seus clientes. 
                Mensagens automáticas de cashback, aniversário e promoções.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {whatsappFeatures.map((item, index) => (
                  <motion.div
                    key={index}
                    {...fadeInUp}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CRM Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">CRM Inteligente</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Conheça seus clientes como nunca antes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Segmentação automática, histórico completo de compras, preferências 
              e alertas inteligentes. Transforme dados em relacionamentos lucrativos.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp}>
              <h3 className="text-xl font-semibold mb-6">Segmentação Automática de Clientes</h3>
              <div className="space-y-4">
                {crmSegments.map((segment, index) => (
                  <motion.div
                    key={index}
                    {...fadeInUp}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                  >
                    <div className={`w-4 h-4 rounded-full ${segment.color}`} />
                    <div>
                      <span className="font-medium">{segment.name}</span>
                      <span className="text-muted-foreground ml-2">— {segment.description}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Segmentação atualizada automaticamente por valor de compra</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Alertas de aniversário com mensagem personalizada</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Histórico completo de interações e compras</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Tags personalizadas para campanhas direcionadas</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.3 }}>
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={mobileImage} 
                  alt="CRM Mobile" 
                  className="w-full h-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Point System Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Ponto Digital REP-P</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Controle de ponto 100% legal
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sistema homologado conforme Portaria 671/2021 do MTE. 
              PIN digital seguro, espelho automático e relatórios para eSocial.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pointFeatures.map((item, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border/50"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">{item.text}</span>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeInUp} className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Conformidade garantida com a legislação trabalhista brasileira
            </p>
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span>CLT Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-500" />
                <span>Portaria 671/2021</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-500" />
                <span>Dados Criptografados</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Multi-store Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Multi-Loja</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Uma rede, um painel, controle total
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Gerencie 1 ou 100 lojas com a mesma facilidade. Visão consolidada 
              para diretores, painel individual para gerentes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div {...fadeInUp} data-testid="multistore-card-0">
              <Card className="h-full hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Visão Consolidada</h3>
                  <p className="text-muted-foreground text-sm">
                    Veja todas as lojas em um único dashboard com métricas agregadas e comparativos.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.1 }} data-testid="multistore-card-1">
              <Card className="h-full hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Painel por Loja</h3>
                  <p className="text-muted-foreground text-sm">
                    Cada gerente acessa apenas sua loja com metas, equipe e indicadores próprios.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.2 }} data-testid="multistore-card-2">
              <Card className="h-full hover-elevate">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <PieChart className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Comparativos</h3>
                  <p className="text-muted-foreground text-sm">
                    Compare performance entre lojas, identifique melhores práticas e replique.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Comparativo</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher o EleveaOne?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Enquanto outros sistemas focam em apenas uma área, 
              nós oferecemos uma solução completa e integrada.
            </p>
          </motion.div>

          <motion.div {...fadeInUp}>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium">Funcionalidade</th>
                        <th className="text-center p-4 font-medium text-primary">EleveaOne</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Outros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonItems.map((item, index) => (
                        <tr key={index} className="border-b last:border-b-0" data-testid={`comparison-row-${index}`}>
                          <td className="p-4 text-sm">{item.feature}</td>
                          <td className="p-4 text-center">
                            {item.elevea === true ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <span className="text-sm">{item.elevea}</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {item.others === false ? (
                              <XCircle className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                            ) : (
                              <span className="text-sm text-muted-foreground">{item.others}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Mais de 150 lojas já transformaram sua gestão com o EleveaOne.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                data-testid={`testimonial-card-${index}`}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6 italic">
                      "{testimonial.content}"
                    </p>
                    <div>
                      <p className="font-medium">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Planos e Preços</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para sua operação
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Todos os planos incluem 14 dias grátis. Sem compromisso, sem cartão de crédito.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className={plan.popular ? "md:-mt-4 md:mb-4" : ""}
              >
                <Card className={`h-full relative ${plan.popular ? "border-primary shadow-lg" : ""}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Mais Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    
                    <div className="mb-6">
                      <span className="text-4xl font-bold">R$ {plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <a href={plan.href} target="_blank" rel="noopener noreferrer" className="block">
                      <Button 
                        className="w-full" 
                        variant={plan.popular ? "default" : "outline"}
                        data-testid={`button-plan-${plan.name.toLowerCase()}`}
                      >
                        {plan.cta}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeInUp} className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Precisa de um plano personalizado?{" "}
              <a href="#contato" className="text-primary hover:underline">Fale conosco</a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tire suas dúvidas sobre o EleveaOne.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.05 }}
                data-testid={`faq-card-${index}`}
              >
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2" data-testid={`faq-question-${index}`}>{faq.question}</h3>
                    <p className="text-muted-foreground text-sm">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para transformar sua loja?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Junte-se a mais de 150 lojas que já estão usando o EleveaOne 
              para aumentar vendas e simplificar a gestão.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" variant="secondary" data-testid="button-cta-start">
                  Começar 14 Dias Grátis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="https://wa.me/5591999999999" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-cta-sales">
                  <Phone className="w-4 h-4 mr-2" />
                  Falar com Vendas
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4" data-testid="link-footer-logo">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">EleveaOne</span>
              </Link>
              <p className="text-muted-foreground text-sm">
                A plataforma completa para gestão de varejo brasileiro. 
                Metas, CRM, WhatsApp e ponto digital em um só lugar.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#recursos" className="hover:text-foreground transition-colors" data-testid="link-footer-recursos">Recursos</a></li>
                <li><a href="#precos" className="hover:text-foreground transition-colors" data-testid="link-footer-precos">Preços</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors" data-testid="link-footer-faq">FAQ</a></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors" data-testid="link-footer-login">Login</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-sobre">Sobre nós</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-blog">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-carreiras">Carreiras</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-parceiros">Parceiros</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  contato@eleveaone.com.br
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (91) 99999-9999
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Belém, PA - Brasil
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 EleveaOne. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground transition-colors" data-testid="link-footer-termos">Termos de Uso</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors" data-testid="link-footer-privacidade">Privacidade</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors" data-testid="link-footer-lgpd">LGPD</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
