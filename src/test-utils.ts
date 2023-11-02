import { RequestHandler, rest } from 'msw';
/**
 * Important: we need to avoid import actual values from these imports:
 * - 'msw/node'
 * - 'msw/native'
 *
 * Why: importing from those platform-specific modules can cause import-time
 * failures for consumers that are using a different platform.
 *
 * It's okay to import _types_ from those paths, but not values.
 */
import type { SetupServer } from 'msw/node';
import { PathParamsOf, RoughEndpoints } from './types';

// This type is the "least common denominator" between the Node
// and browser variants of MSW.
type MSWUsable = {
  use: (...handlers: RequestHandler[]) => void;
  resetHandlers: () => void;
};

export type APIMockerResponse<T> =
  | { status: 200; data: T }
  | { status: 400 | 401 | 403 | 404 | 500; data: any };

type MockRequestHandler<
  Endpoints extends RoughEndpoints,
  Route extends keyof Endpoints,
> = (
  // prettier-ignore
  request:
  & {
      headers: Record<string, string | undefined>;
      params: PathParamsOf<Route>;
    }
  & (Route extends (`GET ${string}` | `DELETE ${string}`)
    ? { query: Endpoints[Route]['Request'] }
    : { body: Endpoints[Route]['Request'] }),
) =>
  | APIMockerResponse<Endpoints[Route]['Response']>
  | Promise<APIMockerResponse<Endpoints[Route]['Response']>>;

type MockFunction<Endpoints extends RoughEndpoints> = <
  Route extends keyof Endpoints & string,
>(
  route: Route,
  handlerOrResponse:
    | APIMockerResponse<Endpoints[Route]['Response']>
    | MockRequestHandler<Endpoints, Route>,
) => APIMocker<Endpoints>;

export type APIMocker<Endpoints extends RoughEndpoints> = {
  /**
   * Persistently mocks the specified `route` using the provided handler or
   * static response.
   */
  mock<Route extends keyof Endpoints & string>(
    route: Route,
    handlerOrResponse:
      | APIMockerResponse<Endpoints[Route]['Response']>
      | MockRequestHandler<Endpoints, Route>,
  ): APIMocker<Endpoints>;

  /**
   * Mocks a series of ordered responses on the specified `route`. Each of
   * the responses will be returned exactly once, in the order they were
   * provided.
   *
   * @example
   *
   * api.mockOrdered(
   *   'GET /something',
   *   [
   *     { status: 200, data: { value: 'one' } },
   *     { status: 200, data: { value: 'two' } },
   *     { status: 200, data: { value: 'three' } },
   *   ]
   * );
   *
   * const res1 = await client.get('/something'); // { value: 'one' }
   * const res2 = await client.get('/something'); // { value: 'two' }
   * const res2 = await client.get('/something'); // { value: 'three' }
   */
  mockOrdered<Route extends keyof Endpoints & string>(
    route: Route,
    handlerOrResponse: (
      | APIMockerResponse<Endpoints[Route]['Response']>
      | MockRequestHandler<Endpoints, Route>
    )[],
  ): APIMocker<Endpoints>;

  reset: () => void;
};

export const createAPIMocker = <Endpoints extends RoughEndpoints>(
  server: MSWUsable,
  baseUrl: string,
): APIMocker<Endpoints> => {
  const api: APIMocker<Endpoints> = {} as any;

  const createMocker =
    (options: { once: boolean }): MockFunction<Endpoints> =>
    (route, handlerOrResponse) => {
      const [method, url] = route.split(' ');

      const lowercaseMethod = method.toLowerCase() as
        | 'get'
        | 'delete'
        | 'put'
        | 'patch'
        | 'post';

      server.use(
        rest[lowercaseMethod](`${baseUrl}${url}`, async (req, res, ctx) => {
          const resolve = options.once ? res.once : res;

          if (typeof handlerOrResponse !== 'function') {
            return resolve(
              ctx.status(handlerOrResponse.status),
              ctx.json(handlerOrResponse.data),
            );
          }

          const mockRequest = {
            headers: req.headers.all(),
            params: req.params as PathParamsOf<typeof route>,
          };

          let mockedResponse: APIMockerResponse<
            Endpoints[typeof route]['Response']
          >;

          if (['get', 'delete'].includes(lowercaseMethod)) {
            const query: Record<string, string> = {};
            for (const [key, value] of req.url.searchParams.entries()) {
              query[key] = value;
            }
            // @ts-expect-error TypeScript isn't smart enough to narrow down
            // the GET/DELETE case here.
            mockedResponse = await handlerOrResponse({
              ...mockRequest,
              query,
            });
          } else {
            const body = await req.json();
            // @ts-expect-error TypeScript isn't smart enough to narrow down
            // the GET/DELETE case here.
            mockedResponse = await handlerOrResponse({
              ...mockRequest,
              body,
            });
          }

          return resolve(
            ctx.status(mockedResponse.status),
            ctx.json(mockedResponse.data),
          );
        }),
      );

      return api;
    };

  api.mock = createMocker({ once: false });

  const mockOnce = createMocker({ once: true });
  api.mockOrdered = (route, handlerOrResponses) => {
    // msw's behavior is the opposite of what we want here: they return _later_
    // mocks first. So, reverse this array to get the behavior we want.
    for (const handlerOrResponse of handlerOrResponses.concat().reverse()) {
      mockOnce(route, handlerOrResponse);
    }
    return api;
  };

  api.reset = () => {
    server.resetHandlers();
  };

  return api;
};

export type CreateAPIMockingConfig = {
  server: SetupServer;
  baseUrl: string;
};

/**
 * Creates a type-friendly reusable "hook" for mocking API requests.
 *
 * @example
 * type MyEndpoints = {
 *   'GET /something': {
 *     Request: { filter: string }
 *     Response: { message: string }
 *   }
 * }
 *
 * // test-utils.ts
 * export const useAPIMocking = createAPIMockingUtility<MyEndpoints>({ baseUrl: '...' })
 *
 * // network.test.ts
 * const api = useAPIMocking();
 *
 * api.mock('GET /something', { status: 200, data: { message: 'test-message' } })
 */
export const createAPIMockingUtility =
  <Endpoints extends RoughEndpoints>({
    server,
    baseUrl,
  }: CreateAPIMockingConfig) =>
  () => {
    const mocker = createAPIMocker<Endpoints>(server, baseUrl);

    beforeEach(() => {
      mocker.reset();
    });

    afterAll(() => {
      server.close();
    });

    return mocker;
  };
