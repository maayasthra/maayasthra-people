-- Creates the secret token that lets the Google Sheet read the end-of-day reports, and shows it to you ONCE in the result below.
-- Only a fingerprint of the token is stored in the database. Copy the token straight from the result into the Apps Script prompt
-- (EOD sync > Connect). Do not paste it into chat or email. Running this again makes a new token and the old one stops working.
with t as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token),
saved as (
  insert into public.eod_export_config (id, token_hash)
  select 1, encode(sha256(convert_to(token, 'UTF8')), 'hex') from t
  on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now()
  returning id
)
select t.token as "COPY THIS TOKEN (shown once)" from t, saved;
