-- Trigger-only functions: revoke from PUBLIC
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: only authenticated users (used by RLS policies under authenticated role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Make highlights bucket non-listable: switch to private
UPDATE storage.buckets SET public = false WHERE id = 'highlights';

-- Replace the broad public SELECT with an authenticated-only one (no listing via anon)
DROP POLICY IF EXISTS "Highlights bucket public read" ON storage.objects;
CREATE POLICY "Highlights readable by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'highlights');