import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  MapPin
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

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: Target,
      title: "Metas Dinâmicas",
      description: "Defina metas mensais com redistribuição automática baseada no fluxo real da loja. Gamificação que engaja sua equipe."
    },
    {
      icon: Users,
      title: "CRM Inteligente",
      description: "Perfil 360° do cliente com histórico de compras, preferências e segmentação automática (VIP, Black, Gold)."
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Automatizado",
      description: "Notificações de cashback, alertas de aniversário e campanhas em massa com rotação de números."
    },
    {
      icon: BarChart3,
      title: "Dashboards em Tempo Real",
      description: "Acompanhe vendas, metas e performance da equipe em tempo real com gráficos interativos."
    },
    {
      icon: Clock,
      title: "Ponto Digital REP-P",
      description: "Controle de ponto em conformidade com a Portaria 671/2021. PIN digital e geração automática de espelho."
    },
    {
      icon: Shield,
      title: "Gestão Financeira",
      description: "Adiantamentos, compras de funcionários e controle de caixa com total transparência."
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
        "Dashboard básico",
        "Metas e gamificação",
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
        "WhatsApp automatizado",
        "CRM completo",
        "Ponto digital REP-P",
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
        "API de integração",
        "Campanhas WhatsApp em massa",
        "Relatórios avançados",
        "Gerente de conta dedicado"
      ],
      cta: "Falar com Consultor",
      href: "https://pay.cakto.com.br/pzpdgb7",
      popular: false
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
            <a href="#recursos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-recursos">Recursos</a>
            <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-precos">Preços</a>
            <a href="#contato" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contato">Contato</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" data-testid="button-login">Entrar</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="gap-2" data-testid="button-start-free">
                Começar Grátis <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16">
        <motion.div 
          className="container mx-auto px-4 py-20"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge variant="secondary" className="mb-6 gap-2">
                <Sparkles className="w-3 h-3" />
                A revolução do varejo brasileiro
              </Badge>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                Transforme sua loja em uma{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                  máquina de vendas
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-xl">
                O EleveaOne é a camada de inteligência que faltava sobre seu ERP. 
                Metas, cashback, CRM e automação WhatsApp em uma única plataforma.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link to="/login">
                  <Button size="lg" className="gap-2 text-lg px-8" data-testid="button-hero-cta">
                    Começar Agora <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8" data-testid="button-hero-demo">
                  <Play className="w-5 h-5" /> Ver Demonstração
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span>14 dias grátis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Suporte brasileiro</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <img 
                  src={heroImage} 
                  alt="EleveaOne Dashboard" 
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              
              {/* Floating Stats Card */}
              <motion.div
                className="absolute -bottom-6 -left-6 bg-card/90 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-border/50"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendas hoje</p>
                    <p className="text-xl font-bold">R$ 12.450</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating Notification */}
              <motion.div
                className="absolute -top-4 -right-4 bg-card/90 backdrop-blur-xl rounded-xl p-3 shadow-xl border border-border/50"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">WhatsApp enviado</p>
                    <p className="text-xs text-muted-foreground">Cashback notificado</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Metrics Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                data-testid={`metric-${index}`}
              >
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2" data-testid={`metric-value-${index}`}>
                  <AnimatedCounter value={metric.value} suffix={metric.suffix} prefix={metric.prefix || ""} />
                </div>
                <p className="text-muted-foreground" data-testid={`metric-label-${index}`}>{metric.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Badge variant="secondary" className="mb-4">Recursos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Tudo que você precisa para{" "}
              <span className="text-primary">vender mais</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa que integra metas, pessoas e clientes 
              em um único lugar inteligente.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="group relative p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Badge variant="secondary" className="mb-4">Dashboard</Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Controle total na{" "}
                <span className="text-primary">palma da mão</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Acompanhe vendas, metas e performance da sua equipe em tempo real. 
                Dashboards intuitivos para gerentes e visão consolidada para administradores.
              </p>
              
              <div className="space-y-4">
                {[
                  "Visualização em tempo real de todas as métricas",
                  "Comparativos de performance entre lojas",
                  "Alertas automáticos de metas e indicadores",
                  "Exportação de relatórios em PDF e Excel"
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <img 
                src={dashboardImage} 
                alt="Dashboard EleveaOne" 
                className="w-full rounded-2xl shadow-2xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* WhatsApp Section */}
      <section className="py-24 relative bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              className="order-2 lg:order-1 relative"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <img 
                src={whatsappImage} 
                alt="WhatsApp Automation" 
                className="w-full rounded-2xl shadow-2xl"
              />
            </motion.div>

            <motion.div
              className="order-1 lg:order-2"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Badge variant="secondary" className="mb-4 gap-2">
                <MessageSquare className="w-3 h-3" />
                WhatsApp Profissional
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Transforme conversas em{" "}
                <span className="text-primary">vendas</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Automatize notificações de cashback, campanhas de marketing e 
                recuperação de clientes inativos diretamente pelo WhatsApp.
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Notificações Automáticas</h4>
                    <p className="text-muted-foreground text-sm">
                      Cashback gerado, aniversários e alertas de compra enviados automaticamente.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Campanhas Segmentadas</h4>
                    <p className="text-muted-foreground text-sm">
                      Envie ofertas personalizadas baseadas no histórico de compras.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Envio Seguro</h4>
                    <p className="text-muted-foreground text-sm">
                      Rotação de números e delays inteligentes para proteger suas contas.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Badge variant="secondary" className="mb-4 gap-2">
                <Store className="w-3 h-3" />
                Aplicativo Mobile
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Sua loja no{" "}
                <span className="text-primary">bolso</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Acesse métricas, registre ponto e acompanhe metas de qualquer lugar. 
                Interface otimizada para vendedoras e gerentes em movimento.
              </p>
              
              <Link to="/login">
                <Button size="lg" className="gap-2" data-testid="button-mobile-cta">
                  Experimentar Agora <ChevronRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              className="relative flex justify-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <motion.img 
                src={mobileImage} 
                alt="Mobile App EleveaOne" 
                className="w-64 rounded-3xl shadow-2xl"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Badge variant="secondary" className="mb-4">Preços</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Planos que cabem no seu{" "}
              <span className="text-primary">bolso</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho da sua operação. 
              Todos incluem 14 dias de teste grátis.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                  plan.popular 
                    ? "bg-primary/5 border-primary/30 scale-105" 
                    : "bg-card/50 border-border/50 hover:border-primary/20"
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1">
                      <Star className="w-3 h-3" /> Mais Popular
                    </Badge>
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold">R$ {plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <a href={plan.href} target="_blank" rel="noopener noreferrer" className="block">
                  <Button 
                    className="w-full gap-2" 
                    variant={plan.popular ? "default" : "outline"}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                  >
                    {plan.cta} <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-purple-600 p-12 md:p-20 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent)]" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Pronto para transformar seu varejo?
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                Junte-se a mais de 150 lojas que já estão vendendo mais com o EleveaOne.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/login">
                  <Button size="lg" variant="secondary" className="gap-2 text-lg px-8" data-testid="button-cta-start">
                    Começar Gratuitamente <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8 bg-white/10 border-white/30 text-white hover:bg-white/20" data-testid="button-cta-sales">
                  <Phone className="w-5 h-5" /> Falar com Vendas
                </Button>
              </div>
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
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#recursos" className="hover:text-foreground transition-colors" data-testid="link-footer-recursos">Recursos</a></li>
                <li><a href="#precos" className="hover:text-foreground transition-colors" data-testid="link-footer-precos">Preços</a></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors" data-testid="link-footer-login">Login</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-sobre">Sobre nós</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-blog">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-carreiras">Carreiras</a></li>
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
                  (11) 99999-9999
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  São Paulo, Brasil
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} EleveaOne. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
