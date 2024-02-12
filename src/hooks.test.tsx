import * as React from 'react';
import * as TestingLibrary from '@testing-library/react';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import axios, { AxiosInstance } from 'axios';
import { createAPIHooks } from './hooks';
import { createAPIMockingUtility } from './test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CacheUtils, EndpointInvalidationMap, RequestPayloadOf } from './types';
import { setupServer } from 'msw/node';

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
  'GET /list': {
    Request: {
      filter: string;
      after?: string;
      before?: string;
    };
    Response: {
      items: { message: string }[];
      next?: string;
      previous?: string;
    };
  };
};

const client = axios.create({ baseURL: 'https://www.lifeomic.com' });

jest.spyOn(client, 'request');

const {
  useAPIQuery,
  useSuspenseAPIQuery,
  useInfiniteAPIQuery,
  useSuspenseInfiniteAPIQuery,
  useAPIMutation,
  useCombinedAPIQueries,
  useSuspenseCombinedAPIQueries,
  useAPICache,
} = createAPIHooks<TestEndpoints>({
  name: 'test-name',
  client,
});

const server = setupServer();
server.listen({ onUnhandledRequest: 'error' });
const network = createAPIMockingUtility<TestEndpoints>({
  server,
  baseUrl: 'https://www.lifeomic.com',
})();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});

beforeEach(() => {
  jest.mocked(client.request).mockClear();
  queryClient.clear();
});

const render = (Component: React.FC) =>
  TestingLibrary.render(<Component />, {
    wrapper: ({ children }) => (
      <ErrorBoundary fallback={<span>error fallback</span>}>
        <React.Suspense fallback={<span>suspense fallback</span>}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </React.Suspense>
      </ErrorBoundary>
    ),
  });

describe('useAPIQuery', () => {
  test('works correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useAPIQuery('GET /items', { filter: 'test-filter' });
      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await TestingLibrary.waitFor(() => {
      expect(screen.getByTestId('content').textContent).toStrictEqual(
        'test-message',
      );
    });
  });

  test('sending axios parameters works', async () => {
    const getItems = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'test-message' },
    });
    network.mock('GET /items', getItems);

    render(() => {
      const query = useAPIQuery(
        'GET /items',
        { filter: 'test-filter' },
        { axios: { headers: { 'test-header': 'test-value' } } },
      );
      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await TestingLibrary.waitFor(() => {
      expect(getItems).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'test-header': 'test-value',
          }),
        }),
      );
    });
  });

  test('using select(...) works and is typed correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useAPIQuery(
        'GET /items',
        { filter: 'test-filter' },
        { select: (data) => data.message },
      );

      // This line implicitly asserts that `query.data` is typed as string.
      query.data?.codePointAt(0);

      return <div data-testid="content">{query.data || ''}</div>;
    });

    await TestingLibrary.waitFor(() => {
      expect(screen.queryByText('test-message')).toBeDefined();
    });
  });
});

describe('useSuspenseAPIQuery', () => {
  test('works correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useSuspenseAPIQuery('GET /items', {
        filter: 'test-filter',
      });

      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await TestingLibrary.waitForElementToBeRemoved(() =>
      screen.getByText(/suspense fallback/i),
    );

    expect((await screen.findByTestId('content')).textContent).toStrictEqual(
      'test-message',
    );
  });

  test('sending axios parameters works', async () => {
    const getItems = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'test-message' },
    });
    network.mock('GET /items', getItems);

    const screen = render(() => {
      const query = useSuspenseAPIQuery(
        'GET /items',
        { filter: 'test-filter' },
        { axios: { headers: { 'test-header': 'test-value' } } },
      );
      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await screen.findByText(/test-message/i);

    expect(getItems).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'test-header': 'test-value',
        }),
      }),
    );
  });

  test('using select(...) works and is typed correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useSuspenseAPIQuery(
        'GET /items',
        { filter: 'test-filter' },
        { select: (data) => data.message },
      );

      // This line implicitly asserts that `query.data` is typed as string.
      query.data.codePointAt(0);

      return <div data-testid="content">{query.data}</div>;
    });

    await screen.findByText(/test-message/i);
  });
});

