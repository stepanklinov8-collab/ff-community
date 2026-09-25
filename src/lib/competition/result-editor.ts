import type {ResultInput} from "./model";

/** Keep the registered roster entry; a guest has no account or personal statistics. */
export function replaceWithGuest(row:ResultInput,playerId:string,guestId:string):ResultInput {
 const index=row.players.findIndex(player=>player.id===playerId&&player.userId&&player.played);
 if(index<0)return row;
 const players=[...row.players];
 players[index]={...players[index],played:false,kills:0,deaths:0,assists:0};
 players.splice(index+1,0,{id:guestId,userId:null,played:true,kills:null,deaths:null,assists:null});
 return {...row,players};
}
