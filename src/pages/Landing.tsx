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
  ChevronDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from '@/components/GlassCard';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { FloatingParticles } from '@/components/FloatingParticles';
import { GradientText } from '@/components/GradientText';

import heroImage from "@assets/generated_images/futuristic_tech_dashboard_hero.png";
import abstractWaves from "@assets/generated_images/abstract_tech_gradient_waves.png";
import dataVisualization from "@assets/generated_images/3d_data_analytics_visualization.png";
import devicesMockup from "@assets/generated_images/devices_dashboard_mockup.png";
import aiNetwork from "@assets/generated_images/ai_network_intelligence_abstract.png";
import gamificationTrophy from "@assets/generated_images/gamification_trophy_achievement.png";
import dashboardImage from "@assets/generated_images/saas_dashboard_analytics_interface.png";
import teamCelebration from "@assets/generated_images/team_celebration_success_moment.png";
import mobileWhatsapp from "@assets/generated_images/mobile_app_whatsapp_notifications.png";
import dataFlow from "@assets/generated_images/data_flow_technology_background.png";

export default function Landing() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);

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
      description: "Sistema inteligente que recalcula metas automaticamente baseado no desempenho real.",
      image: heroImage
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
      description: "Cashback automático com notificações WhatsApp e controle completo de saldos.",
      image: mobileWhatsapp
    },
    {
      icon: <RefreshCw className="h-6 w-6" />,
      title: "Integração Tiny ERP",
      description: "Sincronização automática com Tiny ERP para pedidos e contatos em tempo real.",
      image: dataVisualization
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Multi-Tenancy",
      description: "Gerencie múltiplas lojas com isolamento total de dados e permissões granulares.",
      image: teamCelebration
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
      price: "R$ 97",
      period: "/mês",
      description: "Perfeito para começar",
      features: ["1 Loja", "5 Colaboradores", "Dashboard básico", "Relatórios simples", "Suporte por email"],
      popular: false
    },
    {
      name: "Pro",
      price: "R$ 197",
      period: "/mês",
      description: "Para negócios em crescimento",
      features: ["3 Lojas", "15 Colaboradores", "Dashboard avançado", "Cashback automático", "Integração Tiny ERP", "WhatsApp notifications"],
      popular: true
    },
    {
      name: "Enterprise",
      price: "R$ 497",
      period: "/mês",
      description: "Solução completa para redes",
      features: ["Ilimitadas", "Ilimitados", "Recursos ilimitados", "API dedicada", "Relatórios customizados", "Gerente de conta"],
      popular: false
    }
  ];

  const painPoints = [
    {
      problem: "Minhas vendedoras não batem meta",
      solution: "Metas Inteligentes e Gamificação mantêm sua equipe engajada"
    },
    {
      problem: "O cliente compra uma vez e some",
      solution: "Cashback Automático via WhatsApp garante recompra"
    },
    {
      problem: "Perco tempo com planilhas",
      solution: "Integração com Tiny ERP automatiza 100% dos dados"
    },
    {
      problem: "Não sei se estou lucrando",
      solution: "Dashboards em tempo real mostram saúde financeira"
    },
    {
      problem: "Equipe desmotivada",
      solution: "Troféus, rankings e reconhecimento aumentam motivação"
    },
    {
      problem: "Gestão de múltiplas lojas é caótica",
      solution: "Multi-tenancy com isolamento total de dados"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <FloatingParticles />
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/40 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">
              <GradientText>Controle OM</GradientText>
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

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <Badge className="mb-6 px-4 py-2 bg-violet-500/10 text-violet-400 border-violet-500/20" variant="outline">
              <Sparkles className="h-3 w-3 mr-2" />
              Plataforma Definitiva para Varejo
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Transforme sua loja em
              <br />
              <GradientText className="text-5xl sm:text-6xl md:text-7xl">
                máquina de vendas
              </GradientText>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Cashback automático, metas dinâmicas, gamificação e integração com Tiny ERP. 
              Tudo em uma plataforma moderna para varejo.
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16">
              {stats.map((stat, i) => (
                <GlassCard key={i} className="text-center" data-testid={`stat-${i}`}>
                  <div className="flex items-center justify-center gap-2 text-violet-400 mb-2">
                    {stat.icon}
                    <span className="text-2xl font-bold">
                      <AnimatedCounter end={stat.value} suffix="%" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </GlassCard>
              ))}
            </div>

            {/* CTA Scroll */}
            <div className="animate-bounce">
              <ChevronDown className="h-6 w-6 mx-auto text-violet-400" />
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="mt-16 relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10 transform hover:scale-105 transition-transform duration-500">
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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {painPoints.map((point, i) => (
              <GlassCard key={i} className="hover:scale-105" data-testid={`pain-point-${i}`}>
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

      {/* Features Section */}
      <section id="features" className="py-24 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" variant="outline">
              Funcionalidades
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Tudo que você precisa em
              <br />
              <GradientText>uma plataforma</GradientText>
            </h2>
          </div>

          {/* Interactive Features */}
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-3">
                {features.map((feature, i) => (
                  <GlassCard
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    className={`cursor-pointer transition-all ${activeFeature === i ? 'border-violet-500/50 bg-violet-500/20' : ''}`}
                    data-testid={`feature-button-${i}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-violet-400 mt-1">{feature.icon}</div>
                      <div>
                        <h3 className="font-semibold text-slate-100">{feature.title}</h3>
                        <p className="text-sm text-slate-400">{feature.description}</p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
              <div className="relative">
                <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl">
                  <img 
                    src={features[activeFeature].image} 
                    alt={features[activeFeature].title}
                    className="w-full h-auto transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
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

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative group transition-all duration-300 ${
                  plan.popular ? 'lg:scale-105' : ''
                }`}
                data-testid={`plan-${i}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="px-4 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <GlassCard className={`h-full flex flex-col ${plan.popular ? 'border-violet-500/50 bg-violet-500/20' : ''}`}>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-slate-400 mb-6">{plan.description}</p>
                    <div className="mb-8">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-slate-400">{plan.period}</span>
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
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          plan.popular ? 'bg-violet-500/30' : 'bg-slate-800'
                        }`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-violet-400' : 'text-slate-400'}`} />
                        </div>
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </div>
            ))}
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
                Junte-se a centenas de lojas que já transformaram sua gestão comercial
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">
                <GradientText>Controle OM</GradientText>
              </span>
            </div>
            <p className="text-sm text-slate-400">
              2024 Controle Oliveira Martins. Todos os direitos reservados.
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
