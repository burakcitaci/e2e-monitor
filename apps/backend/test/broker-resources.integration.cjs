// Real Docker management operations, isolated from the normal application database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const mongoose = require('mongoose');
const { ServiceBusAdministrationClient } = require('@azure/service-bus');
const {
  SQSClient,
  GetQueueAttributesCommand,
  DeleteQueueCommand,
} = require('@aws-sdk/client-sqs');
const {
  SNSClient,
  GetTopicAttributesCommand,
  DeleteTopicCommand,
} = require('@aws-sdk/client-sns');

const exampleProcesses = new Set();
function runExample(args, environment, listen = false, expectedCode = 0) {
  const child = spawn(
    'dotnet',
    [
      resolve('examples/servicebus-csharp/bin/smoke/ServiceBusExample.dll'),
      ...args,
    ],
    {
      windowsHide: true,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  exampleProcesses.add(child);
  let output = '';
  let onListening;
  const ready = listen
    ? new Promise((done) => {
        onListening = done;
      })
    : Promise.resolve();
  child.stdout.on('data', (data) => {
    output += data.toString();
    if (output.includes('Listening on')) onListening?.();
  });
  child.stderr.on('data', (data) => {
    output += data.toString();
  });
  const done = new Promise((resolveRun, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`C# process timed out: ${output}`));
    }, 45000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      exampleProcesses.delete(child);
      if (code === expectedCode) resolveRun(output);
      else reject(new Error(`C# process exited ${code}: ${output}`));
    });
  });
  // A subscriber may exit while its publisher is starting; observe early failures.
  done.catch(() => undefined);
  return {
    done,
    ready: Promise.race([
      ready,
      done.then(() => {
        if (listen)
          throw new Error(`Subscriber exited before readiness: ${output}`);
      }),
    ]),
  };
}

async function verifyMessaging(resource, base, db, queueUrl = false) {
  const destination = queueUrl
    ? ['--queue-url', resource.brokerAddress]
    : resource.type === 'queue'
      ? ['--queue', resource.name]
      : ['--topic', resource.name, '--subscription', 'logging-service'];
  const common = [
    '--provider',
    resource.provider,
    ...destination,
    '--capture-api',
    `${base}/`,
    '--capture-token',
    'broker-smoke-token',
  ];
  // subscription is a receive option, so remove it for topic publishers.
  const publish = common.filter(
    (argument, index) =>
      argument !== '--subscription' && common[index - 1] !== '--subscription',
  );
  const environment = {
    SERVICE_BUS_CONNECTION_STRING:
      'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;',
    AWS_ENDPOINT_URL: 'http://localhost:4566',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    SERVICE_BUS_QUEUE: '',
  };
  const subscriber = runExample(
    [
      'subscribe',
      ...common,
      '--receiver',
      'smoke-consumer',
      '--max-messages',
      '1',
    ],
    environment,
    true,
  );
  await subscriber.ready;
  const body = `C# smoke ${resource.name} ${queueUrl ? 'queue-url' : 'name'}`;
  const sent = await runExample(
    ['publish', ...publish, '--sender', 'smoke-publisher', '--body', body],
    environment,
  ).done;
  const received = await subscriber.done;
  assert(
    !sent.includes('[capture warning]') &&
      !received.includes('[capture warning]'),
    'Capture reports must succeed',
  );
  const captureId = /captureId=([a-f\d-]{36})/i.exec(sent)?.[1];
  assert(captureId, 'Publisher must emit a capture ID');
  const record = await db
    .collection('CapturedMessages')
    .findOne({ 'state.captureId': captureId });
  assert(record, 'C# capture must be persisted');
  assert.equal(record.state.provider, resource.provider);
  assert.equal(record.state.destinationType, resource.type);
  assert.equal(record.state.destination, resource.name);
  assert.equal(record.state.sent.body, body);
  assert.equal(record.state.deliveries[0].service, 'smoke-consumer');
  assert(
    record.state.deliveries[0].receivedAt &&
      record.state.deliveries[0].completedAt,
  );
  console.log(
    `PASS C# ${resource.provider} ${resource.type}${queueUrl ? ' URL' : ''}: send + receive + complete + MongoDB capture`,
  );
}

