-- Split "CHECK OUT AND DEPARTURE -LHW" into two separate global templates:
-- 1. Rename existing → "CHECK OUT -LHW"
-- 2. Create new empty → "DEPARTURE -LHW" and link to the same packs
-- Same for THR variant if it exists.

DO $$
DECLARE
  v_template_id       uuid;
  v_new_template_id   uuid;
  v_pack_id           uuid;
  v_position          int;
  rec                 record;
BEGIN

  -- ── LHW (standard) ────────────────────────────────────────────────────────

  -- 1. Rename the existing global template
  UPDATE audit_templates
  SET    name = 'CHECK OUT -LHW'
  WHERE  scope = 'global'
    AND  name  = 'CHECK OUT AND DEPARTURE -LHW';

  -- 2. Get its ID (we need it to find which packs it belongs to)
  SELECT id INTO v_template_id
  FROM   audit_templates
  WHERE  scope = 'global'
    AND  name  = 'CHECK OUT -LHW'
  LIMIT  1;

  IF v_template_id IS NOT NULL THEN

    -- 3. Create the new empty "DEPARTURE -LHW" global template
    INSERT INTO audit_templates (name, scope, active, area_id)
    VALUES ('DEPARTURE -LHW', 'global', true, null)
    RETURNING id INTO v_new_template_id;

    -- 4. Add it to every pack that contained the original template
    FOR rec IN
      SELECT pack_id, position
      FROM   global_audit_pack_templates
      WHERE  audit_template_id = v_template_id
    LOOP
      -- Use position + 1 so DEPARTURE sits right after CHECK OUT
      INSERT INTO global_audit_pack_templates (pack_id, audit_template_id, position)
      VALUES (rec.pack_id, v_new_template_id, rec.position + 1)
      ON CONFLICT DO NOTHING;
    END LOOP;

  END IF;


  -- ── LHW THR variant ───────────────────────────────────────────────────────

  UPDATE audit_templates
  SET    name = 'CHECK OUT -LHW THR'
  WHERE  scope = 'global'
    AND  name  = 'CHECK OUT AND DEPARTURE -LHW THR';

  SELECT id INTO v_template_id
  FROM   audit_templates
  WHERE  scope = 'global'
    AND  name  = 'CHECK OUT -LHW THR'
  LIMIT  1;

  IF v_template_id IS NOT NULL THEN

    INSERT INTO audit_templates (name, scope, active, area_id)
    VALUES ('DEPARTURE -LHW THR', 'global', true, null)
    RETURNING id INTO v_new_template_id;

    FOR rec IN
      SELECT pack_id, position
      FROM   global_audit_pack_templates
      WHERE  audit_template_id = v_template_id
    LOOP
      INSERT INTO global_audit_pack_templates (pack_id, audit_template_id, position)
      VALUES (rec.pack_id, v_new_template_id, rec.position + 1)
      ON CONFLICT DO NOTHING;
    END LOOP;

  END IF;

END $$;