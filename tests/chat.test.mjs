import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationSchema, querySchema } from '../src/modules/chat/model.ts';
const id='00000000-0000-4000-8000-000000000001';
test('chat input cannot inject actor, files, group creation or invalid pagination',()=>{
 const send={action:'send',roomId:id,id,body:'Сообщение 🙂'};
 assert.equal(mutationSchema.safeParse(send).success,true);
 for(const extra of [{actorId:id},{attachments:['file']},{body:' '},{body:'a'.repeat(4001)},{notify:'everyone'}])assert.equal(mutationSchema.safeParse({...send,...extra}).success,false);
 assert.equal(mutationSchema.safeParse({action:'create_group',name:'Group'}).success,false);
 for(const input of [{roomId:id,before:'-1'},{roomId:id,before:'2',after:'1'},{cursorId:id},{roomId:id,before:'Infinity'},{summary:'false'}])assert.equal(querySchema.safeParse(input).success,false);
 assert.equal(querySchema.safeParse({roomId:id,before:'50'}).data.before,50);
});
test('chat moderation requires explicit version and bounded duration',()=>{
 for(const action of ['edit','delete','pin','unpin'])assert.equal(mutationSchema.safeParse({action,roomId:id,id,body:'text'}).success,false);
 assert.equal(mutationSchema.safeParse({action:'mute',roomId:id,userId:id,durationMinutes:29}).success,false);
 assert.equal(mutationSchema.safeParse({action:'mute',roomId:id,userId:null,durationMinutes:null}).success,true);
});
