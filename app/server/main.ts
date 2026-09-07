import { serve } from './index';

/* the server as a process: PORT and HOST from the environment, nothing else */
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';

serve({ port, host }).then((s) => {
  console.log(`brassworks table server listening on ${host}:${s.port}`);
});
