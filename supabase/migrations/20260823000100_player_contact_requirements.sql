-- Player registration requirements
-- Full name remains required, phone is enforced by the application schema,
-- while date of birth is optional for staff-created player records.
alter table public.players
  alter column date_of_birth drop not null;
