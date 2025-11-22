import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Zap, 
  Shield, 
  CheckCircle2,
  ArrowRight,
  Star,
  Award,
  Calendar,
  DollarSign,
  PieChart,
  X,
  Sparkles,
  LineChart,
  ShoppingCart,
  CreditCard,
  Clock,
  FileText,
  Bell,
  Download,
  Filter,
  TrendingDown,
  Activity,
  Gift,
  Medal,
  ThumbsUp,
  Smartphone,
  Globe,
  Lock,
  PlayCircle,
  Monitor,
  Database,
  Cloud,
  Search,
  Settings,
  Eye,
  Calendar as CalendarIcon,
  Calculator,
  TrendingUp as TrendingUpIcon,
  ArrowUpRight,
  Check
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const mainFeatures = [
    {
      icon: <Target className="h-10 w-10 text-primary" />,
      title: "Gestão Inteligente de Metas",
      description: "Sistema completo de metas mensais, semanais e individuais com cálculos automáticos baseados em pesos diários. Metas dinâmicas que se ajustam conforme o desempenho da equipe.",
      details: [
        "Metas mensais por loja e individual",
        "Metas semanais personalizáveis",
        "Super metas para motivar ainda mais",
        "Cálculo automático de metas diárias",
        "Acompanhamento em tempo real"
      ],
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: <Trophy className="h-10 w-10 text-yellow-500" />,
      title: "Gamificação Completa",
      description: "Sistema de conquistas, troféus e rankings que transforma o trabalho em uma experiência motivadora. Galeria de prêmios para destacar as melhores colaboradoras.",
      details: [
        "Galeria de troféus e conquistas",
        "Rankings mensais e semanais",
        "Sistema de bônus configurável",
        "Checkpoints visuais de progresso",
        "Reconhecimento automático de metas"
      ],
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: <BarChart3 className="h-10 w-10 text-green-500" />,
      title: "Analytics Avançado",
      description: "Dashboards completos com KPIs em tempo real, gráficos interativos e relatórios detalhados. Visualize vendas, ticket médio, PA, preço médio e muito mais.",
      details: [
        "Dashboards em tempo real",
        "Múltiplos filtros de período",
        "Gráficos comparativos",
        "Exportação de relatórios",
        "Análise por loja e colaboradora"
      ],
      color: "from-green-500 to-emerald-600"
    },
    {
      icon: <Users className="h-10 w-10 text-purple-500" />,
      title: "Gestão de Equipe",
      description: "Controle completo de colaboradoras, limites financeiros, compras parceladas, adiantamentos e folgas. Tudo centralizado em uma única plataforma.",
      details: [
        "Cadastro completo de colaboradoras",
        "Controle de limites totais e mensais",
        "Gestão de compras parceladas",
        "Sistema de adiantamentos",
        "Controle de folgas e dias off"
      ],
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <LineChart className="h-10 w-10 text-indigo-500" />,
      title: "Relatórios Personalizados",
      description: "Gere relatórios completos por período, loja, colaboradora ou tipo de venda. Exporte dados para análise externa ou compartilhamento.",
      details: [
        "Relatórios customizáveis",
        "Filtros avançados",
        "Visualização em gráficos",
        "Exportação de dados",
        "Comparação de períodos"
      ],
      color: "from-indigo-500 to-blue-600"
    },
    {
      icon: <Zap className="h-10 w-10 text-orange-500" />,
      title: "Metas Dinâmicas",
      description: "Sistema inteligente que recalcula metas diárias automaticamente baseado no desempenho real. Ajuste em tempo real para manter a equipe sempre motivada.",
      details: [
        "Recálculo automático de metas",
        "Piso garantido para cada dia",
        "Ajuste baseado em vendas realizadas",
        "Transparência total nos cálculos",
        "Motivação contínua da equipe"
      ],
      color: "from-orange-500 to-red-500"
    }
  ];

  const keyMetrics = [
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: "Faturamento Total",
      description: "Acompanhe vendas em tempo real com atualizações instantâneas"
    },
    {
      icon: <ShoppingCart className="h-6 w-6" />,
      title: "Ticket Médio",
      description: "Calcule automaticamente o valor médio por venda"
    },
    {
      icon: <Activity className="h-6 w-6" />,
      title: "PA (Peças/Atendimento)",
      description: "Métrica essencial para otimizar seu mix de produtos"
    },
    {
      icon: <TrendingUpIcon className="h-6 w-6" />,
      title: "Preço Médio por Peça",
      description: "Acompanhe o valor médio de cada produto vendido"
    }
  ];

  const benefits = [
    {
      icon: <TrendingUp className="h-8 w-8 text-green-500" />,
      title: "Aumento de Vendas",
      description: "Equipes motivadas vendem mais. Nossos dados mostram aumento médio de 35% nas vendas."
    },
    {
      icon: <Clock className="h-8 w-8 text-blue-500" />,
      title: "Economia de Tempo",
      description: "Redução de até 80% do tempo gasto com processos manuais e planilhas."
    },
    {
      icon: <Eye className="h-8 w-8 text-purple-500" />,
      title: "Visibilidade Total",
      description: "Tenha controle completo sobre cada venda, meta e desempenho em tempo real."
    },
    {
      icon: <Gift className="h-8 w-8 text-pink-500" />,
      title: "Equipe Motivada",
      description: "Gamificação e reconhecimento aumentam a motivação e retenção de talentos."
    },
    {
      icon: <Calculator className="h-8 w-8 text-orange-500" />,
      title: "Cálculos Automáticos",
      description: "Elimine erros de cálculo com sistema automatizado e 100% preciso."
    },
    {
      icon: <Target className="h-8 w-8 text-red-500" />,
      title: "Metas Inteligentes",
      description: "Sistema que se adapta ao desempenho real da equipe mantendo todos motivados."
    }
  ];

  const painPoints = [
    {
      problem: "Falta de visibilidade do desempenho em tempo real",
      solution: "Dashboards completos com métricas atualizadas instantaneamente. Veja tudo que acontece na hora.",
      icon: <BarChart3 className="h-6 w-6 text-green-500" />
    },
    {
      problem: "Dificuldade em acompanhar e ajustar metas",
      solution: "Sistema automatizado de metas com cálculos inteligentes. Metas que se ajustam automaticamente ao desempenho.",
      icon: <Target className="h-6 w-6 text-blue-500" />
    },
    {
      problem: "Falta de motivação e engajamento da equipe",
      solution: "Gamificação completa com troféus, rankings, bônus e reconhecimento automático. Transforme trabalho em diversão.",
      icon: <Trophy className="h-6 w-6 text-yellow-500" />
    },
    {
      problem: "Processos manuais demorados e propensos a erros",
      solution: "Automação completa de relatórios, cálculos e análises. Reduza tempo e erros em até 80%.",
      icon: <Zap className="h-6 w-6 text-orange-500" />
    },
    {
      problem: "Falta de controle financeiro detalhado",
      solution: "Gestão completa de limites, compras parceladas e adiantamentos. Controle total em um só lugar.",
      icon: <CreditCard className="h-6 w-6 text-purple-500" />
    },
    {
      problem: "Dificuldade em tomar decisões baseadas em dados",
      solution: "Relatórios avançados e analytics que transformam dados em insights acionáveis para sua estratégia.",
      icon: <LineChart className="h-6 w-6 text-indigo-500" />
    }
  ];

  const testimonials = [
    {
      name: "Gestor de Vendas",
      role: "Loungerie",
      text: "O sistema revolucionou nossa gestão. As vendas aumentaram 40% e a equipe está mais motivada do que nunca!",
      rating: 5
    },
    {
      name: "Administradora",
      role: "Mr. Kitsch",
      text: "Economizamos horas de trabalho manual. Agora focamos no que importa: vender e motivar a equipe!",
      rating: 5
    },
    {
      name: "Gerente de Loja",
      role: "Sacada | Oh, Boy",
      text: "A galeria de troféus é incrível! As meninas ficam super empolgadas para aparecer no ranking.",
      rating: 5
    }
  ];

  const stats = [
    { value: "35%", label: "Aumento Médio em Vendas", icon: <TrendingUp className="h-8 w-8" /> },
    { value: "80%", label: "Redução de Tempo Manual", icon: <Clock className="h-8 w-8" /> },
    { value: "100%", label: "Precisão nos Cálculos", icon: <CheckCircle2 className="h-8 w-8" /> },
    { value: "24/7", label: "Disponibilidade", icon: <Globe className="h-8 w-8" /> }
  ];

  const useCases = [
    {
      title: "Gestão Diária de Vendas",
      description: "Lançe vendas rapidamente, acompanhe o desempenho em tempo real e veja quem está batendo as metas do dia.",
      features: ["Lançamento rápido de vendas", "Acompanhamento em tempo real", "Metas diárias dinâmicas"]
    },
    {
      title: "Acompanhamento Semanal",
      description: "Visualize o progresso semanal com barras de progresso gamificadas, checkpoints e projeções inteligentes.",
      features: ["Progresso visual gamificado", "Checkpoints de meta e super meta", "Projeções automáticas"]
    },
    {
      title: "Análise Mensal",
      description: "Relatórios completos do mês com gráficos, comparações e análises detalhadas para tomada de decisão.",
      features: ["Relatórios completos", "Gráficos comparativos", "Exportação de dados"]
    },
    {
      title: "Gestão de Equipe",
      description: "Controle completo de colaboradoras, limites, compras e adiantamentos em uma plataforma única.",
      features: ["Gestão de colaboradoras", "Controle de limites", "Sistema de adiantamentos"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Controle OM</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Login
            </Button>
            <Button onClick={() => navigate('/auth')}>
              Começar Agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Enhanced */}
      <section className="container mx-auto px-4 py-20 sm:py-32 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="text-center max-w-5xl mx-auto">
          <Badge className="mb-6 text-base px-6 py-2 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            Sistema Completo de Gestão para Varejo
          </Badge>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
            Controle Oliveira Martins
          </h1>
          <p className="text-2xl sm:text-3xl text-muted-foreground mb-6 font-light">
            Transforme a gestão da sua equipe com tecnologia, gamificação e insights poderosos
          </p>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Sistema completo para gerenciar vendas, metas, colaboradoras e resultados. 
            Tudo em uma plataforma intuitiva, gamificada e poderosa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="text-lg px-10 py-6 h-auto shadow-lg hover:shadow-xl transition-shadow"
              onClick={() => navigate('/auth')}
            >
              Começar Agora Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-10 py-6 h-auto border-2"
              onClick={() => navigate('/auth')}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Ver Demonstração
            </Button>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Sem Cartão de Crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Setup em Minutos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Enhanced */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-4 text-primary">
                  {stat.icon}
                </div>
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Main Features Section - Enhanced */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge className="mb-4">Funcionalidades</Badge>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Tudo que você precisa em uma plataforma
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sistema completo com todas as ferramentas necessárias para gerenciar sua equipe de vendas de forma eficiente e motivadora
          </p>
        </div>
        <div className="space-y-16">
          {mainFeatures.map((feature, index) => (
            <Card 
              key={index} 
              className={`overflow-hidden border-2 ${
                index % 2 === 0 
                  ? 'md:flex-row' 
                  : 'md:flex-row-reverse'
              } flex flex-col`}
            >
              <div className={`md:w-1/2 bg-gradient-to-br ${feature.color} p-8 sm:p-12 flex items-center justify-center`}>
                <div className="text-white/90">
                  {feature.icon}
                </div>
              </div>
              <div className="md:w-1/2 p-8 sm:p-12">
                <h3 className="text-2xl sm:text-3xl font-bold mb-4">{feature.title}</h3>
                <p className="text-lg text-muted-foreground mb-6">{feature.description}</p>
                <ul className="space-y-3">
                  {feature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Key Metrics Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Métricas Importantes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Acompanhe todas as métricas essenciais para o sucesso do seu negócio
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {keyMetrics.map((metric, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-4 text-primary">
                    {metric.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{metric.title}</h3>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section - Enhanced */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">Benefícios Reais</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Resultados comprovados que fazem a diferença no seu negócio
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <Card key={index} className="hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-6">
                <div className="mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pain Points Section - Enhanced */}
      <section className="bg-gradient-to-br from-muted to-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Problemas que Resolvemos</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Entendemos suas dores e criamos soluções específicas para cada desafio
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {painPoints.map((item, index) => (
              <Card key={index} className="border-l-4 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2 mb-3">
                        <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <h3 className="font-semibold text-destructive">{item.problem}</h3>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">{item.solution}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">Casos de Uso</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Veja como diferentes perfis utilizam o sistema no dia a dia
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {index === 0 && <Calendar className="h-5 w-5 text-primary" />}
                    {index === 1 && <TrendingUp className="h-5 w-5 text-primary" />}
                    {index === 2 && <BarChart3 className="h-5 w-5 text-primary" />}
                    {index === 3 && <Users className="h-5 w-5 text-primary" />}
                  </div>
                  {useCase.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Resultados reais de quem já está usando o sistema
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tire suas dúvidas sobre o sistema
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                question: "Como funciona o sistema de metas?",
                answer: "O sistema permite criar metas mensais, semanais e individuais com cálculos automáticos baseados em pesos diários. As metas podem ser ajustadas dinamicamente conforme o desempenho da equipe."
              },
              {
                question: "O sistema funciona no celular?",
                answer: "Sim! O sistema é 100% mobile-first e responsivo. Funciona perfeitamente em smartphones, tablets e desktops, permitindo que você gerencie sua equipe de qualquer lugar."
              },
              {
                question: "Como funciona a gamificação?",
                answer: "O sistema oferece troféus, rankings, checkpoints visuais e uma galeria de conquistas. Quando uma colaboradora atinge uma meta ou super meta, ela recebe um troféu automaticamente."
              },
              {
                question: "Preciso de cartão de crédito para começar?",
                answer: "Não! Você pode começar a usar o sistema gratuitamente, sem necessidade de cartão de crédito. O setup leva apenas alguns minutos."
              },
              {
                question: "Como funciona o sistema de bônus?",
                answer: "Você pode configurar bônus para metas semanais e super metas semanais. O sistema calcula automaticamente quem atingiu os objetivos e exibe os prêmios de forma clara e motivadora."
              },
              {
                question: "Posso gerenciar múltiplas lojas?",
                answer: "Sim! O sistema permite gerenciar múltiplas lojas de forma centralizada, com dashboards separados para cada loja e visão consolidada para administradores."
              }
            ].map((faq, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                      {index + 1}
                    </div>
                    {faq.question}
                  </h3>
                  <p className="text-muted-foreground pl-8">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid - Additional */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">Tecnologias e Segurança</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma moderna, segura e confiável
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Smartphone className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Mobile First</h3>
              <p className="text-sm text-muted-foreground">100% responsivo e otimizado para celular</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Lock className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Seguro</h3>
              <p className="text-sm text-muted-foreground">Criptografia e segurança de nível empresarial</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Cloud className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Cloud</h3>
              <p className="text-sm text-muted-foreground">Dados seguros na nuvem, sempre disponíveis</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Zap className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Rápido</h3>
              <p className="text-sm text-muted-foreground">Interface rápida e atualizações instantâneas</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section - Enhanced */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary via-accent to-primary border-0 shadow-2xl overflow-hidden relative">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          </div>
          <CardContent className="pt-16 pb-16 text-center relative z-10">
            <Trophy className="h-16 w-16 mx-auto mb-6 text-white" />
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
              Pronto para transformar sua gestão?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Comece agora e veja sua equipe alcançar resultados extraordinários. 
              Setup rápido, resultados imediatos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-10 py-6 h-auto"
                onClick={() => navigate('/auth')}
              >
                Começar Agora Grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-10 py-6 h-auto border-2 border-white text-white hover:bg-white/10"
                onClick={() => navigate('/auth')}
              >
                Falar com Especialista
              </Button>
            </div>
            <p className="text-sm text-white/80 mt-6">
              ✓ Sem cartão de crédito  •  ✓ Setup em minutos  •  ✓ Suporte incluso
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <span className="font-bold">Controle Oliveira Martins</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Controle Oliveira Martins. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
