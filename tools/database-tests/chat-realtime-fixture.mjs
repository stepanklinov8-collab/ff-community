// A database-only stand-in for Realtime's SQL interface. This exercises our
// actual channel policy and payloads; it does not simulate the WebSocket SDK.
export async function installChatRealtimeFixture(db) {
 await db.exec(`create schema realtime;
 create table realtime.messages(topic text,extension text,payload jsonb);
 alter table realtime.messages enable row level security;
 grant usage on schema realtime,auth,public to authenticated;
 grant select on realtime.messages to authenticated;
 create function realtime.topic() returns text language sql stable as $$select current_setting('test.realtime_topic',true)$$;
 create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$
 insert into realtime.messages(topic,extension,payload) values(topic,'broadcast',payload) $$;`);
}
