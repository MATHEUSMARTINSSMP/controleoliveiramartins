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
  LineChart,
  Gift,
  MessageSquare,
  DollarSign,
  Activity,
  Layers,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import heroImage from "@assets/generated_images/futuristic_tech_dashboard_hero.png";
import abstractWaves from "@assets/generated_images/abstract_tech_gradient_waves.png";
import dataVisualization from "@assets/generated_images/3d_data_analytics_visualization.png";
import devicesMockup from "@assets/generated_images/devices_dashboard_mockup.png";
import aiNetwork from "@assets/generated_images/ai_network_intelligence_abstract.png";
import gamificationTrophy from "@assets/generated_images/gamification_trophy_achievement.png";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Dashboard Inteligente",
      description: "Visualize KPIs em tempo real com interface futurista e dados atualizados instantaneamente."
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Metas Dinâmicas",
      description: "Sistema inteligente que recalcula metas automaticamente baseado no desempenho real."
    },
    {
      icon: <Trophy className="h-6 w-6" />,
      title: "Gamificação Avançada",
      description: "Troféus, rankings e bônus que transformam o trabalho em uma experiência motivadora."
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "Sistema de Cashback",
      description: "Cashback automático com notificações WhatsApp e controle completo de saldos."
    },
    {
      icon: <RefreshCw className="h-6 w-6" />,
      title: "Sync com Tiny ERP",
      description: "Integração automática com Tiny ERP para sincronização de pedidos e contatos."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Multi-Tenancy",
      description: "Gerencie múltiplas lojas com isolamento total de dados e permissões granulares."
    }
  ];

  const stats = [
    { value: "99.9%", label: "Uptime", icon: <Activity className="h-5 w-5" /> },
    { value: "< 1s", label: "Sync Time", icon: <Zap className="h-5 w-5" /> },
    { value: "256-bit", label: "Encryption", icon: <Shield className="h-5 w-5" /> },
    { value: "24/7", label: "Monitoring", icon: <Globe className="h-5 w-5" /> }
  ];

  const plans = [
    {
      name: "Starter",
      price: "Grátis",
      description: "Perfeito para começar",
      features: ["1 Loja", "5 Colaboradores", "Dashboard básico", "Relatórios simples", "Suporte por email"],
      popular: false
    },
    {
      name: "Business",
      price: "R$ 199",
      period: "/mês",
      description: "Para negócios em crescimento",
      features: ["3 Lojas", "25 Colaboradores", "Dashboard avançado", "Cashback automático", "Integração Tiny ERP", "WhatsApp notifications", "Suporte prioritário"],
      popular: true
    },
    {
      name: "Enterprise",
      price: "R$ 499",
      period: "/mês",
      description: "Solução completa para redes",
      features: ["7 Lojas", "80 Colaboradores", "Recursos ilimitados", "API dedicada", "Relatórios customizados", "Gerente de conta", "SLA garantido"],
      popular: false
    }
  ];

  const testimonials = [
    {
      quote: "Aumentamos nossas vendas em 40% após implementar o sistema de gamificação.",
      author: "Maria Santos",
      role: "Gerente de Vendas",
      company: "Loungerie"
    },
    {
      quote: "O cashback automático revolucionou a fidelização dos nossos clientes.",
      author: "João Silva",
      role: "Diretor Comercial",
      company: "Mr. Kitsch"
    },
    {
      quote: "A integração com Tiny ERP economiza horas de trabalho manual por semana.",
      author: "Ana Costa",
      role: "Administradora",
      company: "Sacada"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/40 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              EleveaOne
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Clientes</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} data-testid="button-login">
              Entrar
            </Button>
            <Button 
              size="sm" 
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
              onClick={() => navigate('/')}
              data-testid="button-start"
            >
              Começar
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={abstractWaves} 
            alt="" 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        </div>
        
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <Badge className="mb-6 px-4 py-2 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
              <Sparkles className="h-3 w-3 mr-2" />
              Plataforma de Gestão Inteligente
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-transparent">
                Transforme sua
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                Gestão de Vendas
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sistema completo de ERP com cashback, gamificação, metas dinâmicas e 
              integração com Tiny ERP. Tudo em uma plataforma moderna e intuitiva.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 h-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
                onClick={() => navigate('/')}
                data-testid="button-start-free"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 h-auto border-violet-500/30 hover:bg-violet-500/10"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-see-features"
              >
                Ver Recursos
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm"
                  data-testid={`stat-${i}`}
                >
                  <div className="flex items-center justify-center gap-2 text-violet-400 mb-1">
                    {stat.icon}
                    <span className="text-lg font-bold">{stat.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-16 relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10">
              <img 
                src={heroImage} 
                alt="Dashboard Preview" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-950/5 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" variant="outline">
              Recursos
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Tudo que você precisa em
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                uma única plataforma
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Recursos avançados para gestão completa do seu negócio
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <Card 
                key={i} 
                className="bg-slate-900/50 border-slate-800/50 backdrop-blur-sm hover:border-violet-500/30 transition-all duration-300 group"
                data-testid={`feature-card-${i}`}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4 group-hover:from-violet-500/30 group-hover:to-fuchsia-500/30 transition-colors">
                    <div className="text-violet-400">{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-20 grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 lg:order-1">
              <Badge className="mb-4 px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
                <LineChart className="h-3 w-3 mr-1" />
                Analytics
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Análise de dados com{" "}
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  inteligência artificial
                </span>
              </h3>
              <p className="text-muted-foreground mb-6">
                Nossa plataforma utiliza machine learning para prever tendências, 
                identificar oportunidades e otimizar suas metas automaticamente.
              </p>
              <ul className="space-y-3">
                {["Previsão de vendas", "Detecção de padrões", "Recomendações automáticas", "Alertas inteligentes"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-violet-400" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-xl">
                <img src={aiNetwork} alt="AI Analytics" className="w-full h-auto" />
              </div>
            </div>
          </div>

          <div className="mt-20 grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <div className="rounded-2xl overflow-hidden border border-fuchsia-500/20 shadow-xl">
                <img src={gamificationTrophy} alt="Gamification" className="w-full h-auto" />
              </div>
            </div>
            <div>
              <Badge className="mb-4 px-3 py-1 bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" variant="outline">
                <Trophy className="h-3 w-3 mr-1" />
                Gamificação
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Motive sua equipe com{" "}
                <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                  gamificação inteligente
                </span>
              </h3>
              <p className="text-muted-foreground mb-6">
                Sistema completo de conquistas, rankings e bônus que transforma 
                o trabalho em uma experiência motivadora e divertida.
              </p>
              <ul className="space-y-3">
                {["Troféus e conquistas", "Rankings em tempo real", "Bônus configuráveis", "Gincanas semanais"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-fuchsia-400" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-20 max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10">
              <img src={devicesMockup} alt="Multi-device" className="w-full h-auto" />
            </div>
            <div className="text-center mt-8">
              <Badge className="mb-4 px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
                <Smartphone className="h-3 w-3 mr-1" />
                Multi-dispositivo
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Acesse de qualquer lugar
              </h3>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Interface responsiva otimizada para desktop, tablet e smartphone. 
                Gerencie seu negócio onde você estiver.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-fuchsia-950/5 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
              Planos
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Escolha o plano ideal
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                para o seu negócio
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Planos flexíveis que crescem junto com você
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <Card 
                key={i} 
                className={`relative bg-slate-900/50 backdrop-blur-sm transition-all duration-300 ${
                  plan.popular 
                    ? 'border-violet-500/50 shadow-xl shadow-violet-500/10 scale-105' 
                    : 'border-slate-800/50 hover:border-violet-500/30'
                }`}
                data-testid={`plan-card-${i}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                  <Button 
                    className={`w-full mb-6 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700' 
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => navigate('/')}
                    data-testid={`button-select-plan-${i}`}
                  >
                    Começar Agora
                  </Button>
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          plan.popular ? 'bg-violet-500/20' : 'bg-muted'
                        }`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-violet-400' : 'text-muted-foreground'}`} />
                        </div>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-950/5 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" variant="outline">
              Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              O que nossos clientes
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                estão dizendo
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <Card 
                key={i} 
                className="bg-slate-900/50 border-slate-800/50 backdrop-blur-sm"
                data-testid={`testimonial-card-${i}`}
              >
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-violet-400 text-violet-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    <p className="text-sm text-violet-400">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={dataVisualization} 
            alt="" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-950/90 via-fuchsia-950/90 to-violet-950/90" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Pronto para transformar
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                seu negócio?
              </span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Comece gratuitamente e veja os resultados em poucos dias. 
              Sem compromisso, sem cartão de crédito.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-10 py-6 h-auto bg-white text-violet-950 hover:bg-white/90 shadow-xl"
                onClick={() => navigate('/')}
                data-testid="button-cta-start"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-10 py-6 h-auto border-white/30 text-white hover:bg-white/10"
                data-testid="button-cta-contact"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Falar com Consultor
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-800/40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                EleveaOne
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 EleveaOne. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Termos</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
