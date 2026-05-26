
insert into storage.buckets (id, name, public)
values ('contact-screenshots', 'contact-screenshots', true)
on conflict (id) do nothing;

create policy "Public can upload contact screenshots"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'contact-screenshots');

create policy "Public can read contact screenshots"
on storage.objects for select to anon, authenticated
using (bucket_id = 'contact-screenshots');
