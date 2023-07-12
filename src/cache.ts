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
  options: { infinite: boolean },
): QueryFilters => ({
  predicate: (query) =>
    query.queryKey.some((entry) => {
      if (!isInternalQueryKey(entry)) {
        return false;
      }

      if (entry.infinite !== options.infinite) {
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

export const createCacheUtils = <Endpoints extends RoughEndpoints>(
  client: QueryClient,
  makeQueryKey: <Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    infinite: boolean,
  ) => InternalQueryKey,
): CacheUtils<Endpoints> => {
  const updateCache: (options: {
    infinite: boolean;
  }) => CacheUtils<Endpoints>['updateCache'] =
    (options) => (route, payload, updater) => {
      client.setQueryData<Endpoints[typeof route]['Response']>(
        [makeQueryKey(route, payload, options.infinite)],
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
      void client.invalidateQueries(
        createQueryFilterFromSpec(spec, { infinite: false }),
      );
    },
    resetQueries: (spec) => {
      void client.resetQueries(
        createQueryFilterFromSpec(spec, { infinite: false }),
      );
    },
    invalidateInfiniteQueries: (spec) => {
      void client.invalidateQueries(
        createQueryFilterFromSpec(spec, { infinite: true }),
      );
    },
    resetInfiniteQueries: (spec) => {
      void client.resetQueries(
        createQueryFilterFromSpec(spec, { infinite: true }),
      );
    },
    updateCache: updateCache({ infinite: false }),
    updateInfiniteCache: updateCache({ infinite: true }),
  };
};
