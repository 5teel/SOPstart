-- Full-text search column on sops table
ALTER TABLE public.sops
ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(sop_number, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(department, '')
  )
) STORED;

CREATE INDEX idx_sops_fts ON public.sops USING gin (fts);
