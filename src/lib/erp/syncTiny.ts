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
 * Cache global para contatos (evita múltiplas requisições do mesmo contato na mesma sincronização)
 */
const contatoCache: Record<string, any> = {};

/**
 * Limpa o cache de contatos (chamar no início de cada sincronização)
 */
function limparCacheContatos(): void {
  Object.keys(contatoCache).forEach(key => delete contatoCache[key]);
}

/**
 * Busca dados completos de um contato na API do Tiny ERP usando o ID
 * Retorna telefone, celular, dataNascimento e outros dados completos
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Contatos/ObterContatoAction
 * Endpoint: GET /contatos/{idContato}
 */
async function fetchContatoCompletoFromTiny(
  storeId: string,
  contatoId: number | string
): Promise<any | null> {
  try {
    // ✅ Cache para evitar múltiplas requisições do mesmo contato
    const cacheKey = `${storeId}_contato_${contatoId}`;
    if (contatoCache[cacheKey]) {
      console.log(`[SyncTiny] ⚡ Cache hit para contato ${contatoId}`);
      return contatoCache[cacheKey];
    }

    console.log(`[SyncTiny] 🔍 Buscando detalhes completos do contato ${contatoId} via GET /contatos/${contatoId}...`);
    
    const response = await callERPAPI(storeId, `/contatos/${contatoId}`, {});
    
    if (!response) {
      console.warn(`[SyncTiny] ⚠️ Resposta vazia ao buscar contato ${contatoId}`);
      return null;
    }

    // ✅ LOG DETALHADO: Verificar estrutura da resposta recebida do proxy
    console.log(`[SyncTiny] 📦 Resposta RAW recebida do proxy para contato ${contatoId}:`, {
      tem_contato: !!response.contato,
      tem_id_direto: !!response.id,
      tipo_response: typeof response,
      chaves_principais: Object.keys(response).slice(0, 10),
      estrutura_completa: JSON.stringify(response).substring(0, 1000),
    });

    // ✅ CORREÇÃO BASEADA NA DOCUMENTAÇÃO OFICIAL:
    // Tiny ERP v3: GET /contatos/{idContato} retorna o contato DIRETAMENTE (não dentro de "contato")
    // Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Contatos/ObterContatoAction
    // A resposta é o objeto contato diretamente: { nome, telefone, celular, dataNascimento, ... }
    const contatoCompleto = response;
    
    console.log(`[SyncTiny] 📋 Contato extraído (response.contato || response):`, {
      tem_contato: !!contatoCompleto,
      tem_id: !!contatoCompleto?.id,
      chaves: contatoCompleto ? Object.keys(contatoCompleto).slice(0, 15) : [],
    });
    
    if (!contatoCompleto || !contatoCompleto.id) {
      console.warn(`[SyncTiny] ⚠️ Detalhes do contato ${contatoId} não encontrados. Resposta:`, JSON.stringify(response).substring(0, 500));
      return null;
    }
    
    console.log(`[SyncTiny] ✅ Detalhes completos recebidos para contato ${contatoId}:`, {
      nome: contatoCompleto.nome,
      tem_telefone: !!contatoCompleto.telefone,
      valor_telefone: contatoCompleto.telefone,
      tem_celular: !!contatoCompleto.celular,
      valor_celular: contatoCompleto.celular,
      tem_dataNascimento: !!contatoCompleto.dataNascimento,
      valor_dataNascimento: contatoCompleto.dataNascimento,
      tem_contatos_array: Array.isArray(contatoCompleto.contatos),
      contatos_length: Array.isArray(contatoCompleto.contatos) ? contatoCompleto.contatos.length : 0,
      todas_chaves: Object.keys(contatoCompleto),
    });

    // Salvar no cache
    contatoCache[cacheKey] = contatoCompleto;

    return contatoCompleto;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao buscar detalhes do contato ${contatoId}:`, error);
    return null;
  }
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
    // API v3: GET /contatos/{idContato} retorna o contato DIRETAMENTE
    const response = await callERPAPI(storeId, `/contatos/${vendedorId}`);

    if (!response || !response.id) {
      console.log(`[SyncTiny] ⚠️ Vendedor ${vendedorId} não encontrado na API do Tiny`);
      return null;
    }

    // ✅ CORREÇÃO: A resposta é o contato diretamente, não dentro de "contato"
    const contato = response;
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
// ✅ CACHE de vendedores para evitar requisições repetidas
const vendedoresCache = new Map<string, any>();

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
    // ✅ VERIFICAR CACHE PRIMEIRO
    const cacheKey = `${storeId}:${vendedor.id}`;

    if (vendedoresCache.has(cacheKey)) {
      console.log(`[SyncTiny] 💾 Vendedor ${vendedor.id} encontrado no cache`);
      vendedorCompleto = vendedoresCache.get(cacheKey)!;
    } else {
      console.log(`[SyncTiny] 🔍 Buscando vendedor ${vendedor.id} na API (não está no cache)`);
      const dadosCompletos = await fetchVendedorCompletoFromTiny(storeId, vendedor.id);
      if (dadosCompletos) {
        vendedorCompleto = {
          ...vendedor,
          cpf: dadosCompletos.cpf || vendedor.cpf,
          email: dadosCompletos.email || vendedor.email,
          nome: dadosCompletos.nome || vendedor.nome,
        };
        // ✅ SALVAR NO CACHE
        vendedoresCache.set(cacheKey, vendedorCompleto);
        console.log(`[SyncTiny] 💾 Vendedor ${vendedor.id} salvo no cache`);
      }
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
    const { dataInicio, dataFim: dataFimParam, limit = 100, maxPages = 5, incremental = true } = options;
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
    // Filtrar pedidos FATURADOS (1) e APROVADOS (3)
    // Pedidos aprovados não vêm com valor na listagem, precisamos buscar detalhes completos
    // situacao pode ser número (1, 2, 3, etc) ou string
    const pedidosFaturados = allPedidos.filter(p => {
      const pedido = p.pedido || p;
      const situacao = pedido.situacao;

      if (typeof situacao === 'number') {
        // API v3 OFICIAL - Códigos de situação:
        // 8 = Dados Incompletos, 0 = Aberta, 3 = Aprovada, 4 = Preparando Envio,
        // 1 = Faturada, 7 = Pronto Envio, 5 = Enviada, 6 = Entregue, 2 = Cancelada, 9 = Não Entregue
        // ✅ CORREÇÃO: Incluir pedidos FATURADOS (1) e APROVADOS (3)
        // Pedidos aprovados não têm valor na listagem, mas temos valorTotalPedido nos detalhes
        return situacao === 1 || situacao === 3; // 1 = Faturada, 3 = Aprovada (API v3 oficial)
      } else if (typeof situacao === 'string') {
        // Fallback para formato string
        const situacaoLower = situacao.toLowerCase();
        return situacaoLower.includes('faturado') || situacaoLower.includes('faturada') || situacaoLower.includes('aprovado') || situacaoLower.includes('aprovada');
      }

      // Se não tiver situacao definida, não processar (evitar dados incompletos)
      return false;
    });

    console.log(`[SyncTiny] Total de pedidos recebidos: ${allPedidos.length}, Faturados/Aprovados: ${pedidosFaturados.length}`);

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

        // ✅ EXTRAÇÃO ROBUSTA DE DADOS DOS PRODUTOS
        // API v3 OFICIAL: itens[] = { produto: { id, sku, descricao }, quantidade: number, valorUnitario: number, infoAdicional }
        // ⚠️ IMPORTANTE: Os itens do pedido NÃO trazem categoria, marca, subcategoria
        // Para obter esses dados, precisamos buscar detalhes completos via GET /produtos/{idProduto}
        
        // Processar itens de forma assíncrona para buscar detalhes quando necessário
        const itensComCategorias = await Promise.all(
          (pedido.itens || []).map(async (item: any) => {
            // API v3 OFICIAL: item.produto, item.quantidade, item.valorUnitario
            const produto = item.produto || {}; // API v3: produto { id, sku, descricao }
            const quantidade = item.quantidade || 0; // API v3: number
            const valorUnitario = item.valorUnitario || 0; // API v3: number
            const infoAdicional = item.infoAdicional || null; // API v3: string

            // Fallback para formato legado (snake_case)
            const itemData = item.item || item;

            // ✅ DADOS BÁSICOS (sempre disponíveis nos itens)
            const codigo = produto.sku || itemData.sku || produto.codigo || itemData.codigo || null;
            const descricao = produto.descricao || itemData.descricao || produto.nome || itemData.nome || null;
            const produtoId = produto.id || itemData.produto_id || null;

            // ✅ BUSCAR DETALHES COMPLETOS DO PRODUTO se tivermos o ID
            // Segundo documentação oficial: GET /produtos/{idProduto} retorna categoria, marca, etc.
            let produtoCompleto: any = null;
            let categoria: string | null = null;
            let subcategoria: string | null = null;
            let marca: string | null = null;
            let tamanho: string | null = null;
            let cor: string | null = null;
            let genero: string | null = null;
            let faixa_etaria: string | null = null;
            let material: string | null = null;

            if (produtoId) {
              try {
                produtoCompleto = await fetchProdutoCompletoFromTiny(storeId, produtoId);
                
                if (produtoCompleto) {
                  // ✅ CATEGORIA - API v3 OFICIAL: produto.categoria { id, nome, caminhoCompleto }
                  if (produtoCompleto.categoria) {
                    categoria = produtoCompleto.categoria.nome || produtoCompleto.categoria.descricao || null;
                    
                    // Extrair subcategoria do caminho completo (ex: "Roupas > Feminino > Vestidos")
                    if (produtoCompleto.categoria.caminhoCompleto) {
                      const caminho = produtoCompleto.categoria.caminhoCompleto.split(' > ');
                      if (caminho.length > 1) {
                        subcategoria = caminho[caminho.length - 1]; // Último nível é a subcategoria
                      }
                    }
                    
                    console.log(`[SyncTiny] ✅ Categoria encontrada para produto ${produtoId}: ${categoria}${subcategoria ? ` (sub: ${subcategoria})` : ''}`);
                  }

                  // ✅ MARCA - API v3 OFICIAL: produto.marca { id, nome }
                  if (produtoCompleto.marca) {
                    marca = produtoCompleto.marca.nome || produtoCompleto.marca.descricao || null;
                    console.log(`[SyncTiny] ✅ Marca encontrada para produto ${produtoId}: ${marca}`);
                  }

                  // ✅ VARIACOES - API v3 OFICIAL: produto.variacoes[] { grade: [{ chave, valor }] }
                  // A grade pode conter tamanho, cor, etc.
                  if (produtoCompleto.variacoes && Array.isArray(produtoCompleto.variacoes) && produtoCompleto.variacoes.length > 0) {
                    // Pegar a primeira variação (geralmente é a variação do item do pedido)
                    const variacao = produtoCompleto.variacoes[0];
                    
                    if (variacao.grade && Array.isArray(variacao.grade)) {
                      for (const atributo of variacao.grade) {
                        const chave = atributo.chave?.toLowerCase() || '';
                        const valor = atributo.valor || '';
                        
                        if (chave.includes('tamanho') || chave.includes('size')) {
                          tamanho = valor;
                        } else if (chave.includes('cor') || chave.includes('color')) {
                          cor = valor;
                        } else if (chave.includes('genero') || chave.includes('gender')) {
                          genero = valor;
                        }
                      }
                    }
                  }

                  // ✅ DADOS EXTRAS - Pode conter informações adicionais
                  if (produtoCompleto.dados_extras) {
                    tamanho = tamanho || produtoCompleto.dados_extras.tamanho || produtoCompleto.dados_extras.size || null;
                    cor = cor || produtoCompleto.dados_extras.cor || produtoCompleto.dados_extras.color || null;
                    genero = genero || produtoCompleto.dados_extras.genero || produtoCompleto.dados_extras.gender || null;
                    faixa_etaria = produtoCompleto.dados_extras.faixa_etaria || produtoCompleto.dados_extras.age_range || null;
                    material = produtoCompleto.dados_extras.material || null;
                  }
                }
              } catch (error: any) {
                console.warn(`[SyncTiny] ⚠️ Erro ao buscar detalhes do produto ${produtoId}:`, error.message);
                // Continuar sem os detalhes - usar fallbacks abaixo
              }
            }

            // ✅ FALLBACKS: Tentar extrair dos dados do item (caso já venham no pedido)
            if (!categoria) {
              categoria = itemData.categoria
                || itemData.categoria_produto
                || itemData.categoria_id
                || produto.categoria?.nome
                || produto.categoria
                || produto.categoria_produto
                || null;
            }

            if (!subcategoria) {
              subcategoria = itemData.subcategoria
                || itemData.subcategoria_produto
                || itemData.subcategoria_id
                || produto.subcategoria?.nome
                || produto.subcategoria
                || produto.subcategoria_produto
                || null;
            }

            if (!marca) {
              marca = itemData.marca?.nome
                || itemData.marca
                || itemData.marca_produto
                || produto.marca?.nome
                || produto.marca
                || produto.marca_produto
                || itemData.fabricante
                || produto.fabricante
                || itemData.dados_extras?.marca
                || produto.dados_extras?.marca
                || null;
            }

            if (!tamanho) {
              tamanho = itemData.tamanho
                || itemData.tamanho_produto
                || produto.tamanho
                || produto.tamanho_produto
                || itemData.dados_extras?.tamanho
                || produto.dados_extras?.tamanho
                || itemData.variacao?.tamanho
                || produto.variacao?.tamanho
                || null;
            }

            if (!cor) {
              cor = itemData.cor
                || itemData.cor_produto
                || produto.cor
                || produto.cor_produto
                || itemData.dados_extras?.cor
                || produto.dados_extras?.cor
                || itemData.variacao?.cor
                || produto.variacao?.cor
                || null;
            }

            if (!genero) {
              genero = itemData.genero
                || produto.genero
                || itemData.dados_extras?.genero
                || produto.dados_extras?.genero
                || null;
            }

            if (!faixa_etaria) {
              faixa_etaria = itemData.faixa_etaria
                || produto.faixa_etaria
                || itemData.dados_extras?.faixa_etaria
                || produto.dados_extras?.faixa_etaria
                || null;
            }

            if (!material) {
              material = itemData.material
                || produto.material
                || itemData.dados_extras?.material
                || produto.dados_extras?.material
                || null;
            }

            return {
              ...itemData,
              // Dados básicos
              produto_id: produtoId,
              codigo,
              descricao,
              quantidade,
              valorUnitario,
              infoAdicional,
              // Dados de categoria/marca (prioridade: detalhes completos > fallbacks)
              categoria,
              subcategoria,
              marca,
              tamanho,
              cor,
              genero,
              faixa_etaria,
              material,
              // Referências
              produto_original: produto,
              produto_completo: produtoCompleto ? {
                id: produtoCompleto.id,
                categoria: produtoCompleto.categoria,
                marca: produtoCompleto.marca,
                tem_variacoes: !!produtoCompleto.variacoes,
              } : null,
            };
          })
        );

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

        // ✅ FASE 1: SEMPRE sincronizar cliente ANTES de salvar pedido
        // Isso garante que o cliente existe em tiny_contacts antes do pedido
        let clienteId: string | null = null;
        if (pedido.cliente) {
          // ✅ CORREÇÃO: Extrair telefone do pedido se não estiver no cliente
          // O telefone pode vir em pedido.cliente.telefone, pedido.clienteTelefone, ou já estar salvo em tiny_orders
          const telefoneDoPedido = pedido.cliente.telefone 
            || pedido.cliente.celular
            || pedido.clienteTelefone
            || pedido.clienteCelular
            || pedido.telefoneCliente
            || pedido.celularCliente
            || null;
          
          // Se encontrou telefone no pedido mas não no cliente, adicionar ao objeto cliente
          if (telefoneDoPedido && !pedido.cliente.telefone && !pedido.cliente.celular) {
            console.log(`[SyncTiny] 📞 Telefone encontrado no pedido: ${telefoneDoPedido.substring(0, 15)}...`);
            // Priorizar celular sobre telefone fixo
            if (telefoneDoPedido.length >= 10) { // Celular geralmente tem 10+ dígitos
              pedido.cliente.celular = telefoneDoPedido;
            } else {
              pedido.cliente.telefone = telefoneDoPedido;
            }
          }
          
          clienteId = await syncTinyContact(storeId, pedido.cliente, tinyId);
          if (!clienteId) {
            console.warn(`[SyncTiny] ⚠️ Cliente não foi sincronizado: ${pedido.cliente.nome || 'Sem nome'}`);
          } else {
            console.log(`[SyncTiny] ✅ Cliente sincronizado com ID: ${clienteId.substring(0, 8)}...`);
          }
        }

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

              // Se for apenas data (YYYY-MM-DD) - usar meia-noite no timezone do Brasil
              // ✅ CORREÇÃO: Usar 00:00:00 (meia-noite) em vez de 12:00:00 para evitar confusão
              if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
                // Usar 00:00:00 (meia-noite) no timezone do Brasil (-03:00)
                const isoString = `${data}T00:00:00-03:00`;
                console.log(`[SyncTiny] ✅ Data convertida para ISO com timezone BR (meia-noite): "${isoString}"`);
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
          // ✅ FASE 2: Usar FK cliente_id ao invés de duplicar dados
          // Dados completos do cliente estão em tiny_contacts
          cliente_id: clienteId, // FK para tiny_contacts (será adicionada na migration)
          // Manter apenas campos essenciais para histórico rápido (sem JOIN)
          cliente_nome: cliente.nome || null, // Para exibição rápida sem JOIN
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
          // ✅ MANTIDO TEMPORARIAMENTE: cliente_telefone para compatibilidade e para usar como fallback
          // Quando não encontramos telefone na API, buscamos em pedidos existentes
          // TODO: Remover após migração completa (FASE 3)
          cliente_telefone: (() => {
            // Extrair telefone do cliente do pedido para salvar em tiny_orders
            // Isso permite buscar telefone de pedidos antigos quando sincronizamos novos contatos
            const telefone = pedido.cliente?.telefone 
              || pedido.cliente?.celular
              || pedido.clienteTelefone
              || pedido.clienteCelular
              || pedido.telefoneCliente
              || pedido.celularCliente
              || null;
            return telefone;
          })(),
          // ✅ REMOVIDO: cliente_email (agora em tiny_contacts via FK)
          // Para obter email: fazer JOIN com tiny_contacts usando cliente_id
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

        // ✅ ESTRATÉGIA ROBUSTA E CRIATIVA: Calcular valor_total usando MÚLTIPLAS FONTES
        // Implementamos uma cascata de estratégias para garantir que sempre temos o valor
        
        let valorFinal = 0;
        let estrategiaUsada = '';
        const estrategias = [];

        // ============================================================================
        // ESTRATÉGIA 1: Valor direto da listagem (mais rápido)
        // ============================================================================
        const valorBrutoListagem = pedido.valor || pedido.valorTotalPedido || null;
        
        if (valorBrutoListagem !== null && valorBrutoListagem !== undefined) {
          let valorParsed = 0;
          
          if (typeof valorBrutoListagem === 'number') {
            valorParsed = valorBrutoListagem;
          } else if (typeof valorBrutoListagem === 'string' && valorBrutoListagem.trim() !== '') {
            // API pode retornar como STRING: "598.00" ou "598,00"
            const valorLimpo = valorBrutoListagem.replace(/[^\d,.-]/g, '').replace(',', '.');
            valorParsed = parseFloat(valorLimpo);
          }

          if (!isNaN(valorParsed) && valorParsed > 0) {
            valorFinal = valorParsed;
            estrategiaUsada = 'Listagem (valor direto)';
            estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal });
            console.log(`[SyncTiny] ✅ ESTRATÉGIA 1: Valor da listagem → ${valorFinal}`);
          } else {
            estrategias.push({ estrategia: 'Listagem (valor direto)', valor: 0, motivo: 'valor inválido ou zerado' });
          }
        } else {
          estrategias.push({ estrategia: 'Listagem (valor direto)', valor: 0, motivo: 'valor não disponível' });
        }

        // ============================================================================
        // ESTRATÉGIA 2: Calcular a partir dos itens da LISTAGEM (se disponível)
        // ============================================================================
        if (valorFinal === 0 && pedido.itens && Array.isArray(pedido.itens) && pedido.itens.length > 0) {
          let valorCalculado = 0;
          for (const item of pedido.itens) {
            const quantidade = item.quantidade || item.qtd || 0;
            const valorUnitario = item.valorUnitario || item.valor_unitario || item.preco || item.valor || 0;
            valorCalculado += quantidade * valorUnitario;
          }
          
          if (valorCalculado > 0) {
            valorFinal = valorCalculado;
            estrategiaUsada = 'Listagem (cálculo pelos itens)';
            estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal });
            console.log(`[SyncTiny] ✅ ESTRATÉGIA 2: Valor calculado dos itens da listagem → ${valorFinal}`);
          } else {
            estrategias.push({ estrategia: 'Listagem (cálculo pelos itens)', valor: 0, motivo: 'itens sem valor válido' });
          }
        }

        // ============================================================================
        // ESTRATÉGIA 3: Buscar detalhes completos via GET /pedidos/{idPedido}
        // ============================================================================
        if (valorFinal === 0 || isNaN(valorFinal)) {
          console.warn(`[SyncTiny] ⚠️ Valor ainda ZERO após estratégias 1-2. Pedido ${tinyId} (situacao: ${pedido.situacao}). Buscando detalhes completos...`);
          
          const pedidoCompleto = await fetchPedidoCompletoFromTiny(storeId, pedido.id);

          if (pedidoCompleto) {
            // 3.1: valorTotalPedido dos detalhes (FONTE PRINCIPAL)
            const valorTotalPedido = pedidoCompleto.valorTotalPedido;
            
            if (valorTotalPedido !== null && valorTotalPedido !== undefined) {
              let valorParsed = 0;
              
              if (typeof valorTotalPedido === 'number') {
                valorParsed = valorTotalPedido;
              } else if (typeof valorTotalPedido === 'string') {
                const valorLimpo = String(valorTotalPedido).replace(/[^\d,.-]/g, '').replace(',', '.');
                valorParsed = parseFloat(valorLimpo);
              }

              if (!isNaN(valorParsed) && valorParsed > 0) {
                valorFinal = valorParsed;
                estrategiaUsada = 'Detalhes (valorTotalPedido)';
                estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal });
                console.log(`[SyncTiny] ✅ ESTRATÉGIA 3.1: valorTotalPedido dos detalhes → ${valorFinal}`);
              }
            }

            // 3.2: Calcular a partir dos itens dos DETALHES (se ainda não temos valor)
            if (valorFinal === 0 && pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
              let valorCalculadoItens = 0;
              
              for (const item of pedidoCompleto.itens) {
                const quantidade = item.quantidade || 0;
                const valorUnitario = item.valorUnitario || 0;
                valorCalculadoItens += quantidade * valorUnitario;
              }
              
              if (valorCalculadoItens > 0) {
                // Aplicar desconto e frete se disponíveis
                const desconto = parseFloat(String(pedidoCompleto.valorDesconto || pedidoCompleto.valor_desconto || 0));
                const frete = parseFloat(String(pedidoCompleto.valorFrete || pedidoCompleto.valor_frete || 0));
                const outrasDespesas = parseFloat(String(pedidoCompleto.valorOutrasDespesas || pedidoCompleto.valor_outras_despesas || 0));
                
                valorFinal = valorCalculadoItens - desconto + frete + outrasDespesas;
                
                if (valorFinal > 0) {
                  estrategiaUsada = 'Detalhes (cálculo pelos itens)';
                  estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal, detalhes: { produtos: valorCalculadoItens, desconto, frete, outrasDespesas } });
                  console.log(`[SyncTiny] ✅ ESTRATÉGIA 3.2: Valor calculado dos itens dos detalhes → ${valorFinal} (produtos: ${valorCalculadoItens}, desconto: ${desconto}, frete: ${frete}, outras: ${outrasDespesas})`);
                }
              }
            }

            // 3.3: Calcular a partir das parcelas de pagamento (ESTRATÉGIA CRIATIVA!)
            if (valorFinal === 0 && pedidoCompleto.pagamento && pedidoCompleto.pagamento.parcelas) {
              const parcelas = pedidoCompleto.pagamento.parcelas;
              
              if (Array.isArray(parcelas) && parcelas.length > 0) {
                let valorTotalParcelas = 0;
                
                for (const parcela of parcelas) {
                  const valorParcela = parseFloat(String(parcela.valor || 0));
                  if (!isNaN(valorParcela) && valorParcela > 0) {
                    valorTotalParcelas += valorParcela;
                  }
                }
                
                if (valorTotalParcelas > 0) {
                  valorFinal = valorTotalParcelas;
                  estrategiaUsada = 'Detalhes (soma das parcelas)';
                  estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal, quantidadeParcelas: parcelas.length });
                  console.log(`[SyncTiny] ✅ ESTRATÉGIA 3.3: Valor calculado pela soma das parcelas → ${valorFinal} (${parcelas.length} parcela(s))`);
                }
              }
            }

            // 3.4: Usar valorTotalProdutos + ajustes (FALLBACK CRIATIVO)
            if (valorFinal === 0 && pedidoCompleto.valorTotalProdutos) {
              const valorProdutos = parseFloat(String(pedidoCompleto.valorTotalProdutos || 0));
              const desconto = parseFloat(String(pedidoCompleto.valorDesconto || 0));
              const frete = parseFloat(String(pedidoCompleto.valorFrete || 0));
              const outrasDespesas = parseFloat(String(pedidoCompleto.valorOutrasDespesas || 0));
              
              valorFinal = valorProdutos - desconto + frete + outrasDespesas;
              
              if (valorFinal > 0) {
                estrategiaUsada = 'Detalhes (valorTotalProdutos + ajustes)';
                estrategias.push({ estrategia: estrategiaUsada, valor: valorFinal });
                console.log(`[SyncTiny] ✅ ESTRATÉGIA 3.4: valorTotalProdutos + ajustes → ${valorFinal}`);
              }
            }
          } else {
            console.error(`[SyncTiny] ❌ ESTRATÉGIA 3: Não foi possível buscar detalhes do pedido ${pedido.id}`);
            estrategias.push({ estrategia: 'Detalhes (API)', valor: 0, motivo: 'erro ao buscar detalhes' });
          }
        }

        // ============================================================================
        // VALIDAÇÃO FINAL E LOG DE DIAGNÓSTICO
        // ============================================================================
        if (valorFinal === 0 || isNaN(valorFinal)) {
          console.error(`[SyncTiny] ❌❌❌ CRÍTICO: Nenhuma estratégia conseguiu obter o valor para o pedido ${tinyId}!`);
          console.error(`[SyncTiny] ❌ Todas as estratégias tentadas:`, JSON.stringify(estrategias, null, 2));
          console.error(`[SyncTiny] ❌ Dados disponíveis na listagem:`, {
            tem_valor: !!pedido.valor,
            tem_valorTotalPedido: !!pedido.valorTotalPedido,
            tem_itens: !!pedido.itens,
            quantidade_itens: pedido.itens?.length || 0,
            situacao: pedido.situacao,
            todas_as_chaves: Object.keys(pedido),
          });
        } else {
          console.log(`[SyncTiny] ✅✅✅ VALOR FINAL OBTIDO: ${valorFinal} (via ${estrategiaUsada})`);
          console.log(`[SyncTiny] 📊 Resumo de todas as estratégias:`, JSON.stringify(estrategias, null, 2));
        }

        // ✅ GARANTIR TIPO CORRETO: valor_total deve ser number, nunca string
        // PostgreSQL DECIMAL(10,2) espera number, não string
        orderData.valor_total = typeof valorFinal === 'number' && !isNaN(valorFinal) && valorFinal > 0 
          ? Number(valorFinal.toFixed(2)) // Garantir 2 casas decimais e tipo number
          : 0;

        // ✅ VALIDAÇÃO CRÍTICA: Garantir que data_pedido está no formato correto
        if (orderData.data_pedido && typeof orderData.data_pedido === 'string') {
          // Se não tiver timezone, adicionar (PostgreSQL precisa)
          if (!orderData.data_pedido.includes('T')) {
            // Se é apenas data, usar meia-noite no timezone do Brasil
            orderData.data_pedido = `${orderData.data_pedido}T00:00:00-03:00`;
          } else if (!orderData.data_pedido.includes('Z') && !orderData.data_pedido.includes('+') && !orderData.data_pedido.includes('-')) {
            // Se tem T mas não tem timezone, adicionar timezone do Brasil
            // ✅ CORREÇÃO: Normalizar para meia-noite se não tiver hora específica
            if (orderData.data_pedido.endsWith('T00:00:00')) {
              orderData.data_pedido = `${orderData.data_pedido}-03:00`;
            } else if (orderData.data_pedido.endsWith('T12:00:00')) {
              // Se estava usando 12:00, manter mas adicionar timezone
              orderData.data_pedido = `${orderData.data_pedido}-03:00`;
            } else {
              // Se tem hora específica, apenas adicionar timezone
              orderData.data_pedido = `${orderData.data_pedido}-03:00`;
            }
          }
        }

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

        // ✅ VALIDAÇÃO CRÍTICA: Verificar dados realmente salvos no banco
        if (upsertedData && upsertedData.length > 0) {
          const savedOrder = upsertedData[0];

          console.log(`[SyncTiny] ✅ Dados SALVOS no banco (pedido ${tinyId}):`, {
            valor_total_SALVO: savedOrder.valor_total,
            valor_total_TIPO_SALVO: typeof savedOrder.valor_total,
            valor_total_ENVIADO: orderData.valor_total,
            valor_total_TIPO_ENVIADO: typeof orderData.valor_total,
            data_pedido_SALVA: savedOrder.data_pedido,
            data_pedido_TIPO_SALVA: typeof savedOrder.data_pedido,
            data_pedido_ENVIADA: orderData.data_pedido,
            cliente_cpf_cnpj_SALVO: savedOrder.cliente_cpf_cnpj ? savedOrder.cliente_cpf_cnpj.substring(0, 3) + '***' : null,
            cliente_cpf_cnpj_ENVIADO: orderData.cliente_cpf_cnpj ? orderData.cliente_cpf_cnpj.substring(0, 3) + '***' : null,
          });

          // ⚠️ ALERTA CRÍTICO se valores não baterem
          if (orderData.valor_total > 0 && (!savedOrder.valor_total || savedOrder.valor_total === 0)) {
            console.error(`[SyncTiny] ⚠️⚠️⚠️ ATENÇÃO CRÍTICA: Valor enviado (${orderData.valor_total}) não foi salvo corretamente (${savedOrder.valor_total})`);
          }

          if (orderData.data_pedido && !savedOrder.data_pedido) {
            console.error(`[SyncTiny] ⚠️⚠️⚠️ ATENÇÃO CRÍTICA: Data enviada (${orderData.data_pedido}) não foi salva corretamente (${savedOrder.data_pedido})`);
          }

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

        // ✅ FASE 1: Cliente já foi sincronizado ANTES (linha ~860)
        // Não precisamos sincronizar novamente aqui
        // clienteId já está disponível no escopo
      } catch (error: any) {
        console.error(`Erro ao processar pedido:`, error);
        errors++;
        errorDetails.push(`Erro genérico: ${error.message}`);
      }
    }

    const executionTime = Date.now() - startTime;
    const dataFimSync = dataFim || new Date().toISOString().split('T')[0];

    // ✅ AUTOMÁTICO: Popular telefones de pedidos para contatos sem telefone
    console.log(`[SyncTiny] 🔄 Populando telefones de pedidos para contatos sem telefone...`);
    try {
      // Buscar telefones de pedidos e atualizar contatos
      const { data: pedidosComTelefone } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_cpf_cnpj, cliente_nome, cliente_telefone, store_id, data_pedido')
        .eq('store_id', storeId)
        .not('cliente_telefone', 'is', null)
        .neq('cliente_telefone', '');
      
      if (pedidosComTelefone && pedidosComTelefone.length > 0) {
        // Agrupar por cliente e pegar telefone mais recente
        const telefonesPorCliente = new Map<string, { telefone: string; data: string }>();
        
        pedidosComTelefone.forEach(pedido => {
          const key = pedido.cliente_cpf_cnpj || pedido.cliente_nome || '';
          if (key && pedido.cliente_telefone) {
            const existing = telefonesPorCliente.get(key);
            if (!existing || (pedido.data_pedido && (!existing.data || pedido.data_pedido > existing.data))) {
              telefonesPorCliente.set(key, {
                telefone: pedido.cliente_telefone,
                data: pedido.data_pedido || ''
              });
            }
          }
        });
        
        // Atualizar contatos sem telefone
        let atualizados = 0;
        for (const [key, info] of telefonesPorCliente.entries()) {
          const isCPF = /^\d{11,14}$/.test(key.replace(/\D/g, ''));
          
          let query = supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .update({ telefone: info.telefone, updated_at: new Date().toISOString() })
            .eq('store_id', storeId)
            .or(isCPF 
              ? `cpf_cnpj.eq.${key},nome.eq.${key}`
              : `nome.eq.${key}`
            )
            .or('telefone.is.null,telefone.eq.');
          
          const { count } = await query.select('id', { count: 'exact', head: true });
          
          if (count) atualizados += count;
        }
        
        console.log(`[SyncTiny] ✅ ${atualizados} contatos atualizados com telefones de pedidos`);
      }
    } catch (error) {
      console.warn(`[SyncTiny] ⚠️ Erro ao popular telefones:`, error);
    }

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
/**
 * Busca detalhes completos de um produto na API do Tiny ERP
 * Usado para obter categoria, marca, subcategoria, variações, etc.
 * 
 * API v3 OFICIAL: GET /produtos/{idProduto}
 * Retorna: { categoria: { id, nome, caminhoCompleto }, marca: { id, nome }, variacoes: [...], ... }
 */
/**
 * Cache global para produtos (evita múltiplas requisições do mesmo produto na mesma sincronização)
 */
const produtoCache: Record<string, any> = {};

/**
 * Limpa o cache de produtos (chamar no início de cada sincronização)
 */
function limparCacheProdutos(): void {
  Object.keys(produtoCache).forEach(key => delete produtoCache[key]);
}

/**
 * Busca detalhes completos de um produto na API do Tiny ERP
 * Usado para obter categoria, marca, subcategoria, variações, etc.
 * 
 * API v3 OFICIAL: GET /produtos/{idProduto}
 * Retorna: { categoria: { id, nome, caminhoCompleto }, marca: { id, nome }, variacoes: [...], ... }
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Produtos/GetProduto
 */
async function fetchProdutoCompletoFromTiny(
  storeId: string,
  produtoId: string | number
): Promise<any | null> {
  try {
    // ✅ Cache para evitar múltiplas requisições do mesmo produto
    const cacheKey = `${storeId}_produto_${produtoId}`;
    if (produtoCache[cacheKey]) {
      console.log(`[SyncTiny] ⚡ Cache hit para produto ${produtoId}`);
      return produtoCache[cacheKey];
    }

    console.log(`[SyncTiny] 🔍 Buscando detalhes completos do produto ${produtoId} via GET /produtos/${produtoId}...`);

    // API v3 OFICIAL: GET /produtos/{idProduto} (sem query params para detalhes)
    const response = await callERPAPI(storeId, `/produtos/${produtoId}`);

    // ✅ CORREÇÃO BASEADA NA DOCUMENTAÇÃO OFICIAL:
    // Tiny ERP v3: GET /produtos/{idProduto} retorna o produto DIRETAMENTE (não dentro de "produto")
    // Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Produtos/ObterProdutoAction
    const produtoCompleto = response;
    
    if (!produtoCompleto || !produtoCompleto.id) {
      console.warn(`[SyncTiny] ⚠️ Detalhes do produto ${produtoId} não encontrados. Resposta:`, JSON.stringify(response).substring(0, 500));
      return null;
    }

    // Log detalhado dos campos importantes
    console.log(`[SyncTiny] ✅ Detalhes do produto ${produtoId} encontrados:`, {
      id: produtoCompleto.id,
      sku: produtoCompleto.sku,
      descricao: produtoCompleto.descricao,
      categoria: produtoCompleto.categoria ? {
        id: produtoCompleto.categoria.id,
        nome: produtoCompleto.categoria.nome,
        caminhoCompleto: produtoCompleto.categoria.caminhoCompleto,
      } : null,
      marca: produtoCompleto.marca ? {
        id: produtoCompleto.marca.id,
        nome: produtoCompleto.marca.nome,
      } : null,
      tem_variacoes: produtoCompleto.variacoes ? produtoCompleto.variacoes.length : 0,
      chaves_disponiveis: Object.keys(produtoCompleto),
    });

    // Salvar no cache
    produtoCache[cacheKey] = produtoCompleto;

    return produtoCompleto;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao buscar detalhes do produto ${produtoId}:`, error);
    return null;
  }
}