describe('useInfiniteAPIQuery', () => {
  test('works correctly', async () => {
    const next = 'second';
    const previous = 'previous';
    const pages = {
      previous: {
        previous: undefined,
        next: 'first',
        items: [
          {
            message: 'previous',
          },
        ],
      },
      first: {
        previous,
        next: 'second',
        items: [
          {
            message: 'first',
          },
        ],
      },
      next: {
        previous: 'first',
        next: undefined,
        items: [
          {
            message: 'second',
          },
        ],
      },
    };

    const listSpy = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: pages.first,
      })
      .mockResolvedValueOnce({
        status: 200,
        data: pages.next,
      })
      .mockResolvedValue({
        status: 200,
        data: pages.previous,
      });

    network.mock('GET /list', listSpy);

    render(() => {
      const query = useInfiniteAPIQuery(
        'GET /list',
        {
          filter: 'some-filter',
          after: undefined,
        },
        {
          initialPageParam: {},
          getNextPageParam: (lastPage) => ({
            after: lastPage.next,
          }),
          getPreviousPageParam: (firstPage) => ({
            before: firstPage.previous,
          }),
        },
      );

      return (
        <div>
          <button
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            fetch next
          </button>
          <button
            onClick={() => {
              void query.fetchPreviousPage();
            }}
          >
            fetch previous
          </button>
          {query?.data?.pages?.flatMap((page) =>
            page.items.map((message) => (
              <p key={message.message}>{message.message}</p>
            )),
          )}
        </div>
      );
    });

    const [previousMessage, firstMessage, nextMessage] = Object.values(pages)
      .flatMap((page) => page.items)
      .map((item) => item.message);

    // initial load
    await TestingLibrary.screen.findByText(firstMessage);
    expect(TestingLibrary.screen.queryByText(previousMessage)).not.toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).not.toBeTruthy();

    // load next page _after_ first
    TestingLibrary.fireEvent.click(
      TestingLibrary.screen.getByRole('button', {
        name: /fetch next/i,
      }),
    );
    await TestingLibrary.screen.findByText(nextMessage);

    expect(TestingLibrary.screen.queryByText(firstMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(previousMessage)).not.toBeTruthy();

    // load previous page _before_ first
    TestingLibrary.fireEvent.click(
      TestingLibrary.screen.getByRole('button', {
        name: /fetch previous/i,
      }),
    );
    await TestingLibrary.screen.findByText(previousMessage);

    // all data should now be on the page
    expect(TestingLibrary.screen.queryByText(firstMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(previousMessage)).toBeTruthy();

    expect(listSpy).toHaveBeenCalledTimes(3);
    expect(listSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: { filter: 'some-filter' },
      }),
    );
    expect(listSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: { filter: 'some-filter', after: next },
      }),
    );
    expect(listSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        query: { filter: 'some-filter', before: previous },
      }),
    );
  });

  test('sending axios parameters works', async () => {
    const listSpy = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        next: undefined,
        items: [],
      },
    });

    network.mock('GET /list', listSpy);

    render(() => {
      useInfiniteAPIQuery(
        'GET /list',
        { filter: 'test-filter' },
        {
          axios: { headers: { 'test-header': 'test-value' } },
          initialPageParam: {},
          getNextPageParam: () => ({}),
        },
      );
      return <div />;
    });

    await TestingLibrary.waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'test-header': 'test-value',
          }),
        }),
      );
    });
  });
});

