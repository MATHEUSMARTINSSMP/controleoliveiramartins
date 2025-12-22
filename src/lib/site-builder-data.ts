export type BusinessType = 'fisico' | 'digital';

export type ContentType = 'produtos' | 'servicos' | 'misto';

export type VoiceToneStyle = 'elegante' | 'profissional' | 'popular' | 'tecnico' | 'acolhedor' | 'dinamico';

export interface Area {
  id: string;
  name: string;
  keywords: string[];
}

export interface VoiceTone {
  style: VoiceToneStyle;
  description: string;
  examples: {
    hero: string;
    cta: string;
    about: string;
  };
}

export interface Segment {
  id: string;
  name: string;
  icon: string;
  contentType: ContentType;
  voiceTone: VoiceTone;
  areas: Area[];
}

export const BUSINESS_TYPES = [
  { id: 'fisico', name: 'Negócio Físico', description: 'Loja, escritório, consultório, restaurante...' },
  { id: 'digital', name: 'Negócio Digital', description: 'E-commerce, serviços online, consultoria remota...' }
] as const;

export const SEGMENTS: Segment[] = [
  {
    id: 'moda',
    name: 'Moda e Vestuário',
    icon: 'Shirt',
    contentType: 'produtos',
    voiceTone: {
      style: 'elegante',
      description: 'Sofisticado, tendências, estilo',
      examples: {
        hero: 'Vista-se com elegância e personalidade',
        cta: 'Descubra a nova coleção',
        about: 'Há mais de X anos vestindo você com estilo e qualidade'
      }
    },
    areas: [
      { id: 'moda-feminina', name: 'Moda Feminina', keywords: ['vestidos', 'blusas', 'saias'] },
      { id: 'moda-masculina', name: 'Moda Masculina', keywords: ['camisas', 'calças', 'ternos'] },
      { id: 'moda-infantil', name: 'Moda Infantil', keywords: ['roupas infantis', 'bebê'] },
      { id: 'moda-plus-size', name: 'Moda Plus Size', keywords: ['plus size', 'tamanhos grandes'] },
      { id: 'moda-praia', name: 'Moda Praia', keywords: ['biquínis', 'maiôs', 'sungas'] },
      { id: 'moda-fitness', name: 'Moda Fitness', keywords: ['leggings', 'tops', 'academia'] },
      { id: 'moda-intima', name: 'Moda Íntima', keywords: ['lingerie', 'pijamas', 'cuecas'] },
      { id: 'moda-noiva', name: 'Moda Noiva/Festa', keywords: ['vestidos de noiva', 'trajes'] }
    ]
  },
  {
    id: 'joias',
    name: 'Joias e Acessórios',
    icon: 'Gem',
    contentType: 'produtos',
    voiceTone: {
      style: 'elegante',
      description: 'Luxo, exclusividade, sofisticação',
      examples: {
        hero: 'Joias que contam a sua história',
        cta: 'Conheça nossa coleção exclusiva',
        about: 'Peças únicas criadas com maestria e paixão'
      }
    },
    areas: [
      { id: 'joias-ouro', name: 'Joias em Ouro', keywords: ['ouro 18k', 'alianças'] },
      { id: 'joias-prata', name: 'Joias em Prata', keywords: ['prata 925', 'semi-joias'] },
      { id: 'relojoaria', name: 'Relojoaria', keywords: ['relógios', 'smartwatch'] },
      { id: 'otica', name: 'Ótica', keywords: ['óculos', 'lentes', 'armações'] },
      { id: 'bijuterias', name: 'Bijuterias', keywords: ['bijuterias', 'acessórios'] }
    ]
  },
  {
    id: 'calcados',
    name: 'Calçados',
    icon: 'Footprints',
    contentType: 'produtos',
    voiceTone: {
      style: 'dinamico',
      description: 'Conforto, estilo, movimento',
      examples: {
        hero: 'Passos que marcam presença',
        cta: 'Encontre o seu par ideal',
        about: 'Conforto e estilo em cada passo'
      }
    },
    areas: [
      { id: 'calcados-femininos', name: 'Calçados Femininos', keywords: ['saltos', 'sapatilhas'] },
      { id: 'calcados-masculinos', name: 'Calçados Masculinos', keywords: ['sapatos sociais', 'mocassins'] },
      { id: 'tenis', name: 'Tênis', keywords: ['tênis esportivo', 'casual'] },
      { id: 'calcados-infantis', name: 'Calçados Infantis', keywords: ['sapatos infantis'] }
    ]
  },
  {
    id: 'esportes',
    name: 'Artigos Esportivos',
    icon: 'Dumbbell',
    contentType: 'produtos',
    voiceTone: {
      style: 'dinamico',
      description: 'Energia, performance, superação',
      examples: {
        hero: 'Supere seus limites',
        cta: 'Equipe-se para vencer',
        about: 'Tudo para o seu melhor desempenho'
      }
    },
    areas: [
      { id: 'academia', name: 'Academia e Musculação', keywords: ['halteres', 'equipamentos'] },
      { id: 'futebol', name: 'Futebol', keywords: ['chuteiras', 'uniformes', 'bolas'] },
      { id: 'corrida', name: 'Corrida', keywords: ['tênis de corrida', 'acessórios'] },
      { id: 'natacao', name: 'Natação', keywords: ['maiôs', 'óculos', 'toucas'] },
      { id: 'ciclismo', name: 'Ciclismo', keywords: ['bicicletas', 'capacetes'] },
      { id: 'lutas', name: 'Lutas e Artes Marciais', keywords: ['kimonos', 'luvas'] },
      { id: 'outdoor', name: 'Outdoor/Camping', keywords: ['barracas', 'mochilas'] }
    ]
  },
  {
    id: 'suplementos',
    name: 'Suplementos',
    icon: 'Pill',
    contentType: 'produtos',
    voiceTone: {
      style: 'tecnico',
      description: 'Saúde, resultados, ciência',
      examples: {
        hero: 'Potencialize seus resultados',
        cta: 'Monte seu kit de suplementação',
        about: 'Os melhores suplementos para sua performance'
      }
    },
    areas: [
      { id: 'whey', name: 'Proteínas e Whey', keywords: ['whey protein', 'caseína'] },
      { id: 'pre-treino', name: 'Pré-Treinos', keywords: ['pré-treino', 'energia'] },
      { id: 'vitaminas', name: 'Vitaminas e Minerais', keywords: ['multivitamínico'] },
      { id: 'emagrecedores', name: 'Emagrecedores', keywords: ['termogênico', 'queimadores'] },
      { id: 'naturais', name: 'Produtos Naturais', keywords: ['orgânicos', 'naturais'] }
    ]
  },
  {
    id: 'farmacia',
    name: 'Farmácia e Saúde',
    icon: 'Cross',
    contentType: 'misto',
    voiceTone: {
      style: 'acolhedor',
      description: 'Cuidado, confiança, bem-estar',
      examples: {
        hero: 'Cuidando da sua saúde com carinho',
        cta: 'Fale com nossos farmacêuticos',
        about: 'Há X anos cuidando de você e sua família'
      }
    },
    areas: [
      { id: 'farmacia-manipulacao', name: 'Farmácia de Manipulação', keywords: ['manipulados'] },
      { id: 'farmacia-popular', name: 'Farmácia Popular', keywords: ['medicamentos', 'genéricos'] },
      { id: 'homeopatia', name: 'Homeopatia', keywords: ['homeopáticos', 'florais'] },
      { id: 'produtos-hospitalares', name: 'Produtos Hospitalares', keywords: ['EPIs', 'descartáveis'] },
      { id: 'ortopedia', name: 'Ortopedia', keywords: ['muletas', 'cadeiras de rodas'] }
    ]
  },
  {
    id: 'beleza',
    name: 'Beleza e Cosméticos',
    icon: 'Sparkles',
    contentType: 'misto',
    voiceTone: {
      style: 'elegante',
      description: 'Beleza, autoestima, transformação',
      examples: {
        hero: 'Revele sua beleza natural',
        cta: 'Agende sua transformação',
        about: 'Especialistas em realçar sua beleza'
      }
    },
    areas: [
      { id: 'cosmeticos', name: 'Cosméticos', keywords: ['maquiagem', 'skincare'] },
      { id: 'cabelos', name: 'Produtos para Cabelos', keywords: ['shampoo', 'tratamentos'] },
      { id: 'perfumaria', name: 'Perfumaria', keywords: ['perfumes', 'fragrâncias'] },
      { id: 'salao', name: 'Salão de Beleza', keywords: ['corte', 'coloração', 'unhas'] },
      { id: 'barbearia', name: 'Barbearia', keywords: ['barba', 'cabelo masculino'] },
      { id: 'estetica', name: 'Estética', keywords: ['tratamentos faciais', 'corporal'] }
    ]
  },
  {
    id: 'alimentacao',
    name: 'Alimentação',
    icon: 'UtensilsCrossed',
    contentType: 'produtos',
    voiceTone: {
      style: 'acolhedor',
      description: 'Sabor, tradição, qualidade',
      examples: {
        hero: 'Sabores que conquistam',
        cta: 'Faça seu pedido agora',
        about: 'Preparado com amor e ingredientes selecionados'
      }
    },
    areas: [
      { id: 'restaurante', name: 'Restaurante', keywords: ['almoço', 'jantar', 'buffet'] },
      { id: 'lanchonete', name: 'Lanchonete', keywords: ['lanches', 'hambúrguer'] },
      { id: 'pizzaria', name: 'Pizzaria', keywords: ['pizza', 'delivery'] },
      { id: 'padaria', name: 'Padaria/Confeitaria', keywords: ['pães', 'bolos', 'doces'] },
      { id: 'acai', name: 'Açaí e Sorvetes', keywords: ['açaí', 'sorvete', 'milk-shake'] },
      { id: 'cafe', name: 'Cafeteria', keywords: ['café', 'brunch'] },
      { id: 'doceria', name: 'Doceria', keywords: ['doces finos', 'trufas'] },
      { id: 'saudavel', name: 'Alimentação Saudável', keywords: ['fit', 'low carb', 'vegano'] }
    ]
  },
  {
    id: 'varejo',
    name: 'Varejo Geral',
    icon: 'ShoppingCart',
    contentType: 'produtos',
    voiceTone: {
      style: 'popular',
      description: 'Preços baixos, variedade, economia',
      examples: {
        hero: 'Os melhores preços da região',
        cta: 'Confira nossas ofertas',
        about: 'Economia e qualidade para sua família'
      }
    },
    areas: [
      { id: 'loja-1-99', name: 'Loja de R$1,99', keywords: ['utilidades', 'barato'] },
      { id: 'bazar', name: 'Bazar', keywords: ['variedades', 'presentes'] },
      { id: 'papelaria', name: 'Papelaria', keywords: ['material escolar', 'escritório'] },
      { id: 'brinquedos', name: 'Brinquedos', keywords: ['brinquedos', 'jogos'] },
      { id: 'armarinho', name: 'Armarinho', keywords: ['aviamentos', 'tecidos'] },
      { id: 'presentes', name: 'Loja de Presentes', keywords: ['presentes', 'decoração'] }
    ]
  },
  {
    id: 'casa',
    name: 'Casa e Decoração',
    icon: 'Home',
    contentType: 'produtos',
    voiceTone: {
      style: 'elegante',
      description: 'Conforto, estilo, ambientes',
      examples: {
        hero: 'Transforme sua casa em lar',
        cta: 'Inspire-se em nossos ambientes',
        about: 'Móveis e decoração que contam sua história'
      }
    },
    areas: [
      { id: 'moveis', name: 'Móveis', keywords: ['sofás', 'mesas', 'cadeiras'] },
      { id: 'colchoes', name: 'Colchões', keywords: ['colchões', 'box', 'travesseiros'] },
      { id: 'decoracao', name: 'Decoração', keywords: ['quadros', 'vasos', 'luminárias'] },
      { id: 'cama-mesa-banho', name: 'Cama, Mesa e Banho', keywords: ['lençóis', 'toalhas'] },
      { id: 'eletrodomesticos', name: 'Eletrodomésticos', keywords: ['geladeira', 'fogão'] },
      { id: 'jardinagem', name: 'Jardinagem', keywords: ['plantas', 'vasos', 'ferramentas'] }
    ]
  },
  {
    id: 'construcao',
    name: 'Construção e Reforma',
    icon: 'Hammer',
    contentType: 'produtos',
    voiceTone: {
      style: 'profissional',
      description: 'Qualidade, confiança, durabilidade',
      examples: {
        hero: 'Construa com quem entende',
        cta: 'Solicite seu orçamento',
        about: 'Materiais de qualidade para sua obra'
      }
    },
    areas: [
      { id: 'materiais-construcao', name: 'Materiais de Construção', keywords: ['cimento', 'tijolos'] },
      { id: 'tintas', name: 'Tintas', keywords: ['tintas', 'vernizes', 'massas'] },
      { id: 'pisos', name: 'Pisos e Revestimentos', keywords: ['cerâmica', 'porcelanato'] },
      { id: 'eletrica', name: 'Material Elétrico', keywords: ['fios', 'tomadas', 'disjuntores'] },
      { id: 'hidraulica', name: 'Material Hidráulico', keywords: ['tubos', 'conexões'] },
      { id: 'ferramentas', name: 'Ferramentas', keywords: ['ferramentas', 'máquinas'] }
    ]
  },
  {
    id: 'veiculos',
    name: 'Veículos e Autopeças',
    icon: 'Car',
    contentType: 'misto',
    voiceTone: {
      style: 'profissional',
      description: 'Confiança, qualidade, segurança',
      examples: {
        hero: 'Seu veículo em boas mãos',
        cta: 'Agende sua revisão',
        about: 'Profissionais especializados para cuidar do seu veículo'
      }
    },
    areas: [
      { id: 'autopecas', name: 'Autopeças', keywords: ['peças', 'acessórios automotivos'] },
      { id: 'oficina', name: 'Oficina Mecânica', keywords: ['mecânica', 'revisão'] },
      { id: 'funilaria', name: 'Funilaria e Pintura', keywords: ['funilaria', 'pintura'] },
      { id: 'pneus', name: 'Pneus', keywords: ['pneus', 'rodas', 'alinhamento'] },
      { id: 'lava-jato', name: 'Lava Jato', keywords: ['lavagem', 'polimento'] },
      { id: 'motos', name: 'Motos e Peças', keywords: ['motos', 'capacetes'] }
    ]
  },
  {
    id: 'pets',
    name: 'Pets',
    icon: 'PawPrint',
    contentType: 'misto',
    voiceTone: {
      style: 'acolhedor',
      description: 'Amor, cuidado, família',
      examples: {
        hero: 'Amor de verdade pelo seu pet',
        cta: 'Agende um horário',
        about: 'Cuidando do seu melhor amigo com carinho'
      }
    },
    areas: [
      { id: 'petshop', name: 'Pet Shop', keywords: ['rações', 'acessórios pet'] },
      { id: 'banho-tosa', name: 'Banho e Tosa', keywords: ['banho', 'tosa', 'grooming'] },
      { id: 'veterinario', name: 'Veterinário', keywords: ['clínica veterinária', 'vacinas'] },
      { id: 'hospedagem-pet', name: 'Hospedagem Pet', keywords: ['hotel', 'creche pet'] }
    ]
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia',
    icon: 'Smartphone',
    contentType: 'misto',
    voiceTone: {
      style: 'tecnico',
      description: 'Inovação, soluções, tecnologia',
      examples: {
        hero: 'Tecnologia que simplifica sua vida',
        cta: 'Fale com um especialista',
        about: 'Soluções tecnológicas para seu dia a dia'
      }
    },
    areas: [
      { id: 'celulares', name: 'Celulares e Acessórios', keywords: ['celulares', 'capas', 'cabos'] },
      { id: 'informatica', name: 'Informática', keywords: ['computadores', 'notebooks'] },
      { id: 'assistencia-tecnica', name: 'Assistência Técnica', keywords: ['conserto', 'manutenção'] },
      { id: 'games', name: 'Games', keywords: ['videogames', 'consoles', 'jogos'] },
      { id: 'eletronicos', name: 'Eletrônicos', keywords: ['TVs', 'som', 'smart home'] }
    ]
  },
  {
    id: 'advocacia',
    name: 'Advocacia',
    icon: 'Scale',
    contentType: 'servicos',
    voiceTone: {
      style: 'profissional',
      description: 'Seriedade, confiança, expertise',
      examples: {
        hero: 'Defendendo seus direitos com excelência',
        cta: 'Agende uma consulta',
        about: 'Experiência e compromisso com seus interesses'
      }
    },
    areas: [
      { id: 'adv-trabalhista', name: 'Direito Trabalhista', keywords: ['trabalhista', 'CLT'] },
      { id: 'adv-familia', name: 'Direito de Família', keywords: ['divórcio', 'pensão'] },
      { id: 'adv-civil', name: 'Direito Civil', keywords: ['contratos', 'indenizações'] },
      { id: 'adv-criminal', name: 'Direito Criminal', keywords: ['defesa criminal'] },
      { id: 'adv-empresarial', name: 'Direito Empresarial', keywords: ['societário', 'contratos'] },
      { id: 'adv-previdenciario', name: 'Direito Previdenciário', keywords: ['aposentadoria', 'INSS'] },
      { id: 'adv-tributario', name: 'Direito Tributário', keywords: ['impostos', 'tributos'] }
    ]
  },
  {
    id: 'saude',
    name: 'Saúde',
    icon: 'Heart',
    contentType: 'servicos',
    voiceTone: {
      style: 'acolhedor',
      description: 'Cuidado, profissionalismo, bem-estar',
      examples: {
        hero: 'Sua saúde em primeiro lugar',
        cta: 'Agende sua consulta',
        about: 'Profissionais dedicados ao seu bem-estar'
      }
    },
    areas: [
      { id: 'dentista', name: 'Dentista/Clínica Odontológica', keywords: ['odontologia', 'dentes'] },
      { id: 'ortodontista', name: 'Ortodontia', keywords: ['aparelho', 'alinhadores'] },
      { id: 'implante', name: 'Implantes Dentários', keywords: ['implantes', 'próteses'] },
      { id: 'medico', name: 'Consultório Médico', keywords: ['médico', 'consultas'] },
      { id: 'psicologia', name: 'Psicologia', keywords: ['terapia', 'psicoterapia'] },
      { id: 'fisioterapia', name: 'Fisioterapia', keywords: ['reabilitação', 'fisio'] },
      { id: 'nutricao', name: 'Nutrição', keywords: ['dieta', 'alimentação'] },
      { id: 'pilates', name: 'Pilates/Yoga', keywords: ['pilates', 'yoga', 'alongamento'] },
      { id: 'academia-studio', name: 'Academia/Studio', keywords: ['treino', 'personal'] }
    ]
  },
  {
    id: 'contabilidade',
    name: 'Contabilidade',
    icon: 'Calculator',
    contentType: 'servicos',
    voiceTone: {
      style: 'profissional',
      description: 'Confiança, precisão, parceria',
      examples: {
        hero: 'Sua empresa em números seguros',
        cta: 'Solicite uma proposta',
        about: 'Parceiros no crescimento do seu negócio'
      }
    },
    areas: [
      { id: 'contabil-empresas', name: 'Contabilidade Empresarial', keywords: ['contábil', 'fiscal'] },
      { id: 'contabil-mei', name: 'Contabilidade para MEI', keywords: ['MEI', 'microempreendedor'] },
      { id: 'contabil-irpf', name: 'Imposto de Renda', keywords: ['IRPF', 'declaração'] },
      { id: 'assessoria-fiscal', name: 'Assessoria Fiscal', keywords: ['tributos', 'planejamento'] }
    ]
  },
  {
    id: 'educacao',
    name: 'Educação',
    icon: 'GraduationCap',
    contentType: 'servicos',
    voiceTone: {
      style: 'acolhedor',
      description: 'Conhecimento, desenvolvimento, futuro',
      examples: {
        hero: 'Investindo no seu futuro',
        cta: 'Matricule-se agora',
        about: 'Educação de qualidade para transformar vidas'
      }
    },
    areas: [
      { id: 'escola', name: 'Escola/Colégio', keywords: ['ensino', 'educação básica'] },
      { id: 'cursos-livres', name: 'Cursos Livres', keywords: ['cursos', 'capacitação'] },
      { id: 'idiomas', name: 'Escola de Idiomas', keywords: ['inglês', 'espanhol'] },
      { id: 'informatica-cursos', name: 'Cursos de Informática', keywords: ['computação'] },
      { id: 'autoescola', name: 'Autoescola', keywords: ['CNH', 'habilitação'] },
      { id: 'musica', name: 'Escola de Música', keywords: ['instrumentos', 'canto'] },
      { id: 'reforco', name: 'Reforço Escolar', keywords: ['aulas particulares'] }
    ]
  },
  {
    id: 'imoveis',
    name: 'Imobiliário',
    icon: 'Building',
    contentType: 'servicos',
    voiceTone: {
      style: 'profissional',
      description: 'Segurança, oportunidade, sonho',
      examples: {
        hero: 'Realize o sonho do imóvel próprio',
        cta: 'Conheça nossos imóveis',
        about: 'Especialistas em encontrar o imóvel ideal para você'
      }
    },
    areas: [
      { id: 'imobiliaria', name: 'Imobiliária', keywords: ['venda', 'aluguel', 'imóveis'] },
      { id: 'corretor', name: 'Corretor de Imóveis', keywords: ['corretor', 'consultoria'] },
      { id: 'administradora', name: 'Administradora de Condomínios', keywords: ['condomínio'] }
    ]
  },
  {
    id: 'eventos',
    name: 'Eventos e Festas',
    icon: 'PartyPopper',
    contentType: 'servicos',
    voiceTone: {
      style: 'dinamico',
      description: 'Celebração, criatividade, momentos',
      examples: {
        hero: 'Momentos inesquecíveis começam aqui',
        cta: 'Solicite seu orçamento',
        about: 'Transformando sonhos em celebrações'
      }
    },
    areas: [
      { id: 'buffet', name: 'Buffet', keywords: ['buffet', 'casamento', 'aniversário'] },
      { id: 'decoracao-festas', name: 'Decoração de Festas', keywords: ['decoração', 'balões'] },
      { id: 'fotografo', name: 'Fotografia', keywords: ['fotógrafo', 'ensaios'] },
      { id: 'dj', name: 'DJ/Som e Iluminação', keywords: ['DJ', 'som', 'luz'] },
      { id: 'cerimonialista', name: 'Cerimonialista', keywords: ['casamento', 'eventos'] },
      { id: 'aluguel-festas', name: 'Aluguel para Festas', keywords: ['mesas', 'cadeiras', 'toalhas'] }
    ]
  },
  {
    id: 'servicos-gerais',
    name: 'Serviços Gerais',
    icon: 'Wrench',
    contentType: 'servicos',
    voiceTone: {
      style: 'profissional',
      description: 'Qualidade, pontualidade, solução',
      examples: {
        hero: 'Soluções práticas para seu dia a dia',
        cta: 'Solicite um orçamento',
        about: 'Profissionais qualificados para resolver'
      }
    },
    areas: [
      { id: 'eletricista', name: 'Eletricista', keywords: ['elétrica', 'instalações'] },
      { id: 'encanador', name: 'Encanador', keywords: ['hidráulica', 'vazamentos'] },
      { id: 'pintor', name: 'Pintor', keywords: ['pintura', 'reforma'] },
      { id: 'limpeza', name: 'Limpeza', keywords: ['faxina', 'limpeza comercial'] },
      { id: 'ar-condicionado', name: 'Ar Condicionado', keywords: ['instalação', 'manutenção'] },
      { id: 'jardineiro', name: 'Jardineiro/Paisagismo', keywords: ['jardim', 'paisagismo'] },
      { id: 'mudancas', name: 'Mudanças e Fretes', keywords: ['mudança', 'frete'] },
      { id: 'serralheria', name: 'Serralheria', keywords: ['portões', 'grades'] },
      { id: 'vidracaria', name: 'Vidraçaria', keywords: ['vidros', 'espelhos', 'box'] }
    ]
  },
  {
    id: 'outros',
    name: 'Outros',
    icon: 'MoreHorizontal',
    contentType: 'misto',
    voiceTone: {
      style: 'profissional',
      description: 'Personalizado conforme o negócio',
      examples: {
        hero: 'Bem-vindo ao nosso negócio',
        cta: 'Entre em contato',
        about: 'Conheça mais sobre nós'
      }
    },
    areas: [
      { id: 'outro-especificar', name: 'Outro (especificar)', keywords: [] }
    ]
  }
];

export function getSegmentById(id: string): Segment | undefined {
  return SEGMENTS.find(s => s.id === id);
}

export function getAreaById(segmentId: string, areaId: string): Area | undefined {
  const segment = getSegmentById(segmentId);
  return segment?.areas.find(a => a.id === areaId);
}

export function searchSegments(query: string): Segment[] {
  const q = query.toLowerCase();
  return SEGMENTS.filter(s => 
    s.name.toLowerCase().includes(q) ||
    s.areas.some(a => a.name.toLowerCase().includes(q) || a.keywords.some(k => k.includes(q)))
  );
}

export function searchAreas(segmentId: string, query: string): Area[] {
  const segment = getSegmentById(segmentId);
  if (!segment) return [];
  
  const q = query.toLowerCase();
  return segment.areas.filter(a => 
    a.name.toLowerCase().includes(q) ||
    a.keywords.some(k => k.includes(q))
  );
}
