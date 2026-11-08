-- Decisión de Teferi (8-nov-2026): cualquier perfil se publica sin esperar revisión.
-- La revisión pasa a ser semanal y a posteriori: las filas con review_note='auto'
-- y reviewed_at null son las que quedan por mirar. Las cuentas suspendidas siguen
-- suspendidas, y las denuncias (social_reports, ai_reports) no cambian.
-- moderation_digest() solo cuenta perfiles 'pending', así que deja de avisar por ellos.

begin;

create or replace function public.social_profile_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op='INSERT' or new.name is distinct from old.name or new.avatar_url is distinct from old.avatar_url
     or new.equipped_title is distinct from old.equipped_title then
    insert into public.social_profile_reviews(user_id,status,approved_name,approved_avatar,approved_title,review_note)
    values(new.id,'approved',new.name,new.avatar_url,new.equipped_title,'auto')
    on conflict(user_id) do update set
      status=case when social_profile_reviews.status='suspended' then 'suspended' else 'approved' end,
      approved_name=case when social_profile_reviews.status='suspended' then null else new.name end,
      approved_avatar=case when social_profile_reviews.status='suspended' then null else new.avatar_url end,
      approved_title=case when social_profile_reviews.status='suspended' then null else new.equipped_title end,
      updated_at=now(),
      reviewed_at=null,
      review_note=case when social_profile_reviews.status='suspended' then null else 'auto' end;
  end if;
  return new;
end;
$function$;

create or replace function public.social_avatar_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.bucket_id='avatars' then
    update public.social_profile_reviews r set
      status=case when r.status='suspended' then 'suspended' else 'approved' end,
      approved_avatar=case when r.status='suspended' then null else new.name end,
      updated_at=now(),
      reviewed_at=null,
      review_note=case when r.status='suspended' then r.review_note else 'auto' end
    from public.profiles p where p.id=r.user_id and p.avatar_url=new.name;
  end if;
  return new;
end;
$function$;

update public.social_profile_reviews r set
  status='approved',
  approved_name=p.name,
  approved_avatar=p.avatar_url,
  approved_title=p.equipped_title,
  updated_at=now(),
  review_note='auto'
from public.profiles p
where p.id=r.user_id and r.status='pending';

commit;
