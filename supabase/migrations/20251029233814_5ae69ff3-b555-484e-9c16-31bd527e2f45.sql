-- First, create the security definer functions
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- Drop ALL policies from all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Recreate profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Recreate stores policies
CREATE POLICY "Everyone can view stores"
ON public.stores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage stores"
ON public.stores
FOR ALL
TO authenticated
USING (public.is_admin());

-- Recreate purchases policies
CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage purchases"
ON public.purchases
FOR ALL
TO authenticated
USING (public.is_admin());

-- Recreate parcelas policies
CREATE POLICY "Users can view their own parcelas"
ON public.parcelas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM purchases 
    WHERE purchases.id = parcelas.compra_id 
    AND purchases.colaboradora_id = auth.uid()
  ) OR public.is_admin()
);

CREATE POLICY "Admins can manage parcelas"
ON public.parcelas
FOR ALL
TO authenticated
USING (public.is_admin());

-- Recreate audit policies
CREATE POLICY "Admins can view audit"
ON public.audit
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert audit"
ON public.audit
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());