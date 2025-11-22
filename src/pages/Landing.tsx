import { Card, CardContent } from "@/components/ui/card";
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
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Target className="h-8 w-8 text-primary" />,
      title: "Gestão de Metas",
      description: "Defina metas mensais, semanais e individuais com acompanhamento em tempo real. Sistema de super metas para motivar ainda mais sua equipe."
    },
    {
      icon: <Trophy className="h-8 w-8 text-yellow-500" />,
      title: "Gamificação e Troféus",
      description: "Sistema de conquistas e troféus que reconhece o desempenho excepcional. Galeria de prêmios para destacar as melhores colaboradoras."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-green-500" />,
      title: "Analytics em Tempo Real",
      description: "Dashboards completos com KPIs, gráficos e relatórios detalhados. Acompanhe vendas, ticket médio, PA e muito mais."
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Gestão de Colaboradoras",
      description: "Controle completo de colaboradoras, limites, compras parceladas e adiantamentos. Tudo em um só lugar."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-purple-500" />,
      title: "Relatórios Avançados",
      description: "Gere relatórios personalizados por período, loja ou colaboradora. Exporte dados para análise externa."
    },
    {
      icon: <Zap className="h-8 w-8 text-orange-500" />,
      title: "Metas Dinâmicas",
      description: "Sistema inteligente que recalcula metas diárias baseado no desempenho. Ajuste automático para manter a equipe sempre motivada."
    }
  ];

  const benefits = [
    "Aumento de produtividade e vendas",
    "Motivação constante através de gamificação",
    "Visibilidade completa do desempenho",
    "Redução de erros e retrabalho",
    "Economia de tempo em processos manuais",
    "Tomada de decisão baseada em dados reais"
  ];

  const painPoints = [
    {
      problem: "Falta de visibilidade do desempenho",
      solution: "Dashboards completos com métricas em tempo real"
    },
    {
      problem: "Dificuldade em acompanhar metas",
      solution: "Sistema automatizado de metas com notificações"
    },
    {
      problem: "Falta de motivação da equipe",
      solution: "Gamificação com troféus, rankings e bônus"
    },
    {
      problem: "Processos manuais e demorados",
      solution: "Automação completa de relatórios e cálculos"
    },
    {
      problem: "Falta de controle financeiro",
      solution: "Gestão completa de limites, compras e adiantamentos"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-4 text-sm px-4 py-1">
            <Star className="h-3 w-3 mr-1" />
            Sistema Completo de Gestão
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Controle Oliveira Martins
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8">
            Transforme a gestão da sua equipe com tecnologia, gamificação e insights poderosos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate('/auth')}
            >
              Começar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8"
              onClick={() => navigate('/auth')}
            >
              Ver Demonstração
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Funcionalidades Principais</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tudo que você precisa para gerenciar sua equipe de vendas de forma eficiente e motivadora
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Benefícios</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Resultados reais para o seu negócio
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-background rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="font-medium">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Problemas que Resolvemos</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Entendemos suas dores e criamos soluções específicas
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {painPoints.map((item, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive mb-2">{item.problem}</h3>
                    <div className="flex items-start gap-2 mt-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">{item.solution}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                <Trophy className="h-10 w-10 mx-auto mb-2" />
                100%
              </div>
              <p className="text-muted-foreground">Gamificado</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                <BarChart3 className="h-10 w-10 mx-auto mb-2" />
                24/7
              </div>
              <p className="text-muted-foreground">Disponível</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                <Zap className="h-10 w-10 mx-auto mb-2" />
                Real-time
              </div>
              <p className="text-muted-foreground">Atualização</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                <Shield className="h-10 w-10 mx-auto mb-2" />
                100%
              </div>
              <p className="text-muted-foreground">Seguro</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20">
          <CardContent className="pt-12 pb-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Pronto para transformar sua gestão?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Comece agora e veja sua equipe alcançar resultados extraordinários
            </p>
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigate('/auth')}
            >
              Começar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

