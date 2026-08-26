ALTER TABLE finance_recurring_items
  ADD COLUMN IF NOT EXISTS anchor_day SMALLINT;

UPDATE finance_recurring_items
SET anchor_day = EXTRACT(DAY FROM next_due_date)::smallint
WHERE anchor_day IS NULL;

ALTER TABLE finance_recurring_items
  ALTER COLUMN anchor_day SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='finance_recurring_items_anchor_day_check'
  ) THEN
    ALTER TABLE finance_recurring_items
      ADD CONSTRAINT finance_recurring_items_anchor_day_check
      CHECK (anchor_day BETWEEN 1 AND 31);
  END IF;
END
$$;
