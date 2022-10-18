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

export type RequestResponseOf<
  Endpoints extends RoughEndpoints,
  Route extends keyof Endpoints,
> = Endpoints[Route]['Response'];
