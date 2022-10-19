import {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

/**
 * Extracts the path parameters from a route.
 *
 * @example
 *
 * type Type1 = PathParamsOf<'GET /v1/items'>
 *   // -> { }
 * type Type2 = PathParamsOf<'GET /v1/items/:id'>
 *   // -> { id: string }
 * type Type3 = PathParamsOf<'GET /v1/items/:id/:something'>
 *   // -> { id: string; something: string }
 */
export type PathParamsOf<Route> =
  // First, filter out the leading method and space (e.g. the "GET ")
  Route extends `${string} ${infer Path}`
    ? PathParamsOf<Path>
    : // Now, split by the "/", and check the strings before + after.
    Route extends `${infer Before}/${infer After}`
    ? PathParamsOf<Before> & PathParamsOf<After>
    : // If the path part looks like a param, return the object.
    Route extends `:${infer Param}`
    ? {
        [Key in Param]: string;
      }
    : {};

export type RoughEndpoints = {
  [key: string]: {
    Request: unknown;
    Response: unknown;
  };
};

export type RequestPayloadOf<
  Endpoints extends RoughEndpoints,
  Route extends keyof Endpoints,
> = Endpoints[Route]['Request'] & PathParamsOf<Route>;

type RestrictedUseQueryOptions<Response> = Omit<
  UseQueryOptions<Response, unknown>,
  'queryKey' | 'queryFn'
>;

export type APIQueryHooks<Endpoints extends RoughEndpoints> = {
  useQuery: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    options?: RestrictedUseQueryOptions<Endpoints[Route]['Response']>,
  ) => UseQueryResult<Endpoints[Route]['Response']>;

  useMutation: <Route extends keyof Endpoints & string>(
    route: Route,
    options?: UseMutationOptions<
      Endpoints[Route]['Response'],
      unknown,
      RequestPayloadOf<Endpoints, Route>
    >,
  ) => UseMutationResult<
    Endpoints[Route]['Response'],
    unknown,
    RequestPayloadOf<Endpoints, Route>
  >;
};