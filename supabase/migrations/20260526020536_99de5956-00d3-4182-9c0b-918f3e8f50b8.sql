
DROP POLICY IF EXISTS "contact_screenshots_no_select" ON storage.objects;
DROP POLICY IF EXISTS "contact_screenshots_no_insert" ON storage.objects;
DROP POLICY IF EXISTS "contact_screenshots_no_update" ON storage.objects;
DROP POLICY IF EXISTS "contact_screenshots_no_delete" ON storage.objects;

CREATE POLICY "contact_screenshots_no_select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'contact-screenshots' AND false);

CREATE POLICY "contact_screenshots_no_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'contact-screenshots' AND false);

CREATE POLICY "contact_screenshots_no_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'contact-screenshots' AND false)
WITH CHECK (bucket_id = 'contact-screenshots' AND false);

CREATE POLICY "contact_screenshots_no_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'contact-screenshots' AND false);
