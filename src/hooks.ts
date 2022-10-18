import { useQuery, useMutation, QueryKey } from '@tanstack/react-query';
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
  };
};
