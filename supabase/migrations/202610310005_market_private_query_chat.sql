begin;
create table public.market_messages(
 id bigint generated always as identity primary key,deal_id uuid not null references public.market_deals(id),
 sender_id uuid not null references public.profiles(id),body text not null check(length(body) between 1 and 4000),
 reply_to bigint references public.market_messages(id),created_at timestamptz not null default clock_timestamp()
);
create index market_messages_deal on public.market_messages(deal_id,id desc);
create index market_messages_sender_time on public.market_messages(sender_id,created_at desc);
create table public.market_reads(deal_id uuid not null references public.market_deals(id),user_id uuid not null references public.profiles(id),last_seen bigint not null default 0,primary key(deal_id,user_id));
alter table public.market_messages enable row level security;alter table public.market_reads enable row level security;
revoke all on public.market_messages,public.market_reads from public,anon,authenticated,service_role;
create trigger market_message_immutable before update or delete on public.market_messages for each row execute function public.contract_frozen_guard();

create function public.market_chat_action(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare deal_value uuid;request_value uuid;action_value text;keys text[];old public.market_requests%rowtype;body_value text;reply bigint;seen bigint;message_id bigint;answer jsonb;d public.market_deals%rowtype;v public.market_versions%rowtype;
begin
 if p_actor is null then raise exception 'MARKET_AUTH';end if;
 action_value:=p_input->>'action';keys:=case action_value when 'message' then array['action','requestId','dealId','body','replyTo'] when 'read' then array['action','requestId','dealId','lastSeen'] else null end;
 if keys is null then raise exception 'MARKET_INPUT';end if;perform public.contract_assert_object(p_input,keys,keys);
 begin deal_value:=(p_input->>'dealId')::uuid;request_value:=(p_input->>'requestId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
 if request_value is null or not public.market_access(deal_value,p_actor) then raise exception 'MARKET_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('market-message:'||p_actor::text,0));
 select * into old from public.market_requests where id=request_value;
 if found then if old.actor_id is distinct from p_actor or old.input is distinct from p_input then raise exception 'MARKET_CONFLICT';end if;return old.result;end if;
 if action_value='read' then
   if jsonb_typeof(p_input->'lastSeen') is distinct from 'string' or coalesce(p_input->>'lastSeen','')!~'^\d{1,18}$' then raise exception 'MARKET_INPUT';end if;
   select least((p_input->>'lastSeen')::bigint,coalesce(max(id),0)) into seen from public.market_messages where deal_id=deal_value;
   insert into public.market_reads(deal_id,user_id,last_seen) values(deal_value,p_actor,seen) on conflict(deal_id,user_id) do update set last_seen=greatest(market_reads.last_seen,excluded.last_seen);
   answer:=jsonb_build_object('success',true);
 else
   select * into strict d from public.market_deals where id=deal_value;
   select * into strict v from public.market_versions where deal_id=d.id and revision=d.current_revision;
   if public.is_full_admin(p_actor) and not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null)
    and not(public.market_buyer_access(d,p_actor) or coalesce(v.seller_user_id=p_actor,false) or coalesce(public.can_manage_organization_contracts(v.seller_organization_id,p_actor),false)
      or v.status in('draft','offered','funded') and v.asset_revision=(select ownership_revision from public.teams where id=d.organization_id) and public.can_manage_organization_contracts(d.organization_id,p_actor)) then raise exception 'MARKET_FORBIDDEN';end if;
   if jsonb_typeof(p_input->'body') is distinct from 'string' then raise exception 'MARKET_INPUT';end if;
   body_value:=trim(p_input->>'body');if length(body_value) not between 1 and 4000 then raise exception 'MARKET_INPUT';end if;
   if (select count(*) from public.market_messages where sender_id=p_actor and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'MARKET_RATE';end if;
   if p_input->'replyTo'<>'null'::jsonb then
     if jsonb_typeof(p_input->'replyTo') is distinct from 'string' or coalesce(p_input->>'replyTo','')!~'^\d{1,18}$' then raise exception 'MARKET_INPUT';end if;
     reply:=(p_input->>'replyTo')::bigint;
     if not exists(select 1 from public.market_messages where id=reply and deal_id=deal_value) then raise exception 'MARKET_REPLY';end if;
   end if;
   insert into public.market_messages(deal_id,sender_id,body,reply_to) values(deal_value,p_actor,body_value,reply) returning id into message_id;
   answer:=jsonb_build_object('success',true,'messageId',message_id::text);
 end if;
 insert into public.market_requests(id,actor_id,input,result) values(request_value,p_actor,p_input,answer);return answer;
end $$;

create function public.market_query(p_actor uuid,p_input jsonb) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;deal_value uuid;revision_value integer;offset_value integer;rows_value jsonb;source_options jsonb;search_value text;kind_value text;
 disclosed jsonb;current_bundle jsonb;can_buyer boolean;can_seller boolean;is_current boolean;fresh boolean;admin_value boolean;consents jsonb;escrow jsonb;dispute jsonb;events jsonb;versions jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'MARKET_AUTH';end if;
 perform public.contract_assert_object(p_input,array[]::text[],array['dealId','revision','offset','search','searchKind','chat','before','history','events']);
 offset_value:=coalesce((p_input->>'offset')::integer,0);if offset_value not between 0 and 1000000 then raise exception 'MARKET_INPUT';end if;
 if p_input?'search' then
   search_value:=trim(p_input->>'search');kind_value:=p_input->>'searchKind';
   if search_value is null or length(search_value) not between 2 and 80 or coalesce(kind_value,'') not in('organizations','users') then raise exception 'MARKET_INPUT';end if;
   if kind_value='users' then
     select coalesce(jsonb_agg(to_jsonb(row_value)),'[]') into rows_value from(select id,nickname as name,'player'::text kind from public.profiles where nickname ilike '%'||search_value||'%' order by nickname,id limit 30) row_value;
   else
     select coalesce(jsonb_agg(to_jsonb(row_value)),'[]') into rows_value from(select id,name,type as kind,public.can_manage_organization_contracts(id,p_actor) as "canPrepare",public.organization_can_spend(id,p_actor) as "canSpend" from public.teams where dissolved_at is null and name ilike '%'||search_value||'%' order by name,id limit 30) row_value;
   end if;return jsonb_build_object('items',rows_value);
 end if;
 begin deal_value:=(p_input->>'dealId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
 if deal_value is null then
   select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value."createdAt" desc,row_value.id),'[]') into rows_value from(
     select listed.id,listed.organization_id as "organizationId",t.name,t.type,latest.revision,latest.price,latest.status,latest.expires_at as "expiresAt",listed.created_at as "createdAt",
       (select count(*) from public.market_messages m where m.deal_id=listed.id and m.sender_id<>p_actor and m.id>coalesce((select last_seen from public.market_reads where deal_id=listed.id and user_id=p_actor),0)) as unread,
       exists(select 1 from public.market_disputes s where s.deal_id=listed.id and s.closed_at is null) as disputed
     from public.market_deals listed join public.teams t on t.id=listed.organization_id
     cross join lateral(select mv.* from public.market_versions mv where mv.deal_id=listed.id and public.market_version_access(listed,mv,p_actor) order by revision desc limit 1) latest
     order by listed.created_at desc,listed.id limit 31 offset offset_value
   ) row_value;
   select coalesce(jsonb_agg(to_jsonb(row_value)),'[]') into source_options from(select id,name,type,public.organization_can_spend(id,p_actor) as "canSpend" from public.teams where dissolved_at is null and public.can_manage_organization_contracts(id,p_actor) order by name,id limit 100) row_value;
   return jsonb_build_object('deals',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),'hasMore',jsonb_array_length(rows_value)>30,'organizations',source_options,'userId',p_actor);
 end if;
 if not public.market_access(deal_value,p_actor) then raise exception 'MARKET_NOT_FOUND';end if;
 select * into strict d from public.market_deals where id=deal_value;
 select * into v from public.market_versions where deal_id=d.id and public.market_version_access(d,market_versions,p_actor)
   and(not(p_input?'revision') or revision=(p_input->>'revision')::integer) order by revision desc limit 1;
 if v.deal_id is null then raise exception 'MARKET_NOT_FOUND';end if;
 if p_input->>'chat'='true' then
   if p_input?'before' and coalesce(p_input->>'before','')!~'^\d{1,18}$' then raise exception 'MARKET_INPUT';end if;
   select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.sequence desc),'[]') into rows_value from(
     select m.id::text id,m.id sequence,m.sender_id as "senderId",p.nickname as name,m.body,m.reply_to::text as "replyTo",m.created_at as "createdAt"
     from public.market_messages m join public.profiles p on p.id=m.sender_id where m.deal_id=d.id and(not(p_input?'before') or m.id<(p_input->>'before')::bigint)
     order by m.id desc limit 51
   ) row_value;
   return jsonb_build_object('messages',coalesce((select jsonb_agg(value-'sequence' order by n desc) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=50),'[]'),'hasMore',jsonb_array_length(rows_value)>50);
 end if;
 if p_input->>'history'='true' then
   select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.revision desc),'[]') into rows_value from(select revision,price,status,expires_at as "expiresAt",created_at as "createdAt" from public.market_versions where deal_id=d.id and public.market_version_access(d,market_versions,p_actor) order by revision desc limit 31 offset offset_value) row_value;
   return jsonb_build_object('versions',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),'hasMore',jsonb_array_length(rows_value)>30);
 end if;
 if p_input->>'events'='true' then
   select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.sequence desc),'[]') into rows_value from(select id::text id,id sequence,revision,actor_id as "actorId",action,details,created_at as "createdAt" from public.market_events where deal_id=d.id and revision<=v.revision order by id desc limit 31 offset offset_value) row_value;
   return jsonb_build_object('events',coalesce((select jsonb_agg(value-'sequence' order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),'hasMore',jsonb_array_length(rows_value)>30);
 end if;
 select bundle into disclosed from public.market_disclosures where deal_id=d.id and revision=v.revision;
 can_buyer:=coalesce(public.market_buyer_access(d,p_actor,true),false);can_seller:=coalesce(public.is_organization_owner(d.organization_id,p_actor),false);
 is_current:=v.revision=d.current_revision;admin_value:=public.is_full_admin(p_actor) and exists(select 1 from public.market_disputes where deal_id=d.id);
 if disclosed is not null or can_seller or admin_value then current_bundle:=public.market_bundle(d.organization_id);end if;
 fresh:=disclosed is not null and disclosed=current_bundle;
 select coalesce(jsonb_agg(jsonb_build_object('party',party,'signedBy',signed_by,'signedAt',signed_at)),'[]') into consents from public.market_consents where deal_id=d.id and revision=v.revision;
 select jsonb_build_object('amount',amount,'held',held) into escrow from public.market_escrows where deal_id=d.id and revision=v.revision;
 select jsonb_build_object('openedBy',opened_by,'reason',reason,'openedAt',opened_at,'closedAt',closed_at,'resolution',resolution) into dispute from public.market_disputes where deal_id=d.id;
 return jsonb_build_object('deal',jsonb_build_object('id',d.id,'organizationId',d.organization_id,'name',(select name from public.teams where id=d.organization_id),
   'buyerUserId',d.buyer_user_id,'buyerOrganizationId',d.buyer_organization_id,
   'buyerName',coalesce((select nickname from public.profiles where id=d.buyer_user_id),(select name from public.teams where id=d.buyer_organization_id)),
   'sellerName',coalesce((select nickname from public.profiles where id=v.seller_user_id),(select name from public.teams where id=v.seller_organization_id)),
   'revision',v.revision,'price',v.price,'expiresAt',v.expires_at,'status',v.status,'authorSide',v.author_side),
   'consents',consents,'escrow',escrow,'dispute',dispute,'disclosed',disclosed is not null,'freshDisclosure',fresh,
   'bundle',case when can_seller or admin_value then coalesce(disclosed,current_bundle) else disclosed end,
   'canRevise',is_current and v.status not in('completed','reversed') and(public.market_buyer_access(d,p_actor) or public.can_manage_organization_contracts(d.organization_id,p_actor)),
   'canOffer',is_current and v.status='draft' and(case when v.author_side='buyer' then public.market_buyer_access(d,p_actor) else public.can_manage_organization_contracts(d.organization_id,p_actor) end),
   'canDisclose',is_current and can_seller and v.status='offered' and disclosed is null,
   'canSellerAccept',is_current and can_seller and v.status='offered' and fresh and not exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller'),
   'canFund',is_current and can_buyer and v.status='offered' and fresh and exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller'),
   'canComplete',is_current and can_buyer and v.status='funded' and fresh,
   'canCancel',is_current and v.status in('draft','offered','funded') and(public.market_buyer_access(d,p_actor) or can_seller),
   'canDispute',is_current and v.status<>'draft' and not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null),
   'canResolve',admin_value and exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null),
   'canReverse',admin_value and public.u6_coin_admin(p_actor) and v.status='completed' and exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null),
   'canMessage',not admin_value or exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null)
     or public.market_buyer_access(d,p_actor) or coalesce(v.seller_user_id=p_actor,false) or public.can_manage_organization_contracts(v.seller_organization_id,p_actor)
     or v.status in('draft','offered','funded') and v.asset_revision=(select ownership_revision from public.teams where id=d.organization_id) and public.can_manage_organization_contracts(d.organization_id,p_actor));
end $$;
revoke all on function public.market_chat_action(uuid,jsonb),public.market_query(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.market_chat_action(uuid,jsonb),public.market_query(uuid,jsonb) to service_role;
commit;
