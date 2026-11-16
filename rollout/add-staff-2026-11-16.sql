-- Adds 12 people to the staff directory so they can sign in. Safe to run twice: anyone already there is left untouched.
-- Names are worked out from the email addresses. Check them, and fix any that are wrong, before running or afterwards in the app (Members > edit).
-- Job title, department, joining date and the rest are left empty for now; everything defaults to Employee, Full-time, 10:00 to 18:00.
insert into public.employees (email, name) values
  ('richa@maayasthra.com',       'Richa'),
  ('tanvi@maayasthra.com',       'Tanvi'),
  ('mahima@maayasthra.com',      'Mahima'),
  ('alfaz@maayasthra.com',       'Alfaz'),
  ('sarahissac@maayasthra.com',  'Sarah Issac'),
  ('sarah@maayasthra.com',       'Sarah'),
  ('arunkannan@maayasthra.com',  'Arun Kannan'),
  ('aarif@maayasthra.com',       'Aarif'),
  ('sathya@maayasthra.com',      'Sathya'),
  ('priyankha@maayasthra.com',   'Priyankha'),
  ('sakshi@maayasthra.com',      'Sakshi'),
  ('sandesh@maayasthra.com',     'Sandesh')
on conflict (email) do nothing;

select email, name from public.employees where email in (
  'richa@maayasthra.com','tanvi@maayasthra.com','mahima@maayasthra.com','alfaz@maayasthra.com','sarahissac@maayasthra.com','sarah@maayasthra.com',
  'arunkannan@maayasthra.com','aarif@maayasthra.com','sathya@maayasthra.com','priyankha@maayasthra.com','sakshi@maayasthra.com','sandesh@maayasthra.com') order by id;
