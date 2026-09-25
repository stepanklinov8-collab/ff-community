interface DeliveryResponse {
  successCount: number;
  failureCount: number;
  responses: Array<{ success: boolean; error?: { code: string } }>;
}

/** FCM accepts at most 500 recipients per call. Keep response indexes local to each batch. */
export async function deliverPushTokens(
  tokens: string[],
  send: (batch: string[]) => Promise<DeliveryResponse>,
) {
  const unique = [...new Set(tokens.filter(Boolean))];
  let successCount = 0, failureCount = 0;
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < unique.length; offset += 500) {
    const batch = unique.slice(offset, offset + 500);
    const result = await send(batch);
    successCount += result.successCount;
    failureCount += result.failureCount;
    result.responses.forEach((response, index) => {
      if (!response.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code ?? "")) {
        invalidTokens.push(batch[index]);
      }
    });
  }
  return { successCount, failureCount, invalidTokens };
}
