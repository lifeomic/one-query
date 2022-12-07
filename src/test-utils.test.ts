import axios from 'axios';
import { v4 } from 'uuid';
import { createAPIMockingUtility } from './test-utils';
import { APIClient } from './util';

describe('createAPIMockingUtility', () => {
  type TestEndpoints = {
    'GET /items': {
      Request: { filter: string };
      Response: { message: string };
    };
    'GET /items/:id': {
      Request: { filter: string };
      Response: { message: string };
    };
    'POST /items': {
      Request: { message: string };
      Response: { message: string };
    };
  };

  const useNetworkMocking = createAPIMockingUtility<TestEndpoints>({
    baseUrl: 'https://www.lifeomic.com',
  });

  const network = useNetworkMocking();

  const client = new APIClient<TestEndpoints>(
    axios.create({ baseURL: 'https://www.lifeomic.com' }),
  );

  describe('mock(...)', () => {
    test('GET success with static responses', async () => {
      const response = { message: v4() };
      network.mock('GET /items', { status: 200, data: response });

      const result = await client.request('GET /items', { filter: '' });

      expect(result.status).toStrictEqual(200);
      expect(result.data).toStrictEqual(response);
    });

    test('GET success with function responses', async () => {
      network.mock('GET /items/:id', (req, ctx) => {
        ctx.delay(50);
        return {
          status: 200,
          data: { message: `${req.query.filter}|${req.params.id}` },
        };
      });

      const payload = { id: v4(), filter: v4() };
      const result = await client.request('GET /items/:id', payload);

      expect(result.status).toStrictEqual(200);
      expect(result.data).toStrictEqual({
        message: `${payload.filter}|${payload.id}`,
      });
    });

    test('POST success with static responses', async () => {
      const response = { message: v4() };
      network.mock('POST /items', { status: 200, data: response });

      const result = await client.request('POST /items', { message: '' });

      expect(result.status).toStrictEqual(200);
      expect(result.data).toStrictEqual(response);
    });

    test('POST success with function responses', async () => {
      network.mock('POST /items', (req) => ({
        status: 200,
        data: { message: req.body.message },
      }));

      const payload = { message: v4() };
      const result = await client.request('POST /items', payload);

      expect(result.status).toStrictEqual(200);
      expect(result.data).toStrictEqual({ message: payload.message });
    });
  });

  test('mockOrdered', async () => {
    network.mockOrdered('GET /items', [
      { status: 200, data: { message: '1' } },
      { status: 200, data: { message: '2' } },
      { status: 200, data: { message: '3' } },
    ]);

    const first = await client.request('GET /items', { filter: '' });
    expect(first.status).toStrictEqual(200);
    expect(first.data).toStrictEqual({ message: '1' });

    const second = await client.request('GET /items', { filter: '' });
    expect(second.status).toStrictEqual(200);
    expect(second.data).toStrictEqual({ message: '2' });

    const third = await client.request('GET /items', { filter: '' });
    expect(third.status).toStrictEqual(200);
    expect(third.data).toStrictEqual({ message: '3' });
  });
});
