import {
  QueryObserverResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  InfiniteData,
  UseSuspenseQueryResult,
  UseSuspenseQueryOptions,
  UseSuspenseInfiniteQueryOptions,
  UseSuspenseInfiniteQueryResult,
  DefaultError,
} from '@tanstack/react-query';
import { AxiosRequestConfig } from 'axios';
import {
  CombinedQueriesResult,
  SuspenseCombinedQueriesResult,
} from './combination';

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

type RestrictedUseQueryOptions<
  Response,
  TError = DefaultError,
  Data = Response,
> = Omit<UseQueryOptions<Response, TError, Data>, 'queryKey' | 'queryFn'> & {
  axios?: AxiosRequestConfig;
};

type RestrictedUseSuspenseQueryOptions<
  Response,
  TError = DefaultError,
  Data = Response,
> = Omit<
  UseSuspenseQueryOptions<Response, TError, Data>,
  'queryKey' | 'queryFn'
> & {
  axios?: AxiosRequestConfig;
};

type RestrictedUseInfiniteQueryOptions<Response, Request> = Omit<
  UseInfiniteQueryOptions<InfiniteData<Response>, DefaultError>,
  | 'queryKey'
  | 'queryFn'
  | 'initialPageParam'
  | 'getNextPageParam'
  | 'getPreviousPageParam'
> & {
  axios?: AxiosRequestConfig;
  initialPageParam: Partial<Request>; // use init payload?
  getNextPageParam: (lastPage: Response) => Partial<Request> | undefined;
  getPreviousPageParam?: (firstPage: Response) => Partial<Request> | undefined;
};

type RestrictedUseSuspenseInfiniteQueryOptions<Response, Request> = Omit<
  UseSuspenseInfiniteQueryOptions<InfiniteData<Response>, DefaultError>,
  | 'queryKey'
  | 'queryFn'
  | 'initialPageParam'
  | 'getNextPageParam'
  | 'getPreviousPageParam'
> & {
  axios?: AxiosRequestConfig;
  initialPageParam: Partial<Request>; // use init payload?
  getNextPageParam: (lastPage: Response) => Partial<Request> | undefined;
  getPreviousPageParam?: (firstPage: Response) => Partial<Request> | undefined;
};

export type CombinedRouteTuples<
  Endpoints extends RoughEndpoints,
  Routes extends (keyof Endpoints)[],
> = {
  [Index in keyof Routes]:
    | [Routes[Index], RequestPayloadOf<Endpoints, Routes[Index]>]
    | [
        Routes[Index],
        RequestPayloadOf<Endpoints, Routes[Index]>,
        (
          | RestrictedUseQueryOptions<Endpoints[Routes[Index]]['Response']>
          | undefined
        ),
      ];
};

export type EndpointInvalidationPredicate<Payload> =
  | 'all'
  | Payload[]
  | ((payload: Payload) => boolean);

export type EndpointInvalidationMap<Endpoints extends RoughEndpoints> = {
  [Route in keyof Endpoints]?: EndpointInvalidationPredicate<
    RequestPayloadOf<Endpoints, Route>
  >;
};

export type CacheUpdate<Data> = Data | ((current: Data) => Data | void);

export type CacheUtils<Endpoints extends RoughEndpoints> = {
  invalidateQueries: (spec: EndpointInvalidationMap<Endpoints>) => void;

  resetQueries: (spec: EndpointInvalidationMap<Endpoints>) => void;

  updateCache: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    updater: CacheUpdate<Endpoints[Route]['Response']>,
  ) => void;

  updateInfiniteCache: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    updater: CacheUpdate<InfiniteData<Endpoints[Route]['Response']>>,
  ) => void;

  getQueryData: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
  ) => Endpoints[Route]['Response'] | undefined;

  getInfiniteQueryData: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
  ) => InfiniteData<Endpoints[Route]['Response']> | undefined;

  getQueriesData: <Route extends keyof Endpoints & string>(
    route: Route,
  ) => {
    payload: RequestPayloadOf<Endpoints, Route>;
    data: Endpoints[Route]['Response'] | undefined;
  }[];

  getInfiniteQueriesData: <Route extends keyof Endpoints & string>(
    route: Route,
  ) => {
    payload: RequestPayloadOf<Endpoints, Route>;
    data: InfiniteData<Endpoints[Route]['Response']> | undefined;
  }[];
};

export type APIQueryHooks<Endpoints extends RoughEndpoints> = {
  useAPIQuery: <
    Route extends keyof Endpoints & string,
    Data = Endpoints[Route]['Response'],
  >(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    options?: RestrictedUseQueryOptions<
      Endpoints[Route]['Response'],
      DefaultError,
      Data
    >,
  ) => UseQueryResult<Data>;

  useSuspenseAPIQuery: <
    Route extends keyof Endpoints & string,
    Data = Endpoints[Route]['Response'],
  >(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    options?: RestrictedUseSuspenseQueryOptions<
      Endpoints[Route]['Response'],
      DefaultError,
      Data
    >,
  ) => UseSuspenseQueryResult<Data>;

  useInfiniteAPIQuery: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    options: RestrictedUseInfiniteQueryOptions<
      Endpoints[Route]['Response'],
      RequestPayloadOf<Endpoints, Route>
    >,
  ) => UseInfiniteQueryResult<
    InfiniteData<Endpoints[Route]['Response']>,
    DefaultError
  >;

  useSuspenseInfiniteAPIQuery: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    options: RestrictedUseSuspenseInfiniteQueryOptions<
      Endpoints[Route]['Response'],
      RequestPayloadOf<Endpoints, Route>
    >,
  ) => UseSuspenseInfiniteQueryResult<
    InfiniteData<Endpoints[Route]['Response']>,
    DefaultError
  >;

  useAPIMutation: <Route extends keyof Endpoints & string>(
    route: Route,
    options?: UseMutationOptions<
      Endpoints[Route]['Response'],
      DefaultError,
      RequestPayloadOf<Endpoints, Route>
    > & {
      axios?: AxiosRequestConfig;
    },
  ) => UseMutationResult<
    Endpoints[Route]['Response'],
    DefaultError,
    RequestPayloadOf<Endpoints, Route>
  >;

  useCombinedAPIQueries<Routes extends (keyof Endpoints & string)[]>(
    ...routes: [...CombinedRouteTuples<Endpoints, Routes>]
  ): CombinedQueriesResult<{
    [Index in keyof Routes]: QueryObserverResult<
      Endpoints[Routes[Index]]['Response']
    >;
  }>;

  useSuspenseCombinedAPIQueries<Routes extends (keyof Endpoints & string)[]>(
    ...routes: [...CombinedRouteTuples<Endpoints, Routes>]
  ): SuspenseCombinedQueriesResult<{
    [Index in keyof Routes]: QueryObserverResult<
      Endpoints[Routes[Index]]['Response']
    >;
  }>;

  useAPICache(): CacheUtils<Endpoints>;
};
