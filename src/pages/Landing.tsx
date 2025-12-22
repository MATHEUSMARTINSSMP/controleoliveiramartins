import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calendar,
  FileText,
  Lock,
  Wallet,
  Bell,
  Heart,
  Eye,
  Send,
  Building2,
  Award,
  Flame,
  Play,
  Headphones,
  Percent,
  LayoutDashboard,
  Store,
  Fingerprint,
  LineChart,
  Package,
  Banknote,
  Brain,
  Cpu,
  CircleDollarSign,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Database,
  Server,
  Repeat,
  UserCheck,
  ClipboardList,
  Timer,
  Settings,
  TrendingDown,
  PieChart,
  Layers,
  Puzzle,
  Rocket,
  ChartBar
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [animatedStats, setAnimatedStats] = useState({ economia: 0, lojas: 0, vendas: 0, satisfacao: 0 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        economia: Math.round(70 * progress),
        lojas: Math.round(150 * progress),
        vendas: Math.round(35 * progress),
        satisfacao: Math.round(98 * progress)
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  const tableOfContents = [
    { num: "01", title: "Visao Geral", desc: "Entenda como o EleveaOne complementa seu ERP" },
    { num: "02", title: "Por que EleveaOne?", desc: "Metas dinamicas, CRM automatizado e gamificacao" },
    { num: "03", title: "Controle Total", desc: "Notificacoes em tempo real de tudo que acontece" },
    { num: "04", title: "Dashboard Admin", desc: "Gerencie multiplas lojas com facilidade" },
    { num: "05", title: "Dashboard da Loja", desc: "Ferramentas diarias para vendedoras e gerentes" },
    { num: "06", title: "WhatsApp Profissional", desc: "Transforme conversas em vendas" },
    { num: "07", title: "Onboarding Rapido", desc: "Comece em minutos, nao em meses" },
    { num: "08", title: "Inovacao Continua", desc: "Roadmap com IA e analise preditiva" },
    { num: "09", title: "Planos e Precos", desc: "Opcoes para cada tamanho de operacao" },
    { num: "10", title: "Contato", desc: "Como comecar sua transformacao digital" }
  ];

  const erpComparison = [
    { label: "Seu ERP Atual", items: ["Nota Fiscal e XML", "Estoque Fiscal", "Financeiro Basico", "Contas a Pagar/Receber"], isErp: true },
    { label: "EleveaOne (Front-Office)", items: ["Metas Dinamicas e Gamificacao", "CRM com Automacao de Vendas", "Cashback e Fidelizacao", "Ponto Digital (REP-P)", "Campanhas WhatsApp", "DRE Gerencial com IA"], isErp: false }
  ];

  const whyChoose = [
    {
      icon: <Target className="h-8 w-8" />,
      title: "Metas que Realmente Funcionam",
      description: "Esqueca as metas estaticas de planilha que ninguem acompanha. O EleveaOne usa metas dinamicas que se ajustam automaticamente a realidade da sua loja.",
      features: [
        "Ajuste Automatico de Deficit: Se a loja vendeu menos ontem, o sistema dilui a diferenca automaticamente nos dias restantes do mes.",
        "Pesos Inteligentes: Configure pesos por dia da semana (ex: Sabado vale 2x mais que Segunda-feira) para refletir o fluxo real de clientes.",
        "Gamificacao Real: Rankings em tempo real, trofeus digitais e bonus automaticos mantem a equipe engajada 100% do tempo."
      ]
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: "CRM que Vende Sozinho",
      description: "Pare de perder vendas por falta de follow-up. Nosso CRM automatizado trabalha 24/7 para converter mais clientes.",
      features: [
        "Pos-Venda Automatico: O sistema agenda automaticamente o contato de pos-venda e notifica a vendedora no momento certo.",
        "Cashback via WhatsApp: O cliente recebe o saldo de cashback no WhatsApp na hora da compra, aumentando drasticamente a recorrencia.",
        "Wishlist Integrada: Sabe aquele cliente que diz: 'Me avisa quando chegar'? Voce nunca mais vai esquecer de avisar ele!"
      ]
    },
    {
      icon: <Wallet className="h-8 w-8" />,
      title: "Gestao Financeira de Pessoal",
      description: "Tenha controle total sobre a folha de pagamento e movimentacoes financeiras da equipe, com transparencia e travas de seguranca.",
      features: [
        "Adiantamentos Controlados: Sistema de solicitacao com aprovacao automatica baseada em margem consignavel e historico.",
        "Compras de Funcionarios: Controle total de compras das colaboradoras na propria loja, com limites configuraveis.",
        "Transparencia Total: Cada movimentacao gera notificacao em tempo real para o gestor."
      ]
    }
  ];

  const notifications = [
    { icon: <DollarSign className="h-5 w-5" />, title: "Nova Venda Realizada", desc: "Receba um alerta instantaneo a cada venda sincronizada do ERP ou emitida manualmente." },
    { icon: <Clock className="h-5 w-5" />, title: "Ponto Batido", desc: "Seja notificado sempre que uma colaboradora registrar entrada, saida ou intervalo." },
    { icon: <Banknote className="h-5 w-5" />, title: "Adiantamento Solicitado", desc: "Receba alertas imediatos quando uma colaboradora solicitar adiantamento." },
    { icon: <FileText className="h-5 w-5" />, title: "Ajuste Criado", desc: "Saiba instantaneamente quando um ajuste ou condicional for gerado para um cliente." },
    { icon: <Bell className="h-5 w-5" />, title: "Alertas de Tarefas", desc: "O sistema notifica sobre tarefas recorrentes (conferencia de estoque, limpeza, abertura de caixa)." }
  ];

  const notificationBenefits = [
    { icon: <Eye className="h-6 w-6" />, title: "Presenca Virtual", desc: "Sinta-se dentro da loja mesmo estando em viagem ou gerenciando outras unidades." },
    { icon: <UserCheck className="h-6 w-6" />, title: "Accountability Natural", desc: "A equipe sabe que o sistema reporta as acoes em tempo real, aumentando responsabilidade." },
    { icon: <Zap className="h-6 w-6" />, title: "Decisoes Ageis", desc: "Voce fica por dentro de tudo que esta acontecendo quase em tempo real na sua operacao." },
    { icon: <Shield className="h-6 w-6" />, title: "Transparencia Total", desc: "Acabe com as 'surpresas' no final do mes. Tudo e registrado e notificado." }
  ];

  const adminDashboardFeatures = [
    {
      num: 1,
      icon: <Target className="h-6 w-6" />,
      title: "Gestao de Metas e Performance",
      items: ["Defina metas mensais e super metas com premiacoes escalonadas", "Configure pesos diarios para distribuir a meta conforme o fluxo da loja", "Redistribuicao automatica quando colaboradora falta", "Compare lojas: melhor Ticket Medio, melhor PA"]
    },
    {
      num: 2,
      icon: <Trophy className="h-6 w-6" />,
      title: "Bonus e Gincanas",
      items: ["Crie gincanas semanais ('Semana do Jeans') para impulsionar produtos especificos", "Configure bonus por meta batida, super meta ou indicadores", "Ranking permanente que gera cultura de alta performance"]
    },
    {
      num: 3,
      icon: <Fingerprint className="h-6 w-6" />,
      title: "Gestao de Pessoas e Ponto",
      items: ["Ponto digital com reconhecimento de local (REP-P - Portaria 671)", "Geracao automatica de espelho de ponto para contabilidade", "Controle visual de escalas e folgas", "Jornada personalizada e flexivel"]
    },
    {
      num: 4,
      icon: <PieChart className="h-6 w-6" />,
      title: "Financeiro e DRE",
      items: ["DRE Gerencial com IA: visualize o resultado real da operacao", "Aprovacao de adiantamentos com validacao de margem consignavel", "Controle de compras de funcionarios com limites mensais"]
    },
    {
      num: 5,
      icon: <RefreshCw className="h-6 w-6" />,
      title: "Integracao ERP Profunda",
      items: ["Sincronizacao em tempo real: pedidos caem segundos apos a venda", "Mapeamento automatico de vendedores entre sistemas", "Suporte multi-ERP: Tiny, Bling, Linx e outros via API"]
    }
  ];

  const storeDashboardFeatures = [
    {
      icon: <Target className="h-6 w-6" />,
      title: "Aba: Metas (O Coracao da Loja)",
      items: ["'Quanto preciso vender hoje?' - A primeira pergunta respondida na tela inicial", "Termometro visual: 'Onde deveriamos estar' vs 'Onde estamos'", "Top 3 do Dia: ranking instantaneo para gerar competicao saudavel"]
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "Cashback e Fidelidade",
      desc: "Consulta rapida por CPF, resgate seguro com PIN, avisos automaticos de expiracao para criar urgencia (FOMO)."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "CRM e Clientes",
      desc: "Perfil 360 graus com historico de compras, marcas preferidas, aniversario. Segmentacao automatica (VIP, Black, Gold). Lista de tarefas de hoje: quem contatar."
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: "Wishlist (Lista de Desejos)",
      desc: "Cliente gostou mas nao tem o tamanho? Cadastre na Wishlist. Alerta automatico quando o item entrar no estoque - nunca perca uma venda."
    },
    {
      icon: <Banknote className="h-6 w-6" />,
      title: "Caixa",
      desc: "Mais controle para voce na abertura e fechamento do caixa: Quem e a vendedora responsavel, quanto dinheiro em caixa, quais as metas do dia da loja e individuais."
    }
  ];

  const whatsappTransactional = [
    { emoji: "gift", text: "'Cashback gerado!' - Envia para o cliente pelo whatsapp quanto cashback foi gerado, qual o prazo para expirar" },
    { emoji: "clock", text: "'Seu cashback vai vencer!' - Recupera clientes inativos com senso de urgencia" },
    { emoji: "cake", text: "'Feliz Aniversario!' - Mensagem personalizada com cupom de presente" },
    { emoji: "trophy", text: "'Meta Batida!' - Avisa a equipe (e o dono) quando a loja alcanca o objetivo" }
  ];

  const whatsappCampaigns = [
    { icon: <Target className="h-6 w-6" />, title: "Segmentacao Cirurgica", desc: "'Enviar para clientes que compraram Jeans nos ultimos 90 dias mas nao compraram nada este mes'" },
    { icon: <Shield className="h-6 w-6" />, title: "Envio Seguro", desc: "Controle de velocidade e rotacao de numeros para evitar bloqueios do WhatsApp" },
    { icon: <BarChart3 className="h-6 w-6" />, title: "Metricas Reais", desc: "Saiba exatamente quanto vendeu a partir de cada campanha enviada" }
  ];

  const onboardingSteps = [
    { num: 1, title: "Conecte seu ERP", desc: "Faca login com suas credenciais do Tiny, Bling ou outro ERP compativel. Processo 100% seguro." },
    { num: 2, title: "Importacao Automatica", desc: "Puxamos automaticamente seu historico de vendas, cadastro de clientes e catalogo de produtos." },
    { num: 3, title: "Configuracao Express", desc: "Defina as metas iniciais, cadastre sua equipe e configure as regras de bonus. Pronto para usar!" }
  ];

  const securityFeatures = [
    { icon: <Lock className="h-6 w-6" />, title: "Criptografia Ponta-a-Ponta", desc: "Seus dados trafegam com o mesmo nivel de seguranca usado por bancos." },
    { icon: <Database className="h-6 w-6" />, title: "Backups Automaticos", desc: "Backups diarios com redundancia geografica. Protecao total contra perda de dados." },
    { icon: <Globe className="h-6 w-6" />, title: "Infraestrutura Global", desc: "Hospedado em nuvem (AWS/Netlify) com 99.9% de uptime garantido." },
    { icon: <Shield className="h-6 w-6" />, title: "LGPD Ready", desc: "Ferramentas completas para anonimizacao e exportacao de dados de clientes." }
  ];

  const roadmapItems = [
    { quarter: "Q1 2026", title: "AI Sales Assistant", desc: "Um 'copiloto' inteligente que sugere para a vendedora: 'A cliente Maria esta vindo? ela usa esses tamanhos e costuma levar essas cores.'" },
    { quarter: "Q1 2026", title: "Previsao de Metas", desc: "Inteligencia Artificial analisando historico de vendas, sazonalidade e tendencias para sugerir metas mais precisas e estoque otimizado." },
    { quarter: "Q1 2026", title: "Analise de Sentimento", desc: "Integracao com WhatsApp para analisar automaticamente se o cliente esta satisfeito ou frustrado nas conversas, permitindo acao proativa." },
    { quarter: "Q2 2026", title: "Recomendacoes Personalizadas", desc: "Sistema de recomendacao baseado em Machine Learning que sugere produtos com alta probabilidade de conversao para cada cliente." }
  ];

  const stackComparison = [
    { name: "Fidelidade/Cashback", min: 200, max: 600 },
    { name: "WhatsApp Profissional", min: 150, max: 500 },
    { name: "Controle de Ponto REP-P", min: 100, max: 400 },
    { name: "CRM", min: 150, max: 600 },
    { name: "BI/Dashboards", min: 100, max: 400 },
    { name: "Financeiro/DRE", min: 64, max: 159 }
  ];

  const plans = [
    {
      name: "Starter",
      price: "R$ 249",
      period: "/mes",
      description: "Para operacoes que buscam organizacao e controle inicial",
      popular: false,
      features: [
        "1 Loja",
        "Ate 5 colaboradoras",
        "Dashboard completo de vendas",
        "Sistema de metas diarias",
        "Controle de ponto digital (CLT)",
        "Programa de cashback automatizado",
        "DRE com IA integrado",
        "Relatorios basicos em PDF",
        "Suporte por e-mail (horario comercial)"
      ],
      notIncluded: ["WhatsApp proprio", "Integracao ERP"]
    },
    {
      name: "Business",
      price: "R$ 499",
      period: "/mes",
      description: "Para negocios em crescimento que exigem automacao completa",
      popular: true,
      features: [
        "Ate 3 Lojas",
        "Ate 25 colaboradoras",
        "Todas as funcionalidades Starter",
        "WhatsApp proprio para envio de mensagens",
        "Programa de cashback automatizado",
        "DRE com IA integrado",
        "Integracao com ERP (Tiny, Bling e outros)",
        "Gincanas e competicoes gamificadas",
        "CRM completo com historico de clientes",
        "Suporte prioritario via WhatsApp"
      ],
      notIncluded: []
    },
    {
      name: "Enterprise",
      price: "R$ 799",
      period: "/mes",
      description: "Para redes que dominam o mercado e exigem excelencia operacional",
      popular: false,
      features: [
        "Ate 10 Lojas (7 + 3 bonus)",
        "Ate 90 colaboradoras (80 + 10 bonus)",
        "Todas as funcionalidades Business",
        "Programa de cashback automatizado",
        "DRE com IA integrado",
        "Integracao com ERP (Tiny, Bling e outros)",
        "Suporte prioritario 24/7",
        "Treinamento completo da equipe",
        "Onboarding dedicado com especialista",
        "Consultoria mensal de performance",
        "API para integracoes personalizadas"
      ],
      notIncluded: []
    }
  ];

  const faqs = [
    { q: "Quanto tempo leva para implantar o EleveaOne?", a: "O EleveaOne e Plug & Play. Voce pode estar operacional no mesmo dia. Basta conectar seu ERP, importar os dados automaticamente e configurar suas metas iniciais." },
    { q: "O EleveaOne substitui meu ERP?", a: "Nao! O EleveaOne complementa seu ERP. Enquanto seu ERP cuida do backoffice (notas fiscais, estoque fiscal, financeiro basico), o EleveaOne cuida do front-office (metas, CRM, cashback, gamificacao)." },
    { q: "Quais ERPs sao compativeis?", a: "Atualmente temos integracao nativa com Tiny e Bling. Outros ERPs como Linx podem ser integrados via API. Entre em contato para verificar a compatibilidade com seu sistema." },
    { q: "Como funciona o sistema de metas dinamicas?", a: "O sistema ajusta automaticamente as metas diarias baseado no desempenho real. Se a loja vendeu menos ontem, o deficit e diluido nos dias restantes do mes. Voce pode configurar pesos por dia da semana para refletir o fluxo real de clientes." },
    { q: "O sistema esta em conformidade com a legislacao trabalhista?", a: "Sim! Nosso ponto digital segue a Portaria 671 (REP-P) e esta em total conformidade com a CLT brasileira. Geramos automaticamente o espelho de ponto para sua contabilidade." }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'var(--gradient-orb-1)',
            filter: 'blur(100px)',
            top: '10%',
            left: '-10%',
            transform: `translate(${scrollY * 0.02}px, ${scrollY * 0.01}px)`
          }}
        />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: 'var(--gradient-orb-2)',
            filter: 'blur(80px)',
            top: '40%',
            right: '-5%',
            transform: `translate(${-scrollY * 0.015}px, ${scrollY * 0.02}px)`
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'var(--gradient-orb-3)',
            filter: 'blur(60px)',
            bottom: '10%',
            left: '30%',
            transform: `translate(${scrollY * 0.01}px, ${-scrollY * 0.015}px)`
          }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-md bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">EleveaOne</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-primary transition-colors" data-testid="link-features">Recursos</a>
            <a href="#pricing" className="hover:text-primary transition-colors" data-testid="link-pricing">Precos</a>
            <a href="#contact" className="hover:text-primary transition-colors" data-testid="link-contact">Contato</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')} data-testid="button-login">
              Entrar
            </Button>
            <Button onClick={() => navigate('/login')} data-testid="button-start-free">
              Comecar Gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-5xl">
          <Badge className="mb-6 px-4 py-2" variant="secondary">
            <Sparkles className="h-4 w-4 mr-2" />
            O Parceiro Perfeito para seu ERP
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Solucao completa para o{' '}
            <span className="text-primary">varejo</span> que eleva a performance
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Unindo fidelizacao de clientes, engajamento de times e automacao inteligente de tarefas operacionais e de gestao.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8" data-testid="button-hero-cta">
              Comecar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-hero-demo">
              <Play className="mr-2 h-5 w-5" />
              Ver Demonstracao
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="glass rounded-lg p-4 text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">{animatedStats.economia}%</div>
              <div className="text-sm text-muted-foreground">Economia vs Stack Separado</div>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">{animatedStats.lojas}+</div>
              <div className="text-sm text-muted-foreground">Lojas Ativas</div>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">+{animatedStats.vendas}%</div>
              <div className="text-sm text-muted-foreground">Aumento em Vendas</div>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary">{animatedStats.satisfacao}%</div>
              <div className="text-sm text-muted-foreground">Satisfacao</div>
            </div>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">O que voce encontrara nesta apresentacao</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Uma jornada completa pelo EleveaOne, da visao geral ate os planos de preco
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {tableOfContents.map((item, index) => (
              <Card key={index} className="hover-elevate cursor-pointer transition-all">
                <CardContent className="p-4">
                  <div className="text-3xl font-bold text-primary/30 mb-2">{item.num}</div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Missing Link Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Visao Geral</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">O "Missing Link" do Varejo Brasileiro</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              O EleveaOne nao e apenas mais um sistema de gestao. E a camada de inteligencia que faltava sobre o seu ERP. 
              Enquanto seu ERP (Tiny, Bling, Linx) cuida do "backoffice" - nota fiscal, estoque fiscal, financeiro basico - 
              o EleveaOne cuida do que realmente importa: <strong>Front-Office</strong>.
            </p>
          </div>

          {/* ERP vs EleveaOne Comparison */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {erpComparison.map((col, index) => (
              <Card key={index} className={col.isErp ? "border-muted" : "border-primary/30 bg-primary/5"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {col.isErp ? <Database className="h-6 w-6 text-muted-foreground" /> : <Rocket className="h-6 w-6 text-primary" />}
                    {col.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {col.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className={`h-5 w-5 ${col.isErp ? 'text-muted-foreground' : 'text-primary'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="glass rounded-xl p-6 md:p-8 text-center">
            <p className="text-lg">
              A maioria das lojas tem um ERP para notas fiscais e talvez uma planilha Excel para metas. 
              O EleveaOne preenche essa lacuna critica, <strong className="text-primary">unificando vendas, pessoas e clientes</strong> em uma unica plataforma inteligente.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Por que EleveaOne?</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Por que Escolher o EleveaOne?</h2>
          </div>

          <div className="space-y-12">
            {whyChoose.map((item, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="space-y-3 pl-0 md:pl-18">
                    {item.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm md:text-base">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 glass rounded-xl p-6 text-center">
            <p className="text-lg">
              Mais controle para voce, mais transparencia com suas colaboradoras. Com nosso sistema elas ficarao cientes de tudo que ja foi descontado e esta previsto para descontar nos proximos meses.
            </p>
          </div>
        </div>
      </section>

      {/* Real-time Control Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Controle Total</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Controle Absoluto em Tempo Real</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              O EleveaOne foi desenhado para que o dono ou gerente tenha controle absoluto sobre o que acontece na loja, 
              sem precisar estar presente fisicamente.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  Notificacoes Direto no Seu WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifications.map((notif, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      {notif.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold">{notif.title}</h4>
                      <p className="text-sm text-muted-foreground">{notif.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Benefits Grid */}
            <div className="grid grid-cols-2 gap-4">
              {notificationBenefits.map((benefit, index) => (
                <Card key={index} className="hover-elevate">
                  <CardContent className="p-5 text-center">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                      {benefit.icon}
                    </div>
                    <h4 className="font-semibold mb-2">{benefit.title}</h4>
                    <p className="text-xs text-muted-foreground">{benefit.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Admin Dashboard Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Dashboard Admin</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Dashboard Admin: Comando Centralizado</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              O centro de comando para redes de lojas. Gerencie 1 ou 100 lojas com a mesma facilidade. 
              Todas as ferramentas que voce precisa para maximizar resultados, em um unico lugar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminDashboardFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {feature.num}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Store Dashboard Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Dashboard da Loja</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Dashboard da Loja: Poder na Ponta</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              A ferramenta diaria da gerente e das vendedoras. Interface limpa, rapida e focada em uma coisa: <strong>vender mais</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeDashboardFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold mb-3">{feature.title}</h3>
                  {feature.items ? (
                    <ul className="space-y-2">
                      {feature.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">WhatsApp Profissional</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">WhatsApp: Sua Nova Maquina de Vendas</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              O EleveaOne transforma o WhatsApp em uma ferramenta de vendas profissional, automatizada e extremamente eficaz.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Transactional Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Notificacoes Transacionais (Automaticas)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {whatsappTransactional.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Campaigns */}
            <Card>
              <CardHeader>
                <CardTitle>Campanhas de Marketing (Bulk Sender)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {whatsappCampaigns.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Onboarding Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Onboarding Rapido</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Comece em Minutos, Nao em Meses</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Diferente de ERPs tradicionais que levam semanas para implantar, o EleveaOne e Plug & Play. 
              Voce pode estar operacional no mesmo dia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {onboardingSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Security */}
          <div className="glass rounded-xl p-8">
            <h3 className="text-2xl font-bold text-center mb-8">Seguranca de Nivel Bancario</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {securityFeatures.map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                    {feature.icon}
                  </div>
                  <h4 className="font-semibold mb-2">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Inovacao Continua</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">O Futuro do Varejo Esta Aqui</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Estamos construindo o futuro do varejo brasileiro. Veja o que esta no nosso roadmap de inovacao:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {roadmapItems.map((item, index) => (
              <Card key={index} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                      <Brain className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-2">{item.quarter}</Badge>
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Comparativo</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Compare: EleveaOne vs Stack Separado</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Montar uma infraestrutura equivalente ao EleveaOne usando ferramentas separadas custa entre R$ 764 e R$ 2.659 por mes 
              - isso para apenas 1 loja e poucos usuarios. E ainda ha o custo oculto de integrar tudo isso.
            </p>
          </div>

          {/* Cost bars */}
          <Card className="mb-12">
            <CardContent className="p-6">
              <div className="space-y-4">
                {stackComparison.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">R$ {item.min} - R$ {item.max}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-destructive/60 to-destructive rounded-full"
                        style={{ width: `${(item.max / 900) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center border-destructive/30">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-destructive mb-1">R$ 764</div>
                <div className="text-sm text-muted-foreground">Custo Minimo Mensal</div>
                <div className="text-xs text-muted-foreground mt-1">Stack separado (cenario conservador)</div>
              </CardContent>
            </Card>
            <Card className="text-center border-destructive/30">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-destructive mb-1">R$ 2.659</div>
                <div className="text-sm text-muted-foreground">Custo Maximo Mensal</div>
                <div className="text-xs text-muted-foreground mt-1">Stack separado (cenario realista)</div>
              </CardContent>
            </Card>
            <Card className="text-center border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary mb-1">R$ 499</div>
                <div className="text-sm text-muted-foreground">EleveaOne Business</div>
                <div className="text-xs text-muted-foreground mt-1">Tudo incluido, ate 3 lojas</div>
              </CardContent>
            </Card>
            <Card className="text-center border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary mb-1">70%</div>
                <div className="text-sm text-muted-foreground">Economia Potencial</div>
                <div className="text-xs text-muted-foreground mt-1">Comparado ao stack separado</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 glass rounded-xl p-6 text-center">
            <p className="text-lg">
              <strong>ROI Comprovado:</strong> O EleveaOne unifica todos esses componentes em um unico produto com auditoria integrada, 
              eliminando integracoes frageis e dispersao de dados. Economia de 50-70% vs stack separado + ganho operacional massivo por centralizacao.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">Planos e Precos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Planos para Cada Etapa do Seu Crescimento</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Escolha o plano adequado a sua operacao atual - voce pode escalar a qualquer momento conforme seu negocio cresce.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'border-primary border-2 shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>Nao incluso: {item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate('/login')}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                  >
                    Comecar Agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Perguntas Frequentes</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card 
                key={index} 
                className="cursor-pointer hover-elevate"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{faq.q}</h3>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </div>
                  {openFaq === index && (
                    <p className="mt-4 text-muted-foreground">{faq.a}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="mb-4" variant="secondary">Contato</Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Entre em Contato</h2>
          <p className="text-lg text-muted-foreground mb-12">
            Fale conosco e comece sua transformacao digital hoje mesmo.
          </p>

          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">E-mail</h3>
                <a href="mailto:suporte@eleveaone.com.br" className="text-primary hover:underline">
                  suporte@eleveaone.com.br
                </a>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Phone className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">WhatsApp</h3>
                <a href="https://wa.me/5596981032928" className="text-primary hover:underline">
                  (96) 98103-2928
                </a>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">Website</h3>
                <a href="https://eleveaone.com.br" className="text-primary hover:underline">
                  eleveaone.com.br
                </a>
              </CardContent>
            </Card>
          </div>

          <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8" data-testid="button-final-cta">
            Comecar Minha Transformacao Digital
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">EleveaOne</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              EleveaOne - Tecnologia que vende.
            </p>
            <p className="text-sm text-muted-foreground">
              2024 Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
