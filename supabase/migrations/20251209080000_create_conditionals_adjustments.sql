-- Create conditionals table
CREATE TABLE IF NOT EXISTS sistemaretiradas.conditionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id),
    customer_name TEXT NOT NULL,
    customer_contact TEXT NOT NULL,
    customer_address TEXT,
    products JSONB NOT NULL DEFAULT '[]'::jsonb,
    date_generated DATE NOT NULL DEFAULT CURRENT_DATE,
    date_return DATE,
    status TEXT NOT NULL DEFAULT 'GERADA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create adjustments table
CREATE TABLE IF NOT EXISTS sistemaretiradas.adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id),
    customer_name TEXT NOT NULL,
    customer_contact TEXT NOT NULL,
    product TEXT NOT NULL,
    adjustment_description TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'NAO_PAGO',
    payment_amount NUMERIC(10, 2) DEFAULT 0,
    date_generated DATE NOT NULL DEFAULT CURRENT_DATE,
    date_seamstress DATE,
    date_delivery DATE,
    time_delivery TIME,
    status TEXT NOT NULL DEFAULT 'GERADA',
    delivery_method TEXT NOT NULL DEFAULT 'LOJA',
    delivery_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sistemaretiradas.conditionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies for conditionals
CREATE POLICY "Enable read access for authenticated users" ON sistemaretiradas.conditionals
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sistemaretiradas.conditionals
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON sistemaretiradas.conditionals
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON sistemaretiradas.conditionals
    FOR DELETE
    TO authenticated
    USING (true);

-- Create policies for adjustments
CREATE POLICY "Enable read access for authenticated users" ON sistemaretiradas.adjustments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sistemaretiradas.adjustments
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON sistemaretiradas.adjustments
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON sistemaretiradas.adjustments
    FOR DELETE
    TO authenticated
    USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_conditionals_updated_at
    BEFORE UPDATE ON sistemaretiradas.conditionals
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_adjustments_updated_at
    BEFORE UPDATE ON sistemaretiradas.adjustments
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();
