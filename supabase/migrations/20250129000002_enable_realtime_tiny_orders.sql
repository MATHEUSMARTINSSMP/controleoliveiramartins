-- Enable Realtime for tiny_orders table
-- This allows the frontend to receive instant notifications when new orders are inserted

-- Enable Realtime publication for tiny_orders
-- Enable Realtime publication for tiny_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'sistemaretiradas' 
        AND tablename = 'tiny_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.tiny_orders;
    END IF;
END $$;

-- Grant necessary permissions for Realtime
GRANT SELECT ON sistemaretiradas.tiny_orders TO anon;
GRANT SELECT ON sistemaretiradas.tiny_orders TO authenticated;

-- Add comment
COMMENT ON TABLE sistemaretiradas.tiny_orders IS 'Pedidos sincronizados do Tiny ERP - Realtime enabled for instant notifications';
