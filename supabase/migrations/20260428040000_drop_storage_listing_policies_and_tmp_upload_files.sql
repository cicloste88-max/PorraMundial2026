-- Item 2: DROP 4 policies SELECT en storage.objects.
-- Buckets public:true no necesitan policy RLS para servir objetos via URL directa.
-- Estas policies eran redundantes Y permitian listing (advisor WARN 0025). 4 WARN -> 0.
-- Item 5: DROP tmp_upload_files.
-- Scripts Python backtest WC2022 (Fase E IA Predictor, 21abr2026). Ya cumplida:
-- motor implementado en TS en EF porra-ia-compute v10.
-- Aplicado 28abr2026 desde Claude.ai (Supabase MCP). Verificado 4/4 PASS.

DROP POLICY IF EXISTS flags_public_read      ON storage.objects;
DROP POLICY IF EXISTS kits_public_read        ON storage.objects;
DROP POLICY IF EXISTS miniatures_public_read  ON storage.objects;
DROP POLICY IF EXISTS sites_public_read       ON storage.objects;

DROP TABLE IF EXISTS public.tmp_upload_files;
