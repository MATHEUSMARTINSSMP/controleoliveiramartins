-- Create enum for adiantamento status
CREATE TYPE public.status_adiantamento AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'DESCONTADO');

-- Create adiantamentos table
CREATE TABLE public.adiantamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaboradora_id UUID NOT NULL,
  valor NUMERIC NOT NULL,
  data_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mes_competencia TEXT NOT NULL,
  status status_adiantamento NOT NULL DEFAULT 'PENDENTE',
  motivo_recusa TEXT,
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  data_desconto TIMESTAMP WITH TIME ZONE,
  aprovado_por_id UUID,
  descontado_por_id UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own adiantamentos"
ON public.adiantamentos
FOR SELECT
USING ((colaboradora_id = auth.uid()) OR is_admin());

CREATE POLICY "Users can insert their own adiantamentos"
ON public.adiantamentos
FOR INSERT
WITH CHECK (colaboradora_id = auth.uid());

CREATE POLICY "Admins can manage all adiantamentos"
ON public.adiantamentos
FOR ALL
USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_adiantamentos_updated_at
BEFORE UPDATE ON public.adiantamentos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add adiantamentos to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.adiantamentos;