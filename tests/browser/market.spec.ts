import {test,expect,type Page} from "@playwright/test";
const userId="00000000-0000-4000-8000-000000028001",asset="00000000-0000-4000-8000-000000028002",source="00000000-0000-4000-8000-000000028003",dealId="00000000-0000-4000-8000-000000028004";
const user={id:userId,aud:"authenticated",role:"authenticated",email:"market@example.invalid",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"};
const deal={id:dealId,organizationId:asset,name:"Команда Альфа",revision:1,price:300,expiresAt:"2026-12-30T16:00:00Z",status:"offered",buyerUserId:null,buyerOrganizationId:source,buyerName:"Покупатель ГИ",sellerName:"Владелец Альфы"};
const detail={deal,bundle:{organizations:[{id:asset,name:"Команда Альфа",balance:77,reserved:5,leader_id:userId}],contracts:[],obligations:[],members:[],rentals:[]},disclosed:true,freshDisclosure:true,consents:[{party:"seller",signedBy:userId,signedAt:"2026-10-31T10:00:00Z"}],escrow:null,dispute:null,canRevise:false,canOffer:false,canDisclose:false,canSellerAccept:false,canFund:true,canComplete:false,canCancel:true,canDispute:true,canResolve:false,canReverse:false,canMessage:true};
async function setup(page:Page,initial:object=detail){
 const token=[{alg:"HS256",typ:"JWT"},{sub:userId,exp:4102444800},"test-only"].map(value=>Buffer.from(typeof value==="string"?value:JSON.stringify(value)).toString("base64url")).join(".");
 await page.context().addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify({access_token:token,refresh_token:"test",expires_at:4102444800,expires_in:86400,token_type:"bearer",user})).toString("base64url"),domain:"127.0.0.1",path:"/",sameSite:"Lax"}]);
 await page.route("http://127.0.0.1:54321/**",route=>{const path=new URL(route.request().url()).pathname;if(path==="/auth/v1/user")return route.fulfill({json:user});const single=route.request().headers().accept?.includes("application/vnd.pgrst.object+json");const rows=path==="/rest/v1/profiles"?[{id:userId,nickname:"Покупатель"}]:[];return route.fulfill({json:single?rows[0]??null:rows});});
 const writes:Record<string,unknown>[]=[];let current=structuredClone(initial);
 await page.route("**/api/**",route=>{
  const url=new URL(route.request().url());if(url.pathname!=="/api/market")return route.fulfill({json:{modules:[],notifications:[],unreadCount:0,canOpenAdmin:false}});
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();writes.push(body);
   if(body.action==="save")current={...detail,deal:{...deal,id:body.dealId,status:"draft",revision:body.expectedRevision+1,price:body.price,buyerOrganizationId:body.buyerOrganizationId,buyerUserId:body.buyerUserId},canFund:false,canOffer:true};
   if(body.action==="buyer_fund")current={...detail,deal:{...deal,status:"funded"},canFund:false,canComplete:true,escrow:{amount:300,held:300}};
   if(body.action==="complete")current={...detail,deal:{...deal,status:"completed"},canFund:false,canComplete:false,canCancel:false,escrow:{amount:300,held:0}};
   return route.fulfill({json:{success:true,dealId:body.dealId}});
  }
  if(url.searchParams.has("search"))return route.fulfill({json:{items:[{id:asset,name:"Команда Альфа",kind:"team"}]}});
  if(url.searchParams.has("chat"))return route.fulfill({json:{messages:[],hasMore:false}});
  if(url.searchParams.has("dealId"))return route.fulfill({json:current});
  return route.fulfill({json:{deals:[deal],hasMore:false,organizations:[{id:source,name:"Покупатель ГИ",kind:"guild",canSpend:true}],userId}});
 });
 return writes;
}

test("organization proposal selects a separate organization buyer and saves no reserve",async({page})=>{
 const writes=await setup(page);await page.goto("/market");await page.getByRole("button",{name:"Создать предложение",exact:true}).click();
 const form=page.getByRole("form",{name:"Предложение покупки организации"});await form.getByLabel("Поиск: Организация для покупки",{exact:true}).fill("Альфа");await form.getByRole("button",{name:"Найти: Организация для покупки",exact:true}).click();await form.getByRole("button",{name:"Команда Альфа · команда",exact:true}).click();
 await form.getByLabel("Покупатель",{exact:true}).selectOption(source);await form.getByLabel("Цена, OC",{exact:true}).fill("300");
 await form.getByRole("button",{name:"Сохранить черновик предложения",exact:true}).click();await expect(page.getByRole("status")).toContainText("Изменения сохранены");
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({action:"save",organizationId:asset,buyerUserId:null,buyerOrganizationId:source,expectedRevision:0,price:300});expect(writes[0]).not.toHaveProperty("sellerUserId");expect(writes[0]).not.toHaveProperty("bundle");
 await expect(page.getByRole("button",{name:"Отправить предложение",exact:true})).toBeVisible();
});

