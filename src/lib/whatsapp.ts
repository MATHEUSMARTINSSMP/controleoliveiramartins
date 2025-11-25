/**
 * Helper para enviar mensagens WhatsApp
 */

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

interface SendWhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia mensagem WhatsApp via função Netlify
 */
export async function sendWhatsAppMessage({
  phone,
  message,
}: SendWhatsAppParams): Promise<SendWhatsAppResponse> {
  try {
    console.log('📱 [sendWhatsAppMessage] Iniciando envio de WhatsApp...');
    console.log('📱 [sendWhatsAppMessage] Telefone:', phone);
    console.log('📱 [sendWhatsAppMessage] Mensagem (primeiros 100 chars):', message.substring(0, 100));
    
    // Detectar se está em desenvolvimento ou produção
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment
      ? 'http://localhost:8888' // Netlify Dev local
      : window.location.origin; // Produção

    const functionUrl = `${baseUrl}/.netlify/functions/send-whatsapp-message`;
    console.log('📱 [sendWhatsAppMessage] URL da função Netlify:', functionUrl);
    console.log('📱 [sendWhatsAppMessage] Ambiente:', isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

    const payload = {
      phone,
      message,
    };

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
interface FormaPagamento {
  tipo: string;
  valor: number;
  parcelas?: number;
}

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
}): string {
  const { colaboradoraName, valor, qtdPecas, storeName, dataVenda, observacoes, totalDia, totalMes, formasPagamento } = params;
  
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
  
  // Adicionar totais se disponíveis
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
 */
export function formatGincanaMessage(params: {
  colaboradoraName: string;
  storeName: string;
  semanaReferencia: string; // WWYYYY
  metaValor: number;
  superMetaValor: number | null;
  dataInicio: string; // Data de início da semana (formato: DD/MM/YYYY)
  dataFim: string; // Data de fim da semana (formato: DD/MM/YYYY)
  premio?: string | null; // Texto do prêmio (ex: "Airfryer" ou "R$ 500")
  condicoes?: string | null; // Condições do bônus
}): string {
  const { colaboradoraName, storeName, semanaReferencia, metaValor, superMetaValor, dataInicio, dataFim, premio, condicoes } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];
  
  // Formatar valores monetários
  const metaFormatada = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(metaValor);
  
  const superMetaFormatada = superMetaValor 
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(superMetaValor)
    : null;

  // Extrair semana e ano
  const semana = semanaReferencia.slice(0, 2);
  const ano = semanaReferencia.slice(2, 6);

  let message = `🎯 *Nova Gincana Semanal!*\n\n`;
  message += `Olá, ${primeiroNome}!\n\n`;
  message += `Uma nova gincana semanal foi criada para você:\n\n`;
  message += `*Loja:* ${storeName}\n`;
  message += `*Período:* ${dataInicio} a ${dataFim}\n`;
  message += `*Semana:* Semana ${semana} de ${ano}\n\n`;
  message += `*Metas:*\n`;
  message += `• Meta: ${metaFormatada}\n`;
  if (superMetaFormatada) {
    message += `• Super Meta: ${superMetaFormatada}\n`;
  }
  message += `\n`;
  
  // Adicionar prêmio se disponível
  if (premio && premio.trim()) {
    message += `*Prêmio:*\n${premio.trim()}\n\n`;
  }
  
  // Adicionar condições se disponíveis
  if (condicoes && condicoes.trim()) {
    message += `*Condições:*\n${condicoes.trim()}\n\n`;
  }
  
  message += `Boa sorte! 💪\n\n`;
  message += `Sistema EleveaOne 📊`;

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
}): string {
  const { colaboradoraName, bonusName, bonusDescription, valorBonus, valorBonusTexto, storeName, preRequisitos } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];
  
  // Formatar valor do bônus
  let valorFormatado = '';
  if (valorBonusTexto) {
    valorFormatado = valorBonusTexto;
  } else if (valorBonus && valorBonus > 0) {
    valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valorBonus);
  }

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
  
  if (valorFormatado) {
    message += `*Valor:* ${valorFormatado}\n`;
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

