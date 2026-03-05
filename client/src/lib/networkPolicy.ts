export function assertNoThirdPartyEgress(targetUrl: string, currentOrigin: string): void {
  const parsedTarget = new URL(targetUrl, currentOrigin);
  const parsedOrigin = new URL(currentOrigin);

  if (parsedTarget.origin !== parsedOrigin.origin) {
    throw new Error(`Third-party egress blocked: ${parsedTarget.origin}`);
  }
}
