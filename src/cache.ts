import { QueryClient, QueryFilters } from '@tanstack/react-query';
// eslint-disable-next-line no-restricted-imports
import { isEqual } from 'lodash';
import { produce } from 'immer';
import {
  CacheUtils,
  EndpointInvalidationMap,
  RequestPayloadOf,
  RoughEndpoints,
} from './types';
import { InternalQueryKey, isInternalQueryKey } from './util';

const createQueryFilterFromSpec = <Endpoints extends RoughEndpoints>(
  endpoints: EndpointInvalidationMap<Endpoints>,
): QueryFilters => ({
  predicate: (query) =>
    query.queryKey.some((entry) => {
      if (!isInternalQueryKey(entry)) {
        return false;
      }

      const payloadsToInvalidate = endpoints[entry.route];

      if (!payloadsToInvalidate) {
        return false;
      }

      // Handle 'all'
      if (payloadsToInvalidate === 'all') {
        return true;
      }

      // Handle predicate function
      if (typeof payloadsToInvalidate === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return payloadsToInvalidate(entry.payload as any);
      }

      // Handle list of variables
      return payloadsToInvalidate.some((payload) =>
        isEqual(payload, entry.payload),
      );
    }),
});

export const INFINITE_QUERY_KEY = 'infinite' as const;

export const createCacheUtils = <Endpoints extends RoughEndpoints>(
  client: QueryClient,
  makeQueryKey: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
  ) => InternalQueryKey,
): CacheUtils<Endpoints> => {
  const updateCache: (
    keyPrefix?: typeof INFINITE_QUERY_KEY,
  ) => CacheUtils<Endpoints>['updateCache'] =
    (keyPrefix) => (route, payload, updater) => {
      client.setQueryData<Endpoints[typeof route]['Response']>(
        [keyPrefix, makeQueryKey(route, payload)].filter(Boolean),
        typeof updater !== 'function'
          ? updater
          : (current) => {
              if (current === undefined) {
                return;
              }
              return produce(
                current,
                // @ts-expect-error TypeScript incorrectly thinks that `updater`
                // still might not be a function. It is wrong.
                updater,
              );
            },
      );
    };

  return {
    invalidateQueries: (spec) => {
      void client.invalidateQueries(createQueryFilterFromSpec(spec));
    },
    resetQueries: (spec) => {
      void client.resetQueries(createQueryFilterFromSpec(spec));
    },
    updateCache: updateCache(),
    updateInfiniteCache: updateCache(INFINITE_QUERY_KEY),
  };
};
