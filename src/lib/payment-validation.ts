import { z } from 'zod';

export const PAYMENT_METHOD_TYPES = ['CREDITO', 'DEBITO', 'DINHEIRO', 'PIX', 'BOLETO'] as const;

export type PaymentMethodType = typeof PAYMENT_METHOD_TYPES[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  CREDITO: 'Cartao de Credito',
  DEBITO: 'Cartao de Debito',
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  BOLETO: 'Boleto',
};

export const formaPagamentoSchema = z.object({
  tipo: z.enum(PAYMENT_METHOD_TYPES, {
    errorMap: () => ({ message: 'Tipo de pagamento invalido' }),
  }),
  valor: z.number({
    required_error: 'Valor e obrigatorio',
    invalid_type_error: 'Valor deve ser um numero',
  }).positive('Valor deve ser maior que zero'),
  parcelas: z.number().int().min(1).max(12).optional(),
}).refine(
  (data) => {
    if (data.tipo === 'CREDITO') {
      return data.parcelas !== undefined && data.parcelas >= 1 && data.parcelas <= 12;
    }
    return true;
  },
  {
    message: 'Credito requer numero de parcelas entre 1 e 12',
    path: ['parcelas'],
  }
).refine(
  (data) => {
    if (data.tipo !== 'CREDITO' && data.parcelas !== undefined && data.parcelas !== 1) {
      return false;
    }
    return true;
  },
  {
    message: 'Parcelas so e permitido para Credito',
    path: ['parcelas'],
  }
);

export const formasPagamentoArraySchema = z.array(formaPagamentoSchema);

export type FormaPagamento = z.infer<typeof formaPagamentoSchema>;

export function validateFormasPagamento(
  formasPagamento: FormaPagamento[],
  valorVenda: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (formasPagamento.length === 0) {
    errors.push('Adicione pelo menos uma forma de pagamento');
    return { valid: false, errors };
  }

  for (let i = 0; i < formasPagamento.length; i++) {
    const forma = formasPagamento[i];
    const result = formaPagamentoSchema.safeParse(forma);
    
    if (!result.success) {
      result.error.errors.forEach((err) => {
        errors.push(`Forma ${i + 1}: ${err.message}`);
      });
    }
  }

  const soma = formasPagamento.reduce((acc, f) => acc + f.valor, 0);
  const diferenca = Math.abs(soma - valorVenda);
  
  if (diferenca > 0.01) {
    errors.push(
      `Soma das formas de pagamento (R$ ${soma.toFixed(2)}) difere do valor da venda (R$ ${valorVenda.toFixed(2)})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatFormaPagamento(forma: FormaPagamento): string {
  let texto = `${PAYMENT_METHOD_LABELS[forma.tipo]}: R$ ${forma.valor.toFixed(2)}`;
  if (forma.tipo === 'CREDITO' && forma.parcelas) {
    texto += ` (${forma.parcelas}x de R$ ${(forma.valor / forma.parcelas).toFixed(2)})`;
  }
  return texto;
}

export function formatFormasPagamentoResumo(formas: FormaPagamento[]): string {
  if (formas.length === 0) return 'Nao informado';
  if (formas.length === 1) return formatFormaPagamento(formas[0]);
  return formas.map(f => formatFormaPagamento(f)).join(' + ');
}

export function getFormaPrincipal(formas: FormaPagamento[]): PaymentMethodType | null {
  if (formas.length === 0) return null;
  const sorted = [...formas].sort((a, b) => b.valor - a.valor);
  return sorted[0].tipo;
}

export function calcularTotalFormas(formas: FormaPagamento[]): number {
  return formas.reduce((acc, f) => acc + f.valor, 0);
}
