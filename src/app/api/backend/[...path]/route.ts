import {serverEnvironment} from '@/platform/server-environment';
import {backendTransport} from '@/platform/backend-transport';
import {proxyBackendRequest} from '@/platform/backend-gateway';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

async function handle(request:Request) {
  serverEnvironment();
  if (backendTransport() !== 'proxy') return Response.json({message:'Backend proxy disabled'},{status:404,headers:{'Cache-Control':'no-store'}});
  return proxyBackendRequest(request,{endpoint:process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!});
}
export {handle as GET,handle as HEAD,handle as POST,handle as PUT,handle as PATCH,handle as DELETE};
