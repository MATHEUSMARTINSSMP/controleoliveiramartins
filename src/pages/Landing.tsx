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
  LineChart,
  Gift,
  MessageSquare,
  DollarSign,
  Activity,
  Layers,
  RefreshCw,
  ChevronDown,
  ShoppingCart,
  Zap as Analytics,
  Users2,
  FileText,
  Briefcase
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from '@/components/GlassCard';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { FloatingParticles } from '@/components/FloatingParticles';
import { GradientText } from '@/components/GradientText';
import { MouseTrackingBackground } from '@/components/MouseTrackingBackground';

import heroImage from "@assets/generated_images/futuristic_tech_dashboard_hero.webp";
import abstractWaves from "@assets/generated_images/abstract_tech_gradient_waves.webp";
import dataVisualization from "@assets/generated_images/3d_data_analytics_visualization.webp";
import devicesMockup from "@assets/generated_images/devices_dashboard_mockup.webp";
import aiNetwork from "@assets/generated_images/ai_network_intelligence_abstract.webp";
import gamificationTrophy from "@assets/generated_images/gamification_trophy_achievement.webp";
import dashboardImage from "@assets/generated_images/saas_dashboard_analytics_interface.webp";
import teamCelebration from "@assets/generated_images/team_celebration_success_moment.webp";
import mobileWhatsapp from "@assets/generated_images/mobile_app_whatsapp_notifications.webp";
import dataFlow from "@assets/generated_images/data_flow_technology_background.webp";

