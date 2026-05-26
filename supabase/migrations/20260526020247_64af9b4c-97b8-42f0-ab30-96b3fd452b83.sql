
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp']
where id = 'contact-screenshots';

drop policy if exists "Public can upload contact screenshots" on storage.objects;
drop policy if exists "Public can read contact screenshots" on storage.objects;
