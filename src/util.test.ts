/* eslint-disable @typescript-eslint/ban-ts-comment */
import { AxiosInstance } from 'axios';
import { v4 } from 'uuid';
import { APIClient } from './util';

const axios: jest.MockedObject<AxiosInstance> = {
  request: jest.fn(),
} as any;

beforeEach(() => {
  axios.request.mockReset();
});

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
  'PUT /list': {
    Request: { message: string }[];
    Response: { message: string };
  };
};

describe('APIClient', () => {
  // Don't actually execute this test -- we're just ensuring that it compiles.
  test('type inference for request payloads', async () => {
    const client = new APIClient<TestEndpoints>(axios);

    jest
      .spyOn(client, 'request')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .mockResolvedValue({ data: { message: '' } } as any);

    // The client should not allow routes that aren't in the endpoints.
    // @ts-expect-error
    void client.request('GET /bogus/route');

    // Omitting a request payload should cause an error.
    // @ts-expect-error
    void client.request('GET /items', {});
    // Passing bogus request payload should cause an error.
    // @ts-expect-error
    void client.request('GET /items', { bogus: '' });
    // This should compile.
    const getItemsResponse = await client.request('GET /items', { filter: '' });
    // Referencing non-existing properties on the response should cause an error.
    // @ts-expect-error
    getItemsResponse.data.bogus;
    // Confirm that the message is a string.
    getItemsResponse.data.message.replace('', '');

    // Omitting a request payload should cause an error.
    // @ts-expect-error
    void client.request('GET /items/:id', {});
    // Passing bogus request payload should cause an error.
    // @ts-expect-error
    void client.request('GET /items/:id', { bogus: '' });
    // Omitting path params should cause an error.
    // @ts-expect-error
    void client.request('GET /items/:id', { filter: '' });
    // Omitting query params should cause an error.
    // @ts-expect-error
    void client.request('GET /items/:id', { id: '' });
    // This should compile.
    const getItemByIdResponse = await client.request('GET /items/:id', {
      id: '',
      filter: '',
    });
    // Referencing non-existing properties on the response should cause an error.
    // @ts-expect-error
    getItemByIdResponse.data.bogus;
    // Confirm that the message is a string.
    getItemByIdResponse.data.message.replace('', '');

    // Omitting a request payload should cause an error.
    // @ts-expect-error
    void client.request('POST /items', {});
    // Passing bogus request payload should cause an error.
    // @ts-expect-error
    void client.request('POST /items', { bogus: '' });
    // Omitting path params should cause an error.
    // @ts-expect-error
    void client.request('POST /items', { filter: '' });
    // Omitting query params should cause an error.
    // @ts-expect-error
    void client.request('POST /items', { id: '' });
    // This should compile.
    const postItemResponse = await client.request('POST /items', {
      message: '',
    });
    // Referencing non-existing properties on the response should cause an error.
    // @ts-expect-error
    postItemResponse.data.bogus;
    // Confirm that the message is a string.
    postItemResponse.data.message.replace('', '');
  });

  test('request sends correct data for a GET request', async () => {
    const client = new APIClient<TestEndpoints>(axios);

    const mockResponse = {
      headers: { 'some-header': v4() },
      data: { 'some-data': v4() },
      status: 200,
    };

    axios.request.mockResolvedValue(mockResponse);

    const payload = { id: v4(), filter: v4() };
    const result = await client.request('GET /items/:id', payload);

    expect(axios.request).toHaveBeenCalledTimes(1);
    expect(axios.request).toHaveBeenCalledWith({
      method: 'GET',
      url: `/items/${payload.id}`,
      params: { filter: payload.filter },
    });

    expect(result).toStrictEqual(mockResponse);
  });

  test('request sends correct data for a POST request', async () => {
    const client = new APIClient<TestEndpoints>(axios);

    const mockResponse = {
      headers: { 'some-header': v4() },
      data: { 'some-data': v4() },
      status: 200,
    };

    axios.request.mockResolvedValue(mockResponse);

    const payload = { message: v4() };
    const result = await client.request('POST /items', payload);

    expect(axios.request).toHaveBeenCalledTimes(1);
    expect(axios.request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/items',
      data: payload,
    });

    expect(result).toStrictEqual(mockResponse);
  });

  test('request sends correct data when the payload is an array', async () => {
    const client = new APIClient<TestEndpoints>(axios);

    const mockResponse = {
      headers: { 'some-header': v4() },
      data: { 'some-data': v4() },
      status: 200,
    };

    axios.request.mockResolvedValue(mockResponse);

    const payload = [{ message: v4() }, { message: v4() }];
    const result = await client.request('PUT /list', payload);

    expect(axios.request).toHaveBeenCalledTimes(1);
    expect(axios.request).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/list',
      data: payload,
    });

    expect(result).toStrictEqual(mockResponse);
  });
});
