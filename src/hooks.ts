import {
  useQuery,
  useMutation,
  QueryKey,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { createCacheUtils } from './cache';
import { combineQueries } from './combination';
import { APIQueryHooks, RoughEndpoints } from './types';
import { APIClient, createQueryKey } from './util';

export type CreateAPIQueryHooksOptions<Endpoints extends RoughEndpoints> = {
  name: string;
  client: APIClient<Endpoints>;
};

export const createAPIHooks = <Endpoints extends RoughEndpoints>({
  name,
  client,
}: CreateAPIQueryHooksOptions<Endpoints>): APIQueryHooks<Endpoints> => {
  return {
    useQuery: (route, payload, options) => {
      const queryKey: QueryKey = [createQueryKey(name, route, payload)];
      return useQuery(
        queryKey,
        () => client.request(route, payload).then((res) => res.data),
        options,
      );
    },
    useMutation: (route, options) =>
      useMutation(
        (payload) => client.request(route, payload).then((res) => res.data),
        options,
      ),
    useCombinedQueries: (...routes) => {
      const queries = useQueries({
        queries: routes.map(([endpoint, payload, options]) => ({
          ...options,
          queryKey: [createQueryKey(name, endpoint, payload)],
          queryFn: () =>
            client.request(endpoint, payload).then((res) => res.data),
        })),
      });

      // The useQueries type inference is not quite as in-depth as ours is. So,
      // the types don't fully agree here -- casting to `any` was a painful, but
      // simple solution.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return combineQueries(queries as any);
    },
    useCache: () => {
      const client = useQueryClient();
      return createCacheUtils(client, (route, payload) =>
        createQueryKey(name, route, payload),
      );
    },
  };
};
