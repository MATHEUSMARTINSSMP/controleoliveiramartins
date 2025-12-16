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
  ArrowUpRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const painPoints = [
    {
      icon: <AlertTriangle className="h-8 w-8 text-red-500" />,
      problem: "Colaboradoras pedem adiantamento toda hora e voce nao sabe quanto cada uma ja deve?",
      consequence: "Fim do mes chega e o salario nao cobre as dividas. Conflitos, demissoes e prejuizo.",
      solution: "Sistema de adiantamentos com limite automatico, parcelas controladas e notificacao por WhatsApp. Cada colaboradora ve quanto pode pedir e quanto ja deve."
    },
    {
      icon: <TrendingDown className="h-8 w-8 text-red-500" />,
      problem: "Nao sabe se a loja ta dando lucro ou prejuizo esse mes?",
      consequence: "Voce trabalha muito, mas no fim do mes nao sobra dinheiro. Gastos se acumulam sem controle.",
      solution: "DRE automatico com integracao N8N. Veja receitas, despesas e lucro real em tempo real. Sem precisar de contador ou planilhas."
    },
    {
      icon: <Eye className="h-8 w-8 text-red-500" />,
      problem: "Colaboradoras vendem e voce so descobre dias depois?",
      consequence: "Perda de controle, vendas nao registradas, metas nao acompanhadas. Equipe desmotivada.",
      solution: "Notificacao WhatsApp instantanea a cada venda. Voce recebe no celular: quem vendeu, quanto, forma de pagamento. Em tempo real."
    },
    {
      icon: <Users className="h-8 w-8 text-red-500" />,
      problem: "Cliente comprou uma vez e nunca mais voltou?",
      consequence: "Custo de aquisicao alto, vendas esporadicas, faturamento instavel.",
      solution: "Cashback automatico com notificacao WhatsApp. Cliente recebe: 'Voce tem R$ 50 de credito, valido ate dia X'. Eles voltam sozinhos."
    },
    {
      icon: <Clock className="h-8 w-8 text-red-500" />,
      problem: "Colaboradora diz que chegou no horario, mas voce nao tem como provar?",
      consequence: "Processos trabalhistas, horas extras indevidas, falta de controle de jornada.",
      solution: "Ponto digital com assinatura por PIN, em conformidade com a CLT. Registro de entrada, saida e intervalos. Relatorios PDF para fiscalizacao."
    },
    {
      icon: <Target className="h-8 w-8 text-red-500" />,
      problem: "Equipe nao sabe qual e a meta do dia e trabalha no piloto automatico?",
      consequence: "Vendas abaixo do potencial, falta de foco, resultados medios.",
      solution: "Meta diaria com pesos por dia da semana. Sabado vale mais que segunda. Colaboradora abre o app e ve: 'Hoje sua meta e R$ 2.500'. Claro e direto."
    }
  ];

  const transformations = [
    {
      before: "Planilhas confusas e dados desatualizados",
      after: "Dashboard em tempo real com graficos claros",
      icon: <BarChart3 className="h-6 w-6" />
    },
    {
      before: "Equipe desmotivada sem reconhecimento",
      after: "Gincanas semanais com premios e ranking",
      icon: <Trophy className="h-6 w-6" />
    },
    {
      before: "Clientes que compram uma vez e somem",
      after: "Cashback que traz o cliente de volta sozinho",
      icon: <Repeat className="h-6 w-6" />
    },
    {
      before: "Horas perdidas com relatorios manuais",
      after: "Relatorios automaticos em PDF e Excel",
      icon: <FileText className="h-6 w-6" />
    },
    {
      before: "Metas fixas que nao fazem sentido",
      after: "Metas dinamicas com pesos por dia",
      icon: <Calendar className="h-6 w-6" />
    },
    {
      before: "Comunicacao por grupos confusos",
      after: "Notificacoes WhatsApp automaticas e organizadas",
      icon: <MessageSquare className="h-6 w-6" />
    }
  ];

  const modules = [
    {
      title: "Vendas em Tempo Real",
      description: "A cada venda registrada, voce recebe notificacao no WhatsApp. Acompanhe de onde estiver. Veja quem vendeu, quanto, forma de pagamento e se bateu a meta do dia.",
      icon: <TrendingUp className="h-8 w-8" />,
      highlight: "Notificacao instantanea"
    },
    {
      title: "Metas Inteligentes",
      description: "Esqueca metas fixas. Configure pesos diferentes para cada dia (sabado vale 15%, segunda vale 8%). O sistema redistribui automaticamente quando alguem esta de folga.",
      icon: <Target className="h-8 w-8" />,
      highlight: "Redistribuicao automatica"
    },
    {
      title: "Gincanas que Motivam",
      description: "Crie competicoes semanais com premios. Ranking em tempo real, meta e super meta. Quem bater primeiro ganha o premio. Equipe engajada sem voce precisar cobrar.",
      icon: <Trophy className="h-8 w-8" />,
      highlight: "Premios configuraveis"
    },
    {
      title: "Cashback Automatico",
      description: "Cliente compra R$ 500, ganha R$ 25 de cashback. Recebe WhatsApp: 'Voce tem credito de R$ 25, valido ate dia 15'. Ele volta. Voce nao precisa fazer nada.",
      icon: <Gift className="h-8 w-8" />,
      highlight: "WhatsApp automatico"
    },
    {
      title: "Controle de Adiantamentos",
      description: "Colaboradora pede adiantamento pelo app. Sistema verifica limite, aprova ou recusa. Parcelas descontadas automaticamente. Sem surpresas no fim do mes.",
      icon: <Wallet className="h-8 w-8" />,
      highlight: "Limite automatico"
    },
    {
      title: "Ponto Digital (CLT)",
      description: "Em conformidade com a Portaria 671. Assinatura digital por PIN. Entrada, saida, intervalos. Solicitacao de alteracao pelo app. Relatorio PDF para fiscalizacao.",
      icon: <ClipboardCheck className="h-8 w-8" />,
      highlight: "Conformidade legal"
    },
    {
      title: "CRM Completo",
      description: "Saiba quando e o aniversario da cliente, o que ela comprou, quanto tempo faz. Crie tarefas: 'Ligar para Maria dia 15'. Nunca mais esqueca de um follow-up.",
      icon: <Heart className="h-8 w-8" />,
      highlight: "Relacionamento"
    },
    {
      title: "DRE Automatico",
      description: "Conecte seu financeiro e veja receitas, despesas e lucro real. Sem precisar entender de contabilidade. O sistema monta o relatorio para voce.",
      icon: <PiggyBank className="h-8 w-8" />,
      highlight: "Lucro real"
    },
    {
      title: "Integracao Tiny ERP",
      description: "Vendeu no Tiny? Aparece aqui em segundos. Sincronizacao automatica de pedidos e clientes. Mapeie vendedores do ERP com colaboradoras do sistema.",
      icon: <RefreshCw className="h-8 w-8" />,
      highlight: "Sync automatico"
    },
    {
      title: "Alertas de Tarefas",
      description: "Configure lembretes recorrentes: 'Todo dia as 9h enviar WhatsApp para a equipe'. O sistema envia automaticamente. Voce nunca esquece.",
      icon: <Bell className="h-8 w-8" />,
      highlight: "Lembretes automaticos"
    },
    {
      title: "Check de Meta Diaria",
      description: "Colaboradora abre o app e confirma que viu a meta do dia. Quem confirmar ate as 10h ganha bonus no fim do mes. Gamificacao que funciona.",
      icon: <CheckCircle2 className="h-8 w-8" />,
      highlight: "Bonus por consistencia"
    },
    {
      title: "Multi-Loja",
      description: "Gerencie 1 loja ou 10. Cada uma com suas metas, colaboradoras, WhatsApp proprio. Dados isolados, seguranca garantida. Escale sem limite.",
      icon: <Building2 className="h-8 w-8" />,
      highlight: "Escale sem limite"
    }
  ];

  const stats = [
    { value: "35%", label: "Aumento medio em vendas", sublabel: "nos primeiros 3 meses" },
    { value: "10h", label: "Economizadas por semana", sublabel: "em relatorios manuais" },
    { value: "67%", label: "Clientes voltam", sublabel: "com cashback ativo" },
    { value: "100%", label: "Conformidade CLT", sublabel: "no controle de ponto" }
  ];

  const plans = [
    {
      name: "Starter",
      price: "249",
      period: "/mes",
      description: "Para quem esta comecando a organizar",
      features: [
        "1 Loja",
        "5 Colaboradoras",
        "Dashboard completo",
        "Metas e vendas",
        "Controle de ponto",
        "Relatorios basicos",
        "Suporte por email"
      ],
      notIncluded: [
        "WhatsApp integrado",
        "Cashback automatico",
        "DRE financeiro"
      ],
      popular: false,
      cta: "Comecar Agora"
    },
    {
      name: "Business",
      price: "499",
      period: "/mes",
      description: "Para quem quer crescer de verdade",
      features: [
        "3 Lojas",
        "25 Colaboradoras",
        "Tudo do Starter +",
        "WhatsApp integrado",
        "Cashback automatico",
        "Integracao Tiny ERP",
        "Gincanas semanais",
        "CRM completo",
        "Suporte WhatsApp"
      ],
      notIncluded: [
        "DRE financeiro"
      ],
      popular: true,
      cta: "Quero Esse"
    },
    {
      name: "Enterprise",
      price: "799",
      period: "/mes",
      description: "Para redes que dominam o mercado",
      features: [
        "7 Lojas (+3 bonus)",
        "80 Colaboradoras (+10 bonus)",
        "Tudo do Business +",
        "DRE automatico",
        "Suporte prioritario 24/7",
        "Treinamento da equipe",
        "Onboarding dedicado",
        "Consultoria mensal"
      ],
      notIncluded: [],
      popular: false,
      cta: "Falar com Especialista"
    }
  ];

  const faqs = [
    {
      question: "Preciso ter conhecimento tecnico para usar?",
      answer: "Nao. O sistema foi feito para donos de loja, nao para programadores. Interface simples, intuitiva. Se voce usa WhatsApp, voce usa o EleveaOne."
    },
    {
      question: "Consigo integrar com meu ERP atual?",
      answer: "Sim! Temos integracao nativa com Tiny ERP. Bling em breve. Outras integracoes podem ser feitas via API ou conversando com nosso suporte."
    },
    {
      question: "O sistema funciona no celular?",
      answer: "100%. Interface responsiva, funciona em qualquer dispositivo. Colaboradoras registram vendas pelo celular, voce acompanha de onde estiver."
    },
    {
      question: "Como funciona o cashback automatico?",
      answer: "Voce define a porcentagem (ex: 5%). A cada venda, o cliente ganha credito. Recebe WhatsApp avisando. Quando voltar, o sistema aplica o desconto automaticamente."
    },
    {
      question: "O controle de ponto esta dentro da lei?",
      answer: "Sim. Em conformidade com a Portaria 671/2021 e CLT. Assinatura digital por PIN, registros inalteraveis, relatorios para fiscalizacao."
    },
    {
      question: "Posso testar antes de assinar?",
      answer: "Sim. Oferecemos 14 dias gratis para voce testar todas as funcionalidades. Sem compromisso, sem cartao de credito."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">EleveaOne</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#problemas" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Problemas</a>
            <a href="#solucoes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Solucoes</a>
            <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <Button onClick={() => navigate('/auth')} size="sm">
            Entrar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Sistema usado por +150 lojas no Brasil</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Sua loja vende mais quando voce{" "}
              <span className="text-primary">para de apagar incendio</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Adiantamentos descontrolados, colaboradoras sem meta, clientes que nunca voltam. 
              <strong className="text-foreground"> O EleveaOne resolve tudo isso no piloto automatico.</strong>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate('/auth')}>
                Testar 14 Dias Gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => document.getElementById('problemas')?.scrollIntoView({ behavior: 'smooth' })}>
                Ver Como Funciona
                <ChevronDown className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <span>Dados criptografados</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                <span>Setup em 15 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Sem fidelidade</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="problemas" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">O problema</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Se voce se identifica com algum desses problemas...
            </h2>
            <p className="text-xl text-muted-foreground">
              Nao e falta de esforco. E falta de sistema.
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

      {/* Transformation Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">A transformacao</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Do caos ao controle total
            </h2>
            <p className="text-xl text-muted-foreground">
              Veja o antes e depois de quem usa o EleveaOne
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

      {/* Stats Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">{stat.value}</div>
                <div className="font-medium">{stat.label}</div>
                <div className="text-sm text-primary-foreground/70">{stat.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="solucoes" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">As solucoes</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              12 modulos que trabalham por voce
            </h2>
            <p className="text-xl text-muted-foreground">
              Cada funcionalidade foi pensada para resolver um problema real do varejo
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-primary/20">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {module.icon}
                    </div>
                    <Badge variant="secondary" className="text-xs">{module.highlight}</Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{module.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Quem usa, recomenda</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Donos de loja como voce ja resolveram esses problemas
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Antes eu passava o mes inteiro cobrando meta. Agora o sistema faz isso por mim. As meninas veem a meta todo dia no celular e se cobram sozinhas.",
                author: "Patricia S.",
                role: "Dona de 2 lojas de roupas",
                highlight: "Equipe autogerenciavel"
              },
              {
                quote: "O cashback mudou meu negocio. Clientes que nao voltavam ha meses agora aparecem perguntando do credito deles. E automatico, eu nao faco nada.",
                author: "Fernanda M.",
                role: "Loja de acessorios",
                highlight: "67% de retorno"
              },
              {
                quote: "Adiantamento era minha maior dor de cabeca. Agora cada colaboradora tem limite, o sistema controla as parcelas. Zero surpresa no fim do mes.",
                author: "Roberto C.",
                role: "Rede com 4 lojas",
                highlight: "Financeiro no controle"
              }
            ].map((testimonial, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">"{testimonial.quote}"</p>
                  <div className="pt-4 border-t border-border">
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    <Badge variant="secondary" className="mt-2 text-xs">{testimonial.highlight}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Investimento</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Escolha o plano ideal para sua operacao
            </h2>
            <p className="text-xl text-muted-foreground">
              Todos os planos incluem 14 dias gratis. Cancele quando quiser.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative overflow-hidden ${plan.popular ? 'border-2 border-primary shadow-lg scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    MAIS POPULAR
                  </div>
                )}
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <div className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {plan.notIncluded.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                        <span className="line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate('/auth')}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 inline mr-2" />
            Pagamento seguro. Dados criptografados. Cancele quando quiser.
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Duvidas frequentes</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Perguntas que todo dono de loja faz
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card 
                key={index} 
                className="cursor-pointer overflow-hidden"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{faq.question}</h3>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </div>
                  {openFaq === index && (
                    <p className="mt-4 text-muted-foreground">{faq.answer}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para parar de apagar incendio?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/80">
            Comece hoje. Em 15 minutos seu sistema esta no ar. 
            14 dias gratis para testar tudo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/auth')}
            >
              Comecar Agora - E Gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-6 text-sm text-primary-foreground/60">
            Sem cartao de credito. Sem compromisso. Sem pegadinha.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">EleveaOne</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="mailto:suporte@eleveaone.com.br" className="hover:text-foreground transition-colors">Suporte</a>
            </div>
            <div className="text-sm text-muted-foreground">
              2024 EleveaOne. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
