// Explicit, local-only opt-in to the named staging project. The default dev
// command stays disposable and never inherits real credentials.
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {safeTestEnv} from '../../scripts/safe-test-env.mjs';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
const config=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-staging-private.json',import.meta.url),'utf8'));
if(process.argv.slice(2).some(arg=>arg!=='--backend-proxy'))throw Error('Only --backend-proxy is accepted');
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);
if(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname!==stagingProject+'.supabase.co'||!config.NEXT_PUBLIC_SUPABASE_ANON_KEY||!config.SUPABASE_SERVICE_ROLE_KEY)throw Error('Dedicated staging credentials required');
const env={...safeTestEnv(),NODE_ENV:'development',NEXT_PUBLIC_DEPLOYMENT_ENV:'development',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3001',
 NEXT_PUBLIC_SUPABASE_URL:config.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:config.SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_SUPABASE_TRANSPORT:process.argv.includes('--backend-proxy')?'proxy':'direct',
 OMCITE_MODULES:'chat=public,contracts=public',OMCITE_TEST_EXTERNAL_EFFECTS:'',NODE_OPTIONS:'--v8-pool-size=1 --max-old-space-size=1536',RAYON_NUM_THREADS:'1'};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p','3001','-H','127.0.0.1'],{env,stdio:'inherit',windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
