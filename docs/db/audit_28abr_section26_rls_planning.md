# Sección 2.6 — RLS rewrites con (SELECT auth.uid())  [PLANNING]

19 policies usan auth.uid() directo en lugar de (SELECT auth.uid()), ineficiente cuando hay muchas filas. Bajo impacto pre-Mundial (tablas <500 filas). Re-evaluar pre-11jun.

## Listar las afectadas

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND ((qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%')
    OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%'));
```

## Plantilla de rewrite

```sql
ALTER POLICY <policy_name> ON public.<table>
  USING (user_id = (SELECT auth.uid()));
```
