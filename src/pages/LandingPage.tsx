import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    ArrowRight, Check, TrendingUp, Target, Gift, BarChart3, Smartphone, Users,
    Zap, Shield, Clock, Award, DollarSign, ShoppingCart, CreditCard, MessageSquare,
    Calendar, TrendingDown, Bell, FileText, PieChart, Activity, Settings, Lock
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
    const navigate = useNavigate();
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const mainFeatures = [
        {
            icon: TrendingUp,
            title: "Dashboard Inteligente em Tempo Real",
            description: "Visualize o desempenho de toda sua operação em tempo real. KPIs dinâmicos, gráficos interativos e insights acionáveis para cada loja e colaborador.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/hero_dashboard_mockup_1764082858339.png",
            highlights: ["Atualização em tempo real", "Múltiplas visões (Admin/Loja/Colaborador)", "Gráficos interativos"]
        },
        {
            icon: Target,
            title: "Gestão de Metas Multi-Período",
            description: "Configure metas diárias, semanais, mensais e anuais com distribuição inteligente de pesos diferentes para cada dia. Sistema ajusta automaticamente déficits.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/goals_tracking_illustration_1764082881280.png",
            highlights: ["Pesos dinâmicos por dia", "Ajuste automático de déficit", "Metas individuais e coletivas"]
        },
        {
            icon: Calendar,
            title: "Metas Dinâmicas com Pesos Personalizados",
            description: "Atribua pesos diferentes para cada dia do mês baseado em sazonalidade, eventos especiais ou estratégia comercial. O sistema recalcula automaticamente.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/goals_tracking_illustration_1764082881280.png",
            highlights: ["Calendário interativo", "Pesos por dia", "Recálculo automático"]
        },
        {
            icon: Gift,
            title: "Sistema de Bônus Gamificado Avançado",
            description: "Crie campanhas de incentivo com múltiplos pré-requisitos, prêmios por posição e condições flexíveis. Acompanhe o progresso em tempo real.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/bonus_system_illustration_1764082900560.png",
            highlights: ["Múltiplos pré-requisitos", "Prêmios por posição", "Tracking em tempo real"]
        },
        {
            icon: MessageSquare,
            title: "Notificações WhatsApp Automáticas",
            description: "Envie notificações automáticas ao cadastrar vendas, atingir metas, ganhar bônus e muito mais. Mantenha sua equipe sempre informada.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/team_collaboration_illustration_1764082998149.png",
            highlights: ["Mensagens automáticas", "Notificações de metas", "Alertas de bônus"]
        },
        {
            icon: DollarSign,
            title: "Gestão Financeira Completa",
            description: "Controle total sobre adiantamentos de salário, compras das colaboradoras e parcelas. Tudo integrado e automatizado.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/financial_management_dashboard_1764083852381.png",
            highlights: ["Adiantamentos de salário", "Gestão de parcelas", "Controle de compras"]
        },
        {
            icon: ShoppingCart,
            title: "Sistema de Acompanhamento de Compras",
            description: "Registre e acompanhe todas as compras feitas pelas colaboradoras na loja. Controle de estoque, parcelas e histórico completo.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/financial_management_dashboard_1764083852381.png",
            highlights: ["Registro de compras", "Controle de parcelas", "Histórico completo"]
        },
        {
            icon: CreditCard,
            title: "Gestão de Parcelas e Adiantamentos",
            description: "Sistema completo para gerenciar parcelas de compras e adiantamentos de salário. Cálculo automático de descontos e vencimentos.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/financial_management_dashboard_1764083852381.png",
            highlights: ["Parcelas automáticas", "Adiantamentos controlados", "Descontos em folha"]
        },
        {
            icon: BarChart3,
            title: "Relatórios Avançados Multi-Dimensionais",
            description: "Análises detalhadas por loja, colaborador, período e categoria. Exporte dados e tome decisões baseadas em informações reais.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/reports_analytics_illustration_1764082921105.png",
            highlights: ["Análise multi-dimensional", "Exportação de dados", "Insights acionáveis"]
        },
        {
            icon: Smartphone,
            title: "Mobile First & Responsivo",
            description: "Acesse de qualquer lugar, a qualquer momento. Interface responsiva otimizada para todos os dispositivos.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/mobile_app_mockup_1764082970903.png",
            highlights: ["100% responsivo", "App-like experience", "Offline-ready"]
        },
        {
            icon: Users,
            title: "Gestão de Equipe Completa",
            description: "Gerencie colaboradores, lojas e permissões. Sistema de roles com controle granular de acesso.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/team_collaboration_illustration_1764082998149.png",
            highlights: ["Controle de permissões", "Múltiplas lojas", "Hierarquia flexível"]
        },
        {
            icon: Activity,
            title: "Gincanas Semanais",
            description: "Crie competições semanais com checkpoints e prêmios. Aumente o engajamento e a produtividade da equipe.",
            image: "/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/bonus_system_illustration_1764082900560.png",
            highlights: ["Checkpoints semanais", "Ranking em tempo real", "Prêmios automáticos"]
        }
    ];

    const additionalFeatures = [
        { icon: Bell, title: "Alertas Inteligentes", desc: "Notificações personalizadas para eventos importantes" },
        { icon: FileText, title: "Histórico Completo", desc: "Acesso a todo histórico de vendas, metas e bônus" },
        { icon: PieChart, title: "Benchmarks", desc: "Compare performance entre lojas e períodos" },
        { icon: Lock, title: "Segurança Avançada", desc: "Dados criptografados e backup automático" },
        { icon: Settings, title: "Configuração Flexível", desc: "Personalize o sistema para sua necessidade" },
        { icon: Award, title: "Gamificação", desc: "Sistema de conquistas e reconhecimento" }
    ];

    const benefits = [
        { icon: Zap, text: "Aumento de até 40% na produtividade" },
        { icon: Shield, text: "Dados seguros e criptografados" },
        { icon: Clock, text: "Economize 10+ horas por semana" },
        { icon: Award, text: "Melhore o engajamento da equipe em 60%" },
        { icon: DollarSign, text: "Reduza erros financeiros em 95%" },
        { icon: TrendingUp, text: "Aumente vendas em até 35%" }
    ];

    const painPoints = [
        {
            problem: "Perdendo vendas por falta de acompanhamento em tempo real?",
            solution: "Monitore cada venda instantaneamente com notificações automáticas"
        },
        {
            problem: "Equipe desmotivada e sem direção clara?",
            solution: "Gamifique com metas dinâmicas, bônus atrativos e gincanas semanais"
        },
        {
            problem: "Relatórios manuais tomando horas do seu tempo?",
            solution: "Automatize tudo e tenha insights instantâneos em poucos cliques"
        },
        {
            problem: "Dificuldade em gerenciar adiantamentos e compras?",
            solution: "Sistema financeiro completo com controle de parcelas e descontos automáticos"
        },
        {
            problem: "Metas fixas que não se adaptam à realidade?",
            solution: "Metas dinâmicas com pesos diferentes por dia e ajuste automático de déficit"
        },
        {
            problem: "Comunicação falha com a equipe?",
            solution: "WhatsApp integrado com notificações automáticas para todos os eventos"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
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
                        <div className="space-y-8 text-center lg:text-left">
                            <div className="inline-block">
                                <span className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold animate-fade-in">
                                    🚀 A Plataforma Mais Completa do Mercado
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight animate-fade-in-up">
                                Transforme Sua Equipe em{" "}
                                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                    Máquina de Vendas
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-muted-foreground animate-fade-in-up delay-200">
                                Sistema completo com gestão de metas dinâmicas, bônus gamificados, controle financeiro, notificações WhatsApp e muito mais.
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
                                    Ver Todas as Funcionalidades
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 animate-fade-in-up delay-400">
                                {[
                                    { value: "40%", label: "Mais Produtividade" },
                                    { value: "10h", label: "Economizadas/Semana" },
                                    { value: "35%", label: "Mais Vendas" }
                                ].map((stat, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-3xl font-bold text-primary">{stat.value}</div>
                                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative animate-fade-in-up delay-500">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 hover:scale-105 transition-transform duration-500">
                                <img
                                    src="/home/matheusmartins/.gemini/antigravity/brain/6e65ba7e-56f9-4a5e-8f2c-7b0d6357326d/hero_dashboard_mockup_1764082858339.png"
                                    alt="Dashboard"
                                    className="w-full h-auto"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                            </div>

                            <div className="absolute -top-4 -right-4 bg-card border border-border rounded-lg p-4 shadow-lg animate-float">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-sm font-semibold">Tempo Real</span>
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
                            Você não está sozinho. Veja como resolvemos cada um deles.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {painPoints.map((point, i) => (
                            <Card key={i} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-destructive">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <span className="text-destructive font-bold">✕</span>
                                        </div>
                                        <p className="font-semibold">{point.problem}</p>
                                    </div>
                                    <div className="flex items-start gap-3 pl-9">
                                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                            <Check className="w-4 h-4 text-green-600" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">{point.solution}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Main Features Section */}
            <section id="features" className="py-20 px-4">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            Sistema Completo e Robusto{" "}
                            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                                Para Sua Operação
                            </span>
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            Muito mais do que um simples sistema de vendas. Uma plataforma completa de gestão comercial e financeira.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {mainFeatures.map((feature, i) => (
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
                                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                                    <div className="space-y-2 pt-2">
                                        {feature.highlights.map((highlight, j) => (
                                            <div key={j} className="flex items-center gap-2 text-xs">
                                                <Check className="w-4 h-4 text-green-600" />
                                                <span className="text-muted-foreground">{highlight}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Additional Features Grid */}
            <section className="py-20 px-4 bg-muted/30">
                <div className="container mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            E Muito Mais...
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {additionalFeatures.map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-4 p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <feature.icon className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-1">{feature.title}</h4>
                                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 px-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
                <div className="container mx-auto">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-bold text-center mb-12">
                            Resultados Comprovados
                        </h2>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {benefits.map((benefit, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                >
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <benefit.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <p className="font-semibold">{benefit.text}</p>
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
                            Junte-se a centenas de empresas que já transformaram sua gestão comercial e financeira
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
                            © 2025 Sistema de Gestão Comercial e Financeira. Todos os direitos reservados.
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

        .bg-grid-white\\/10 {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>
        </div>
    );
}
