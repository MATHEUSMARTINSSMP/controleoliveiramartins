-- Adicionar campos de limite na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN limite_total NUMERIC DEFAULT 1000.00 NOT NULL,
ADD COLUMN limite_mensal NUMERIC DEFAULT 800.00 NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.limite_total IS 'Limite total de crédito disponível para a colaboradora (padrão: R$ 1.000,00)';
COMMENT ON COLUMN public.profiles.limite_mensal IS 'Limite máximo de desconto mensal (padrão: R$ 800,00)';