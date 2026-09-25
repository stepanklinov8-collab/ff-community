export async function GET(){return Response.json({sessions:[],message:"Комнаты доступны по группам на странице мероприятия."});}
export async function PATCH(){return Response.json({error:"Откройте настройки комнаты соответствующей группы на странице мероприятия."},{status:410});}
