-- Add versioning columns to sops table
ALTER TABLE public.sops
ADD COLUMN superseded_by uuid REFERENCES public.sops(id) ON DELETE SET NULL,
ADD COLUMN parent_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;

-- parent_sop_id: all versions of the "same SOP" share the same parent_sop_id (the original SOP's id)
-- superseded_by: old version points to new version (null for current version)

CREATE INDEX idx_sops_parent ON public.sops (parent_sop_id);
CREATE INDEX idx_sops_superseded ON public.sops (superseded_by);

-- Helper function: get the current (non-superseded) version of an SOP lineage
CREATE OR REPLACE FUNCTION public.current_sop_version(p_parent_id uuid)
RETURNS uuid AS $$
  SELECT id FROM public.sops
  WHERE (parent_sop_id = p_parent_id OR id = p_parent_id)
    AND superseded_by IS NULL
    AND status = 'published'
  ORDER BY version DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;
