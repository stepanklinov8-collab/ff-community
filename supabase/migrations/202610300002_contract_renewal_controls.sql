-- Display prior financial activation from trusted history, never infer it
-- from a revision number: earlier revisions may only have been drafts.
begin;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_query(uuid,jsonb)'::regprocedure);
 needle:='c.created_at as "createdAt",';
 if position(needle in d)=0 then raise exception 'CONTRACT_RENEWAL_QUERY_PATCH';end if;
 execute replace(d,needle,needle||' exists(select 1 from public.contract_financial_starts fs where fs.contract_id=c.id) as "hasSignedHistory",');
end $$;
commit;
