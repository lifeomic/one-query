import * as React from 'react';
import * as TestingLibrary from '@testing-library/react';
import axios from 'axios';
import { createAPIHooks } from './hooks';
import { createAPIMockingUtility } from './test-utils';
import { APIClient } from './util';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const { useQuery, useMutation, useCombinedQueries } = createAPIHooks({
  name: 'test-name',
  client: new APIClient<TestEndpoints>(
    axios.create({ baseURL: 'https://www.lifeomic.com' }),
  ),
});

const network = createAPIMockingUtility<TestEndpoints>({
  baseUrl: 'https://www.lifeomic.com',
})();

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});

beforeEach(() => {
  client.clear();
});

const render = (Component: React.FC) =>
  TestingLibrary.render(<Component />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

describe('useQuery', () => {
  test('works correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useQuery('GET /items', { filter: 'test-filter' });
      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await TestingLibrary.waitFor(() => {
      expect(screen.getByTestId('content').textContent).toStrictEqual(
        'test-message',
      );
    });
  });
});

describe('useMutation', () => {
  test('works correctly', async () => {
    const networkPost = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'another-test-message' },
    });
    network.mock('POST /items', networkPost);

    const screen = render(() => {
      const mutation = useMutation('POST /items');
      return (
        <button
          onClick={() => {
            mutation.mutate({ message: 'something' });
          }}
        >
          Press Me
        </button>
      );
    });

    TestingLibrary.fireEvent.click(screen.getByText('Press Me'));

    await TestingLibrary.waitFor(() => {
      expect(networkPost).toHaveBeenCalledTimes(1);
      expect(networkPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { message: 'something' },
        }),
      );
    });
  });
});

describe('useCombinedQueries', () => {
  beforeEach(() => {
    network
      .mock('GET /items', { status: 200, data: { message: 'get response' } })
      .mock('POST /items', { status: 200, data: { message: 'post response' } })
      .mock('GET /items/:id', {
        status: 200,
        data: { message: 'put response' },
      });
  });

  const setup = () => {
    const onRender = jest.fn();
    const screen = render(() => {
      const query = useCombinedQueries(
        ['GET /items', { filter: '' }],
        ['POST /items', { message: '' }],
        ['GET /items/:id', { filter: '', id: 'test-id' }],
      );

      if (onRender) {
        onRender(query);
      }
      return (
        <>
          <button onClick={query.refetchAll}>Refetch All</button>
        </>
      );
    });

    return { screen, onRender };
  };

  test('loading state', async () => {
    const { onRender } = setup();

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: true,
          isRefetching: false,
          isError: false,
          data: undefined,
        }),
      );
    });
  });

  test('error state', async () => {
    network.mock('POST /items', { status: 500, data: {} });
    const { onRender } = setup();

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: false,
          isRefetching: false,
          isError: true,
          data: undefined,
        }),
      );
    });
  });

  test('success state', async () => {
    const { onRender } = setup();

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: false,
          isRefetching: false,
          isError: false,
          data: [
            { message: 'get response' },
            { message: 'post response' },
            { message: 'put response' },
          ],
        }),
      );
    });
  });

  test('refetchAll', async () => {
    network
      .mockOrdered('GET /items', [
        { status: 200, data: { message: 'get response 1' } },
        { status: 200, data: { message: 'get response 2' } },
      ])
      .mockOrdered('POST /items', [
        { status: 200, data: { message: 'post response 1' } },
        { status: 200, data: { message: 'post response 2' } },
      ])
      .mockOrdered('GET /items/:id', [
        { status: 200, data: { message: 'put response 1' } },
        { status: 200, data: { message: 'put response 2' } },
      ]);
    const { screen, onRender } = setup();

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: false,
          isRefetching: false,
          isError: false,
          data: [
            { message: 'get response 1' },
            { message: 'post response 1' },
            { message: 'put response 1' },
          ],
        }),
      );
    });

    TestingLibrary.fireEvent.click(screen.getByText('Refetch All'));

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: false,
          isRefetching: false,
          isError: false,
          data: [
            { message: 'get response 2' },
            { message: 'post response 2' },
            { message: 'put response 2' },
          ],
        }),
      );
    });
  });
});
