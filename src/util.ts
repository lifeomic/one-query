import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RequestPayloadOf, RoughEndpoints } from './types';

type RoughPathParams = Record<string, string>;

/**
 * Substitutes path param values into our route syntax.
 *
 * @example
 * const result = substitutePathParams(
 *   '/items/:id',
 *   {
 *     id: 'something'
 *   }
 * );
 *
 * console.log(result); // "/items/something"
 */
const substitutePathParams = (route: string, params: RoughPathParams): string =>
  Object.entries(params).reduce(
    (url, [name, value]) => url.replace(':' + name, encodeURIComponent(value)),
    route,
  );

/**
 * Removes any keys in the request payload that already appear as path
 * parameters in the `route`, and returns the result. We do this because
 * path params should be directly substituded in the URL. Replacement is
 * skipped when the request payload is an array.
 *
 * @example
 * const result = removePathParamsFromRequestPayload(
 *   '/items/:id',
 *   {
 *     id: 'something',
 *     message: 'something-else'
 *   }
 * );
 *
 * console.log(result); // { message: 'something-else' }
 */
const removePathParamsFromRequestPayload = (
  route: string,
  payload: RoughPathParams | RoughPathParams[],
) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .reduce(
      (accum, [name, value]) =>
        route.includes(`:${name}`) ? accum : { ...accum, [name]: value },
      {},
    );
};

export class APIClient<Endpoints extends RoughEndpoints> {
  constructor(private readonly axiosClient: AxiosInstance) {}

  /**
   * Makes a request to the API using the provided `route` and `payload`.
   */
  request<Route extends keyof Endpoints & string>(
    route: Route,
    payload: RequestPayloadOf<Endpoints, Route>,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<Endpoints[Route]['Response']>> {
    const [method, url] = route.split(' ');

    const requestPayload: Endpoints[Route]['Request'] =
      removePathParamsFromRequestPayload(url, payload);

    return this.axiosClient.request({
      ...config,
      method,
      url: substitutePathParams(url, payload),
      // For GET + DELETE, send the payload as query params.
      ...(['GET', 'DELETE'].includes(method)
        ? { params: requestPayload }
        : { data: requestPayload }),
    });
  }
}

export type InternalQueryKey = {
  name: string;
  route: string;
  payload: unknown;
  infinite: boolean;
};

export const createQueryKey = (options: {
  name: string;
  route: string;
  payload: unknown;
  infinite: boolean;
}): InternalQueryKey => options;

export const isInternalQueryKey = (key: any): key is InternalQueryKey =>
  typeof key === 'object' &&
  'name' in key &&
  'route' in key &&
  'payload' in key &&
  'infinite' in key;