describe('useSuspenseInfiniteAPIQuery', () => {
  test('works correctly', async () => {
    const next = 'second';
    const previous = 'previous';
    const pages = {
      previous: {
        previous: undefined,
        next: 'first',
        items: [
          {
            message: 'previous',
          },
        ],
      },
      first: {
        previous,
        next: 'second',
        items: [
          {
            message: 'first',
          },
        ],
      },
      next: {
        previous: 'first',
        next: undefined,
        items: [
          {
            message: 'second',
          },
        ],
      },
    };

    const listSpy = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: pages.first,
      })
      .mockResolvedValueOnce({
        status: 200,
        data: pages.next,
      })
      .mockResolvedValue({
        status: 200,
        data: pages.previous,
      });

    network.mock('GET /list', listSpy);

    render(() => {
      const query = useSuspenseInfiniteAPIQuery(
        'GET /list',
        {
          filter: 'some-filter',
          after: undefined,
        },
        {
          initialPageParam: {},
          getNextPageParam: (lastPage) => ({
            after: lastPage.next,
          }),
          getPreviousPageParam: (firstPage) => ({
            before: firstPage.previous,
          }),
        },
      );

      return (
        <div>
          <button
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            fetch next
          </button>
          <button
            onClick={() => {
              void query.fetchPreviousPage();
            }}
          >
            fetch previous
          </button>
          {query?.data?.pages?.flatMap((page) =>
            page.items.map((message) => (
              <p key={message.message}>{message.message}</p>
            )),
          )}
        </div>
      );
    });

    const [previousMessage, firstMessage, nextMessage] = Object.values(pages)
      .flatMap((page) => page.items)
      .map((item) => item.message);

    await TestingLibrary.waitForElementToBeRemoved(() =>
      TestingLibrary.screen.getByText(/suspense fallback/i),
    );

    // initial load
    await TestingLibrary.screen.findByText(firstMessage);
    expect(TestingLibrary.screen.queryByText(previousMessage)).not.toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).not.toBeTruthy();

    // load next page _after_ first
    TestingLibrary.fireEvent.click(
      TestingLibrary.screen.getByRole('button', {
        name: /fetch next/i,
      }),
    );
    await TestingLibrary.screen.findByText(nextMessage);

    expect(TestingLibrary.screen.queryByText(firstMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(previousMessage)).not.toBeTruthy();

    // load previous page _before_ first
    TestingLibrary.fireEvent.click(
      TestingLibrary.screen.getByRole('button', {
        name: /fetch previous/i,
      }),
    );
    await TestingLibrary.screen.findByText(previousMessage);

    // all data should now be on the page
    expect(TestingLibrary.screen.queryByText(firstMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(nextMessage)).toBeTruthy();
    expect(TestingLibrary.screen.queryByText(previousMessage)).toBeTruthy();

    expect(listSpy).toHaveBeenCalledTimes(3);
    expect(listSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: { filter: 'some-filter' },
      }),
    );
    expect(listSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: { filter: 'some-filter', after: next },
      }),
    );
    expect(listSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        query: { filter: 'some-filter', before: previous },
      }),
    );
  });

  test('sending axios parameters works', async () => {
    const listSpy = jest.fn().mockResolvedValue({
      status: 200,
      data: {
        next: undefined,
        items: [],
      },
    });

    network.mock('GET /list', listSpy);

    render(() => {
      const query = useSuspenseInfiniteAPIQuery(
        'GET /list',
        { filter: 'test-filter' },
        {
          axios: { headers: { 'test-header': 'test-value' } },
          initialPageParam: {},
          getNextPageParam: () => ({}),
        },
      );
      return <div>{query.data.pages.at(0)?.items.length}</div>;
    });

    await TestingLibrary.screen.findByText('0');

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'test-header': 'test-value',
        }),
      }),
    );
  });
});

describe('useAPIMutation', () => {
  test('works correctly', async () => {
    const networkPost = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'another-test-message' },
    });
    network.mock('POST /items', networkPost);

    const screen = render(() => {
      const mutation = useAPIMutation('POST /items');
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

  test('axios parameters works', async () => {
    const networkPost = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'another-test-message' },
    });
    network.mock('POST /items', networkPost);

    const screen = render(() => {
      const mutation = useAPIMutation('POST /items', {
        axios: {
          headers: {
            'test-header': 'test-value',
          },
        },
      });
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
          headers: expect.objectContaining({
            'test-header': 'test-value',
          }),
        }),
      );
    });
  });
});

describe('useCombinedAPIQueries', () => {
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
      const query = useCombinedAPIQueries(
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
          isPending: true,
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
          isPending: false,
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
          isPending: false,
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
          isPending: false,
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
          isPending: false,
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

  test('sending axios parameters works', async () => {
    const getItems = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'test-message' },
    });
    network.mock('GET /items', getItems);

    render(() => {
      useCombinedAPIQueries([
        'GET /items',
        { filter: 'test-filter' },
        { axios: { headers: { 'test-header': 'test-value' } } },
      ]);
      return <div data-testid="content" />;
    });

    await TestingLibrary.waitFor(() => {
      expect(getItems).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'test-header': 'test-value',
          }),
        }),
      );
    });
  });
});

