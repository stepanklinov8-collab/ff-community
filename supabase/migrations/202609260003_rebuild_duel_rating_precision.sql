begin;

-- Rebuild existing independent duel ratings so stored team/guild values
-- receive the new hundredths precision immediately.
select public.u2_rebuild_duel_ratings('bo');
select public.u2_rebuild_duel_ratings('kv');

commit;
