/**
 * Helper para enviar mensagens WhatsApp
 */

import { type FormaPagamento } from './payment-validation';

interface SendWhatsAppParams {
  phone: string;
  message: string;
  store_id?: string; // MULTI-TENANCY: Se fornecido, usa credenciais da loja
}

interface SendWhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
  credentials_source?: string; // Indica se usou credenciais da loja ou global
}

/**
 * Envia mensagem WhatsApp via função Netlify
 * 
 * MULTI-TENANCY:
 * - Se store_id for fornecido e a loja tiver WhatsApp configurado, usa as credenciais da loja
 * - Caso contrário, usa as credenciais globais (variáveis de ambiente)
 */
export async function sendWhatsAppMessage({
  phone,
  message,
  store_id,
}: SendWhatsAppParams): Promise<SendWhatsAppResponse> {
  try {
    console.log('📱 [sendWhatsAppMessage] Iniciando envio de WhatsApp...');
    console.log('📱 [sendWhatsAppMessage] Telefone:', phone);
    console.log('📱 [sendWhatsAppMessage] Store ID:', store_id || 'não fornecido (usará global)');
    console.log('📱 [sendWhatsAppMessage] Mensagem (primeiros 100 chars):', message.substring(0, 100));

    // Detectar se está em desenvolvimento ou produção
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment
      ? 'http://localhost:8888' // Netlify Dev local
      : window.location.origin; // Produção

    const functionUrl = `${baseUrl}/.netlify/functions/send-whatsapp-message`;
    console.log('📱 [sendWhatsAppMessage] URL da função Netlify:', functionUrl);
    console.log('📱 [sendWhatsAppMessage] Ambiente:', isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

    const payload: { phone: string; message: string; store_id?: string } = {
      phone,
      message,
    };

    // Adicionar store_id se fornecido (para multi-tenancy)
    if (store_id) {
      payload.store_id = store_id;
    }

    console.log('📱 [sendWhatsAppMessage] Enviando requisição para Netlify Function...');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📱 [sendWhatsAppMessage] Resposta recebida. Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📱 [sendWhatsAppMessage] Dados da resposta:', data);

    if (!response.ok) {
      console.error('📱 [sendWhatsAppMessage] ❌ Erro na resposta:', data);
      throw new Error(data.error || 'Erro ao enviar mensagem WhatsApp');
    }

    console.log('📱 [sendWhatsAppMessage] ✅ Mensagem enviada com sucesso!');
    console.log('📱 [sendWhatsAppMessage] Fonte das credenciais:', data.credentials_source || 'não informada');
    return data;
  } catch (error: any) {
    console.error('📱 [sendWhatsAppMessage] ❌ Erro ao enviar mensagem WhatsApp:', error);
    console.error('📱 [sendWhatsAppMessage] Stack:', error.stack);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Formata mensagem de venda lançada (notificação para administrador)
 */
export function formatVendaMessage(params: {
  colaboradoraName: string;
  valor: number;
  qtdPecas: number;
  storeName?: string;
  dataVenda?: string;
  observacoes?: string | null;
  totalDia?: number;
  totalMes?: number;
  formasPagamento?: FormaPagamento[];
  clienteNome?: string | null; // Nome do cliente (se não for Consumidor Final)
}): string {
  const { colaboradoraName, valor, qtdPecas, storeName, dataVenda, observacoes, totalDia, totalMes, formasPagamento, clienteNome } = params;

  const dataFormatada = dataVenda
    ? new Date(dataVenda).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'hoje';

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  // Formatar mensagem com quebras de linha usando \n
  // A Netlify Function vai escapar corretamente a mensagem antes de enviar para o n8n
  // Isso permite que o n8n use {{ $json.message }} sem quebrar o JSON
  let message = `🛒 *Nova Venda Lançada*\n\n`;

  message += `*Colaboradora:* ${colaboradoraName}\n`;

  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }

  message += `*Valor:* ${valorFormatado}\n`;
  message += `*Quantidade de Peças:* ${qtdPecas}\n`;

  // Adicionar cliente se fornecido e não for Consumidor Final
  if (clienteNome && clienteNome.trim() && clienteNome !== 'Consumidor Final' && clienteNome !== 'CONSUMIDOR_FINAL') {
    message += `*Cliente:* ${clienteNome.trim()}\n`;
  }

  // Adicionar formas de pagamento se disponíveis
  if (formasPagamento && formasPagamento.length > 0) {
    const formasTexto = formasPagamento.map(f => {
      let texto = `${f.tipo}: ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(f.valor)}`;
      if (f.tipo === 'CREDITO' && f.parcelas) {
        texto += ` (${f.parcelas}x)`;
      }
      return texto;
    }).join(' | ');
    message += `*Formas de Pagamento:* ${formasTexto}\n`;
  }

  message += `*Data:* ${dataFormatada}\n`;

  // Adicionar totais se disponíveis (sempre incluir se fornecido, mesmo se for 0)
  if (totalDia !== undefined && totalDia !== null) {
    const totalDiaFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalDia);
    message += `*Total Vendido (Hoje):* ${totalDiaFormatado}\n`;
  }

  if (totalMes !== undefined && totalMes !== null) {
    const totalMesFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalMes);
    message += `*Total Mês:* ${totalMesFormatado}\n`;
  }

  // Adicionar observações se houver
  if (observacoes && observacoes.trim()) {
    message += `\n*Observações:*\n${observacoes.trim()}\n`;
  }

  message += `\nSistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de solicitação de adiantamento (notificação para administrador)
 */
export function formatAdiantamentoMessage(params: {
  colaboradoraName: string;
  valor: number;
  mesCompetencia: string;
  observacoes?: string | null;
  storeName?: string;
}): string {
  const { colaboradoraName, valor, mesCompetencia, observacoes, storeName } = params;

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  // Formatar mês de competência (YYYYMM -> MM/YYYY)
  const mes = mesCompetencia.slice(4, 6);
  const ano = mesCompetencia.slice(0, 4);
  const mesFormatado = `${mes}/${ano}`;

  // Formatar data/hora atual
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let message = `💰 *Nova Solicitação de Adiantamento*\n\n`;

  message += `*Colaboradora:* ${colaboradoraName}\n`;

  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }

  message += `*Valor Solicitado:* ${valorFormatado}\n`;
  message += `*Mês de Competência:* ${mesFormatado}\n`;
  message += `*Data da Solicitação:* ${dataAtual}\n`;

  if (observacoes && observacoes.trim()) {
    message += `\n*Observações:*\n${observacoes.trim()}\n`;
  }

  message += `\nSistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de parabéns após venda (notificação para loja/colaboradora)
 */
export function formatParabensMessage(params: {
  colaboradoraName: string;
  valor: number;
  storeName?: string;
}): string {
  const { colaboradoraName, valor } = params;

  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  let message = `🎉 *Parabéns!*\n\n`;
  message += `Parabéns, ${primeiroNome}! 🎊\n\n`;
  message += `Você acabou de realizar uma venda de ${valorFormatado}!\n\n`;
  message += `Continue assim! Estamos muito orgulhosos do seu trabalho. 💪\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de nova gincana semanal (notificação para colaboradora)
 * Formato consolidado: GINCANA SEMANAL LANÇADA PARA VOCÊ - LOJA X
 */
export function formatGincanaMessage(params: {
  colaboradoraName: string;
  storeName: string;
  semanaReferencia: string; // WWYYYY
  metaValor: number;
  superMetaValor: number | null;
  dataInicio: string; // Data de início da semana (formato: DD/MM/YYYY)
  dataFim: string; // Data de fim da semana (formato: DD/MM/YYYY)
  premioCheckpoint1?: string | null; // Prêmio checkpoint 1 (gincana semanal)
  premioCheckpointFinal?: string | null; // Prêmio checkpoint final (super gincana)
}): string {
  const { colaboradoraName, storeName, semanaReferencia, metaValor, superMetaValor, dataInicio, dataFim, premioCheckpoint1, premioCheckpointFinal } = params;

  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];

  // Formatar valores monetários
  const metaFormatada = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(metaValor);

  const superMetaFormatada = superMetaValor
    ? new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(superMetaValor)
    : null;

  // Formatar prêmios
  const premioCheckpoint1Formatado = premioCheckpoint1 ? premioCheckpoint1.trim() : null;
  const premioCheckpointFinalFormatado = premioCheckpointFinal ? premioCheckpointFinal.trim() : null;

  // Formato consolidado solicitado
  let message = `*GINCANA SEMANAL LANÇADA PARA VOCÊ - ${storeName.toUpperCase()}*\n\n`;
  message += `${primeiroNome}, VOCÊ TEM NOVA GINCANA SEMANAL LANÇADA PARA VOCÊ\n\n`;
  message += `*GINCANA SEMANAL - DE ${dataInicio} ATÉ ${dataFim}*\n\n`;
  message += `VALOR META GINCANA SEMANAL ${metaFormatada}`;
  if (premioCheckpoint1Formatado) {
    message += ` PREMIO ${premioCheckpoint1Formatado}`;
  }
  message += `\n`;

  if (superMetaFormatada) {
    message += `VALOR META SUPER GINCANA SEMANAL ${superMetaFormatada}`;
    if (premioCheckpointFinalFormatado) {
      message += ` PREMIO ${premioCheckpointFinalFormatado}`;
    }
    message += `\n`;
  }

  message += `\nBOA SORTE E BOAS VENDAS!`;

  return message;
}

/**
 * Formata mensagem de novo bônus criado (notificação para colaboradora)
 */
export function formatBonusMessage(params: {
  colaboradoraName: string;
  bonusName: string;
  bonusDescription?: string | null;
  valorBonus?: number | null;
  valorBonusTexto?: string | null;
  storeName?: string;
  preRequisitos?: string[] | null; // Array de pré-requisitos
  // Prêmios por posição (Top 1, 2, 3)
  valorBonus1?: number | null;
  valorBonus2?: number | null;
  valorBonus3?: number | null;
  valorBonusTexto1?: string | null;
  valorBonusTexto2?: string | null;
  valorBonusTexto3?: string | null;
  condicaoRanking?: number | null; // 1, 2 ou 3 - indica quantas posições há prêmios
}): string {
  const {
    colaboradoraName,
    bonusName,
    bonusDescription,
    valorBonus,
    valorBonusTexto,
    storeName,
    preRequisitos,
    valorBonus1,
    valorBonus2,
    valorBonus3,
    valorBonusTexto1,
    valorBonusTexto2,
    valorBonusTexto3,
    condicaoRanking
  } = params;

  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];

  // Verificar se há prêmios por posição (Top 1, 2, 3)
  const temPremiosPorPosicao = condicaoRanking && condicaoRanking > 0 && (
    (valorBonus1 !== null && valorBonus1 !== undefined && valorBonus1 > 0) ||
    (valorBonusTexto1 && valorBonusTexto1.trim()) ||
    (valorBonus2 !== null && valorBonus2 !== undefined && valorBonus2 > 0) ||
    (valorBonusTexto2 && valorBonusTexto2.trim()) ||
    (valorBonus3 !== null && valorBonus3 !== undefined && valorBonus3 > 0) ||
    (valorBonusTexto3 && valorBonusTexto3.trim())
  );

  let message = `🎁 *Novo Bônus Disponível!*\n\n`;
  message += `Olá, ${primeiroNome}!\n\n`;
  message += `Um novo bônus foi criado para você:\n\n`;
  message += `*Bônus:* ${bonusName}\n`;

  if (bonusDescription && bonusDescription.trim()) {
    message += `*Descrição:* ${bonusDescription.trim()}\n`;
  }

  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }

  // Se houver prêmios por posição, mostrar todos os prêmios disponíveis
  if (temPremiosPorPosicao) {
    message += `\n*Prêmios por Posição:*\n`;

    // Top 1
    if ((valorBonus1 !== null && valorBonus1 !== undefined && valorBonus1 > 0) || (valorBonusTexto1 && valorBonusTexto1.trim())) {
      let premio1 = '';
      if (valorBonusTexto1 && valorBonusTexto1.trim()) {
        premio1 = valorBonusTexto1.trim();
      } else if (valorBonus1 && valorBonus1 > 0) {
        premio1 = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(valorBonus1);
      }
      if (premio1) {
        message += `🥇 *1º Lugar:* ${premio1}\n`;
      }
    }

    // Top 2
    if (condicaoRanking && condicaoRanking >= 2) {
      if ((valorBonus2 !== null && valorBonus2 !== undefined && valorBonus2 > 0) || (valorBonusTexto2 && valorBonusTexto2.trim())) {
        let premio2 = '';
        if (valorBonusTexto2 && valorBonusTexto2.trim()) {
          premio2 = valorBonusTexto2.trim();
        } else if (valorBonus2 && valorBonus2 > 0) {
          premio2 = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(valorBonus2);
        }
        if (premio2) {
          message += `🥈 *2º Lugar:* ${premio2}\n`;
        }
      }
    }

    // Top 3
    if (condicaoRanking && condicaoRanking >= 3) {
      if ((valorBonus3 !== null && valorBonus3 !== undefined && valorBonus3 > 0) || (valorBonusTexto3 && valorBonusTexto3.trim())) {
        let premio3 = '';
        if (valorBonusTexto3 && valorBonusTexto3.trim()) {
          premio3 = valorBonusTexto3.trim();
        } else if (valorBonus3 && valorBonus3 > 0) {
          premio3 = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(valorBonus3);
        }
        if (premio3) {
          message += `🥉 *3º Lugar:* ${premio3}\n`;
        }
      }
    }
  } else {
    // Prêmio único (comportamento antigo)
    let valorFormatado = '';
    if (valorBonusTexto) {
      valorFormatado = valorBonusTexto;
    } else if (valorBonus && valorBonus > 0) {
      valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valorBonus);
    }

    if (valorFormatado) {
      message += `*Valor:* ${valorFormatado}\n`;
    }
  }

  // Adicionar pré-requisitos se houver (array de pré-requisitos)
  if (preRequisitos && preRequisitos.length > 0) {
    const preRequisitosFiltrados = preRequisitos.filter(pr => pr && pr.trim()).map(pr => pr.trim());
    if (preRequisitosFiltrados.length > 0) {
      message += `\n*Pré-requisitos:*\n`;
      preRequisitosFiltrados.forEach((pr, index) => {
        message += `${index + 1}. ${pr}\n`;
      });
    }
  }

  message += `\nBoa sorte! 💪\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de cashback gerado (notificação para cliente)
 */
export function formatCashbackMessage(params: {
  clienteNome: string;
  storeName: string;
  cashbackAmount: number;
  dataExpiracao: string;
  percentualUsoMaximo: number;
  saldoAtual?: number; // Opcional - não será mais exibido
}): string {
  const { clienteNome, storeName, cashbackAmount, dataExpiracao, percentualUsoMaximo } = params;

  // Extrair apenas o primeiro nome
  const primeiroNome = clienteNome.split(' ')[0];

  // Formatar valores monetários
  const cashbackFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cashbackAmount);

  // Formatar data de expiração
  const dataExpiracaoFormatada = new Date(dataExpiracao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Formatar percentual de uso máximo
  const percentualFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(percentualUsoMaximo / 100);

  let message = `🎁 *Cashback Gerado!*\n\n`;
  message += `${primeiroNome},\n\n`;
  message += `Obrigado pela sua compra na ${storeName}, nós somos muito gratos por ter você como nossa cliente.\n\n`;
  message += `Você gerou ${cashbackFormatado} de cashback para você utilizar em nossa loja.\n\n`;
  message += `Esse cashback é válido até o dia ${dataExpiracaoFormatada} e você poderá cobrir até ${percentualFormatado} do valor da sua próxima compra.\n\n`;
  message += `Com carinho,\n${storeName}\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

// =====================================================
// WhatsApp Status API Helper (via Netlify Function proxy)
// =====================================================

const getStatusEndpoint = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('eleveaone.com')) {
    return 'https://eleveaone.com.br/.netlify/functions/whatsapp-status';
  }
  return '/.netlify/functions/whatsapp-status';
};

const getConnectEndpoint = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('eleveaone.com')) {
    return 'https://eleveaone.com.br/.netlify/functions/whatsapp-connect';
  }
  return '/.netlify/functions/whatsapp-connect';
};

export interface WhatsAppStatusResponse {
  success: boolean;
  ok: boolean;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_required' | 'error';
  qrCode: string | null;
  instanceId: string | null;
  phoneNumber: string | null;
  token: string | null;
}

export interface FetchStatusParams {
  siteSlug: string;
  customerId: string;
}

/**
 * Fetch WhatsApp connection status from N8N endpoint
 */
/**
 * Busca status de WhatsApp para número reserva (aceita whatsapp_account_id)
 */
export async function fetchBackupWhatsAppStatus(params: FetchStatusParams & { whatsapp_account_id?: string }): Promise<WhatsAppStatusResponse> {
  const { siteSlug, customerId, whatsapp_account_id } = params;
  
  if (!siteSlug || !customerId) {
    return {
      success: false,
      ok: false,
      connected: false,
      status: 'error',
      qrCode: null,
      instanceId: null,
      phoneNumber: null,
      token: null,
    };
  }

  try {
    const endpoint = getStatusEndpoint();
    let url = `${endpoint}?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(customerId)}`;
    
    // Se whatsapp_account_id fornecido, adicionar à URL
    if (whatsapp_account_id) {
      url += `&whatsapp_account_id=${encodeURIComponent(whatsapp_account_id)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WhatsApp] Status (backup):', data);
    
    return {
      success: data.success ?? true,
      ok: data.ok ?? true,
      connected: data.connected ?? false,
      status: data.status || 'disconnected',
      qrCode: data.qrCode || null,
      instanceId: data.instanceId || null,
      phoneNumber: data.phoneNumber || null,
      token: data.token || null,
    };
  } catch (error: any) {
    console.error('Erro ao buscar status WhatsApp (backup):', error);
    return {
      success: false,
      ok: false,
      connected: false,
      status: 'error',
      qrCode: null,
      instanceId: null,
      phoneNumber: null,
      token: null,
    };
  }
}

