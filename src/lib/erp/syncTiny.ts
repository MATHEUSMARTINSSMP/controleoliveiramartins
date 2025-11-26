/**
 * Sincronização Tiny ERP
 * 
 * Foco: Pedidos de venda (aprovados/faturados) e Clientes
 * NÃO sincroniza: Produtos, Estoque
 * 
 * Documentação Oficial: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { supabase } from '@/integrations/supabase/client';
import { callERPAPI } from '@/lib/erpIntegrations';

interface TinyPedido {
  // A API v3 retorna o pedido diretamente, não dentro de um objeto "pedido"
  // Mas para compatibilidade, aceitamos ambos os formatos
  pedido?: {
    // Formato legado (snake_case)
    id?: string | number;
    numero?: string;
    numero_ecommerce?: string;
    situacao?: string | number;
    data_pedido?: string;
    data_prevista?: string;
    cliente?: any;
    valor_total?: string | number;
    valor_desconto?: string | number;
    valor_frete?: string | number;
    forma_pagamento?: string;
    forma_envio?: string;
    endereco_entrega?: any;
    itens?: Array<any>;
    observacoes?: string;
    vendedor?: any;
    dados_extras?: any;
  };
  // Formato oficial API v3 (camelCase)
  id?: number;
  numeroPedido?: number;
  situacao?: number; // 8, 0, 3, 4, 1, 7, 5, 6, 2, 9
  data?: string; // Data de criação do pedido
  dataPrevista?: string;
  dataEnvio?: string;
  dataEntrega?: string;
  dataFaturamento?: string;
  valorTotalPedido?: number; // Valor total do pedido
  valorTotalProdutos?: number;
  valorDesconto?: number;
  valorFrete?: number;
  valorOutrasDespesas?: number;
  observacoes?: string;
  observacoesInternas?: string;
  numeroOrdemCompra?: string;
  idNotaFiscal?: number;
  cliente?: {
    id?: number;
    nome?: string;
    codigo?: string;
    fantasia?: string;
    tipoPessoa?: string; // 'F' ou 'J' (camelCase)
    cpfCnpj?: string; // camelCase
    inscricaoEstadual?: string;
    rg?: string;
    telefone?: string;
    celular?: string;
    email?: string;
    endereco?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      cep?: string;
      uf?: string;
      pais?: string;
    };
  };
  enderecoEntrega?: {
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    cep?: string;
    uf?: string;
    pais?: string;
    nomeDestinatario?: string;
    cpfCnpj?: string;
    tipoPessoa?: string;
  };
  ecommerce?: {
    id?: number;
    nome?: string;
    numeroPedidoEcommerce?: string;
    numeroPedidoCanalVenda?: string;
    canalVenda?: string;
  };
  vendedor?: {
    id?: number;
    nome?: string;
  };
  transportador?: any;
  deposito?: any;
  naturezaOperacao?: any;
  intermediador?: any;
  pagamento?: any;
  listaPreco?: any;
  itens?: Array<{
    produto?: {
      id?: number;
      sku?: string;
      descricao?: string;
    };
    quantidade?: number;
    valorUnitario?: number;
    infoAdicional?: string;
    // Formato legado (snake_case)
    item?: any;
    dados_extras?: any;
  }>;
  pagamentosIntegrados?: Array<any>;
}

interface TinyContato {
  contato: {
    id: number;
    nome: string;
    codigo?: string;
    fantasia?: string;
    tipoPessoa: string; // 'F' ou 'J' (camelCase conforme API v3)
    cpfCnpj?: string; // camelCase conforme API v3
    inscricaoEstadual?: string;
    rg?: string;
    telefone?: string;
    celular?: string;
    telefoneAdicional?: string;
    email?: string;
    emailNfe?: string;
    site?: string;
    dataNascimento?: string; // camelCase conforme API v3
    naturalidade?: string;
    nomePai?: string;
    nomeMae?: string;
    cpfPai?: string;
    cpfMae?: string;
    limiteCredito?: number;
    situacao?: string;
    observacoes?: string;
    dataCriacao?: string;
    dataAtualizacao?: string;
    endereco?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      cep?: string;
      uf?: string;
      pais?: string;
    };
    enderecoCobranca?: any;
    vendedor?: {
      id: number;
      nome: string;
    };
    tipos?: Array<{
      id: number;
      descricao: string;
    }>;
    contatos?: Array<{
      nome: string;
      telefone: string;
      ramal?: string;
      email?: string;
      setor?: string;
      id: number;
    }>;
    // Campos legados (para compatibilidade)
    tipo?: string; // Fallback para tipoPessoa
    cpf_cnpj?: string; // Fallback para cpfCnpj
    fone?: string; // Fallback para telefone
    dados_extras?: any;
  };
}

/**
 * Busca dados completos do vendedor na API do Tiny ERP usando o ID
 * Retorna CPF, email e outros dados completos do contato
 */
