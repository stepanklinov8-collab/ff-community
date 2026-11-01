import assert from 'node:assert/strict';

export async function verifyOrganizationHierarchy(db,id){
 const root=id(8910),child=id(8911),leaf=id(8912),owner=id(8920),nextOwner=id(8921),leader=id(8922),delegate=id(8923);
 for(const [user,name] of [[owner,'Root owner'],[nextOwner,'Buyer'],[leader,'Parent leader'],[delegate,'Delegate']]){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,name]);
 }
 for(const team of [root,child,leaf]){
  await db.query("insert into teams(id,name,type,leader_id) values($1,$2,'team',$3)",[team,team===root?'Parent':team===child?'Child':'Leaf',leader]);
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'main')",[team,leader,delegate]);
 }
 async function change(sql,params){
  await db.exec("begin;select set_config('omcite.allow_organization_owner_transfer','on',true)");
  try{await db.query(sql,params);await db.exec('commit');}catch(error){await db.exec('rollback');throw error;}
 }
 async function asUser(user,sql,params){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec('set role authenticated');
  try{return await db.query(sql,params);}finally{await db.exec('reset role');}
 }
 await change('update teams set owner_user_id=$2 where id=$1',[root,owner]);
 await change('update teams set owner_user_id=null,owner_team_id=$2 where id=$1',[child,root]);
 await change('update teams set owner_user_id=null,owner_team_id=$2 where id=$1',[leaf,child]);
 const leaves=await db.query('select id,ultimate_owner_user_id,leader_id from teams where id=any($1::uuid[])',[ [root,child,leaf] ]);
 assert(leaves.rows.every(row=>row.ultimate_owner_user_id===owner&&row.leader_id===leader));
 assert.equal((await db.query('select is_organization_owner($1,$2) allowed',[leaf,owner])).rows[0].allowed,true);
 assert.equal((await db.query('select is_organization_owner($1,$2) allowed',[leaf,leader])).rows[0].allowed,false,'parent leadership does not imply ownership of descendants');
 await assert.rejects(()=>db.query('update teams set owner_team_id=$2,owner_user_id=null where id=$1',[root,leaf]),/только завершённой сделкой/);
 await assert.rejects(()=>change('update teams set owner_team_id=$2,owner_user_id=null where id=$1',[root,leaf]),/замкнутую цепочку/);
 await assert.rejects(()=>change('update teams set owner_team_id=id,owner_user_id=null where id=$1',[root]),/владеть собой/);
 await assert.rejects(()=>db.query('update teams set dissolved_at=now() where id=$1',[root]),/дочерними организациями/);
 await db.query('update teams set ultimate_owner_user_id=$2,ownership_revision=999 where id=$1',[leaf,nextOwner]);
 assert.equal((await db.query('select ultimate_owner_user_id from teams where id=$1',[leaf])).rows[0].ultimate_owner_user_id,owner,'cached ownership cannot be forged');
 await asUser(owner,'select organization_owner_set_contract_access($1,$2,true)',[leaf,delegate]);
 const account=(await db.query("select u6_coin_account('organization',$1) id",[leaf])).rows[0].id;
 await db.query('update coin_accounts set balance=100 where id=$1',[account]);
 await db.query("select u6_coin_action($1,$2,'transfer',$3::jsonb)",[owner,id(8930),JSON.stringify({teamId:leaf,userId:delegate,amount:10})]);
 const revision=(await db.query('select ownership_revision from teams where id=$1',[leaf])).rows[0].ownership_revision;
 await change('update teams set owner_user_id=$2 where id=$1',[root,nextOwner]);
 assert.equal((await db.query('select ultimate_owner_user_id from teams where id=$1',[leaf])).rows[0].ultimate_owner_user_id,nextOwner);
 assert.equal(Number((await db.query('select ownership_revision from teams where id=$1',[leaf])).rows[0].ownership_revision),Number(revision)+1);
 assert.equal((await db.query('select count(*)::int n from organization_contract_access where team_id=$1',[leaf])).rows[0].n,0,'former root owner delegates are revoked throughout the subtree');
 await assert.rejects(()=>db.query("select u6_coin_action($1,$2,'transfer',$3::jsonb)",[owner,id(8931),JSON.stringify({teamId:leaf,userId:delegate,amount:10})]),/владелец или руководитель/);
 await db.query("select u6_coin_action($1,$2,'transfer',$3::jsonb)",[nextOwner,id(8932),JSON.stringify({teamId:leaf,userId:delegate,amount:10})]);
 assert.equal(Number((await db.query('select balance from coin_accounts where id=$1',[account])).rows[0].balance),80);
 await asUser(nextOwner,'select organization_owner_set_leader($1,$2,false)',[leaf,delegate]);
 assert.equal((await db.query('select leader_id from teams where id=$1',[leaf])).rows[0].leader_id,delegate);
 console.log('PASS: organization hierarchy, root ownership, protected cache, cycle/dissolution guards, inherited finance/control, ownership revisions and subtree delegation revocation');
}
