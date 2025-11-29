-- Enable Realtime for tiny_orders table
-- This allows the frontend to receive instant notifications when new orders are inserted

-- Enable Realtime publication for tiny_orders
ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.tiny_orders;

-- Grant necessary permissions for Realtime
GRANT SELECT ON sistemaretiradas.tiny_orders TO anon;
GRANT SELECT ON sistemaretiradas.tiny_orders TO authenticated;

-- Add comment
COMMENT ON TABLE sistemaretiradas.tiny_orders IS 'Pedidos sincronizados do Tiny ERP - Realtime enabled for instant notifications';