test("organization funding retries one request and completion requires reviewed obligations",async({page})=>{
 const writes=await setup(page);const funding:Record<string,unknown>[]=[];
 await page.route("**/api/market",route=>{if(route.request().method()!=="POST"||route.request().postDataJSON().action!=="buyer_fund")return route.fallback();funding.push(route.request().postDataJSON());return funding.length===1?route.abort("failed"):route.fallback();});
 await page.goto(`/market?dealId=${dealId}`);await page.getByRole("button",{name:"Зарезервировать цену",exact:true}).click();let dialog=page.getByRole("dialog",{name:"Подтверждение сделки"});await expect(dialog).toContainText("счёте организации-покупателя");await expect(dialog).toContainText("DEMO-баланс");
 await dialog.getByRole("button",{name:"Подтвердить действие"}).click();await expect(dialog.getByRole("alert")).toContainText("Ответ не получен");await dialog.getByRole("button",{name:"Подтвердить действие"}).click();await expect(dialog).toHaveCount(0);expect(funding).toHaveLength(2);expect(funding[0].requestId).toBe(funding[1].requestId);
 await page.getByRole("button",{name:"Завершить покупку",exact:true}).click();dialog=page.getByRole("dialog",{name:"Подтверждение сделки"});await expect(dialog.getByRole("button",{name:"Подтвердить действие"})).toBeDisabled();await dialog.getByLabel("Я ознакомился с раскрытыми договорами и обязательствами").check();await dialog.getByRole("button",{name:"Подтвердить действие"}).click();await expect(dialog).toHaveCount(0);expect(writes.filter(w=>w.action==="complete")).toHaveLength(1);await expect(page.getByRole("region",{name:"Условия сделки"})).toContainText("Покупка завершена");
});

test("a confirmed market reserve with failed refresh hides stale financial controls",async({page})=>{
 await setup(page);let paid=false;
 await page.route("**/api/market**",route=>{if(route.request().method()==="POST"){paid=true;return route.fallback();}if(paid&&new URL(route.request().url()).searchParams.has("dealId"))return route.fulfill({status:503,json:{error:"Refresh failed"}});return route.fallback();});
 await page.goto(`/market?dealId=${dealId}`);await page.getByRole("button",{name:"Зарезервировать цену",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Подтвердить действие"}).click();await expect(page.getByRole("alert").filter({hasText:"Действие выполнено"})).toBeVisible();await expect(page.getByRole("button",{name:"Зарезервировать цену",exact:true})).toHaveCount(0);await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("buyer cannot inspect organization contracts before owner disclosure",async({page})=>{
 await setup(page,{...detail,bundle:null,disclosed:false,freshDisclosure:false,canFund:false});await page.goto(`/market?dealId=${dealId}`);const region=page.getByRole("region",{name:"Условия сделки"});await expect(region).toContainText("требуется отдельное разрешение владельца");await expect(region.locator("summary")).toHaveCount(0);await expect(page.getByRole("button",{name:"Зарезервировать цену",exact:true})).toHaveCount(0);
});

test("owner explicitly permits one deal disclosure without sending client-supplied contracts",async({page})=>{
 const writes=await setup(page,{...detail,disclosed:false,freshDisclosure:false,canFund:false,canDisclose:true});await page.goto(`/market?dealId=${dealId}`);await page.getByRole("button",{name:"Разрешить просмотр договоров",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Подтверждение сделки"});await expect(dialog).toContainText("дочерних организаций");await expect(dialog).toContainText("Банковские реквизиты заявок не раскрываются");await dialog.getByRole("button",{name:"Подтвердить действие"}).click();await expect(dialog).toHaveCount(0);expect(writes[0]).toMatchObject({action:"disclose",dealId,revision:1});expect(writes[0]).not.toHaveProperty("bundle");expect(writes[0]).not.toHaveProperty("contracts");
});

test("private deal chat retains a reply on a lost response and renders text safely on mobile",async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});const messages=[{id:"1",senderId:asset,name:"Продавец",body:"Обсудим условия",replyTo:null,createdAt:"2026-10-31T10:00:00Z"}],attempts:Record<string,unknown>[]=[];
 await page.route("**/api/market**",route=>{const params=new URL(route.request().url()).searchParams;if(params.has("chat"))return route.fulfill({json:{messages,hasMore:false}});if(route.request().method()==="POST"&&route.request().postDataJSON().action==="message"){const data=route.request().postDataJSON();attempts.push(data);if(attempts.length===1)return route.abort("failed");messages.push({id:"2",senderId:userId,name:"Покупатель",body:data.body,replyTo:data.replyTo,createdAt:"2026-10-31T10:01:00Z"});return route.fulfill({json:{success:true,messageId:"2"}});}return route.fallback();});
 await page.goto(`/market?dealId=${dealId}`);await page.getByRole("button",{name:"Обсуждение сделки",exact:true}).click();const chat=page.getByRole("region",{name:"Обсуждение сделки"});await chat.getByRole("button",{name:"Ответить",exact:true}).click();await chat.getByLabel("Сообщение",{exact:true}).fill("<script>window.marketInjection=true</script>");await chat.getByRole("button",{name:"Отправить сообщение",exact:true}).click();await expect(chat.getByRole("alert")).toContainText("Повторная отправка");await chat.getByRole("button",{name:"Отправить сообщение",exact:true}).click();await expect(chat.getByRole("status")).toContainText("Сообщение отправлено");expect(attempts[0].requestId).toBe(attempts[1].requestId);expect(attempts[0].replyTo).toBe("1");await expect(chat.locator("script")).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole("region",{name:"Условия сделки"}).screenshot({path:"tools/database-tests/artifacts/contracts/market-mobile.png"});
});

test("disabled contracts module also disables market page and API",async({request})=>{
 const html=await(await request.get("http://127.0.0.1:3104/market")).text();expect(html).not.toContain("Согласуйте цену, ознакомьтесь с обязательствами");expect(html).toContain("NEXT_HTTP_ERROR_FALLBACK;404");expect((await request.get("http://127.0.0.1:3104/api/market")).status()).toBe(404);
});