async function main() {
  const id = randomUUID().replaceAll('-', '');
  const database = `e2e_broker_smoke_${id}`;
  const port = 3017;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const connection =
    'Endpoint=sb://localhost:5300;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;';
  const uri = 'mongodb://testuser:testpass@localhost:27017/';
  const azure = new ServiceBusAdministrationClient(connection);
  const options = {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };
  const sqs = new SQSClient(options);
  const sns = new SNSClient(options);
  const owned = [];
  const cleanupErrors = [];
  let db;
  let server;
  try {
    // Do not send requests to, or stop, an unrelated process already using the port.
    const net = require('node:net');
    await new Promise((resolvePort, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(port, '127.0.0.1', () => probe.close(resolvePort));
    });
    server = spawn(process.execPath, [resolve('apps/backend/dist/main.js')], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(port),
        MONGO_URI: uri,
        MONGO_MESSAGE_DB: database,
        MONGO_AUTH_SOURCE: 'admin',
        SERVICE_BUS_ADMIN_CONNECTION_STRING: connection,
        AWS_ENDPOINT_URL: options.endpoint,
        AWS_REGION: options.region,
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        CAPTURE_TOKEN: 'broker-smoke-token',
        THROTTLE_LIMIT: '1000',
      },
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null)
        throw new Error('Isolated API exited before readiness');
      try {
        if (
          (
            await fetch(`${base}/health/ready`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        ) {
          ready = true;
          break;
        }
      } catch {
        /* wait for startup */
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    assert(ready, 'Isolated API did not become ready');
    db = await mongoose
      .createConnection(uri, { dbName: database, authSource: 'admin' })
      .asPromise();
    for (const [provider, type] of [
      ['azure', 'queue'],
      ['azure', 'topic'],
      ['aws', 'queue'],
      ['aws', 'topic'],
    ]) {
      const resource = {
        provider,
        type,
        name: `e2e-smoke-${id}-${provider}-${type}`,
        status: 'active',
        ...(provider === 'azure' && type === 'topic'
          ? { subscriptions: ['logging-service'] }
          : {}),
      };
      async function create() {
        const response = await fetch(`${base}/message-resources/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resource),
          signal: AbortSignal.timeout(30000),
        });
        const result = await response.json();
        assert(response.ok, `${provider} ${type}: ${JSON.stringify(result)}`);
        return result.data;
      }
      const saved = await create();
      owned.push(saved);
      assert.equal(
        (await create()).id,
        saved.id,
        'Retry must preserve the catalog ID',
      );
      assert.equal(
        await db
          .collection('MessagingResources')
          .countDocuments({ name: resource.name, provider, type }),
        1,
      );
      const row = await db
        .collection('MessagingResources')
        .findOne({ id: saved.id });
      assert.equal(row.brokerAddress, saved.brokerAddress);
      if (provider === 'azure') {
        assert(
          await (type === 'queue'
            ? azure.queueExists(resource.name)
            : azure.topicExists(resource.name)),
        );
        if (type === 'topic')
          assert(
            await azure.subscriptionExists(resource.name, 'logging-service'),
          );
      } else if (type === 'queue') {
        await sqs.send(
          new GetQueueAttributesCommand({ QueueUrl: saved.brokerAddress }),
        );
      } else {
        await sns.send(
          new GetTopicAttributesCommand({ TopicArn: saved.brokerAddress }),
        );
      }
      console.log(
        `PASS ${provider} ${type}: broker + MongoDB + idempotent retry`,
      );
      if (
        process.argv.includes('--messaging') &&
        (provider === 'azure' || type === 'queue')
      ) {
        await verifyMessaging(saved, base, db);
        if (provider === 'aws') await verifyMessaging(saved, base, db, true);
      }
    }
    if (process.argv.includes('--messaging')) {
      const invalid = await runExample(
        ['publish', '--provider', 'invalid'],
        {},
        false,
        1,
      ).done;
      assert(invalid.includes('--provider must be azure or aws'));
      const conflicting = await runExample(
        ['publish', '--provider', 'aws', '--topic', 'events'],
        {},
        false,
        1,
      ).done;
      assert(conflicting.includes('AWS uses SQS queues'));
    }
  } finally {
    for (const child of exampleProcesses) child.kill();
    for (const resource of owned.reverse()) {
      try {
        if (resource.provider === 'azure') {
          await (resource.type === 'queue'
            ? azure.deleteQueue(resource.name)
            : azure.deleteTopic(resource.name));
        } else if (resource.type === 'queue') {
          await sqs.send(
            new DeleteQueueCommand({ QueueUrl: resource.brokerAddress }),
          );
        } else
          await sns.send(
            new DeleteTopicCommand({ TopicArn: resource.brokerAddress }),
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (db) {
      try {
        await db.dropDatabase();
      } catch (error) {
        cleanupErrors.push(error);
      } finally {
        await db.close();
      }
    }
    if (server && server.exitCode === null) {
      const stopped = new Promise((done) => server.once('exit', done));
      server.kill();
      await stopped;
    }
    sqs.destroy();
    sns.destroy();
  }
  if (cleanupErrors.length)
    throw new AggregateError(
      cleanupErrors,
      'Failed to clean up temporary smoke resources',
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
