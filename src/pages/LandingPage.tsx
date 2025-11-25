import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Check, TrendingUp, Target, Gift, BarChart3, Smartphone, Users, Zap, Shield, Clock, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
    const navigate = useNavigate();
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const features = [
        {
            icon: TrendingUp,
            title: "Dashboard Inteligente",
            description: "Visualize o desempenho em tempo real com métricas que importam. KPIs claros, gráficos interativos e insights acionáveis.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/hero_dashboard_mockup_1764082858339.png"
        },
        {
            icon: Target,
            title: "Gestão de Metas Avançada",
            description: "Defina metas individuais e coletivas com distribuição inteligente de pesos diários. Acompanhe o progresso e ajuste automaticamente.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/goals_tracking_illustration_1764082881280.png"
        },
        {
            icon: Gift,
            title: "Sistema de Bônus Gamificado",
            description: "Crie campanhas de incentivo flexíveis com múltiplos pré-requisitos e prêmios por posição. Motive sua equipe de forma inteligente.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/bonus_system_illustration_1764082900560.png"
        },
        {
            icon: BarChart3,
            title: "Relatórios Poderosos",
            description: "Análises detalhadas por loja, colaborador e período. Exporte dados e tome decisões baseadas em informações reais.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/reports_analytics_illustration_1764082921105.png"
        },
        {
            icon: Smartphone,
            title: "Mobile First",
            description: "Acesse de qualquer lugar, a qualquer momento. Interface responsiva otimizada para dispositivos móveis.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/mobile_app_mockup_1764082970903.png"
        },
        {
            icon: Users,
            title: "Notificações WhatsApp",
            description: "Mantenha sua equipe informada com notificações automáticas sobre metas, bônus e conquistas direto no WhatsApp.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/team_collaboration_illustration_1764082998149.png"
        }
    ];

    const benefits = [
        { icon: Zap, text: "Aumento de até 40% na produtividade" },
        { icon: Shield, text: "Dados seguros e criptografados" },
        { icon: Clock, text: "Economize 10+ horas por semana" },
        { icon: Award, text: "Melhore o engajamento da equipe" }
    ];

    const painPoints = [
        {
            problem: "Perdendo vendas por falta de acompanhamento?",
            solution: "Monitore cada venda em tempo real e nunca mais perca uma oportunidade"
        },
        {
            problem: "Equipe desmotivada e sem direção?",
            solution: "Gamifique o processo com metas claras e bônus atrativos"
        },
        {
            problem: "Relatórios manuais tomando seu tempo?",
            solution: "Automatize tudo e tenha insights instantâneos"
        },
        {
            problem: "Dificuldade em gerenciar múltiplas lojas?",
            solution: "Centralize tudo em uma única plataforma intuitiva"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
                {/* Animated background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"
                        style={{ transform: `translateY(${scrollY * 0.5}px)` }}
                    />
                    <div
                        className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"
                        style={{ transform: `translateY(${-scrollY * 0.3}px)` }}
                    />
                </div>

                <div className="container mx-auto relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left side - Copy */}
                        <div className="space-y-8 text-center lg:text-left">
                            <div className="inline-block">
                                <span className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold animate-fade-in">
                                    🚀 A Revolução na Gestão de Vendas
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight animate-fade-in-up">
                                Transforme Sua Equipe em{" "}
                                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                    Máquina de Vendas
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-muted-foreground animate-fade-in-up delay-200">
                                Pare de perder vendas e tempo com planilhas. Gerencie metas, bônus e performance em tempo real com a plataforma mais completa do mercado.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up delay-300">
                                <Button
                                    size="lg"
                                    className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
                                    onClick={() => navigate("/")}
                                >
                                    Começar Agora
                                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="text-lg px-8 py-6 border-2 hover:bg-primary/5"
                                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                >
                                    Ver Demonstração
                                </Button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 pt-8 animate-fade-in-up delay-400">
                                {[
                                    { value: "40%", label: "Mais Produtividade" },
                                    { value: "10h", label: "Economizadas/Semana" },
                                    { value: "100%", label: "Satisfação" }
                                ].map((stat, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-3xl font-bold text-primary">{stat.value}</div>
                                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right side - Hero Image */}
                        <div className="relative animate-fade-in-up delay-500">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 hover:scale-105 transition-transform duration-500">
                                <img
                                    src="/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/hero_dashboard_mockup_1764082858339.png"
                                    alt="Dashboard"
                                    className="w-full h-auto"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                            </div>

                            {/* Floating cards */}
                            <div className="absolute -top-4 -right-4 bg-card border border-border rounded-lg p-4 shadow-lg animate-float">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-sm font-semibold">Em tempo real</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pain Points Section */}
            <section className="py-20 px-4 bg-muted/30">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            Reconhece Esses Problemas?
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            Você não está sozinho. Veja como resolvemos isso.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {painPoints.map((point, i) => (
                            <Card key={i} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-destructive">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <span className="text-destructive font-bold">✕</span>
                                        </div>
                                        <p className="font-semibold text-lg">{point.problem}</p>
                                    </div>
                                    <div className="flex items-start gap-3 pl-9">
                                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <Check className="w-4 h-4 text-green-600" />
                                        </div>
                                        <p className="text-muted-foreground">{point.solution}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-4">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            Tudo Que Você Precisa,{" "}
                            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                                Em Um Só Lugar
                            </span>
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Funcionalidades poderosas que transformam a gestão da sua equipe de vendas
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, i) => (
                            <Card
                                key={i}
                                className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden border-border/50 hover:border-primary/50"
                            >
                                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/5 to-purple-500/5">
                                    <img
                                        src={feature.image}
                                        alt={feature.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <feature.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold">{feature.title}</h3>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 px-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
                <div className="container mx-auto">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-bold text-center mb-12">
                            Por Que Escolher Nossa Plataforma?
                        </h2>

                        <div className="grid sm:grid-cols-2 gap-6">
                            {benefits.map((benefit, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                >
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <benefit.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <p className="font-semibold text-lg">{benefit.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20" />
                <div className="absolute inset-0 bg-grid-white/10" />

                <div className="container mx-auto relative z-10">
                    <div className="max-w-3xl mx-auto text-center space-y-8">
                        <h2 className="text-4xl md:text-6xl font-bold">
                            Pronto Para Revolucionar Suas Vendas?
                        </h2>
                        <p className="text-xl md:text-2xl text-muted-foreground">
                            Junte-se a centenas de empresas que já transformaram sua gestão de vendas
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            <Button
                                size="lg"
                                className="text-xl px-12 py-8 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 shadow-2xl hover:shadow-3xl transition-all duration-300 group"
                                onClick={() => navigate("/")}
                            >
                                Começar Gratuitamente
                                <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        </div>

                        <p className="text-sm text-muted-foreground pt-4">
                            ✓ Sem cartão de crédito  ✓ Suporte dedicado  ✓ Configuração em minutos
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 border-t border-border/50">
                <div className="container mx-auto">
                    <div className="text-center text-muted-foreground">
                        <p className="text-sm">
                            © 2025 Sistema de Gestão de Vendas. Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </footer>

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .delay-200 {
          animation-delay: 200ms;
        }

        .delay-300 {
          animation-delay: 300ms;
        }

        .delay-400 {
          animation-delay: 400ms;
        }

        .delay-500 {
          animation-delay: 500ms;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }

        .bg-grid-white\/10 {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>
        </div>
    );
}
