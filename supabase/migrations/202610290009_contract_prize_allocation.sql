-- Pure server-side allocation used by the forthcoming signed-contract
-- settlement. No wallet mutation or live publication trigger is changed here.
begin;
create function public.contract_prize_allocation(p_prize bigint,p_games integer,p_recipients jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare recipient jsonb; obligation jsonb; rule jsonb; participation jsonb;
 player uuid; organization uuid; seen_players uuid[]:='{}'; seen_organizations uuid[];
 played integer; share integer; numerator integer; weight numeric:=0; gross bigint; deducted bigint;
 guest_percent integer; points integer; amount bigint; assigned bigint:=0;
 payouts jsonb:='[]'; transfers jsonb;
begin
 if p_prize is null or p_prize not between 0 and 1000000000000 or p_games is null or p_games not between 1 and 1000000
   or jsonb_typeof(p_recipients) is distinct from 'array' then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
 if jsonb_array_length(p_recipients)>1000 then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
 for recipient in select * from jsonb_array_elements(p_recipients) loop
   if jsonb_typeof(recipient) is distinct from 'object' then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
   player:=(recipient->>'playerId')::uuid;
   if player is null or player=any(seen_players) then raise exception 'CONTRACT_ALLOCATION_DUPLICATE';end if;
   seen_players:=array_append(seen_players,player);
   if jsonb_typeof(recipient->'playedGames') is distinct from 'number' or (recipient->>'playedGames')!~'^\d+$'
     or (recipient->>'playedGames')::numeric not between 0 and p_games
     or jsonb_typeof(recipient->'shareBps') is distinct from 'number' or (recipient->>'shareBps')!~'^\d+$'
     or (recipient->>'shareBps')::numeric not between 0 and 10000 then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
   played:=(recipient->>'playedGames')::integer;share:=(recipient->>'shareBps')::integer;
   participation:=recipient->'participation';
   if jsonb_typeof(participation) is distinct from 'object' or coalesce(participation->>'mode','') not in('any','proportional','minimum') then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
   numerator:=case when played>0 then p_games else 0 end;
   if participation->>'mode'='proportional' then numerator:=played;end if;
   if participation->>'mode'='minimum' then
     if jsonb_typeof(participation->'games') is distinct from 'number' or (participation->>'games')!~'^\d+$'
       or (participation->>'games')::numeric not between 1 and 10000 then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
     numerator:=case when played>=(participation->>'games')::integer then p_games else 0 end;
   end if;
   weight:=weight+share::numeric*numerator;
   -- Reject oversubscription before rounding. A one-coin prize is no exception.
   if weight>10000::numeric*p_games then raise exception 'CONTRACT_TOTAL_SHARE';end if;
   gross:=floor(p_prize::numeric*share*numerator/(10000::numeric*p_games))::bigint;
   deducted:=0;guest_percent:=0;transfers:='[]';seen_organizations:='{}';
   if jsonb_typeof(recipient->'guestObligations') is distinct from 'array' then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
   for obligation in select * from jsonb_array_elements(recipient->'guestObligations') loop
     organization:=(obligation->>'organizationId')::uuid;
     if organization is null or organization=any(seen_organizations) then raise exception 'CONTRACT_ALLOCATION_DUPLICATE';end if;
     seen_organizations:=array_append(seen_organizations,organization);
     rule:=obligation->'compensation';
     if jsonb_typeof(rule) is distinct from 'object' or coalesce(rule->>'kind','') not in('none','fixed','percent') then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
     if rule->>'kind'='fixed' then
       if jsonb_typeof(rule->'amount') is distinct from 'number' or (rule->>'amount')!~'^\d+$'
         or (rule->>'amount')::numeric not between 0 and 1000000000000 then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
       -- The host funds fixed compensation from a distinct reserved balance.
       -- Never deduct it from the player's prize or the organizer's prize fund.
     elsif rule->>'kind'='percent' then
       if jsonb_typeof(rule->'basisPoints') is distinct from 'number' or (rule->>'basisPoints')!~'^\d+$'
         or (rule->>'basisPoints')::numeric not between 0 and 10000 then raise exception 'CONTRACT_ALLOCATION_INPUT';end if;
       points:=(rule->>'basisPoints')::integer;guest_percent:=guest_percent+points;
       if guest_percent>10000 then raise exception 'CONTRACT_GUEST_TOTAL_SHARE';end if;
       amount:=floor(gross::numeric*points/10000)::bigint;deducted:=deducted+amount;
       transfers:=transfers||jsonb_build_array(jsonb_build_object('organizationId',organization,'amount',amount));
     end if;
   end loop;
   assigned:=assigned+gross;
   payouts:=payouts||jsonb_build_array(jsonb_build_object('playerId',player,'gross',gross,'net',gross-deducted,'toOrganizations',transfers));
 end loop;
 return jsonb_build_object('organizationAmount',p_prize-assigned,'payouts',payouts);
end $$;
-- Call only from trusted settlement functions, never directly from a browser
-- or through the contract proposal endpoint with caller-supplied recipients.
revoke all on function public.contract_prize_allocation(bigint,integer,jsonb) from public,anon,authenticated,service_role;
commit;
