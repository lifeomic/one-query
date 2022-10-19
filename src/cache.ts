import { QueryClient, QueryFilters } from '@tanstack/react-query';
// eslint-disable-next-line no-restricted-imports
import { isEqual } from 'lodash';
import { CacheUtils, EndpointInvalidationMap, RoughEndpoints } from './types';
import { isInternalQueryKey } from './util';

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

export const createCacheUtils = <Endpoints extends RoughEndpoints>(
  client: QueryClient,
): CacheUtils<Endpoints> => {
  return {
    invalidateQueries: (spec) => {
      void client.invalidateQueries(createQueryFilterFromSpec(spec));
    },
    resetQueries: (spec) => {
      void client.resetQueries(createQueryFilterFromSpec(spec));
    },
  };
};
