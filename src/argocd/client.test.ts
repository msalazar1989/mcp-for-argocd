import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArgoCDClient } from './client.js';

const makeClient = (items: unknown[]) => {
  const client = new ArgoCDClient('https://argocd.example.com', 'test-token');
  let requestArgs: unknown[] = [];
  const httpClient = (
    client as unknown as { client: { get: (...args: unknown[]) => Promise<unknown> } }
  ).client;

  httpClient.get = async (...args) => {
    requestArgs = args;
    return { body: { items, metadata: { resourceVersion: 'rv-1' } } };
  };

  return { client, getRequestArgs: () => requestArgs };
};

test('listApplications filters names before pagination without sending search to Argo CD', async () => {
  const { client, getRequestArgs } = makeClient([
    { metadata: { name: 'alloy' } },
    { metadata: { name: 'gameboost-stage' } },
    { metadata: { name: 'gameboost-live' } }
  ]);

  const firstPage = await client.listApplications({ search: 'GAMEBOOST', limit: 1 });
  assert.deepEqual(
    firstPage.items.map((item) => item.metadata.name),
    ['gameboost-stage']
  );
  assert.equal(firstPage.metadata.totalItems, 2);
  assert.equal(firstPage.metadata.hasMore, true);

  const secondPage = await client.listApplications({ search: 'GAMEBOOST', limit: 1, offset: 1 });
  assert.deepEqual(
    secondPage.items.map((item) => item.metadata.name),
    ['gameboost-live']
  );
  assert.equal(secondPage.metadata.totalItems, 2);
  assert.equal(secondPage.metadata.returnedItems, 1);
  assert.equal(secondPage.metadata.hasMore, false);
  assert.deepEqual(getRequestArgs(), ['/api/v1/applications']);
});

test('listApplications reports zero matches for an unmatched search', async () => {
  const { client } = makeClient([{ metadata: { name: 'alloy' } }]);

  const result = await client.listApplications({ search: 'missing' });

  assert.deepEqual(result.items, []);
  assert.equal(result.metadata.totalItems, 0);
  assert.equal(result.metadata.returnedItems, 0);
  assert.equal(result.metadata.hasMore, false);
});
