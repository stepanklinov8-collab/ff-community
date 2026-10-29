import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {safeTestEnv} from './safe-test-env.mjs';
import {assertTestDatabaseTarget,stagingProject} from '../src/platform/environment.ts';
const config=JSON.parse(readFileSync('tools/database-tests/artifacts/prize-wallets/local-staging-private.json','utf8'));
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);
if(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname!==`${stagingProject}.supabase.co`)throw Error('Only the dedicated staging project is allowed');
const env={...safeTestEnv(),NEXT_PUBLIC_DEPLOYMENT_ENV:'development',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3001',
 NEXT_PUBLIC_SUPABASE_URL:config.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
 SUPABASE_SERVICE_ROLE_KEY:config.SUPABASE_SERVICE_ROLE_KEY,OMCITE_MODULES:'chat=public,contracts=public',OMCITE_TEST_EXTERNAL_EFFECTS:''};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p','3001','-H','127.0.0.1'],{env,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
