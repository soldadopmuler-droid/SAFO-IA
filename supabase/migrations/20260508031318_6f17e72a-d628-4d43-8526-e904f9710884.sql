DROP POLICY IF EXISTS "Sistema sobe podcasts" ON storage.objects;

CREATE POLICY "Admins sobem podcasts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'podcasts'::text AND has_role(auth.uid(), 'admin'::app_role));