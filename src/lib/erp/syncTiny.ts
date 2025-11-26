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
  pedido: {
    id: string;
    numero: string;
    numero_ecommerce?: string;
    situacao: string;
    data_pedido: string;
    data_prevista?: string;
    cliente: {
      nome: string;
      tipo: string; // 'F' ou 'J'
      cpf_cnpj?: string;
      email?: string;
      fone?: string;
      celular?: string;
      endereco?: any;
    };
    valor_total: string;
    valor_desconto?: string;
    valor_frete?: string;
    forma_pagamento?: string;
    forma_envio?: string;
    endereco_entrega?: any;
    itens: Array<{
      item: {
        codigo?: string;
        descricao: string;
        quantidade: string;
        valor_unitario: string;
        valor_total: string;
        categoria?: string;
        subcategoria?: string;
        dados_extras?: any;
      };
    }>;
    observacoes?: string;
    vendedor?: {
      id?: string;
      nome?: string;
      email?: string;
      cpf?: string; // CPF pode vir direto no vendedor
      dados_extras?: any;
    };
    dados_extras?: any;
  };
}

interface TinyContato {
  contato: {
    id: string;
    nome: string;
    tipo: string; // 'F' ou 'J'
    cpf_cnpj?: string;
    email?: string;
    fone?: string;
    celular?: string;
    endereco?: any;
    observacoes?: string;
    dados_extras?: any;
  };
}

/**
 * Busca colaboradora no sistema pelo vendedor do Tiny
 * Tenta matching por: CPF (prioritário), email e nome
 * 
 * CPF está disponível no cadastro do Tiny e no profile do sistema
 */