describe('useSuspenseCombinedAPIQueries', () => {
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
      const query = useSuspenseCombinedAPIQueries(
        ['GET /items', { filter: '' }],
        ['POST /items', { message: '' }],
        ['GET /items/:id', { filter: '', id: 'test-id' }],
      );

      if (onRender) {
        onRender(query);
      }
      return <button onClick={query.refetchAll}>Refetch All</button>;
    });

    return { screen, onRender };
  };

  test('error state', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    network.mock('POST /items', { status: 500, data: {} });
    setup();

    await TestingLibrary.waitForElementToBeRemoved(() =>
      TestingLibrary.screen.getByText(/suspense fallback/i),
    );

    expect(TestingLibrary.screen.getByText(/error fallback/i)).toBeDefined();
    errorSpy.mockRestore();
  });

  test('success state', async () => {
    const { onRender } = setup();

    await TestingLibrary.waitForElementToBeRemoved(() =>
      TestingLibrary.screen.getByText(/suspense fallback/i),
    );

    expect(onRender).toHaveBeenCalledWith(
      expect.objectContaining({
        isPending: false,
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

    await TestingLibrary.waitForElementToBeRemoved(() =>
      TestingLibrary.screen.getByText(/suspense fallback/i),
    );

    expect(onRender).toHaveBeenCalledWith(
      expect.objectContaining({
        isPending: false,
        isRefetching: false,
        isError: false,
        data: [
          { message: 'get response 1' },
          { message: 'post response 1' },
          { message: 'put response 1' },
        ],
      }),
    );

    TestingLibrary.fireEvent.click(screen.getByText('Refetch All'));

    await TestingLibrary.waitFor(() => {
      expect(onRender).toHaveBeenCalledWith(
        expect.objectContaining({
          isPending: false,
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

  test('sending axios parameters works', async () => {
    const getItems = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'test-message' },
    });
    network.mock('GET /items', getItems);

    render(() => {
      useSuspenseCombinedAPIQueries([
        'GET /items',
        { filter: 'test-filter' },
        { axios: { headers: { 'test-header': 'test-value' } } },
      ]);
      return <div data-testid="content" />;
    });

    await TestingLibrary.waitForElementToBeRemoved(() =>
      TestingLibrary.screen.getByText(/suspense fallback/i),
    );

    expect(getItems).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'test-header': 'test-value',
        }),
      }),
    );
  });
});

