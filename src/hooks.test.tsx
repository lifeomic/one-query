import * as React from 'react';
import * as TestingLibrary from '@testing-library/react';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import axios from 'axios';
import { createAPIHooks } from './hooks';
import { createAPIMockingUtility } from './test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CacheUtils, EndpointInvalidationMap, RequestPayloadOf } from './types';

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

const client = axios.create({ baseURL: 'https://www.lifeomic.com' });

jest.spyOn(client, 'request');

const { useAPIQuery, useAPIMutation, useCombinedAPIQueries, useAPICache } =
  createAPIHooks<TestEndpoints>({
    name: 'test-name',
    client,
  });

const network = createAPIMockingUtility<TestEndpoints>({
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
        expect.objectContaining({
          delay: expect.any(Function),
        }),
      );
    });
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
        expect.objectContaining({
          delay: expect.any(Function),
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
        expect.objectContaining({
          delay: expect.any(Function),
        }),
      );
    });
  });
});

describe('useAPICache', () => {
  describe('invalidation', () => {
    beforeEach(() => {
      // Mock a bunch of different requests to help us confirm render count.
      network.mockOrdered('GET /items/:id', [
        { status: 200, data: { message: '1' } },
        { status: 200, data: { message: '2' } },
        { status: 200, data: { message: '3' } },
      ]);
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

        it('invalidates matching queries based on static match', async () => {
          const variables: RequestPayloadOf<TestEndpoints, 'GET /items/:id'> = {
            id: 'some-id',
            filter: 'some-filter',
          };

          const screen = render(() => (
            <TestComponent
              getRenderData={() => {
                const { data } = useAPIQuery('GET /items/:id', variables, {
                  cacheTime: Infinity,
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
                  { cacheTime: Infinity },
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
                  { cacheTime: Infinity },
                );

                const second = useAPIQuery(
                  'GET /items/:id',
                  { id: 'some-other-id', filter: 'some-other-filter' },
                  { cacheTime: Infinity },
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
              const { data } = useReactQuery(['some-other-key'], () =>
                client.request({
                  method: 'GET',
                  url: '/items/some-id',
                  params: { filter: 'some-filter' },
                }),
              );

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
                        { cacheTime: Infinity },
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

  describe('updateCache', () => {
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

    it('updates queries using static data', async () => {
      network.mock('GET /items', {
        status: 200,
        data: { message: 'Frodo Baggins' },
      });

      const update = { message: 'Samwise Gamgee' };

      const screen = render(() => (
        <TestComponent
          getRenderData={() => {
            const { data } = useAPIQuery('GET /items', { filter: '' });
            return `Response: ${data?.message}`;
          }}
          onPress={(cache) => {
            cache.updateCache('GET /items', { filter: '' }, update);
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
      network.mock('GET /items', {
        status: 200,
        data: { message: 'Frodo Baggins' },
      });

      const screen = render(() => (
        <TestComponent
          getRenderData={() => {
            const { data } = useAPIQuery('GET /items', { filter: '' });
            return `Response: ${data?.message}`;
          }}
          onPress={(cache) => {
            cache.updateCache('GET /items', { filter: '' }, () => ({
              message: 'Samwise Gamgee',
            }));
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
      network.mock('GET /items', {
        status: 200,
        data: { message: 'Frodo Baggins' },
      });

      const screen = render(() => (
        <TestComponent
          getRenderData={() => {
            const { data } = useAPIQuery('GET /items', { filter: '' });
            return `Response: ${data?.message}`;
          }}
          onPress={(cache) => {
            cache.updateCache('GET /items', { filter: '' }, (current) => {
              current.message = 'Samwise Gamgee';
            });
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
      const updateFn = jest.fn();
      const screen = render(() => (
        <TestComponent
          getRenderData={() => {
            return 'Response: nothing';
          }}
          onPress={(cache) => {
            cache.updateCache('GET /items', { filter: '' }, updateFn);
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