async function findCollaboratorByVendedor(
  storeId: string,
  vendedor: { id?: string; nome?: string; email?: string; cpf?: string }
): Promise<string | null> {
  if (!vendedor.nome && !vendedor.email && !vendedor.cpf) {
    return null;
  }

  try {
    // Normalizar CPF (remover caracteres especiais)
    const normalizeCPF = (cpf: string | undefined) => {
      if (!cpf) return null;
      return cpf.replace(/\D/g, '');
    };

    const normalizedCPF = normalizeCPF(vendedor.cpf);

    // Buscar colaboradoras da loja
    const { data: colaboradoras, error } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, cpf, store_id')
      .eq('role', 'COLABORADORA')
      .eq('active', true)
      .eq('store_id', storeId);

    if (error || !colaboradoras || colaboradoras.length === 0) {
      return null;
    }

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
    if (vendedor.email) {
      const matchByEmail = colaboradoras.find(
        (colab) => colab.email && colab.email.toLowerCase() === vendedor.email?.toLowerCase()
      );
      if (matchByEmail) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por email: ${matchByEmail.name} (${matchByEmail.id})`);
        return matchByEmail.id;
      }
    }

    // Tentar matching por nome (última opção, menos confiável)
    if (vendedor.nome) {
      const normalizeName = (name: string) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .trim();
      };

      const normalizedVendedorNome = normalizeName(vendedor.nome);
      const matchByName = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        return normalizedColabNome === normalizedVendedorNome;
      });

      if (matchByName) {
        console.log(`[SyncTiny] ✅ Vendedora encontrada por nome: ${matchByName.name} (${matchByName.id})`);
        return matchByName.id;
      }
    }

    console.log(`[SyncTiny] ⚠️ Vendedora não encontrada: ${vendedor.nome || vendedor.email || vendedor.cpf || 'N/A'}`);
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
        // Situacao numérica: 3 = Faturado (conforme documentação Tiny)
        return situacao === 3;
      } else if (typeof situacao === 'string') {
        // Situacao string: verificar se contém "faturado"
        const situacaoLower = situacao.toLowerCase();
        return situacaoLower.includes('faturado') || situacaoLower === 'faturado';
      }
      
      // Se não tiver situacao, aceitar (pode ser que venha de outra forma)
      return true;
    });

    console.log(`[SyncTiny] Total de pedidos recebidos: ${allPedidos.length}, Faturados: ${pedidosFaturados.length}`);

    for (const pedidoData of pedidosFaturados) {
      try {
        const pedido = pedidoData.pedido || pedidoData;
        const cliente = pedido.cliente || {};

        // Extrair TODOS os dados possíveis dos produtos para relatórios inteligentes
        const itensComCategorias = pedido.itens?.map((item: any) => {
          const itemData = item.item || item;
          const produto = itemData.produto || {};
          
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
          
          // Extrair código do produto
          const codigo = itemData.codigo
            || produto.codigo
            || produto.codigo_produto
            || itemData.sku
            || produto.sku
            || null;
          
          // Extrair descrição completa
          const descricao = itemData.descricao
            || produto.descricao
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
        if (pedido.vendedor) {
          // Buscar CPF do vendedor - pode estar em vários lugares conforme documentação
          const vendedorCPF = pedido.vendedor.cpf
            || pedido.vendedor.dados_extras?.cpf 
            || pedido.vendedor.dados_extras?.cpf_cnpj
            || pedido.dados_extras?.vendedor_cpf
            || null;

          colaboradoraId = await findCollaboratorByVendedor(storeId, {
            id: pedido.vendedor.id,
            nome: pedido.vendedor.nome,
            email: pedido.vendedor.email,
            cpf: vendedorCPF,
          });
        }

        // Preparar dados do pedido
        const tinyId = String(pedido.id || pedido.numero || `temp_${Date.now()}`);
        ultimoTinyIdProcessado = tinyId; // Atualizar último ID processado
        
        const orderData = {
          store_id: storeId,
          tiny_id: tinyId,
          numero_pedido: pedido.numero?.toString() || null,
          numero_ecommerce: pedido.numero_ecommerce?.toString() || null,
          situacao: pedido.situacao || null,
          data_pedido: pedido.data_pedido 
            ? (pedido.data_pedido.includes('T') ? pedido.data_pedido : `${pedido.data_pedido}T00:00:00`)
            : null,
          data_prevista: pedido.data_prevista 
            ? (pedido.data_prevista.includes('T') ? pedido.data_prevista : `${pedido.data_prevista}T00:00:00`)
            : null,
          cliente_nome: cliente.nome || null,
          cliente_cpf_cnpj: cliente.cpf_cnpj || null,
          cliente_email: cliente.email || null,
          cliente_telefone: cliente.fone || cliente.celular || null,
          valor_total: parseFloat(String(pedido.valor_total || '0').replace(',', '.')),
          valor_desconto: parseFloat(String(pedido.valor_desconto || '0').replace(',', '.')),
          valor_frete: parseFloat(String(pedido.valor_frete || '0').replace(',', '.')),
          forma_pagamento: pedido.forma_pagamento || null,
          forma_envio: pedido.forma_envio || null,
          endereco_entrega: pedido.endereco_entrega ? JSON.stringify(pedido.endereco_entrega) : null,
          itens: JSON.stringify(itensComCategorias),
          observacoes: pedido.observacoes || null,
          vendedor_nome: pedido.vendedor?.nome || null,
          vendedor_tiny_id: pedido.vendedor?.id?.toString() || null,
          colaboradora_id: colaboradoraId,
          dados_extras: pedido.dados_extras ? JSON.stringify(pedido.dados_extras) : null,
          sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Verificar se pedido já existe
        const { data: existingOrder } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('id')
          .eq('store_id', storeId)
          .eq('tiny_id', orderData.tiny_id)
          .maybeSingle();

        // Upsert pedido (insert ou update se já existir)
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert(orderData, {
            onConflict: 'store_id,tiny_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Erro ao salvar pedido ${orderData.tiny_id}:`, error);
          errors++;
          errorDetails.push(`Pedido ${orderData.numero_pedido || orderData.tiny_id}: ${error.message}`);
        } else {
          if (existingOrder) {
            updated++;
          } else {
            synced++;
          }

          // Sincronizar cliente também
          if (cliente.nome) {
            await syncTinyContact(storeId, cliente, orderData.tiny_id);
          }
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

    const contactData = {
      store_id: storeId,
      tiny_id: cliente.id?.toString() || cliente.cpf_cnpj || `temp_${Date.now()}`,
      nome: cliente.nome,
      tipo: cliente.tipo || 'F',
      cpf_cnpj: cliente.cpf_cnpj || null,
      email: cliente.email || null,
      telefone: cliente.fone || null,
      celular: cliente.celular || null,
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