describe('useAPICache', () => {
  describe('invalidation', () => {
    beforeEach(() => {
      const messages = [{ message: '1' }, { message: '2' }, { message: '3' }];
      // Mock a bunch of different requests to help us confirm render count.
      network
        .mockOrdered(
          'GET /items/:id',
          messages.map((data) => ({ status: 200, data })),
        )
        .mockOrdered(
          'GET /list',
          messages.map((item) => ({
            status: 200,
            data: {
              previous: undefined,
              next: undefined,
              items: [item],
            },
          })),
        );
    });

    (['resetQueries', 'invalidateQueries'] as const).forEach((method) => {
      describe(`${method}`, () => {
        type TestComponentProps = {
          getRenderData: () => string;

          onPress: (
            invalidate: CacheUtils<TestEndpoints>[typeof method],
          ) => void;
        };

        const TestComponent: React.FC<TestComponentProps> = ({
          getRenderData,
          onPress,
        }) => {
          const cache = useAPICache();
          const data = getRenderData();
          return (
            <>
              <button
                data-testid="invalidate-button"
                onClick={() => onPress(cache[method])}
              >
                Invalidate
              </button>
              <div data-testid="text">{data}</div>
            </>
          );
        };

        it('invalidates infinite queries', async () => {
          const screen = render(() => (
            <TestComponent
              getRenderData={() => {
                const { data } = useInfiniteAPIQuery(
                  'GET /list',
                  {
                    filter: 'some-filter',
                  },
                  {
                    gcTime: Infinity,
                    initialPageParam: {},
                    getNextPageParam: () => ({}),
                  },
                );

                return `Response: ${
                  data?.pages?.at(-1)?.items?.at(-1)?.message || 'undefined'
                }`;
              }}
              onPress={(invalidate) => {
                invalidate({
                  'GET /list': (variables) =>
                    variables.filter === 'some-filter',
                });
              }}
            />
          ));

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 1',
            );
          });

          expect(client.request).toHaveBeenCalledTimes(1);

          TestingLibrary.fireEvent.click(
            screen.getByTestId('invalidate-button'),
          );

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 2',
            );
            expect(client.request).toHaveBeenCalledTimes(2);
          });

          screen.rerender(
            <TestComponent
              getRenderData={() => {
                const { data } = useInfiniteAPIQuery(
                  'GET /list',
                  {
                    filter: 'some-filter',
                  },
                  {
                    gcTime: Infinity,
                    initialPageParam: {},
                    getNextPageParam: () => ({}),
                  },
                );

                return `Response: ${
                  data?.pages?.at(-1)?.items?.at(-1)?.message || 'undefined'
                }`;
              }}
              onPress={(invalidate) => {
                invalidate({
                  'GET /list': 'all',
                });
              }}
            />,
          );

          TestingLibrary.fireEvent.click(
            screen.getByTestId('invalidate-button'),
          );

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 3',
            );
            expect(client.request).toHaveBeenCalledTimes(3);
          });
        });

        it('invalidates matching queries based on static match', async () => {
          const variables: RequestPayloadOf<TestEndpoints, 'GET /items/:id'> = {
            id: 'some-id',
            filter: 'some-filter',
          };

          const screen = render(() => (
            <TestComponent
              getRenderData={() => {
                const { data } = useAPIQuery('GET /items/:id', variables, {
                  gcTime: Infinity,
                });

                return `Response: ${data?.message || 'undefined'}`;
              }}
              onPress={(invalidate) => {
                invalidate({
                  'GET /items/:id': [variables],
                });
              }}
            />
          ));

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 1',
            );
          });

          expect(client.request).toHaveBeenCalledTimes(1);

          TestingLibrary.fireEvent.click(
            screen.getByTestId('invalidate-button'),
          );

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 2',
            );
            expect(client.request).toHaveBeenCalledTimes(2);
          });
        });

        it('invalidates matching queries based on predicate match', async () => {
          const screen = render(() => (
            <TestComponent
              getRenderData={() => {
                const { data } = useAPIQuery(
                  'GET /items/:id',
                  { id: 'some-id', filter: 'some-filter' },
                  { gcTime: Infinity },
                );

                return `Response: ${data?.message || 'undefined'}`;
              }}
              onPress={(invalidate) => {
                invalidate({
                  'GET /items/:id': (variables) =>
                    variables.filter === 'some-filter',
                });
              }}
            />
          ));

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 1',
            );
          });

          expect(client.request).toHaveBeenCalledTimes(1);

          TestingLibrary.fireEvent.click(
            screen.getByTestId('invalidate-button'),
          );

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Response: 2',
            );
            expect(client.request).toHaveBeenCalledTimes(2);
          });
        });

        it('invalidates all queries when "all" is used', async () => {
          network.reset();
          network.mockOrdered('GET /items/:id', [
            { status: 200, data: { message: '1' } },
            { status: 200, data: { message: '1' } },
            { status: 200, data: { message: '2' } },
            { status: 200, data: { message: '2' } },
          ]);
          const screen = render(() => (
            <TestComponent
              getRenderData={() => {
                const first = useAPIQuery(
                  'GET /items/:id',
                  { id: 'some-id', filter: 'some-filter' },
                  { gcTime: Infinity },
                );

                const second = useAPIQuery(
                  'GET /items/:id',
                  { id: 'some-other-id', filter: 'some-other-filter' },
                  { gcTime: Infinity },
                );

                return `Responses: ${first.data?.message || 'undefined'} ${
                  second.data?.message || 'undefined'
                }`;
              }}
              onPress={(invalidate) => {
                invalidate({
                  'GET /items/:id': 'all',
                });
              }}
            />
          ));

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Responses: 1 1',
            );
          });

          expect(client.request).toHaveBeenCalledTimes(2);

          TestingLibrary.fireEvent.click(
            screen.getByTestId('invalidate-button'),
          );

          await TestingLibrary.waitFor(() => {
            expect(screen.getByTestId('text').textContent).toStrictEqual(
              'Responses: 2 2',
            );
            expect(client.request).toHaveBeenCalledTimes(4);
          });
        });

        const wait = (ms: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms));

        const NON_INVALIDATION_SCENARIOS: {
          it: string;
          invalidate: EndpointInvalidationMap<TestEndpoints>;
          getRenderData?: () => string;
        }[] = [
          {
            it: 'does not invalidate queries that do not match static config',
            invalidate: {
              'GET /items/:id': [
                { id: 'some-other-id', filter: 'some-other-filter' },
              ],
            },
          },
          {
            it: 'does not invalidate queries that do not match predicate config',
            invalidate: {
              'GET /items/:id': (variables) =>
                variables.filter === 'some-other-filter',
            },
          },
          {
            it: 'does not invalidate query if the endpoint is not specified',
            invalidate: {},
          },
          {
            it: 'does not invalidate queries that were not created by the shared hooks',
            invalidate: {},
            getRenderData: () => {
              const { data } = useReactQuery({
                queryKey: ['some-other-key'],
                queryFn: () =>
                  client.request({
                    method: 'GET',
                    url: '/items/some-id',
                    params: { filter: 'some-filter' },
                  }),
              });

              return `Response: ${data?.data.message || 'undefined'}`;
            },
          },
        ];

        NON_INVALIDATION_SCENARIOS.forEach(
          ({ it: name, invalidate: spec, getRenderData }) => {
            it(`${name}`, async () => {
              const screen = render(() => (
                <TestComponent
                  getRenderData={
                    getRenderData ??
                    (() => {
                      const { data } = useAPIQuery(
                        'GET /items/:id',
                        { id: 'some-id', filter: 'some-filter' },
                        { gcTime: Infinity },
                      );

                      return `Response: ${data?.message || 'undefined'}`;
                    })
                  }
                  onPress={(invalidate) => {
                    invalidate(spec);
                  }}
                />
              ));

              await TestingLibrary.waitFor(() => {
                expect(screen.getByTestId('text').textContent).toStrictEqual(
                  'Response: 1',
                );
              });

              expect(client.request).toHaveBeenCalledTimes(1);

              TestingLibrary.fireEvent.click(
                screen.getByTestId('invalidate-button'),
              );

              await wait(150);

              // Assert response unchanged.
              expect(screen.getByTestId('text').textContent).toStrictEqual(
                'Response: 1',
              );
              // Assert no additional queries.
              expect(client.request).toHaveBeenCalledTimes(1);
            });
          },
        );
      });
    });
  });

  (['updateCache', 'updateInfiniteCache'] as const).forEach((method) => {
    describe(`${method}`, () => {
      const config =
        method === 'updateCache'
          ? {
              route: 'GET /items',
              getRenderData: () => {
                const { data } = useAPIQuery('GET /items', { filter: '' });
                return `Response: ${data?.message}`;
              },
            }
          : {
              route: 'GET /list',
              getRenderData: () => {
                const { data } = useInfiniteAPIQuery(
                  'GET /list',
                  {
                    filter: '',
                  },
                  {
                    initialPageParam: {},
                    getNextPageParam: () => ({}),
                  },
                );
                return `Response: ${data?.pages?.at(0)?.items?.at(0)?.message}`;
              },
            };

      const TestComponent: React.FC<{
        getRenderData: () => string;
        onPress: (cache: CacheUtils<TestEndpoints>) => void;
      }> = ({ getRenderData, onPress }) => {
        const cache = useAPICache();
        const data = getRenderData();
        return (
          <>
            <div data-testid="render-data">{data}</div>
            <button onClick={() => onPress(cache)}>Update Cache</button>
          </>
        );
      };

      beforeEach(() => {
        network
          .mock('GET /items', {
            status: 200,
            data: { message: 'Frodo Baggins' },
          })
          .mock('GET /list', {
            status: 200,
            data: {
              items: [{ message: 'Frodo Baggins' }],
            },
          });
      });

      it('updates queries using static data', async () => {
        const update =
          method === 'updateCache'
            ? { message: 'Samwise Gamgee' }
            : {
                pages: [{ items: [{ message: 'Samwise Gamgee' }] }],
                pageParams: [],
              };

        const screen = render(() => (
          <TestComponent
            getRenderData={config.getRenderData}
            onPress={(cache) => {
              const updateMethod = cache[method];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              updateMethod(config.route, { filter: '' }, update);
            }}
          />
        ));

        await screen.findByText('Response: Frodo Baggins');

        expect(client.request).toHaveBeenCalledTimes(1);

        TestingLibrary.fireEvent.click(screen.getByText('Update Cache'));

        // The update does not happen immediately.
        await TestingLibrary.waitFor(() => {
          expect(screen.getByTestId('render-data').textContent).toStrictEqual(
            'Response: Samwise Gamgee',
          );
        });

        // Confirm that another network call is not triggered.
        expect(client.request).toHaveBeenCalledTimes(1);
      });

      it('updates queries using a function when there is existing data', async () => {
        const updater =
          method === 'updateCache'
            ? () => ({ message: 'Samwise Gamgee' })
            : () => ({
                pages: [{ items: [{ message: 'Samwise Gamgee' }] }],
                pageParams: [],
              });

        const screen = render(() => (
          <TestComponent
            getRenderData={config.getRenderData}
            onPress={(cache) => {
              const updateMethod = cache[method];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              updateMethod(config.route, { filter: '' }, updater);
            }}
          />
        ));

        await screen.findByText('Response: Frodo Baggins');

        expect(client.request).toHaveBeenCalledTimes(1);

        TestingLibrary.fireEvent.click(screen.getByText('Update Cache'));

        // The update does not happen immediately.
        await TestingLibrary.waitFor(() => {
          expect(screen.getByTestId('render-data').textContent).toStrictEqual(
            'Response: Samwise Gamgee',
          );
        });

        expect(client.request).toHaveBeenCalledTimes(1);
      });

      it('supports mutating the current value when using a function', async () => {
        const updater =
          method === 'updateCache'
            ? (current: any) => {
                current.message = 'Samwise Gamgee';
              }
            : (current: any) => {
                current.pages.at(0).items.at(0).message = 'Samwise Gamgee';
              };

        const screen = render(() => (
          <TestComponent
            getRenderData={config.getRenderData}
            onPress={(cache) => {
              const updateMethod = cache[method];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              updateMethod(config.route, { filter: '' }, updater);
            }}
          />
        ));

        await screen.findByText('Response: Frodo Baggins');

        expect(client.request).toHaveBeenCalledTimes(1);

        TestingLibrary.fireEvent.click(screen.getByText('Update Cache'));

        // The update does not happen immediately.
        await TestingLibrary.waitFor(() => {
          expect(screen.getByTestId('render-data').textContent).toStrictEqual(
            'Response: Samwise Gamgee',
          );
        });

        expect(client.request).toHaveBeenCalledTimes(1);
      });

      it('does nothing when a function update is passed, but there is no data', async () => {
        network.reset();

        const updateFn = jest.fn();
        const screen = render(() => (
          <TestComponent
            getRenderData={() => {
              return 'Response: nothing';
            }}
            onPress={(cache) => {
              const updateMethod = cache[method];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              updateMethod(config.route, { filter: '' }, updateFn);
            }}
          />
        ));

        await screen.findByText('Response: nothing');

        expect(client.request).toHaveBeenCalledTimes(0);

        TestingLibrary.fireEvent.click(screen.getByText('Update Cache'));

        expect(client.request).toHaveBeenCalledTimes(0);

        expect(updateFn).not.toHaveBeenCalled();
      });
    });
  });
});

