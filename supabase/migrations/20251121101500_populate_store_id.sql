-- First, add the store_id column if it doesn't exist
ALTER TABLE sistemaretiradas.profiles 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id);

-- Update store_id for Loungerie collaborators
UPDATE sistemaretiradas.profiles
SET store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
WHERE store_default = 'Loungerie' AND role = 'COLABORADORA';

-- Update store_id for Mr. Kitsch collaborators
UPDATE sistemaretiradas.profiles
SET store_id = 'c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3'
WHERE store_default = 'Mr. Kitsch' AND role = 'COLABORADORA';

-- Update store_id for Sacada | Oh, Boy collaborators (handles both variations)
UPDATE sistemaretiradas.profiles
SET store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'
WHERE (store_default LIKE 'Sacada%' OR store_default LIKE '%Oh%Boy%') AND role = 'COLABORADORA';

-- Verify the update
SELECT id, name, email, role, store_default, store_id, 
       (SELECT name FROM sistemaretiradas.stores WHERE id = profiles.store_id) as store_name
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
ORDER BY store_default;