/**
 * Busca detalhes completos de um pedido na API do Tiny ERP
 * Usado quando a listagem não retorna todos os campos (ex: valor para pedidos aprovados)
 * 
 * API v3 OFICIAL: GET /pedidos/{idPedido}
 * Retorna: { valorTotalPedido: number, valorTotalProdutos: number, valorDesconto: number, valorFrete: number, itens: [...] }
 */
async function fetchPedidoCompletoFromTiny(
  storeId: string,
  pedidoId: string | number
): Promise<any | null> {
  try {
    console.log(`[SyncTiny] 🔍 Buscando detalhes completos do pedido ${pedidoId} via GET /pedidos/${pedidoId}...`);

    // API v3 OFICIAL: GET /pedidos/{idPedido} (sem query params para detalhes)
    const response = await callERPAPI(storeId, `/pedidos/${pedidoId}`);

    // ✅ CORREÇÃO BASEADA NA DOCUMENTAÇÃO OFICIAL:
    // Tiny ERP v3: GET /pedidos/{idPedido} retorna o pedido DIRETAMENTE (não dentro de "pedido")
    // Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Pedidos/ObterPedidoAction
    const pedidoCompleto = response;
    
    if (!pedidoCompleto || !pedidoCompleto.id) {
      console.warn(`[SyncTiny] ⚠️ Detalhes do pedido ${pedidoId} não encontrados. Resposta:`, JSON.stringify(response).substring(0, 500));
      return null;
    }

    // Log detalhado dos campos importantes para diagnóstico
    console.log(`[SyncTiny] ✅ Detalhes do pedido ${pedidoId} encontrados:`, {
      id: pedidoCompleto.id,
      numeroPedido: pedidoCompleto.numeroPedido,
      // Valores disponíveis
      valorTotalPedido: pedidoCompleto.valorTotalPedido,
      valorTotalProdutos: pedidoCompleto.valorTotalProdutos,
      valorDesconto: pedidoCompleto.valorDesconto,
      valorFrete: pedidoCompleto.valorFrete,
      valorOutrasDespesas: pedidoCompleto.valorOutrasDespesas,
      // Itens
      tem_itens: pedidoCompleto.itens ? pedidoCompleto.itens.length : 0,
      quantidade_itens: pedidoCompleto.itens?.length || 0,
      // Pagamento
      tem_pagamento: !!pedidoCompleto.pagamento,
      tem_parcelas: pedidoCompleto.pagamento?.parcelas ? pedidoCompleto.pagamento.parcelas.length : 0,
      // Outros
      situacao: pedidoCompleto.situacao,
      todas_as_chaves_valor: Object.keys(pedidoCompleto).filter(k => k.toLowerCase().includes('valor')),
      chaves_disponiveis: Object.keys(pedidoCompleto),
    });

    return pedidoCompleto;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao buscar detalhes do pedido ${pedidoId}:`, error);
    return null;
  }
}

/**
 * Sincroniza um cliente/contato do Tiny ERP
 * 
 * ✅ FASE 1: Retorna o ID do cliente criado/atualizado para uso em FK
 * 
 * @returns UUID do cliente em tiny_contacts ou null se não foi possível criar
 */
async function syncTinyContact(
  storeId: string,
  cliente: any,
  pedidoId?: string
): Promise<string | null> {
  try {
    if (!cliente.nome) {
      console.warn(`[SyncTiny] ⚠️ Cliente sem nome, ignorando sincronização`);
      return null;
    }

    // ✅ Buscar data de nascimento - pode estar em vários lugares
    // API v3 usa camelCase: dataNascimento
    const dataNascimento = cliente.dataNascimento  // API v3 oficial (camelCase)
      || cliente.data_nascimento  // Fallback para snake_case
      || cliente.nascimento
      || cliente.data_nasc
      || cliente.dataNasc
      || cliente.dados_extras?.dataNascimento
      || cliente.dados_extras?.data_nascimento
      || cliente.dados_extras?.nascimento
      || null;

    // Log para diagnóstico
    if (!dataNascimento) {
      console.log(`[SyncTiny] 🔍 Buscando data de nascimento para ${cliente.nome}:`, {
        tem_dataNascimento: !!cliente.dataNascimento,
        valor_dataNascimento: cliente.dataNascimento,
        tem_data_nascimento: !!cliente.data_nascimento,
        valor_data_nascimento: cliente.data_nascimento,
        chaves_disponiveis: Object.keys(cliente).filter(k => 
          k.toLowerCase().includes('nasc') || 
          k.toLowerCase().includes('data')
        ),
      });
    }

    // Normalizar data de nascimento para formato DATE
    let dataNascimentoNormalizada: string | null = null;
    if (dataNascimento) {
      try {
        // Se for string, tentar parsear
        const date = new Date(dataNascimento);
        if (!isNaN(date.getTime())) {
          dataNascimentoNormalizada = date.toISOString().split('T')[0]; // YYYY-MM-DD
          console.log(`[SyncTiny] ✅ Data de nascimento encontrada para ${cliente.nome}: ${dataNascimentoNormalizada}`);
        } else {
          console.warn(`[SyncTiny] ⚠️ Data de nascimento inválida para ${cliente.nome}: ${dataNascimento}`);
        }
      } catch (error) {
        console.warn(`[SyncTiny] ⚠️ Erro ao parsear data de nascimento para ${cliente.nome}:`, error);
      }
    } else {
      console.warn(`[SyncTiny] ⚠️ Nenhuma data de nascimento encontrada para ${cliente.nome}`);
    }

    // ✅ Extrair CPF/CNPJ do cliente (API v3 usa camelCase)
    const cpfCnpj = cliente.cpfCnpj  // API v3 oficial (camelCase)
      || cliente.cpf_cnpj  // Fallback para snake_case
      || cliente.cpf
      || cliente.cnpj
      || cliente.documento
      || null;

    // ✅ ESTRATÉGIA ULTRA ROBUSTA: Priorizar CELULAR sobre TELEFONE
    // API v3 pode retornar em múltiplos lugares: celular, telefone, mobile, whatsapp, contatos[], etc.
    // Damos preferência ABSOLUTA para celular (mais útil para contato)
    const telefoneFinal = (() => {
      // Log detalhado do objeto recebido para diagnóstico
      const chavesTelefone = Object.keys(cliente).filter(k => {
        const kLower = k.toLowerCase();
        return kLower.includes('tel') || 
               kLower.includes('cel') || 
               kLower.includes('mobile') || 
               kLower.includes('whats') ||
               kLower.includes('fone');
      });
      
      console.log(`[SyncTiny] 🔍 Buscando telefone para cliente ${cliente.nome}:`, {
        tem_celular: !!cliente.celular,
        valor_celular: cliente.celular,
        tem_telefone: !!cliente.telefone,
        valor_telefone: cliente.telefone,
        tem_mobile: !!cliente.mobile,
        valor_mobile: cliente.mobile,
        tem_whatsapp: !!cliente.whatsapp,
        valor_whatsapp: cliente.whatsapp,
        tem_contatos: !!cliente.contatos,
        contatos_length: Array.isArray(cliente.contatos) ? cliente.contatos.length : 0,
        chaves_telefone: chavesTelefone,
        todas_chaves: Object.keys(cliente),
      });
      
      // Log completo do objeto (limitado para não poluir)
      if (chavesTelefone.length > 0) {
        const valoresTelefone: Record<string, any> = {};
        chavesTelefone.forEach(k => {
          valoresTelefone[k] = cliente[k];
        });
        console.log(`[SyncTiny] 📞 Valores de telefone encontrados:`, valoresTelefone);
      }

      // 1. PRIORIDADE MÁXIMA: Celular direto (campos principais)
      const celularDireto = cliente.celular 
        || cliente.mobile 
        || cliente.whatsapp 
        || cliente.celularAdicional
        || cliente.celularPrincipal
        || null;
      
      if (celularDireto && String(celularDireto).trim() !== '') {
        const celularLimpo = String(celularDireto).trim();
        console.log(`[SyncTiny] ✅ Telefone encontrado (CELULAR DIRETO): ${celularLimpo.substring(0, 15)}...`);
        return celularLimpo;
      }
      
      // 2. PRIORIDADE ALTA: Array de contatos (Tiny ERP pode ter múltiplos contatos)
      if (Array.isArray(cliente.contatos) && cliente.contatos.length > 0) {
        for (const contato of cliente.contatos) {
          // Priorizar celular no array de contatos
          const celularContato = contato.celular 
            || contato.mobile 
            || contato.whatsapp
            || contato.telefoneCelular
            || null;
          
          if (celularContato && String(celularContato).trim() !== '') {
            const celularLimpo = String(celularContato).trim();
            console.log(`[SyncTiny] ✅ Telefone encontrado (CELULAR EM CONTATOS[]): ${celularLimpo.substring(0, 15)}...`);
            return celularLimpo;
          }
        }
        
        // Se não encontrou celular, tentar telefone fixo no array
        for (const contato of cliente.contatos) {
          const telefoneContato = contato.telefone 
            || contato.fone
            || contato.telefonePrincipal
            || null;
          
          if (telefoneContato && String(telefoneContato).trim() !== '') {
            const telefoneLimpo = String(telefoneContato).trim();
            console.log(`[SyncTiny] ✅ Telefone encontrado (FIXO EM CONTATOS[]): ${telefoneLimpo.substring(0, 15)}...`);
            return telefoneLimpo;
          }
        }
      }
      
      // 3. FALLBACK: Telefone fixo direto
      const telefoneFixo = cliente.telefone 
        || cliente.fone 
        || cliente.telefoneAdicional
        || cliente.telefonePrincipal
        || null;
      
      if (telefoneFixo && String(telefoneFixo).trim() !== '') {
        const telefoneLimpo = String(telefoneFixo).trim();
        console.log(`[SyncTiny] ✅ Telefone encontrado (FIXO DIRETO): ${telefoneLimpo.substring(0, 15)}...`);
        return telefoneLimpo;
      }
      
      // 4. FALLBACK: Dados extras (JSONB)
      const telefoneExtras = cliente.dados_extras?.celular
        || cliente.dados_extras?.telefone
        || cliente.dados_extras?.mobile
        || cliente.dados_extras?.whatsapp
        || cliente.dados_extras?.telefoneCelular
        || null;
      
      if (telefoneExtras && String(telefoneExtras).trim() !== '') {
        const telefoneLimpo = String(telefoneExtras).trim();
        console.log(`[SyncTiny] ✅ Telefone encontrado (DADOS_EXTRAS): ${telefoneLimpo.substring(0, 15)}...`);
        return telefoneLimpo;
      }
      
      // 5. FALLBACK FINAL: Verificar se já existe telefone no banco (não sobrescrever com null)
      // Isso evita perder dados que já foram salvos anteriormente
      console.warn(`[SyncTiny] ⚠️ Nenhum telefone encontrado nos dados recebidos para cliente ${cliente.nome}`);
      console.warn(`[SyncTiny] ⚠️ Objeto completo recebido:`, JSON.stringify(cliente).substring(0, 500));
      
      // Retornar null - o upsert não vai sobrescrever se já existir telefone no banco
      return null;
    })();

    const contactData = {
      store_id: storeId,
      tiny_id: cliente.id?.toString() || cpfCnpj || `temp_${Date.now()}`,
      nome: cliente.nome,
      tipo: cliente.tipoPessoa || cliente.tipo || 'F', // API v3 usa tipoPessoa (camelCase)
      cpf_cnpj: cpfCnpj, // Usar o CPF/CNPJ que encontramos acima
      email: cliente.email || null,
      // ✅ SALVAR NA COLUNA TELEFONE (priorizando celular)
      telefone: telefoneFinal, // Celular ou telefone (prioridade para celular)
      celular: null, // Manter null para não duplicar (já está em telefone)
      data_nascimento: dataNascimentoNormalizada,
      endereco: cliente.endereco ? JSON.stringify(cliente.endereco) : null,
      observacoes: cliente.observacoes || null,
      dados_extras: cliente.dados_extras ? JSON.stringify(cliente.dados_extras) : null,
      sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ✅ FASE 1: Fazer upsert e retornar o ID do cliente
    // ⚠️ IMPORTANTE: Se telefoneFinal for null, não sobrescrever telefone existente no banco
    // Verificar se já existe contato com telefone antes de fazer upsert
    let contactDataFinal = { ...contactData };
    
    if (!telefoneFinal) {
      // ✅ ESTRATÉGIA 1: Verificar se já existe telefone no tiny_contacts
      const { data: existingContact } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('telefone, celular')
        .eq('store_id', storeId)
        .eq('tiny_id', contactData.tiny_id)
        .maybeSingle();
      
      if (existingContact && (existingContact.telefone || existingContact.celular)) {
        // Manter telefone existente (não sobrescrever com null)
        contactDataFinal.telefone = existingContact.telefone || existingContact.celular;
        console.log(`[SyncTiny] ✅ Mantendo telefone existente em tiny_contacts: ${contactDataFinal.telefone?.substring(0, 15)}...`);
      } else {
        // ✅ ESTRATÉGIA 2: Buscar telefone em pedidos existentes (tiny_orders.cliente_telefone)
        // Isso é útil para "consumidor final" que não tem cadastro completo
        // Buscar por CPF primeiro (mais preciso), depois por nome
        let pedidoComTelefone = null;
        
        if (contactData.cpf_cnpj) {
          const { data } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('cliente_telefone')
            .eq('store_id', storeId)
            .eq('cliente_cpf_cnpj', contactData.cpf_cnpj)
            .not('cliente_telefone', 'is', null)
            .limit(1)
            .maybeSingle();
          pedidoComTelefone = data;
        }
        
        // Se não encontrou por CPF, tentar por nome
        if (!pedidoComTelefone?.cliente_telefone && contactData.nome) {
          const { data } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('cliente_telefone')
            .eq('store_id', storeId)
            .eq('cliente_nome', contactData.nome)
            .not('cliente_telefone', 'is', null)
            .limit(1)
            .maybeSingle();
          pedidoComTelefone = data;
        }
        
        if (pedidoComTelefone && pedidoComTelefone.cliente_telefone) {
          contactDataFinal.telefone = pedidoComTelefone.cliente_telefone;
          console.log(`[SyncTiny] ✅ Telefone encontrado em pedido existente (tiny_orders): ${contactDataFinal.telefone?.substring(0, 15)}...`);
        } else {
          // ✅ ESTRATÉGIA 3: Buscar telefone mais recente de qualquer pedido do cliente
          // Útil para quando o cliente não tem telefone mas já fez pedidos
          const { data: pedidoMaisRecente } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('cliente_telefone')
            .eq('store_id', storeId)
            .not('cliente_telefone', 'is', null)
            .neq('cliente_telefone', '')
            .or(`cliente_cpf_cnpj.eq.${contactData.cpf_cnpj},cliente_nome.eq.${contactData.nome}`)
            .order('data_pedido', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (pedidoMaisRecente && pedidoMaisRecente.cliente_telefone) {
            contactDataFinal.telefone = pedidoMaisRecente.cliente_telefone;
            console.log(`[SyncTiny] ✅ Telefone encontrado no pedido mais recente: ${contactDataFinal.telefone?.substring(0, 15)}...`);
          }
        }
      }
    }
    
    const { data: contactResult, error: contactError } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_contacts')
      .upsert(contactDataFinal, {
        onConflict: 'store_id,tiny_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (contactError) {
      console.error(`[SyncTiny] ❌ Erro ao sincronizar contato ${cliente.nome}:`, contactError);
      return null;
    }

    if (!contactResult || !contactResult.id) {
      console.warn(`[SyncTiny] ⚠️ Cliente sincronizado mas ID não retornado: ${cliente.nome}`);
      // Tentar buscar o ID pelo tiny_id
      const { data: existingContact } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id')
        .eq('store_id', storeId)
        .eq('tiny_id', contactData.tiny_id)
        .single();

      if (existingContact?.id) {
        console.log(`[SyncTiny] ✅ ID do cliente recuperado: ${existingContact.id.substring(0, 8)}...`);
        return existingContact.id;
      }

      return null;
    }

    console.log(`[SyncTiny] ✅ Cliente sincronizado: ${cliente.nome} → ID: ${contactResult.id.substring(0, 8)}...`);
    return contactResult.id;
  } catch (error: any) {
    console.error(`[SyncTiny] ❌ Erro ao sincronizar contato ${cliente.nome}:`, error);
    return null;
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

    // ✅ ANTES DE PROCESSAR: Popular telefones de pedidos para contatos sem telefone
    console.log(`[SyncTiny] 🔄 Populando telefones de pedidos para contatos sem telefone...`);
    try {
      // Buscar telefones de pedidos e atualizar contatos
      const { data: pedidosComTelefone } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_cpf_cnpj, cliente_nome, cliente_telefone, store_id, data_pedido')
        .eq('store_id', storeId)
        .not('cliente_telefone', 'is', null)
        .neq('cliente_telefone', '');
      
      if (pedidosComTelefone && pedidosComTelefone.length > 0) {
        // Agrupar por cliente e pegar telefone mais recente
        const telefonesPorCliente = new Map<string, { telefone: string; data: string }>();
        
        pedidosComTelefone.forEach(pedido => {
          const key = pedido.cliente_cpf_cnpj || pedido.cliente_nome || '';
          if (key && pedido.cliente_telefone) {
            const existing = telefonesPorCliente.get(key);
            if (!existing || (pedido.data_pedido && (!existing.data || pedido.data_pedido > existing.data))) {
              telefonesPorCliente.set(key, {
                telefone: pedido.cliente_telefone,
                data: pedido.data_pedido || ''
              });
            }
          }
        });
        
        // Atualizar contatos sem telefone
        let atualizados = 0;
        for (const [key, info] of telefonesPorCliente.entries()) {
          const isCPF = /^\d{11,14}$/.test(key.replace(/\D/g, ''));
          
          let query = supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .update({ telefone: info.telefone, updated_at: new Date().toISOString() })
            .eq('store_id', storeId)
            .or(isCPF 
              ? `cpf_cnpj.eq.${key},nome.eq.${key}`
              : `nome.eq.${key}`
            )
            .or('telefone.is.null,telefone.eq.');
          
          const { count } = await query.select('id', { count: 'exact', head: true });
          
          if (count) atualizados += count;
        }
        
        console.log(`[SyncTiny] ✅ ${atualizados} contatos atualizados com telefones de pedidos`);
      }
    } catch (error) {
      console.warn(`[SyncTiny] ⚠️ Erro ao popular telefones:`, error);
    }

    // Processar cada contato
    // Os contatos já vêm diretos em 'itens', não há objeto 'contato' aninhado
    console.log(`[SyncTiny] 📊 Iniciando processamento de ${allContatos.length} contatos coletados de ${totalPages} página(s)...`);
    
    let contadores = {
      total: allContatos.length,
      processados: 0,
      comDetalhesBuscados: 0,
      semId: 0,
      jaCompletos: 0,
      erros: 0,
      fornecedoresDescartados: 0,
    };
    
    for (const contatoData of allContatos) {
      try {
        // ✅ CORREÇÃO BASEADA NA DOCUMENTAÇÃO OFICIAL:
        // A listagem GET /contatos retorna { itens: [...], paginacao: {...} }
        // Cada item em 'itens' JÁ É um contato direto (não há wrapper)
        // contatoData JÁ É o contato diretamente do array itens
        let contato: any = contatoData;
        
        // ✅ VALIDAÇÃO: Verificar se contatoData tem estrutura mínima de contato
        if (!contato || (!contato.id && !contato.nome)) {
          console.warn(`[SyncTiny] ⚠️ Contato inválido na listagem, ignorando:`, JSON.stringify(contatoData).substring(0, 200));
          continue;
        }
        
        // Log para diagnóstico
        if (!contato.nome) {
          console.warn(`[SyncTiny] ⚠️ Contato sem nome (ID: ${contato.id}), ignorando`);
          continue;
        }

        // ✅ FILTRO: Descartar fornecedores - só processar clientes
        // A API do Tiny retorna tipos em um array: tipos: [{ id, descricao: "Cliente" | "Fornecedor" | ... }]
        const tipos = contato.tipos || [];
        const descricoesTipos = tipos.map((t: any) => (t.descricao || '').toLowerCase());
        const isFornecedor = descricoesTipos.some((desc: string) => 
          desc.includes('fornecedor') || 
          desc.includes('supplier') ||
          desc === 'fornecedor' ||
          desc === 'supplier'
        );
        
        // Se for fornecedor, descartar
        if (isFornecedor) {
          contadores.fornecedoresDescartados++;
          if (contadores.fornecedoresDescartados <= 5) {
            console.log(`[SyncTiny] 🚫 Fornecedor descartado: ${contato.nome} (ID: ${contato.id}) - Tipos: ${descricoesTipos.join(', ')}`);
          }
          continue;
        }

        // ✅ CORREÇÃO CRÍTICA: A listagem NÃO retorna telefone, celular ou dataNascimento
        // SEMPRE buscar detalhes completos quando temos o ID do contato
        // A listagem só retorna dados básicos, precisamos GET /contatos/{idContato} para dados completos
        let contatoCompleto = contato;
        
        if (contato.id) {
          // ✅ SIMPLIFICAÇÃO: A listagem SEMPRE retorna telefone/celular/dataNascimento vazios
          // SEMPRE buscar detalhes completos para TODOS os contatos que têm ID
          // Isso garante que sempre temos os dados completos, sem verificar condições
          contadores.comDetalhesBuscados++;
          
          // Log apenas a cada 10 contatos para não poluir o console
          if (contadores.comDetalhesBuscados % 10 === 0 || contadores.comDetalhesBuscados <= 5) {
            console.log(`[SyncTiny] 🔍 [${contadores.comDetalhesBuscados}/${contadores.total}] Buscando detalhes completos para ${contato.nome} (ID: ${contato.id})...`);
          }
          
          try {
            const contatoDetalhado = await fetchContatoCompletoFromTiny(storeId, contato.id);
            if (contatoDetalhado) {
              // Mesclar dados: priorizar detalhes completos, manter dados da listagem como fallback
              contatoCompleto = {
                ...contato,
                ...contatoDetalhado,
                // Garantir que não perdemos o ID e dados importantes da listagem
                id: contato.id,
                nome: contatoDetalhado.nome || contato.nome,
                cpfCnpj: contatoDetalhado.cpfCnpj || contato.cpfCnpj,
              };
              
              // Log apenas para os primeiros 5 ou quando encontrar dados importantes
              if (contadores.comDetalhesBuscados <= 5 || contatoCompleto.celular || contatoCompleto.telefone || contatoCompleto.dataNascimento) {
                console.log(`[SyncTiny] ✅ Detalhes completos obtidos para ${contato.nome}:`, {
                  tem_telefone: !!contatoCompleto.telefone,
                  valor_telefone: contatoCompleto.telefone,
                  tem_celular: !!contatoCompleto.celular,
                  valor_celular: contatoCompleto.celular,
                  tem_dataNascimento: !!contatoCompleto.dataNascimento,
                  valor_dataNascimento: contatoCompleto.dataNascimento,
                });
              }
            } else {
              if (contadores.comDetalhesBuscados <= 5) {
                console.warn(`[SyncTiny] ⚠️ Não foi possível obter detalhes completos de ${contato.nome} (ID: ${contato.id})`);
              }
            }
          } catch (error) {
            contadores.erros++;
            if (contadores.comDetalhesBuscados <= 5) {
              console.warn(`[SyncTiny] ⚠️ Erro ao buscar detalhes completos de ${contato.nome}:`, error);
            }
            // Continuar com dados da listagem mesmo se falhar
          }
        } else {
          contadores.semId++;
          if (contadores.semId <= 5) {
            console.warn(`[SyncTiny] ⚠️ Contato ${contato.nome} não tem ID, não é possível buscar detalhes completos`);
          }
        }
        
        contadores.processados++;
        
        // Log de progresso a cada 50 contatos
        if (contadores.processados % 50 === 0) {
          console.log(`[SyncTiny] 📊 Progresso: ${contadores.processados}/${contadores.total} contatos processados | ${contadores.comDetalhesBuscados} com busca de detalhes | ${contadores.jaCompletos} já completos | ${contadores.semId} sem ID | ${contadores.fornecedoresDescartados} fornecedores descartados`);
        }

        // Log detalhado para diagnóstico (DEPOIS de buscar detalhes se necessário)
        console.log(`[SyncTiny] 📋 Processando contato FINAL: ${contatoCompleto.nome}`, {
          id: contatoCompleto.id,
          tem_celular: !!contatoCompleto.celular,
          valor_celular: contatoCompleto.celular,
          tem_telefone: !!contatoCompleto.telefone,
          valor_telefone: contatoCompleto.telefone,
          tem_dataNascimento: !!contatoCompleto.dataNascimento,
          valor_dataNascimento: contatoCompleto.dataNascimento,
          tem_contatos_array: Array.isArray(contatoCompleto.contatos),
          contatos_length: Array.isArray(contatoCompleto.contatos) ? contatoCompleto.contatos.length : 0,
          chaves_telefone: Object.keys(contatoCompleto).filter(k => 
            k.toLowerCase().includes('tel') || 
            k.toLowerCase().includes('cel') || 
            k.toLowerCase().includes('mobile') ||
            k.toLowerCase().includes('nasc')
          ),
        });

        // Verificar se já existe
        const { data: existing } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('id, telefone, celular')
          .eq('store_id', storeId)
          .eq('tiny_id', String(contatoCompleto.id || contatoCompleto.cpfCnpj || contatoCompleto.cpf_cnpj || `temp_${Date.now()}`))
          .maybeSingle();

        // Se já existe e tem telefone, logar para diagnóstico
        if (existing && (existing.telefone || existing.celular)) {
          console.log(`[SyncTiny] ℹ️ Contato já existe com telefone: ${existing.telefone || existing.celular}`);
        }

        await syncTinyContact(storeId, contatoCompleto);

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

    // ✅ Log final com estatísticas completas
    console.log(`[SyncTiny] 📊 Sincronização de contatos concluída:`, {
      total_recebidos: contadores.total,
      processados: contadores.processados,
      com_detalhes_buscados: contadores.comDetalhesBuscados,
      ja_completos: contadores.jaCompletos,
      sem_id: contadores.semId,
      fornecedores_descartados: contadores.fornecedoresDescartados,
      erros: contadores.erros,
      sincronizados: synced,
      atualizados: updated,
      tempo_execucao: `${(executionTime / 1000).toFixed(1)}s`,
    });

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
