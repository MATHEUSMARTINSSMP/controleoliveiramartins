-- Add store_id column to profiles table
ALTER TABLE sistemaretiradas.profiles 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON sistemaretiradas.profiles(store_id);

-- Comment explaining the column
COMMENT ON COLUMN sistemaretiradas.profiles.store_id IS 'Foreign key to stores table, linking collaborators to their store';