export async function fetchWhatsAppStatus(params: FetchStatusParams): Promise<WhatsAppStatusResponse> {
  const { siteSlug, customerId } = params;
  
  if (!siteSlug || !customerId) {
    return {
      success: false,
      ok: false,
      connected: false,
      status: 'error',
      qrCode: null,
      instanceId: null,
      phoneNumber: null,
      token: null,
    };
  }

  try {
    const endpoint = getStatusEndpoint();
    const url = `${endpoint}?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(customerId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    
    // Normalizar resposta
    return {
      success: data.success ?? true,
      ok: data.ok ?? true,
      connected: data.connected ?? false,
      status: normalizeWhatsAppStatus(data.status, data.connected, data.qrCode),
      qrCode: data.qrCode || null,
      instanceId: data.instanceId || null,
      phoneNumber: data.phoneNumber || null,
      token: data.token || data.uazapi_token || null,
    };
  } catch (error) {
    console.error('Erro ao verificar status WhatsApp:', error);
    return {
      success: false,
      ok: false,
      connected: false,
      status: 'error',
      qrCode: null,
      instanceId: null,
      phoneNumber: null,
      token: null,
    };
  }
}

/**
 * Normaliza status baseado em multiplos indicadores
 */
function normalizeWhatsAppStatus(
  rawStatus: string | undefined, 
  connected: boolean, 
  qrCode: string | null
): WhatsAppStatusResponse['status'] {
  // Se tem QR code, precisa escanear
  if (qrCode && !connected) {
    return 'qr_required';
  }
  
  // Se esta conectado
  if (connected) {
    return 'connected';
  }
  
  // Mapear status raw
  const statusLower = (rawStatus || '').toLowerCase();
  
  if (statusLower === 'connected' || statusLower === 'open') {
    return 'connected';
  }
  
  if (statusLower === 'connecting' || statusLower === 'loading') {
    return 'connecting';
  }
  
  if (statusLower === 'error' || statusLower === 'failed') {
    return 'error';
  }
  
  return 'disconnected';
}

/**
 * Verifica se o status e terminal (nao precisa mais polling)
 */
export function isTerminalStatus(status: WhatsAppStatusResponse['status']): boolean {
  return status === 'connected' || status === 'error';
}

export interface WhatsAppConnectResponse {
  success: boolean;
  qrCode: string | null;
  instanceId: string | null;
  status: string;
  message: string | null;
  error?: string;
}

/**
 * Iniciar conexao WhatsApp e gerar QR Code
 */
/**
 * Conecta WhatsApp para número reserva (aceita whatsapp_account_id)
 */
export async function connectBackupWhatsApp(params: FetchStatusParams & { whatsapp_account_id?: string }): Promise<WhatsAppConnectResponse> {
  const { siteSlug, customerId, whatsapp_account_id } = params;
  
  if (!siteSlug || !customerId) {
    return {
      success: false,
      qrCode: null,
      instanceId: null,
      status: 'error',
      message: 'Parametros invalidos',
      error: 'Missing siteSlug or customerId',
    };
  }

  try {
    const endpoint = getConnectEndpoint();
    let url = `${endpoint}?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(customerId)}`;
    
    // Se whatsapp_account_id fornecido, adicionar à URL
    if (whatsapp_account_id) {
      url += `&whatsapp_account_id=${encodeURIComponent(whatsapp_account_id)}`;
    }

    console.log('[WhatsApp] Iniciando conexao (backup):', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WhatsApp] Resposta conexao (backup):', data);
    
    return {
      success: data.success ?? false,
      qrCode: data.qrCode || null,
      instanceId: data.instanceId || null,
      status: data.status || 'connecting',
      message: data.message || null,
      error: data.error || undefined,
    };
  } catch (error: any) {
    console.error('Erro ao conectar WhatsApp (backup):', error);
    return {
      success: false,
      qrCode: null,
      instanceId: null,
      status: 'error',
      message: 'Erro ao conectar',
      error: error.message,
    };
  }
}

export async function connectWhatsApp(params: FetchStatusParams): Promise<WhatsAppConnectResponse> {
  const { siteSlug, customerId } = params;
  
  if (!siteSlug || !customerId) {
    return {
      success: false,
      qrCode: null,
      instanceId: null,
      status: 'error',
      message: 'Parametros invalidos',
      error: 'Missing siteSlug or customerId',
    };
  }

  try {
    const endpoint = getConnectEndpoint();
    const url = `${endpoint}?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(customerId)}`;

    console.log('[WhatsApp] Iniciando conexao:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[WhatsApp] Resposta conexao:', data);
    
    return {
      success: data.success ?? false,
      qrCode: data.qrCode || null,
      instanceId: data.instanceId || null,
      status: data.status || 'connecting',
      message: data.message || null,
      error: data.error || undefined,
    };
  } catch (error: any) {
    console.error('Erro ao conectar WhatsApp:', error);
    return {
      success: false,
      qrCode: null,
      instanceId: null,
      status: 'error',
      message: 'Erro ao conectar',
      error: error.message,
    };
  }
}

/**
 * Formata mensagem de abertura de caixa (notificação WhatsApp)
 */
export function formatAberturaCaixaMessage(params: {
  storeName: string;
  dataAbertura: string;
  dinheiroCaixa: number;
  metaDia: number;
  metaMes: number;
  vendidoMes: number;
  faltaMes: number;
  diasRestantes: number;
  metasColaboradoras?: { nome: string; metaDiaria: number }[];
  observacoes?: string;
  colaboradoraResponsavel?: string;
}): string {
  const {
    storeName,
    dataAbertura,
    dinheiroCaixa,
    metaDia,
    metaMes,
    vendidoMes,
    faltaMes,
    diasRestantes,
    metasColaboradoras,
    observacoes,
    colaboradoraResponsavel,
  } = params;

  const dataFormatada = new Date(dataAbertura).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const horaFormatada = new Date(dataAbertura).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatarValor = (valor: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);

  let message = `*ABERTURA DE CAIXA - ${dataFormatada}*\n`;
  message += `${storeName.toUpperCase()}\n`;
  message += `Horário: ${horaFormatada}\n`;
  if (colaboradoraResponsavel) {
    message += `*Responsável:* ${colaboradoraResponsavel}\n`;
  }
  message += `\n`;

  message += `*Dinheiro em Caixa:* ${formatarValor(dinheiroCaixa)}\n\n`;

  message += `*META DO MÊS*\n`;
  message += `Meta: ${formatarValor(metaMes)}\n`;
  message += `Vendido: ${formatarValor(vendidoMes)}\n`;
  message += `Falta: ${formatarValor(faltaMes)}\n`;
  message += `Dias restantes: ${diasRestantes}\n`;
  message += `Diária necessária: ${formatarValor(metaDia)}\n\n`;

  if (metasColaboradoras && metasColaboradoras.length > 0) {
    message += `*METAS INDIVIDUAIS HOJE*\n`;
    metasColaboradoras.forEach((colab) => {
      message += `${colab.nome}: ${formatarValor(colab.metaDiaria)}\n`;
    });
    message += `\n`;
  }

  if (observacoes && observacoes.trim()) {
    message += `*Obs:* ${observacoes.trim()}\n\n`;
  }

  message += `Sistema EleveaOne`;

  return message;
}

/**
 * Formata mensagem de fechamento de caixa (notificação WhatsApp)
 */
export function formatFechamentoCaixaMessage(params: {
  storeName: string;
  dataFechamento: string;
  metaMes: number;
  vendidoMes: number;
  faltaMes: number;
  diariaNecessaria: number;
  diasRestantes: number;
  vendidoHoje: number;
  dinheiroCaixa?: number;
  vendasColaboradoras?: { nome: string; vendidoHoje: number; isOnLeave: boolean }[];
  observacoes?: string;
  colaboradoraResponsavel?: string;
}): string {
  const {
    storeName,
    dataFechamento,
    metaMes,
    vendidoMes,
    faltaMes,
    diariaNecessaria,
    diasRestantes,
    vendidoHoje,
    dinheiroCaixa,
    vendasColaboradoras,
    observacoes,
    colaboradoraResponsavel,
  } = params;

  const dataFormatada = new Date(dataFechamento).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formatarValor = (valor: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);

  const formatarValorCurto = (valor: number) => {
    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(0)}K`;
    }
    return formatarValor(valor);
  };

  let message = `*FECHAMENTO - ${dataFormatada}*\n`;
  message += `${storeName.toUpperCase()}\n`;
  if (colaboradoraResponsavel) {
    message += `*Responsável:* ${colaboradoraResponsavel}\n`;
  }
  message += `\n`;

  message += `Meta Loja: ${formatarValorCurto(metaMes)}\n`;
  message += `Vendido: ${formatarValor(vendidoMes)}\n`;
  message += `Falta: ${formatarValor(faltaMes)}\n`;
  message += `Diária hoje: ${formatarValor(diariaNecessaria)}\n`;
  message += `Restam ${diasRestantes} dias no mês\n\n`;

  message += `*Loja vendeu hoje:* ${formatarValor(vendidoHoje)}\n`;

  if (dinheiroCaixa !== undefined && dinheiroCaixa > 0) {
    message += `*Dinheiro em caixa:* ${formatarValor(dinheiroCaixa)}\n`;
  }

  if (vendasColaboradoras && vendasColaboradoras.length > 0) {
    vendasColaboradoras.forEach((colab) => {
      if (colab.isOnLeave) {
        message += `${colab.nome}: R$ - folga\n`;
      } else {
        message += `${colab.nome}: ${formatarValor(colab.vendidoHoje)}\n`;
      }
    });
  }

  if (observacoes && observacoes.trim()) {
    message += `\n*Obs:* ${observacoes.trim()}\n`;
  }

  message += `\nSistema EleveaOne`;

  return message;
}

