import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  QueryKey,
  useQueryClient,
  useSuspenseQuery,
  useQueries,
  QueriesOptions,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import { AxiosInstance } from 'axios';
import { createCacheUtils, INFINITE_QUERY_KEY } from './cache';
import { APIQueryHooks, RoughEndpoints } from './types';
import { APIClient, createQueryKey } from './util';
import { combineQueries } from './combination';

export type CreateAPIQueryHooksOptions = {
  name: string;
  /**
   * An Axios client, or a function for retrieving one. This function can
   * call React hooks -- it will be called according to the rules of hooks.
   */
  client: AxiosInstance | (() => AxiosInstance);
};

export const createAPIHooks = <Endpoints extends RoughEndpoints>({
  name,
  client: axiosClient,
}: CreateAPIQueryHooksOptions): APIQueryHooks<Endpoints> => {
  const useClient = () =>
    new APIClient<Endpoints>(
      // Since AxiosInstances themselves are functions, check for the `.get(...)`
      // property to determine if this is a client, or a function to return a client.
      'get' in axiosClient ? axiosClient : axiosClient(),
    );

  return {
    useAPIQuery: (route, payload, options) => {
      const client = useClient();
      const queryKey: QueryKey = [createQueryKey(name, route, payload)];

      const query = useQuery({
        ...options,
        queryKey,
        queryFn: () =>
          client
            .request(route, payload, options?.axios)
            .then((res) => res.data),
      });

      return query;
    },

    useSuspenseAPIQuery: (route, payload, options) => {
      const client = useClient();
      const queryKey: QueryKey = [createQueryKey(name, route, payload)];

      const query = useSuspenseQuery({
        queryKey,
        queryFn: () =>
          client
            .request(route, payload, options?.axios)
            .then((res) => res.data),
        ...options,
      });

      return query;
    },

    useInfiniteAPIQuery: (route, initPayload, options) => {
      const client = useClient();
      const queryKey: QueryKey = [
        INFINITE_QUERY_KEY,
        createQueryKey(name, route, initPayload),
      ];

      const query = useInfiniteQuery({
        ...options,
        queryKey,
        initialPageParam: options.initialPageParam,
        queryFn: ({ pageParam }) => {
          const payload = {
            ...initPayload,
            ...(pageParam as any),
            // casting here because `pageParam` is typed `any` and once it is
            // merged with initPayload it makes `payload` `any`
          } as typeof initPayload;

          return client
            .request(route, payload, options.axios)
            .then((res) => res.data) as any;
        },
      });

      return query;
    },

    useSuspenseInfiniteAPIQuery: (route, initPayload, options) => {
      const client = useClient();
      const queryKey: QueryKey = [
        INFINITE_QUERY_KEY,
        createQueryKey(name, route, initPayload),
      ];

      const query = useSuspenseInfiniteQuery({
        ...options,
        queryKey,
        initialPageParam: options.initialPageParam,
        queryFn: ({ pageParam }) => {
          const payload = {
            ...initPayload,
            ...(pageParam as any),
            // casting here because `pageParam` is typed `any` and once it is
            // merged with initPayload it makes `payload` `any`
          } as typeof initPayload;

          return client
            .request(route, payload, options?.axios)
            .then((res) => res.data) as any;
        },
      });

      return query;
    },

    useAPIMutation: (route, options) => {
      const client = useClient();

      return useMutation({
        ...options,
        mutationFn: (payload) =>
          client
            .request(route, payload, options?.axios)
            .then((res) => res.data),
      });
    },

    useCombinedAPIQueries: (...routes) => {
      const client = useClient();

      const queries = useQueries({
        queries: routes.map(([endpoint, payload, options]) => ({
          ...options,
          queryKey: [createQueryKey(name, endpoint, payload)],
          queryFn: () =>
            client
              .request(endpoint, payload, options?.axios)
              .then((res) => res.data),
        })) as [...QueriesOptions<any>],
      });

      // The useQueries type inference is not quite as in-depth as ours is. So,
      // the types don't fully agree here -- casting to `any` was a painful, but
      // simple solution.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return combineQueries(queries as any);
    },

    useAPICache: () => {
      const client = useQueryClient();
      return createCacheUtils(client, (route, payload) =>
        createQueryKey(name, route, payload),
      );
    },
  };
};
