import { QueryClient, QueryFilters } from '@tanstack/react-query';
// eslint-disable-next-line no-restricted-imports
import { isEqual } from 'lodash';
import { produce } from 'immer';
import { CacheUtils, EndpointInvalidationMap, RoughEndpoints } from './types';
import { createQueryKey, isInternalQueryKey } from './util';

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
  name: string,
): CacheUtils<Endpoints> => {
  const updateCache: (
    keyPrefix?: typeof INFINITE_QUERY_KEY,
  ) => CacheUtils<Endpoints>['updateCache'] =
    (keyPrefix) => (route, payloadOrPredicate, updater) => {
      client.setQueriesData<Endpoints[typeof route]['Response']>(
        typeof payloadOrPredicate === 'function'
          ? {
              predicate: ({ queryKey }) => {
                /* istanbul ignore next */
                if (keyPrefix && queryKey[0] !== keyPrefix) {
                  /* istanbul ignore next */
                  return false;
                }
                const payloadInKey = keyPrefix ? queryKey[1] : queryKey[0];

                return (
                  isInternalQueryKey(payloadInKey) &&
                  payloadInKey.name === name &&
                  payloadInKey.route === route &&
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore These types are a bit finicky. Override it.
                  payloadOrPredicate(payloadInKey.payload)
                );
              },
            }
          : {
              queryKey: [
                keyPrefix,
                createQueryKey(name, route, payloadOrPredicate),
              ].filter(Boolean),
              exact: true,
            },
        typeof updater !== 'function'
          ? updater
          : (current) => {
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
    getQueryData: (route, payload) =>
      client.getQueryData([createQueryKey(name, route, payload)]),
    getInfiniteQueryData: (route, payload) =>
      client.getQueryData([
        INFINITE_QUERY_KEY,
        createQueryKey(name, route, payload),
      ]),
    getQueriesData: (route) =>
      client
        .getQueriesData(createQueryFilterFromSpec({ [route]: 'all' }))
        // Don't match infinite queries
        .filter(([queryKey]) => queryKey[0] !== INFINITE_QUERY_KEY)
        .map(([queryKey, data]) => ({
          payload: (queryKey[0] as any).payload,
          data,
        })),
    getInfiniteQueriesData: (route) =>
      client
        .getQueriesData(createQueryFilterFromSpec({ [route]: 'all' }))
        // Only match infinite queries
        .filter(([queryKey]) => queryKey[0] === INFINITE_QUERY_KEY)
        .map(([queryKey, data]) => ({
          payload: (queryKey[1] as any).payload,
          data: data as any,
        })),
  };
};