export default function Landing() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Dashboard Inteligente",
      description: "Visualize KPIs em tempo real com interface futurista e dados atualizados instantaneamente.",
      image: dashboardImage
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Metas Dinâmicas",
      description: "Metas semanais, diárias, mensais com pesos customizados e gincanas que motivam.",
      image: abstractWaves
    },
    {
      icon: <Trophy className="h-6 w-6" />,
      title: "Gamificação Avançada",
      description: "Troféus, rankings e bônus que transformam o trabalho em uma experiência motivadora.",
      image: gamificationTrophy
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "Cashback Automático",
      description: "Sistema completo de cashback com notificações WhatsApp e controle de saldos.",
      image: mobileWhatsapp
    },
    {
      icon: <RefreshCw className="h-6 w-6" />,
      title: "Integração Tiny ERP",
      description: "Sincronização automática com Tiny ERP para pedidos e contatos em tempo real.",
      image: dataVisualization
    },
    {
      icon: <ShoppingCart className="h-6 w-6" />,
      title: "Acompanhamento de Compras",
      description: "Rastreie todas as compras das colaboradoras com histórico completo e análises.",
      image: devicesMockup
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Controle de Adiantamento",
      description: "Sistema completo para controle de adiantamentos de salário com notificações automáticas.",
      image: aiNetwork
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "WhatsApp Notifications",
      description: "Notifique administradores sobre novas vendas, parabenize colaboradoras e comunique pedidos.",
      image: dataFlow
    },
    {
      icon: <Analytics className="h-6 w-6" />,
      title: "Inteligência de Produtos",
      description: "Relatórios completos: peças mais vendidas, cores, marcas e tamanhos por consultora.",
      image: heroImage
    },
    {
      icon: <Users2 className="h-6 w-6" />,
      title: "Sistema de CRM",
      description: "Saiba o que falar e quando falar com seu cliente. Histórico completo de interações.",
      image: teamCelebration
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Lançamento Manual de Vendas",
      description: "Registre vendas manualmente quando o ERP ainda não estiver integrado.",
      image: abstractWaves
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Multi-Tenancy",
      description: "Gerencie múltiplas lojas com isolamento total de dados e permissões granulares.",
      image: devicesMockup
    }
  ];

  const stats = [
    { value: 35, label: "% Aumento de Vendas", icon: <TrendingUp className="h-5 w-5" /> },
    { value: 80, label: "% Economia de Tempo", icon: <Clock className="h-5 w-5" /> },
    { value: 100, label: "% Precisão nos Cálculos", icon: <Check className="h-5 w-5" /> },
    { value: 24, label: "/7 Disponibilidade", icon: <Globe className="h-5 w-5" /> }
  ];

  const plans = [
    {
      name: "Starter",
      price: "R$ 249",
      period: "/mês",
      description: "Perfeito para começar",
      features: ["1 Loja", "5 Colaboradores", "Dashboard completo", "Relatórios completos", "Suporte por email", "WhatsApp da agência"],
      popular: false
    },
    {
      name: "Business",
      price: "R$ 499",
      period: "/mês",
      description: "Para negócios em crescimento",
      features: ["3 Lojas", "25 Colaboradores", "Dashboard completo", "Relatórios completos", "Integração Tiny ERP", "WhatsApp próprio integrado", "Suporte por WhatsApp"],
      popular: true
    },
    {
      name: "Enterprise",
      price: "R$ 799",
      period: "/mês",
      description: "Solução completa para redes",
      features: ["7 Lojas", "80 Colaboradores", "Suporte prioritário 24/7", "+ 3 lojas extras grátis", "+ 10 colaboradores extras grátis", "Todos os recursos ilimitados"],
      popular: false
    }
  ];

  const addOns = [
    {
      name: "Loja Extra",
      price: "R$ 100",
      period: "/mês",
      description: "Adicione mais uma loja"
    },
    {
      name: "5 Colaboradores Extra",
      price: "R$ 49",
      period: "/mês",
      description: "Adicione mais 5 colaboradores"
    }
  ];

  const painPoints = [
    {
      problem: "Minhas vendedoras não batem meta",
      solution: "Metas Dinâmicas e Gamificação mantêm sua equipe engajada e motivada"
    },
    {
      problem: "O cliente compra uma vez e some",
      solution: "Cashback Automático via WhatsApp garante recompra e fidelização"
    },
    {
      problem: "Perco tempo com planilhas",
      solution: "Integração com Tiny ERP automatiza 100% dos dados"
    },
    {
      problem: "Não sei se estou lucrando",
      solution: "Dashboards em tempo real mostram saúde financeira completa"
    },
    {
      problem: "Equipe desmotivada e desorganizada",
      solution: "CRM completo + gincanas + troféus + reconhecimento aumentam motivação"
    },
    {
      problem: "Gestão de múltiplas lojas é caótica",
      solution: "Multi-tenancy com isolamento total de dados e permissões granulares"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-x-hidden">
      {/* Mouse Tracking Background */}
      <MouseTrackingBackground />

      {/* Animated Floating Particles */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <FloatingParticles />
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/40 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 relative z-10">
            <img src="/elevea2.png" alt="EleveaOne" className="h-16 w-16" />
            <span className="font-bold text-xl text-slate-100">
              EleveaOne
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Recursos</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-3 relative z-10">
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

      {/* Hero Section - Mobile First */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-16 md:min-h-screen md:flex md:items-center md:justify-center md:pt-16 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <Badge className="mb-4 sm:mb-6 px-3 py-1.5 sm:px-4 sm:py-2 bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs sm:text-sm" variant="outline">
              <Sparkles className="h-3 w-3 mr-2" />
              Plataforma Definitiva para Varejo
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
              Transforme sua loja em
              <br />
              <GradientText className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl">
                máquina de vendas
              </GradientText>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-slate-200 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
              Cashback automático, metas dinâmicas, gamificação, inteligência de produtos, CRM completo e integração com Tiny ERP. 
              Tudo em uma plataforma moderna para varejo.
            </p>
            
            <div className="flex flex-col gap-3 sm:gap-4 justify-center mb-8 sm:mb-12">
              <Button 
                size="lg" 
                className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 h-auto min-h-[44px] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
                onClick={() => navigate('/')}
                data-testid="button-start-free"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 h-auto min-h-[44px] bg-violet-500/30 hover:bg-violet-500/40 text-white font-bold border border-violet-500/50"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-see-features"
              >
                Ver Recursos
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Stats Grid - Mobile First */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto mb-8 sm:mb-16">
              {stats.map((stat, i) => (
                <GlassCard key={i} className="text-center p-3 sm:p-4 min-h-[80px] sm:min-h-[100px] flex flex-col justify-center" data-testid={`stat-${i}`}>
                  <div className="flex items-center justify-center gap-1.5 text-violet-300 mb-1 sm:mb-2">
                    <span className="h-4 w-4 sm:h-5 sm:w-5">{stat.icon}</span>
                    <span className="text-lg sm:text-2xl font-bold">
                      <AnimatedCounter end={stat.value} suffix="%" />
                    </span>
                  </div>
                  <p className="text-xs sm:text-xs text-slate-300">{stat.label}</p>
                </GlassCard>
              ))}
            </div>

            {/* CTA Scroll */}
            <div className="animate-bounce hidden sm:block">
              <ChevronDown className="h-6 w-6 mx-auto text-violet-400" />
            </div>
          </div>
          
          {/* Hero Image - Mobile First */}
          <div className="mt-8 sm:mt-12 md:mt-16 relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-lg sm:rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10 transform hover:scale-105 transition-transform duration-500 max-h-60 sm:max-h-96">
              <img 
                src={heroImage} 
                alt="Dashboard Preview" 
                className="w-full h-auto"
                style={{ transform: `translateY(${scrollY * 0.1}px)` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-24 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Os problemas que você conhece bem
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Nós entendemos seus desafios e criamos soluções específicas
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {painPoints.map((point, i) => (
              <GlassCard key={i} className="hover:scale-105 p-4 sm:p-6" data-testid={`pain-point-${i}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-red-400 font-bold text-xs">✕</span>
                  </div>
                  <h3 className="font-semibold text-slate-100">{point.problem}</h3>
                </div>
                <div className="flex items-start gap-3 pl-9">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-sm text-slate-400">{point.solution}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Spread Throughout */}
      <section id="features" className="relative z-10">
        <div className="text-center py-16 sm:py-24">
          <Badge className="mb-4 px-4 py-2 bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" variant="outline">
            Funcionalidades
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 px-4">
            Tudo que você precisa em
            <br />
            <GradientText>uma plataforma</GradientText>
          </h2>
        </div>

        {/* Feature Sections - Alternating Layout */}
        {features.map((feature, i) => (
          <section key={i} className={`py-16 sm:py-24 relative z-10 ${i % 2 === 0 ? 'bg-gradient-to-r from-violet-950/20 to-transparent' : ''}`}>
            <div className="container mx-auto px-4">
              <div className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 sm:gap-12 max-w-5xl mx-auto`}>
                {/* Text Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-violet-400 flex-shrink-0">{feature.icon}</div>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold">{feature.title}</h3>
                  </div>
                  <p className="text-base sm:text-lg text-slate-200 mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <Button 
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 min-h-[44px] px-6 sm:px-8 text-sm sm:text-base"
                    data-testid={`feature-cta-${i}`}
                  >
                    Saiba mais
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

                {/* Image */}
                <div className="flex-1 w-full">
                  <div className="rounded-lg sm:rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10 h-56 sm:h-72 md:h-80">
                    <img 
                      src={feature.image} 
                      alt={feature.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-950/5 via-transparent to-violet-950/5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
              Planos
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Escolha o plano ideal
              <br />
              <GradientText>para sua loja</GradientText>
            </h2>
          </div>

          {/* Main Plans - Mobile Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto mb-16">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative group transition-all duration-300 ${
                  plan.popular ? 'md:scale-105' : ''
                }`}
                data-testid={`plan-${i}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="px-3 sm:px-4 py-1 text-xs sm:text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <GlassCard className={`h-full flex flex-col p-4 sm:p-6 ${plan.popular ? 'border-violet-500/50 bg-violet-500/20' : ''}`}>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 text-white">{plan.name}</h3>
                    <p className="text-sm text-slate-100 mb-6">{plan.description}</p>
                    <div className="mb-8">
                      <span className="text-3xl sm:text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-sm text-slate-100 block mt-1">{plan.period}</span>
                    </div>
                    <Button 
                      className={`w-full mb-6 min-h-[44px] text-sm sm:text-base font-bold text-white ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700' 
                          : 'bg-violet-500/30 hover:bg-violet-500/40 border border-violet-500/50'
                      }`}
                      variant={plan.popular ? 'default' : 'default'}
                      onClick={() => navigate('/')}
                      data-testid={`button-select-plan-${i}`}
                    >
                      Começar Agora
                    </Button>
                  </div>
                  <ul className="space-y-2 sm:space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? 'bg-violet-500/30' : 'bg-slate-800'
                        }`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-violet-300' : 'text-slate-300'}`} />
                        </div>
                        <span className="text-slate-50">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="border-t border-violet-500/20 pt-12 sm:pt-16 mt-12 sm:mt-16">
            <div className="text-center mb-8 sm:mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold mb-2">
                Precisa de mais?
              </h3>
              <p className="text-sm sm:text-base text-slate-300">Adicione recursos conforme sua loja cresce</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 max-w-2xl mx-auto">
              {addOns.map((addon, i) => (
                <GlassCard key={i} className="text-center p-4 sm:p-6 min-h-[120px] flex flex-col justify-center" data-testid={`addon-${i}`}>
                  <h4 className="text-lg sm:text-xl font-bold mb-2">{addon.name}</h4>
                  <p className="text-xs sm:text-sm text-slate-300 mb-3 sm:mb-4">{addon.description}</p>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold">{addon.price}</span>
                    <span className="text-xs sm:text-sm text-slate-300">{addon.period}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600/30 via-fuchsia-600/30 to-violet-600/30 blur-2xl" />
            <GlassCard className="text-center py-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Pronto para revolucionar suas vendas?
              </h2>
              <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                Junte-se a centenas de lojas que já transformaram sua gestão comercial com EleveaOne
              </p>
              <Button 
                size="lg" 
                className="text-lg px-12 py-8 h-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25"
                onClick={() => navigate('/')}
                data-testid="button-cta-start"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/40 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/elevea2.png" alt="EleveaOne" className="h-16 w-16" />
              <span className="font-bold text-xl text-slate-100">
                EleveaOne
              </span>
            </div>
            <p className="text-sm text-slate-400">
              2024 EleveaOne. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Termos</a>
              <a href="#" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Privacidade</a>
              <a href="#" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
