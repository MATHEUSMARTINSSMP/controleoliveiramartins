-- Check RLS policies on goals table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'goals';

-- Also check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'goals';