test('passing a function for `client` is supported', async () => {
  const TestContext = React.createContext<AxiosInstance | undefined>(undefined);

  const { useAPIQuery } = createAPIHooks<TestEndpoints>({
    name: 'test-name',
    client: () => {
      const client = React.useContext(TestContext);
      if (!client) {
        throw new Error('no client specified');
      }
      return client;
    },
  });

  const TestComponent: React.FC = () => {
    const query = useAPIQuery('GET /items', { filter: 'test-filter' });
    return <>{query.data?.message}</>;
  };

  network.mock('GET /items', {
    status: 200,
    data: { message: 'test-message-2' },
  });

  const screen = TestingLibrary.render(<TestComponent />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <TestContext.Provider
          value={axios.create({ baseURL: 'https://www.lifeomic.com' })}
        >
          {children}
        </TestContext.Provider>
      </QueryClientProvider>
    ),
  });

  await TestingLibrary.waitFor(() => {
    expect(screen.queryAllByText('test-message-2')).toBeDefined();
  });
});

test('getQueryData', async () => {
  network.mock('GET /items', {
    status: 200,
    data: { message: 'test-message' },
  });

  // Populate the cache.
  const screen1 = render(() => {
    const query = useAPIQuery('GET /items', { filter: 'test-filter' });
    return <>{query.status}</>;
  });

  await TestingLibrary.waitFor(() => {
    screen1.getByText('success');
  });

  screen1.unmount();

  // Now, fetch from the cache.

  const screen2 = render(() => {
    const cache = useAPICache();

    return (
      <>
        {cache.getQueryData('GET /items', { filter: 'test-filter' })?.message}
      </>
    );
  });

  screen2.getByText('test-message');
});

