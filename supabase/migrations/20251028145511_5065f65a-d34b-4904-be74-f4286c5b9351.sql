-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUMS
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'COLABORADORA');
CREATE TYPE public.status_compra AS ENUM ('PENDENTE', 'PARCIAL', 'PAGO', 'CANCELADO');
CREATE TYPE public.status_parcela AS ENUM ('PENDENTE', 'AGENDADO', 'DESCONTADO', 'ESTORNADO', 'CANCELADO');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  store_default TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaboradora_id UUID NOT NULL REFERENCES public.profiles(id),
  loja_id UUID NOT NULL REFERENCES public.stores(id),
  data_compra TIMESTAMPTZ NOT NULL,
  item TEXT NOT NULL,
  preco_venda DECIMAL(12,2) NOT NULL,
  desconto_beneficio DECIMAL(12,2) NOT NULL,
  preco_final DECIMAL(12,2) NOT NULL,
  num_parcelas INTEGER NOT NULL,
  status_compra public.status_compra DEFAULT 'PENDENTE',
  observacoes TEXT,
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create parcelas table
CREATE TABLE public.parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  n_parcela INTEGER NOT NULL,
  competencia TEXT NOT NULL, -- AAAAMM format
  valor_parcela DECIMAL(12,2) NOT NULL,
  status_parcela public.status_parcela DEFAULT 'PENDENTE',
  data_baixa TIMESTAMPTZ,
  baixado_por_id UUID REFERENCES public.profiles(id),
  motivo_estorno TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit table
CREATE TABLE public.audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  executed_by_id UUID NOT NULL REFERENCES public.profiles(id),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- RLS Policies for stores
CREATE POLICY "Everyone can view stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Admins can manage stores" ON public.stores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- RLS Policies for purchases
CREATE POLICY "Users can view their own purchases" ON public.purchases FOR SELECT USING (
  colaboradora_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can manage purchases" ON public.purchases FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- RLS Policies for parcelas
CREATE POLICY "Users can view their own parcelas" ON public.parcelas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.purchases WHERE id = compra_id AND colaboradora_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can manage parcelas" ON public.parcelas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- RLS Policies for audit
CREATE POLICY "Admins can view audit" ON public.audit FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can insert audit" ON public.audit FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_stores BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_purchases BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_parcelas BEFORE UPDATE ON public.parcelas FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'COLABORADORA')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert seed data: Stores
INSERT INTO public.stores (name) VALUES
  ('Mr. Kitsch'),
  ('Loungerie'),
  ('Sacada | Oh, Boy');

-- Note: Users will be created via Supabase Auth signup, which will trigger profile creation