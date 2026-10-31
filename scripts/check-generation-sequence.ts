import { generateFollowUp } from '../src/app/tutor/generator';
process.loadEnvFile('.env.local');
const recentIds:string[]=[];const recentPlans:unknown[]=[];
for(let i=0;i<5;i++) {
 try {const q=await generateFollowUp({conceptId:'light:reflection',difficulty:1,goal:'Verify angles are measured from the normal in a fresh example.',misconceptionTag:'m:angle-from-surface',previousQuestion:'Synthetic test: a ray makes 25 degrees with the mirror surface.',recentIds,recentPlans});if(!q)throw Error('missing');recentIds.push(q.id);recentPlans.push(q.origin);console.log(JSON.stringify({step:i,stem:q.stem,answer:q.answer}));}
 catch(e){console.log(String(e).replaceAll(process.env.LLM_API_KEY!,'[redacted]'));process.exitCode=1;break;}
}