test('getInfiniteQueryData', async () => {
  network.mock('GET /list', {
    status: 200,
    data: { items: [{ message: 'one' }, { message: 'two' }] },
  });

  // Populate the cache.
  const screen1 = render(() => {
    const query = useInfiniteAPIQuery(
      'GET /list',
      { filter: 'test-filter' },
      {
        initialPageParam: {},
        getNextPageParam: () => ({}),
      },
    );
    return <>{query.status}</>;
  });

  await TestingLibrary.waitFor(() => {
    screen1.getByText('success');
  });

  screen1.unmount();

  // Now, fetch from the cache.

  const screen2 = render(() => {
    const cache = useAPICache();

    const value = cache.getInfiniteQueryData('GET /list', {
      filter: 'test-filter',
    });

    const messages = value?.pages.flatMap((p) => p.items).map((i) => i.message);

    return <>{messages?.join(',')}</>;
  });

  screen2.getByText('one,two');
});

test('getQueriesData', async () => {
  network.mock('GET /items', ({ query }) => ({
    status: 200,
    data: { message: query.filter },
  }));

  // Populate the cache.
  const screen1 = render(() => {
    const query = useCombinedAPIQueries(
      ['GET /items', { filter: 'test-filter' }],
      ['GET /items', { filter: 'other-filter' }],
    );
    return <>{query.status}</>;
  });

  await TestingLibrary.waitFor(() => {
    screen1.getByText('success');
  });

  screen1.unmount();

  // Now, fetch from the cache.

  const screen2 = render(() => {
    const cache = useAPICache();

    const value = cache
      .getQueriesData('GET /items')
      .map(({ data }) => data?.message)
      .join(',');

    return <>{value}</>;
  });

  screen2.getByText('test-filter,other-filter');
});

test('getInfiniteQueriesData', async () => {
  network.mock('GET /list', ({ query }) => ({
    status: 200,
    data: { items: [{ message: query.filter }] },
  }));

  // Populate the cache.
  const screen1 = render(() => {
    const query1 = useInfiniteAPIQuery(
      'GET /list',
      { filter: 'test-filter' },
      {
        initialPageParam: {},
        getNextPageParam: () => ({}),
      },
    );
    const query2 = useInfiniteAPIQuery(
      'GET /list',
      { filter: 'other-filter' },
      {
        initialPageParam: {},
        getNextPageParam: () => ({}),
      },
    );

    return (
      <>
        {query1.status},{query2.status}
      </>
    );
  });

  await TestingLibrary.waitFor(() => {
    screen1.getByText('success,success');
  });

  screen1.unmount();

  // Now, fetch from the cache.

  const screen2 = render(() => {
    const cache = useAPICache();

    const value = cache.getInfiniteQueriesData('GET /list');

    const messages = value
      .flatMap(({ data }) => data!.pages)
      .flatMap((p) => p.items)
      .map((i) => i.message);

    return <>{messages?.join(',')}</>;
  });

  screen2.getByText('test-filter,other-filter');
});
