-- Files are stored as <shop_id>/<import_id>/<filename>; access requires approved shop membership.
create policy "shop members read uploads" on storage.objects for select to authenticated
using (
  bucket_id = 'shop-uploads'
  and public.has_shop_access(((storage.foldername(name))[1])::uuid)
);

create policy "shop members upload files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'shop-uploads'
  and public.has_shop_access(((storage.foldername(name))[1])::uuid)
);