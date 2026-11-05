type VkFetch = typeof fetch;
export async function sendVkFinanceNotice(input: {
  token: string; recipient: string; groupId: number; deliveryId: number; message: string;
}, send: VkFetch = fetch) {
  const call = async (method: string, params: Record<string,string>) => {
    const response = await send('https://api.vk.com/method/' + method, {
      method:'POST', body:new URLSearchParams({...params,access_token:input.token,v:'5.199'}),
      signal:AbortSignal.timeout(5000),cache:'no-store',redirect:'error',
    });
    if (!response.ok) throw new Error('VK_HTTP_' + response.status);
    const value = await response.json();
    if (value.error) throw new Error('VK_' + Number(value.error.error_code || 0));
    return value.response;
  };
  let recipient = input.recipient;
  if (!/^[1-9]\d*$/.test(recipient)) {
    const resolved = await call('utils.resolveScreenName',{screen_name:recipient});
    if (resolved?.type !== 'user' || !Number.isSafeInteger(resolved.object_id) || resolved.object_id <= 0) throw new Error('VK_RECIPIENT');
    recipient = String(resolved.object_id);
  }
  const result = await call('messages.send',{
    user_id:recipient,group_id:String(input.groupId),random_id:String(input.deliveryId),message:input.message,
  });
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('VK_RESPONSE');
}
