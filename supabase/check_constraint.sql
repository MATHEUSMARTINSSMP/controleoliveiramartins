SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.goals'::regclass
AND conname = 'goals_tipo_check';
