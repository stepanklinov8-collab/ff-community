import {spawn} from 'node:child_process';
import {safeTestEnv} from './safe-test-env.mjs';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3106','-H','127.0.0.1'],{env:{...safeTestEnv(),NEXT_PUBLIC_SUPABASE_TRANSPORT:'proxy',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3106',OMCITE_MODULES:'chat=public,contracts=public'},stdio:'inherit',windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