async function fetchVendedorCompletoFromTiny(
  storeId: string,
  vendedorId: string
): Promise<{ cpf?: string; email?: string; nome?: string } | null> {
  try {
    console.log(`[SyncTiny] 🔍 Buscando dados completos do vendedor ${vendedorId} no Tiny ERP...`);

    // Buscar contato/vendedor pelo ID na API do Tiny
    // API v3: GET /contatos/{idContato}
    const response = await callERPAPI(storeId, `/contatos/${vendedorId}`);

    if (!response || !response.contato) {
      console.log(`[SyncTiny] ⚠️ Vendedor ${vendedorId} não encontrado na API do Tiny`);
      return null;
    }

    const contato = response.contato;
    const dadosCompletos = {
      cpf: contato.cpf_cnpj || contato.cpf || contato.dados_extras?.cpf || null,
      email: contato.email || contato.dados_extras?.email || null,
      nome: contato.nome || null,
    };

    console.log(`[SyncTiny] ✅ Dados completos do vendedor encontrados:`, {
      nome: dadosCompletos.nome,
      email: dadosCompletos.email ? '***' : null,
      cpf: dadosCompletos.cpf ? dadosCompletos.cpf.substring(0, 3) + '***' : null,
    });

    return dadosCompletos;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao buscar vendedor ${vendedorId} no Tiny:`, error);
    return null;
  }
}

/**
 * Busca colaboradora no sistema pelo vendedor do Tiny
 * Tenta matching por: CPF (prioritário), email e nome
 * 
 * Se tiver vendedor.id, busca dados completos no Tiny primeiro para pegar CPF
 * CPF está disponível no cadastro do Tiny e no profile do sistema
 */
async function findCollaboratorByVendedor(
  storeId: string,
  vendedor: { id?: string; nome?: string; email?: string; cpf?: string }
): Promise<string | null> {
  if (!vendedor.nome && !vendedor.email && !vendedor.cpf) {
    return null;
  }

  // Se tiver ID do vendedor mas não tiver CPF, buscar dados completos no Tiny
  let vendedorCompleto = { ...vendedor };
  if (vendedor.id && !vendedor.cpf) {
    const dadosCompletos = await fetchVendedorCompletoFromTiny(storeId, vendedor.id);
    if (dadosCompletos) {
      vendedorCompleto = {
        ...vendedor,
        cpf: dadosCompletos.cpf || vendedor.cpf,
        email: dadosCompletos.email || vendedor.email,
        nome: dadosCompletos.nome || vendedor.nome,
      };
    }
  }

  try {
    // Normalizar CPF (remover caracteres especiais)
    const normalizeCPF = (cpf: string | undefined) => {
      if (!cpf) return null;
      return cpf.replace(/\D/g, '');
    };

    const normalizedCPF = normalizeCPF(vendedorCompleto.cpf);

    // Buscar colaboradoras da loja
    const { data: colaboradoras, error } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, cpf, store_id')
      .eq('role', 'COLABORADORA')
      .eq('active', true)
      .eq('store_id', storeId);

    if (error) {
      console.error(`[SyncTiny] ❌ Erro ao buscar colaboradoras:`, error);
      return null;
    }

    if (!colaboradoras || colaboradoras.length === 0) {
      console.log(`[SyncTiny] ⚠️ Nenhuma colaboradora encontrada para a loja ${storeId}`);
      return null;
    }

    console.log(`[SyncTiny] 📋 Colaboradoras disponíveis na loja (${colaboradoras.length}):`,
      colaboradoras.map(c => ({ nome: c.name, email: c.email, cpf: c.cpf?.substring(0, 3) + '***' }))
    );

    // Tentar matching por CPF primeiro (mais confiável)
    if (normalizedCPF && normalizedCPF.length >= 11) {
      const matchByCPF = colaboradoras.find((colab) => {
        const colabCPF = normalizeCPF(colab.cpf);
        return colabCPF && colabCPF === normalizedCPF;
      });
      if (matchByCPF) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por CPF: ${matchByCPF.name} (${matchByCPF.id})`);
        return matchByCPF.id;
      }
    }

    // Tentar matching por email (segunda opção)
    if (vendedorCompleto.email) {
      const matchByEmail = colaboradoras.find(
        (colab) => colab.email && colab.email.toLowerCase() === vendedorCompleto.email?.toLowerCase()
      );
      if (matchByEmail) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por email: ${matchByEmail.name} (${matchByEmail.id})`);
        return matchByEmail.id;
      }
    }

    // Tentar matching por nome (última opção, menos confiável)
    if (vendedorCompleto.nome) {
      const normalizeName = (name: string) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .trim();
      };

      const normalizedVendedorNome = normalizeName(vendedorCompleto.nome);

      console.log(`[SyncTiny] 🔍 Tentando matching por nome: "${vendedorCompleto.nome}" (normalizado: "${normalizedVendedorNome}")`);

      // Tentar match exato primeiro
      const matchByName = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        const isMatch = normalizedColabNome === normalizedVendedorNome;
        if (isMatch) {
          console.log(`[SyncTiny] 🎯 Match encontrado: "${colab.name}" = "${vendedorCompleto.nome}"`);
        }
        return isMatch;
      });

      if (matchByName) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por nome: ${matchByName.name} (${matchByName.id})`);
        return matchByName.id;
      }

      // Se não encontrou match exato, tentar match parcial (contém)
      const matchPartial = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        // Verificar se o nome do vendedor contém o nome da colaboradora ou vice-versa
        return normalizedColabNome.includes(normalizedVendedorNome) ||
          normalizedVendedorNome.includes(normalizedColabNome);
      });

      if (matchPartial) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por nome parcial: ${matchPartial.name} (${matchPartial.id})`);
        return matchPartial.id;
      }

      // Log de nomes disponíveis para debug
      console.log(`[SyncTiny] 📋 Nomes de colaboradoras disponíveis:`,
        colaboradoras.map(c => `"${c.name}" (normalizado: "${normalizeName(c.name)}")`).join(', ')
      );
    }

    console.log(`[SyncTiny] ⚠️ Vendedora não encontrada: ${vendedorCompleto.nome || vendedorCompleto.email || vendedorCompleto.cpf || 'N/A'}`);
    console.log(`[SyncTiny] 📋 Dados do vendedor recebidos:`, {
      nome: vendedorCompleto.nome,
      email: vendedorCompleto.email,
      cpf: vendedorCompleto.cpf ? vendedorCompleto.cpf.substring(0, 3) + '***' : null,
      id: vendedor.id,
    });
    return null;
  } catch (error: any) {
    console.error('[SyncTiny] Erro ao buscar colaboradora:', error);
    return null;
  }
}

/**
 * Sincroniza pedidos de venda do Tiny ERP
 * Apenas pedidos com status 'faturado' (vendidos)
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Pedidos
 * Endpoint: GET /pedidos
 * Parâmetros: pagina, limite, situacao, dataInicial, dataFinal
 */
export async function syncTinyOrders(
  storeId: string,
  options: {
    dataInicio?: string; // YYYY-MM-DD
    dataFim?: string; // YYYY-MM-DD
    limit?: number;
    maxPages?: number; // Limite de páginas para paginação
    incremental?: boolean; // Sincronização incremental (apenas novos)
  } = {}
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  updated: number;
  errors: number;
  totalPages: number;
  executionTime: number;
}> {
  const startTime = Date.now();

  // Definir variáveis no escopo externo para estar disponível no catch
  let dataInicioSync: string | undefined = options.dataInicio;
  let dataFim: string | undefined = options.dataFim;

  try {
    const { dataInicio, dataFim: dataFimParam, limit = 100, maxPages = 50, incremental = true } = options;
    dataFim = dataFimParam;

    // Sincronização incremental - buscar última data E último ID
    dataInicioSync = dataInicio;
    let ultimoTinyIdSync: string | null = null;

    if (incremental && !dataInicio) {
      const { data: lastSync } = await supabase
        .schema('sistemaretiradas')
        .from('erp_sync_logs')
        .select('data_fim, ultimo_tiny_id_sincronizado')
        .eq('store_id', storeId)
        .eq('sistema_erp', 'TINY')
        .eq('tipo_sync', 'PEDIDOS')
        .eq('status', 'SUCCESS')
        .order('sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync?.data_fim) {
        // Sincronizar desde a última data (inclusive)
        const lastDate = new Date(lastSync.data_fim);
        lastDate.setDate(lastDate.getDate() - 1); // 1 dia antes para garantir que não perde nada
        dataInicioSync = lastDate.toISOString().split('T')[0];
        ultimoTinyIdSync = lastSync.ultimo_tiny_id_sincronizado || null;
        console.log(`[SyncTiny] Sincronização incremental desde: ${dataInicioSync}, último ID: ${ultimoTinyIdSync || 'N/A'}`);
      } else {
        // Se não há sincronização anterior, sincronizar últimos 7 dias por padrão
        const hoje = new Date();
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        dataInicioSync = seteDiasAtras.toISOString().split('T')[0];
        console.log(`[SyncTiny] Primeira sincronização - sincronizando últimos 7 dias desde: ${dataInicioSync}`);
      }
    } else if (!dataInicio) {
      // Se não é incremental e não tem dataInicio, também usar últimos 7 dias
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      dataInicioSync = seteDiasAtras.toISOString().split('T')[0];
      console.log(`[SyncTiny] Sem data inicial definida - sincronizando últimos 7 dias desde: ${dataInicioSync}`);
    }

    // Endpoint conforme documentação oficial
    // GET /pedidos com query parameters
    let allPedidos: TinyPedido[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalPages = 0;

    // Paginação conforme documentação
    while (hasMorePages && currentPage <= maxPages) {
      const params: Record<string, any> = {
        pagina: currentPage,
        limite: limit,
        // situacao: código numérico (ex: 3 = faturado, conforme documentação Tiny ERP v3)
        // Removendo situacao por enquanto - vamos buscar todos e filtrar depois se necessário
        // Ou usar filtro por data apenas
      };

      if (dataInicioSync) {
        params.dataInicial = dataInicioSync; // Formato: YYYY-MM-DD
      }
      if (dataFim) {
        params.dataFinal = dataFim; // Formato: YYYY-MM-DD
      }

      console.log(`[SyncTiny] Buscando página ${currentPage}...`);

      // API v3 usa GET para listar pedidos
      const response = await callERPAPI(storeId, '/pedidos', params);

      // Verificar estrutura da resposta conforme documentação Tiny ERP v3
      // A API v3 retorna: { itens: [...], paginacao: {...} }
      let pedidos: TinyPedido[] = [];

      console.log(`[SyncTiny] Resposta recebida (página ${currentPage}):`, JSON.stringify(response).substring(0, 500));

      // Tiny ERP v3 retorna: { itens: [...], paginacao: {...} }
      if (response.itens && Array.isArray(response.itens)) {
        pedidos = response.itens;
        console.log(`[SyncTiny] Encontrados ${pedidos.length} pedidos na página ${currentPage} via 'itens'`);

        // Log detalhado do primeiro pedido para debug
        if (pedidos.length > 0) {
          console.log(`[SyncTiny] 📋 EXEMPLO DO PRIMEIRO PEDIDO (estrutura real):`, JSON.stringify(pedidos[0], null, 2).substring(0, 2000));
          console.log(`[SyncTiny] 📋 Chaves do primeiro pedido:`, Object.keys(pedidos[0]));
        }
      } else if (response.pedidos && Array.isArray(response.pedidos)) {
        // Fallback para estrutura alternativa
        pedidos = response.pedidos;
        console.log(`[SyncTiny] Encontrados ${pedidos.length} pedidos na página ${currentPage} via 'pedidos'`);
      } else if (response.retorno?.pedidos && Array.isArray(response.retorno.pedidos)) {
        pedidos = response.retorno.pedidos;
        console.log(`[SyncTiny] Encontrados ${pedidos.length} pedidos na página ${currentPage} via 'retorno.pedidos'`);
      } else if (response.data?.pedidos && Array.isArray(response.data.pedidos)) {
        pedidos = response.data.pedidos;
        console.log(`[SyncTiny] Encontrados ${pedidos.length} pedidos na página ${currentPage} via 'data.pedidos'`);
      } else if (Array.isArray(response)) {
        // Se a resposta é um array direto
        pedidos = response;
        console.log(`[SyncTiny] Encontrados ${pedidos.length} pedidos na página ${currentPage} (array direto)`);
      } else {
        console.warn(`[SyncTiny] Página ${currentPage}: Estrutura de resposta não reconhecida. Chaves encontradas:`, Object.keys(response || {}));
        if (currentPage === 1) {
          return {
            success: false,
            message: `Resposta inválida da API Tiny. Estrutura recebida: ${JSON.stringify(Object.keys(response || {}))}`,
            synced: 0,
            updated: 0,
            errors: 0,
            totalPages: 0,
            executionTime: Date.now() - startTime,
          };
        }
        break;
      }

      if (pedidos.length === 0) {
        hasMorePages = false;
        break;
      }

      allPedidos = allPedidos.concat(pedidos);
      totalPages = currentPage;

      // Se retornou menos que o limite, é a última página
      if (pedidos.length < limit) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    console.log(`[SyncTiny] Total de ${allPedidos.length} pedidos encontrados em ${totalPages} página(s)`);

    let synced = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    let ultimoTinyIdProcessado: string | null = null;

    // Processar cada pedido
    // Filtrar apenas pedidos faturados
    // situacao pode ser número (1, 2, 3, etc) ou string
    // No Tiny ERP v3, situacao 3 geralmente é "Faturado"
    const pedidosFaturados = allPedidos.filter(p => {
      const pedido = p.pedido || p;
      const situacao = pedido.situacao;

      if (typeof situacao === 'number') {
        // API v3 OFICIAL - Códigos de situação:
        // 8 = Dados Incompletos, 0 = Aberta, 3 = Aprovada, 4 = Preparando Envio,
        // 1 = Faturada, 7 = Pronto Envio, 5 = Enviada, 6 = Entregue, 2 = Cancelada, 9 = Não Entregue
        // Filtrar apenas pedidos faturados (1) conforme solicitado pelo usuário
        return situacao === 1; // 1 = Faturada (API v3 oficial)
      } else if (typeof situacao === 'string') {
        // Fallback para formato string
        const situacaoLower = situacao.toLowerCase();
        return situacaoLower.includes('faturado') || situacaoLower.includes('faturada');
      }

      // Se não tiver situacao definida, não processar (evitar dados incompletos)
      return false;
    });

    console.log(`[SyncTiny] Total de pedidos recebidos: ${allPedidos.length}, Faturados: ${pedidosFaturados.length}`);

    for (const pedidoData of pedidosFaturados) {
      try {
        const pedido = pedidoData.pedido || pedidoData;
        const cliente = pedido.cliente || {};

        // Log detalhado do pedido completo para debug
        console.log(`[SyncTiny] 📦 Processando pedido completo:`, {
          id: pedido.id,
          numeroPedido: pedido.numeroPedido,
          numero: pedido.numero,
          valorTotalPedido: pedido.valorTotalPedido,
          valor_total: pedido.valor_total,
          valor: pedido.valor,
          data: pedido.data,
          data_pedido: pedido.data_pedido,
          dataCriacao: pedido.dataCriacao,
          situacao: pedido.situacao,
          todas_as_chaves: Object.keys(pedido),
        });

        // Extrair TODOS os dados possíveis dos produtos para relatórios inteligentes
        // API v3 OFICIAL: itens[] = { produto: { id, sku, descricao }, quantidade: number, valorUnitario: number, infoAdicional }
        const itensComCategorias = pedido.itens?.map((item: any) => {
          // API v3 OFICIAL: item.produto, item.quantidade, item.valorUnitario
          const produto = item.produto || {}; // API v3: produto { id, sku, descricao }
          const quantidade = item.quantidade || 0; // API v3: number
          const valorUnitario = item.valorUnitario || 0; // API v3: number
          const infoAdicional = item.infoAdicional || null; // API v3: string

          // Fallback para formato legado (snake_case)
          const itemData = item.item || item;

          // Extrair categoria e subcategoria
          const categoria = itemData.categoria
            || itemData.categoria_produto
            || itemData.categoria_id
            || produto.categoria
            || produto.categoria_produto
            || null;

          const subcategoria = itemData.subcategoria
            || itemData.subcategoria_produto
            || itemData.subcategoria_id
            || produto.subcategoria
            || produto.subcategoria_produto
            || null;

          // Extrair marca (pode estar em vários lugares)
          const marca = itemData.marca
            || itemData.marca_produto
            || produto.marca
            || produto.marca_produto
            || itemData.fabricante
            || produto.fabricante
            || itemData.dados_extras?.marca
            || produto.dados_extras?.marca
            || null;

          // Extrair tamanho
          const tamanho = itemData.tamanho
            || itemData.tamanho_produto
            || produto.tamanho
            || produto.tamanho_produto
            || itemData.dados_extras?.tamanho
            || produto.dados_extras?.tamanho
            || itemData.variacao?.tamanho
            || produto.variacao?.tamanho
            || null;

          // Extrair cor
          const cor = itemData.cor
            || itemData.cor_produto
            || produto.cor
            || produto.cor_produto
            || itemData.dados_extras?.cor
            || produto.dados_extras?.cor
            || itemData.variacao?.cor
            || produto.variacao?.cor
            || null;

          // Extrair código do produto - API v3 OFICIAL: produto.sku
          const codigo = produto.sku  // API v3 oficial (camelCase)
            || itemData.sku
            || produto.codigo
            || produto.codigo_produto
            || itemData.codigo
            || null;

          // Extrair descrição completa - API v3 OFICIAL: produto.descricao
          const descricao = produto.descricao  // API v3 oficial (camelCase)
            || itemData.descricao
            || produto.nome
            || itemData.nome
            || null;

          // Extrair outras informações úteis
          const genero = itemData.genero
            || produto.genero
            || itemData.dados_extras?.genero
            || produto.dados_extras?.genero
            || null;

          const faixa_etaria = itemData.faixa_etaria
            || produto.faixa_etaria
            || itemData.dados_extras?.faixa_etaria
            || produto.dados_extras?.faixa_etaria
            || null;

          const material = itemData.material
            || produto.material
            || itemData.dados_extras?.material
            || produto.dados_extras?.material
            || null;

          return {
            ...itemData,
            // Dados organizados para relatórios
            categoria,
            subcategoria,
            marca,
            tamanho,
            cor,
            codigo,
            descricao,
            genero,
            faixa_etaria,
            material,
            // Manter todos os dados originais para referência
            dados_originais: itemData,
            produto_original: produto,
          };
        }) || [];

        // Identificar vendedora/colaboradora
        let colaboradoraId: string | null = null;
        if (pedido.vendedor && pedido.vendedor.id) {
          // Log detalhado dos dados do vendedor recebidos do Tiny
          console.log(`[SyncTiny] 🔍 Dados do vendedor recebidos:`, {
            id: pedido.vendedor.id,
            nome: pedido.vendedor.nome,
            email: pedido.vendedor.email,
            cpf: pedido.vendedor.cpf,
            objeto_completo: JSON.stringify(pedido.vendedor).substring(0, 500),
          });

          // Tentar buscar CPF do vendedor nos dados do pedido (pode não vir)
          const vendedorCPF = pedido.vendedor.cpf
            || pedido.vendedor.dados_extras?.cpf
            || pedido.vendedor.dados_extras?.cpf_cnpj
            || pedido.dados_extras?.vendedor_cpf
            || null;

          console.log(`[SyncTiny] 🔍 Buscando colaboradora com:`, {
            id: pedido.vendedor.id,
            nome: pedido.vendedor.nome,
            email: pedido.vendedor.email,
            cpf: vendedorCPF || 'não informado no pedido - será buscado na API',
            storeId,
          });

          // A função findCollaboratorByVendedor agora busca dados completos do Tiny se tiver ID mas não tiver CPF
          colaboradoraId = await findCollaboratorByVendedor(storeId, {
            id: pedido.vendedor.id?.toString(),
            nome: pedido.vendedor.nome,
            email: pedido.vendedor.email,
            cpf: vendedorCPF,
          });
        }

        // Preparar dados do pedido
        // API v3 usa: id (number), numeroPedido (number)
        const tinyId = String(pedido.id || pedido.numeroPedido || pedido.numero || `temp_${Date.now()}`);
        ultimoTinyIdProcessado = tinyId; // Atualizar último ID processado

        const orderData = {
          store_id: storeId,
          tiny_id: tinyId,
          numero_pedido: (pedido.numeroPedido || pedido.numero)?.toString() || null,
          numero_ecommerce: (pedido.ecommerce?.numeroPedidoEcommerce || pedido.numero_ecommerce)?.toString() || null,
          situacao: pedido.situacao?.toString() || null, // API v3 retorna número (8, 0, 3, 4, 1, 7, 5, 6, 2, 9)
          data_pedido: (() => {
            // API v3 oficial usa: data (data de criação), dataFaturamento, dataEntrega
            const data = pedido.data  // API v3 oficial (camelCase)
              || pedido.dataFaturamento  // Data de faturamento
              || pedido.data_pedido  // Fallback para snake_case
              || pedido.dataCriacao
              || pedido.data_criacao
              || pedido.dataPedido
              || pedido.data_criacao_pedido
              || null;

            if (!data) {
              console.warn(`[SyncTiny] ⚠️ Data não encontrada no pedido ${pedido.id || pedido.numeroPedido || pedido.numero}`);
              return null;
            }

            console.log(`[SyncTiny] 📅 Data bruta recebida: "${data}" (tipo: ${typeof data})`);

            // ✅ CORREÇÃO: Lidar com diferentes formatos de data
            try {
              // Se já tem formato ISO completo com T e timezone
              if (typeof data === 'string' && data.includes('T') && (data.includes('Z') || data.includes('+') || data.includes('-'))) {
                console.log(`[SyncTiny] ✅ Data já em formato ISO completo: "${data}"`);
                return data;
              }

              // Se for apenas data (YYYY-MM-DD) - usar meio-dia no timezone do Brasil
              if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
                // Usar 12:00 (meio-dia) no timezone do Brasil (-03:00)
                const isoString = `${data}T12:00:00-03:00`;
                console.log(`[SyncTiny] ✅ Data convertida para ISO com timezone BR: "${isoString}"`);
                return isoString;
              }

              // Tentar parsear qualquer outro formato
              const date = new Date(data);
              if (!isNaN(date.getTime())) {
                const isoString = date.toISOString();
                console.log(`[SyncTiny] ✅ Data convertida para ISO: "${isoString}"`);
                return isoString;
              }
            } catch (error) {
              console.error(`[SyncTiny] ❌ Erro ao converter data "${data}":`, error);
            }

            return null;
          })(),
          data_prevista: (() => {
            const data = pedido.dataPrevista  // API v3 oficial (camelCase)
              || pedido.data_prevista  // Fallback para snake_case
              || null;
            if (!data) return null;
            return data.includes('T') ? data : `${data}T00:00:00`;
          })(),
          cliente_nome: cliente.nome || null,
          cliente_cpf_cnpj: (() => {
            // API v3 usa camelCase: cpfCnpj
            const cpfCnpj = cliente.cpfCnpj  // API v3 oficial (camelCase)
              || cliente.cpf_cnpj  // Fallback para snake_case
              || cliente.cpf
              || cliente.cnpj
              || cliente.documento
              || cliente.dados_extras?.cpfCnpj
              || cliente.dados_extras?.cpf_cnpj
              || cliente.dados_extras?.cpf
              || cliente.dados_extras?.cnpj
              || null;
            if (cpfCnpj) {
              console.log(`[SyncTiny] ✅ CPF/CNPJ do cliente encontrado: ${cpfCnpj.substring(0, 3)}***`);
            } else {
              console.warn(`[SyncTiny] ⚠️ CPF/CNPJ não encontrado para cliente ${cliente.nome}`);
            }
            return cpfCnpj;
          })(),
          cliente_email: cliente.email || null,
          cliente_telefone: cliente.telefone || cliente.fone || cliente.telefoneAdicional || cliente.celular || cliente.mobile || null,
          // ✅ CORREÇÃO CRÍTICA: valor_total será calculado depois (async)
          valor_total: 0, // Placeholder - será atualizado abaixo
          // ✅ API v3 oficial usa camelCase
          valor_desconto: pedido.valorDesconto || 0,
          valor_frete: pedido.valorFrete || 0,
          forma_pagamento: pedido.pagamento?.formaPagamento?.nome || null,
          forma_envio: pedido.transportador?.formaEnvio?.nome || null,
          endereco_entrega: pedido.enderecoEntrega ? JSON.stringify(pedido.enderecoEntrega) : null,
          itens: JSON.stringify(itensComCategorias),
          observacoes: pedido.observacoes || null,
          vendedor_nome: pedido.vendedor?.nome || pedido.vendedor_nome || null, // Coluna já existe na tabela (criada em 20250127040000)
          vendedor_tiny_id: pedido.vendedor?.id?.toString() || null, // Será adicionada pela migration
          colaboradora_id: colaboradoraId, // Será adicionada pela migration
          dados_extras: pedido.dados_extras ? JSON.stringify(pedido.dados_extras) : null,
          sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // ✅ CORREÇÃO CRÍTICA: Calcular valor_total real
        // A API de listagem NÃO retorna valor para pedidos aprovados (situacao: 3)
        const valorBruto = pedido.valor || pedido.valorTotalPedido || null;
        let valorFinal = 0;

        if (valorBruto) {
          if (typeof valorBruto === 'number') {
            valorFinal = valorBruto;
          } else {
            const valorLimpo = String(valorBruto).replace(/[^\d,.-]/g, '').replace(',', '.');
            valorFinal = parseFloat(valorLimpo) || 0;
          }
        }

        // Se valor é zero, buscar detalhes completos
        if (valorFinal === 0) {
          console.warn(`[SyncTiny] ⚠️ Valor ZERO no pedido ${tinyId} - buscando detalhes...`);
          const pedidoCompleto = await fetchPedidoCompletoFromTiny(storeId, pedido.id);

          if (pedidoCompleto && pedidoCompleto.valorTotalPedido) {
            valorFinal = typeof pedidoCompleto.valorTotalPedido === 'number'
              ? pedidoCompleto.valorTotalPedido
              : parseFloat(String(pedidoCompleto.valorTotalPedido).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

            console.log(`[SyncTiny] ✅ Valor encontrado nos detalhes: ${valorFinal}`);
          }
        }

        orderData.valor_total = valorFinal;

        // Verificar se pedido já existe
        const { data: existingOrder } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('id')
          .eq('store_id', storeId)
          .eq('tiny_id', orderData.tiny_id)
          .maybeSingle();

        // Log dos dados que serão salvos
        console.log(`[SyncTiny] 💾 Salvando pedido ${tinyId}:`, {
          numero_pedido: orderData.numero_pedido,
          valor_total: orderData.valor_total,
          data_pedido: orderData.data_pedido,
          cliente_nome: orderData.cliente_nome,
          cliente_cpf_cnpj: orderData.cliente_cpf_cnpj ? orderData.cliente_cpf_cnpj.substring(0, 3) + '***' : null,
          vendedor_nome: orderData.vendedor_nome,
        });

        // 🔍 DIAGNÓSTICO: Log detalhado dos TIPOS de dados ANTES do upsert
        console.log(`[SyncTiny] 🔍 Tipos de dados ANTES do save (pedido ${tinyId}):`, {
          valor_total_TIPO: typeof orderData.valor_total,
          valor_total_VALOR: orderData.valor_total,
          data_pedido_TIPO: typeof orderData.data_pedido,
          data_pedido_VALOR: orderData.data_pedido,
          cliente_cpf_cnpj_TIPO: typeof orderData.cliente_cpf_cnpj,
          cliente_cpf_cnpj_VALOR: orderData.cliente_cpf_cnpj ? orderData.cliente_cpf_cnpj.substring(0, 3) + '***' : null,
        });

        // ✅ CORREÇÃO: Usar UPDATE/INSERT explícito em vez de upsert
        // Isso garante que registros existentes sejam ATUALIZADOS
        let upsertedData: any[] = [];
        let upsertError: any = null;

        if (existingOrder) {
          // UPDATE explícito para pedido existente
          console.log(`[SyncTiny] 🔄 Pedido ${tinyId} já existe (id: ${existingOrder.id}), fazendo UPDATE...`);

          const { data, error } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .update(orderData)
            .eq('id', existingOrder.id)
            .select('tiny_id, numero_pedido, valor_total, data_pedido, cliente_cpf_cnpj');

          upsertedData = data || [];
          upsertError = error;
        } else {
          // INSERT para pedido novo
          console.log(`[SyncTiny] ➕ Pedido ${tinyId} é novo, fazendo INSERT...`);

          const { data, error } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .insert(orderData)
            .select('tiny_id, numero_pedido, valor_total, data_pedido, cliente_cpf_cnpj');

          upsertedData = data || [];
          upsertError = error;
        }

        if (upsertError) {
          console.error(`[SyncTiny] ❌ Erro ao salvar pedido ${tinyId}:`, upsertError);
          errors++;
          errorDetails.push(`Pedido ${orderData.numero_pedido || orderData.tiny_id}: ${upsertError.message}`);
          continue; // Pular para o próximo pedido
        }

        // ✅ VALIDAÇÃO: Verificar dados realmente salvos no banco
        if (upsertedData && upsertedData.length > 0) {
          const savedOrder = upsertedData[0];

          console.log(`[SyncTiny] ✅ Dados SALVOS no banco (pedido ${tinyId}):`, {
            valor_total_SALVO: savedOrder.valor_total,
            valor_total_TIPO_SALVO: typeof savedOrder.valor_total,
            data_pedido_SALVA: savedOrder.data_pedido,
            data_pedido_TIPO_SALVA: typeof savedOrder.data_pedido,
            cliente_cpf_cnpj_SALVO: savedOrder.cliente_cpf_cnpj ? savedOrder.cliente_cpf_cnpj.substring(0, 3) + '***' : null,
          });

          // 🚨 ALERTAS: Comparar dados enviados vs salvos
          let hasDiscrepancy = false;

          // Validar valor_total
          if (orderData.valor_total > 0 && (!savedOrder.valor_total || savedOrder.valor_total === 0)) {
            console.error(`[SyncTiny] ⚠️⚠️⚠️ VALOR INCORRETO (pedido ${tinyId}):`);
            console.error(`  → Enviado: ${orderData.valor_total} (tipo: ${typeof orderData.valor_total})`);
            console.error(`  → Salvo: ${savedOrder.valor_total} (tipo: ${typeof savedOrder.valor_total})`);
            hasDiscrepancy = true;
          }

          // Validar data_pedido
          if (orderData.data_pedido && !savedOrder.data_pedido) {
            console.error(`[SyncTiny] ⚠️⚠️⚠️ DATA INCORRETA (pedido ${tinyId}):`);
            console.error(`  → Enviada: ${orderData.data_pedido} (tipo: ${typeof orderData.data_pedido})`);
            console.error(`  → Salva: ${savedOrder.data_pedido} (tipo: ${typeof savedOrder.data_pedido})`);
            hasDiscrepancy = true;
          }

          // Validar CPF/CNPJ
          if (orderData.cliente_cpf_cnpj && !savedOrder.cliente_cpf_cnpj) {
            console.error(`[SyncTiny] ⚠️⚠️⚠️ CPF/CNPJ INCORRETO (pedido ${tinyId}):`);
            console.error(`  → Enviado: ${orderData.cliente_cpf_cnpj.substring(0, 3)}*** (tipo: ${typeof orderData.cliente_cpf_cnpj})`);
            console.error(`  → Salvo: ${savedOrder.cliente_cpf_cnpj} (tipo: ${typeof savedOrder.cliente_cpf_cnpj})`);
            hasDiscrepancy = true;
          }

          if (!hasDiscrepancy) {
            console.log(`[SyncTiny] ✅ Pedido ${tinyId} salvo com sucesso! Todos os dados conferem.`);
          } else {
            console.error(`[SyncTiny] ⚠️ Pedido ${tinyId} salvo MAS com discrepâncias nos dados!`);
          }
        } else {
          console.warn(`[SyncTiny] ⚠️ Pedido ${tinyId} - upsert não retornou dados!`);
        }

        if (existingOrder) {
          updated++;
        } else {
          synced++;
        }

        // Sincronizar cliente também
        if (cliente.nome) {
          await syncTinyContact(storeId, cliente, orderData.tiny_id);
        }
      } catch (error: any) {
        console.error(`Erro ao processar pedido:`, error);
        errors++;
        errorDetails.push(`Erro genérico: ${error.message}`);
      }
    }

    const executionTime = Date.now() - startTime;
    const dataFimSync = dataFim || new Date().toISOString().split('T')[0];

    // Logs detalhados de sincronização
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'PEDIDOS',
        registros_sincronizados: synced,
        registros_atualizados: updated,
        registros_com_erro: errors,
        status: errors === 0 ? 'SUCCESS' : (synced + updated > 0 ? 'PARTIAL' : 'ERROR'),
        error_message: errorDetails.length > 0 ? errorDetails.slice(0, 5).join('; ') : null,
        data_inicio: dataInicioSync || null,
        data_fim: dataFimSync,
        tempo_execucao_ms: executionTime,
        total_paginas: totalPages,
        ultimo_tiny_id_sincronizado: ultimoTinyIdProcessado,
        sync_at: new Date().toISOString(),
      });

    return {
      success: errors === 0,
      message: `Sincronizados ${synced} novos, ${updated} atualizados${errors > 0 ? `, ${errors} erros` : ''} (${totalPages} página(s), ${(executionTime / 1000).toFixed(1)}s)`,
      synced,
      updated,
      errors,
      totalPages,
      executionTime,
    };
  } catch (error: any) {
    console.error('Erro na sincronização de pedidos:', error);
    const executionTime = Date.now() - startTime;

    // Log detalhado de erro
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'PEDIDOS',
        registros_sincronizados: 0,
        registros_atualizados: 0,
        registros_com_erro: 0,
        status: 'ERROR',
        error_message: error.message || 'Erro desconhecido',
        data_inicio: dataInicioSync || null,
        data_fim: dataFim || null,
        tempo_execucao_ms: executionTime,
        total_paginas: 0,
        sync_at: new Date().toISOString(),
      });

    return {
      success: false,
      message: error.message || 'Erro ao sincronizar pedidos',
      synced: 0,
      updated: 0,
      errors: 0,
      totalPages: 0,
      executionTime,
    };
  }
}

/**
 * Busca detalhes completos de um pedido na API do Tiny ERP
 * Usado quando a listagem não retorna todos os campos (ex: valor para pedidos aprovados)
 * 
 * API v3: GET /pedidos/{idPedido}
 */
async function fetchPedidoCompletoFromTiny(
  storeId: string,
  pedidoId: string | number
): Promise<any | null> {
  try {
    console.log(`[SyncTiny] 🔍 Buscando detalhes completos do pedido ${pedidoId}...`);

    const response = await callERPAPI(storeId, `/pedidos/${pedidoId}`);

    if (!response || !response.pedido) {
      console.warn(`[SyncTiny] ⚠️ Detalhes do pedido ${pedidoId} não encontrados`);
      return null;
    }

    console.log(`[SyncTiny] ✅ Detalhes do pedido ${pedidoId} encontrados`);
    return response.pedido;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao buscar detalhes do pedido ${pedidoId}:`, error);
    return null;
  }
}

