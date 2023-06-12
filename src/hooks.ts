import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  QueryKey,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosInstance } from 'axios';
import { createCacheUtils } from './cache';
import { combineQueries } from './combination';
import { APIQueryHooks, RoughEndpoints } from './types';
import { APIClient, createQueryKey } from './util';

export type CreateAPIQueryHooksOptions = {
  name: string;
  client: AxiosInstance;
};

export const createAPIHooks = <Endpoints extends RoughEndpoints>({
  name,
  client: axiosClient,
}: CreateAPIQueryHooksOptions): APIQueryHooks<Endpoints> => {
  const client = new APIClient<Endpoints>(axiosClient);
  return {
    useAPIQuery: (route, payload, options) => {
      const queryKey: QueryKey = [createQueryKey(name, route, payload)];
      return useQuery(
        queryKey,
        () =>
          client
            .request(route, payload, options?.axios)
            .then((res) => res.data),
        options,
      );
    },
    useInfiniteAPIQuery: (route, initPayload, options) => {
      const queryKey: QueryKey = [createQueryKey(name, route, initPayload)];
      const query = useInfiniteQuery(
        queryKey,
        ({ pageParam }) => {
          const payload = {
            ...initPayload,
            ...pageParam,
            // casting here because `pageParam` is typed `any` and once it is
            // merged with initPayload it makes `payload` `any`
          } as typeof initPayload;

          return client
            .request(route, payload, options?.axios)
            .then((res) => res.data);
        },
        options,
      );

      return query;
    },
    useAPIMutation: (route, options) =>
      useMutation(
        (payload) => client.request(route, payload).then((res) => res.data),
        options,
      ),
    useCombinedAPIQueries: (...routes) => {
      const queries = useQueries({
        queries: routes.map(([endpoint, payload, options]) => ({
          ...options,
          queryKey: [createQueryKey(name, endpoint, payload)],
          queryFn: () =>
            client
              .request(endpoint, payload, options?.axios)
              .then((res) => res.data),
        })),
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
