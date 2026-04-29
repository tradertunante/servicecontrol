-- Add enabled_packs column to hotels table.
-- pack1  = Recuperación
-- pack_it         = IT (antes agrupado en pack1)
-- pack_engineering = Engineering / Mantenimiento (antes agrupado en pack1)
-- pack2  = Análisis
-- pack3  = Formaciones

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS enabled_packs text[] DEFAULT '{"base"}';

-- Asegurar que hoteles existentes tengan al menos el pack base
UPDATE hotels
SET enabled_packs = '{"base"}'
WHERE enabled_packs IS NULL;