/**
 * Sincroniza um cliente/contato do Tiny ERP
 */
async function syncTinyContact(
  storeId: string,
  cliente: any,
  pedidoId?: string
): Promise<void> {
  try {
    if (!cliente.nome) {
      return;
    }

    // Buscar data de nascimento - pode estar em vários lugares
    const dataNascimento = cliente.data_nascimento
      || cliente.nascimento
      || cliente.data_nasc
      || cliente.dados_extras?.data_nascimento
      || cliente.dados_extras?.nascimento
      || null;

    // Normalizar data de nascimento para formato DATE
    let dataNascimentoNormalizada: string | null = null;
    if (dataNascimento) {
      try {
        // Se for string, tentar parsear
        const date = new Date(dataNascimento);
        if (!isNaN(date.getTime())) {
          dataNascimentoNormalizada = date.toISOString().split('T')[0]; // YYYY-MM-DD
        }
      } catch {
        // Se não conseguir parsear, deixar null
      }
    }

    // ✅ Extrair CPF/CNPJ do cliente (API v3 usa camelCase)
    const cpfCnpj = cliente.cpfCnpj  // API v3 oficial (camelCase)
      || cliente.cpf_cnpj  // Fallback para snake_case
      || cliente.cpf
      || cliente.cnpj
      || cliente.documento
      || null;

    const contactData = {
      store_id: storeId,
      tiny_id: cliente.id?.toString() || cpfCnpj || `temp_${Date.now()}`,
      nome: cliente.nome,
      tipo: cliente.tipoPessoa || cliente.tipo || 'F', // API v3 usa tipoPessoa (camelCase)
      cpf_cnpj: cpfCnpj, // Usar o CPF/CNPJ que encontramos acima
      email: cliente.email || null,
      telefone: cliente.telefone || cliente.fone || cliente.telefoneAdicional || null, // API v3 usa telefone
      celular: cliente.celular || cliente.mobile || cliente.whatsapp || null, // API v3 usa celular
      data_nascimento: dataNascimentoNormalizada,
      endereco: cliente.endereco ? JSON.stringify(cliente.endereco) : null,
      observacoes: cliente.observacoes || null,
      dados_extras: cliente.dados_extras ? JSON.stringify(cliente.dados_extras) : null,
      sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .schema('sistemaretiradas')
      .from('tiny_contacts')
      .upsert(contactData, {
        onConflict: 'store_id,tiny_id',
        ignoreDuplicates: false,
      });
  } catch (error: any) {
    console.error('Erro ao sincronizar contato:', error);
  }
}

/**
 * Sincroniza todos os clientes do Tiny ERP
 * Útil para sincronização inicial completa
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Contatos
 * Endpoint: GET /contatos
 * Parâmetros: pagina, limite
 */
export async function syncTinyContacts(
  storeId: string,
  options: {
    limit?: number;
    maxPages?: number;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  updated: number;
  errors: number;
  totalPages: number;
  executionTime: number;
}> {
  const startTime = Date.now();

  try {
    const { limit = 100, maxPages = 50 } = options;

    let allContatos: TinyContato[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalPages = 0;

    // Paginação conforme documentação
    while (hasMorePages && currentPage <= maxPages) {
      const params: Record<string, any> = {
        pagina: currentPage,
        limite: limit,
      };

      console.log(`[SyncTiny] Buscando contatos página ${currentPage}...`);

      const response = await callERPAPI(storeId, '/contatos', params);

      // Verificar estrutura da resposta
      // Tiny ERP v3 pode retornar: { contatos: [...] } ou { retorno: { contatos: [...] } }
      let contatos: TinyContato[] = [];

      console.log(`[SyncTiny] Resposta recebida (página ${currentPage}):`, JSON.stringify(response).substring(0, 500));

      // Tiny ERP v3 retorna: { itens: [...], paginacao: {...} }
      if (response.itens && Array.isArray(response.itens)) {
        contatos = response.itens;
        console.log(`[SyncTiny] Encontrados ${contatos.length} contatos na página ${currentPage} via 'itens'`);
      } else if (response.contatos && Array.isArray(response.contatos)) {
        // Fallback para estrutura alternativa
        contatos = response.contatos;
        console.log(`[SyncTiny] Encontrados ${contatos.length} contatos na página ${currentPage} via 'contatos'`);
      } else if (response.retorno?.contatos && Array.isArray(response.retorno.contatos)) {
        contatos = response.retorno.contatos;
        console.log(`[SyncTiny] Encontrados ${contatos.length} contatos na página ${currentPage} via 'retorno.contatos'`);
      } else if (response.data?.contatos && Array.isArray(response.data.contatos)) {
        contatos = response.data.contatos;
        console.log(`[SyncTiny] Encontrados ${contatos.length} contatos na página ${currentPage} via 'data.contatos'`);
      } else if (Array.isArray(response)) {
        // Se a resposta é um array direto
        contatos = response;
        console.log(`[SyncTiny] Encontrados ${contatos.length} contatos na página ${currentPage} (array direto)`);
      } else {
        console.warn(`[SyncTiny] Estrutura de resposta não reconhecida (página ${currentPage}). Chaves encontradas:`, Object.keys(response || {}));
        if (currentPage === 1) {
          return {
            success: false,
            message: `Resposta inválida da API Tiny. Estrutura recebida: ${JSON.stringify(Object.keys(response || {}))}`,
            synced: 0,
            updated: 0,
            errors: 0,
            totalPages: 0,
            executionTime: Date.now() - startTime,
          };
        }
        break;
      }

      if (contatos.length === 0) {
        hasMorePages = false;
        break;
      }

      allContatos = allContatos.concat(contatos);
      totalPages = currentPage;

      if (contatos.length < limit) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    let synced = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Processar cada contato
    // Os contatos já vêm diretos em 'itens', não há objeto 'contato' aninhado
    for (const contatoData of allContatos) {
      try {
        // O item já é o contato direto
        const contato = contatoData.contato || contatoData;

        if (!contato || !contato.nome) {
          continue;
        }

        // Verificar se já existe
        const { data: existing } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('id')
          .eq('store_id', storeId)
          .eq('tiny_id', String(contato.id || contato.cpf_cnpj || `temp_${Date.now()}`))
          .maybeSingle();

        await syncTinyContact(storeId, contato);

        if (existing) {
          updated++;
        } else {
          synced++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar contato:`, error);
        errors++;
        errorDetails.push(`Contato: ${error.message}`);
      }
    }

    const executionTime = Date.now() - startTime;

    // Log detalhado
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'CONTATOS',
        registros_sincronizados: synced,
        registros_atualizados: updated,
        registros_com_erro: errors,
        status: errors === 0 ? 'SUCCESS' : (synced + updated > 0 ? 'PARTIAL' : 'ERROR'),
        error_message: errorDetails.length > 0 ? errorDetails.slice(0, 5).join('; ') : null,
        tempo_execucao_ms: executionTime,
        total_paginas: totalPages,
        sync_at: new Date().toISOString(),
      });

    return {
      success: errors === 0,
      message: `Sincronizados ${synced} novos, ${updated} atualizados${errors > 0 ? `, ${errors} erros` : ''} (${totalPages} página(s), ${(executionTime / 1000).toFixed(1)}s)`,
      synced,
      updated,
      errors,
      totalPages,
      executionTime,
    };
  } catch (error: any) {
    console.error('Erro na sincronização de contatos:', error);
    const executionTime = Date.now() - startTime;

    return {
      success: false,
      message: error.message || 'Erro ao sincronizar contatos',
      synced: 0,
      updated: 0,
      errors: 0,
      totalPages: 0,
      executionTime,
    };
  }
}
