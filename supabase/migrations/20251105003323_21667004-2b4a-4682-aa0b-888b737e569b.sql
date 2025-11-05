-- Adicionar campo CPF à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN cpf TEXT;

-- Adicionar constraint de unicidade no CPF
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário - único e obrigatório para colaboradoras';