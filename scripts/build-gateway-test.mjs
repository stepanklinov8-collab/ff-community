import {spawn} from 'node:child_process';
import {safeTestEnv} from './safe-test-env.mjs';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{env:{...safeTestEnv(),NEXT_PUBLIC_SUPABASE_TRANSPORT:'proxy'},stdio:'inherit',windowsHide:true});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});
