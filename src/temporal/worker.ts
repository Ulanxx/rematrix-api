import 'dotenv/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/video-generation.activities';

async function run() {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'rematrix-video';

  const bunnyHostname = process.env.BUNNY_STORAGE_HOSTNAME ?? '';
  const bunnyZone = process.env.BUNNY_STORAGE_ZONE ?? '';
  const bunnyKeyPrefix = (process.env.BUNNY_STORAGE_ACCESS_KEY ?? '').slice(
    0,
    6,
  );
  const bunnyPublic = process.env.BUNNY_PUBLIC_BASE_URL ? 'set' : 'unset';

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve('./workflows/video-generation.workflow'),
    activities,
  });

  console.log(
    `[temporal-worker] started. address=${address} namespace=${namespace} taskQueue=${taskQueue}`,
  );
  console.log(
    `[temporal-worker] bunny hostname=${bunnyHostname} zone=${bunnyZone} keyPrefix=${bunnyKeyPrefix} publicBase=${bunnyPublic}`,
  );

  await worker.run();
}

run().catch((err) => {
  console.error('[temporal-worker] fatal', err);
  process.exit(1);
});
