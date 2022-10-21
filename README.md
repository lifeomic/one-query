This package helps you use [`react-query`](https://tanstack.com/query) with a REST API, and get type safety everywhere.

## Installation

```
yarn add @lifeomic/one-query
```

## Setup

1. Define the input + output types for your API endpoints. Use a single type to define every endpoint.

```typescript
// endpoints.ts
type Message = {
  id: string;
  content: string;
};

export type APIEndpoints = {
  'GET /messages': {
    Request: { filter?: string };
    Response: Message[];
  };
  'GET /messages/:id': {
    Request: {};
    Response: Message;
  };
  'PUT /messages/:id': {
    Request: { content: string };
    Response: Message;
  };
};
```

2. Use `createAPIHooks` to create re-usable hooks using this type.

```typescript
// api-hooks.ts
import axios from 'axios';
import { createAPIHooks } from '@lifeomic/one-query';
import { APIEndpoints } from './endpoints'

const hooks = createAPIHooks<APIEndpoints>({ // <-- Specify your custom type here
  name: 'my-api',
  client: axios.create({ baseURL: 'https://my.api.com', headers: {...} })
});

export const {
  useAPIQuery,
  useAPIMutation
  useCombinedAPIQueries,
  useAPICache
} = hooks;
```

3. Use your hooks. Enjoy auto-completed route names, type-safe inputs, inferred path parameters, and more.

```jsx
// MyComponent.ts
import { useAPIQuery } from './api-hooks';

const MyComponent = () => {
  const query = useAPIQuery('GET /messages', { filter: '...' });

  const mutation = useAPIMutation('PUT /messages/:id');

  const messages = query.data?.map(m => m.content).join(',');

  return (
    <>
      <div>{messages}<div>
      <button
        onClick={() => {
          mutation.mutate({
            id: 'new-message-id',
            content: 'some message content',
          });
        }}
      >
        Mutate
      </button>
    </>
  );
};
```

4. (optional) Use `createAPIMockingUtility` to create a type-safe network mocking utility for use in unit tests.

```typescript
// api-mocking.ts
import { createAPIMockingUtility } from '@lifeomic/one-query/test-utils';
import { APIEndpoints } from './endpoints';

export const useAPIMocking = createAPIMockingUtility<APIEndpoints>({
  baseUrl: 'https://my.api.com',
});
```

Now, use the created utility in your tests to mock the network:

```jsx
// MyComponent.test.ts
import { render } from '@testing-library/react';
import { useAPIMocking } from './api-mocking';

const api = useAPIMocking();

it('renders messages', () => {
  api.mock('GET /messages', {
    status: 200,
    data: [
      { id: '1', content: 'one' },
      { id: '1', content: 'two' },
    ],
  });

  const view = render(<MyComponent />);

  await view.findByText('one, two')
});
```

## Hooks API Reference

Most of the functionality provided by this library consists of light wrappers around `react-query` hooks + primitive. These hooks often return values directly from `react-query`. For complete details on the workings of those internals, see the `react-query` docs.

The examples in the documentation below will all be based on this example set of endpoints:

```typescript
type Message = {
  id: string;
  content: string;
};

type APIEndpoints = {
  'GET /messages': {
    Request: { filter?: string };
    Response: Message[];
  };
  'GET /messages/:id': {
    Request: {};
    Response: Message;
  };
  'PUT /messages/:id': {
    Request: { content: string };
    Response: Message;
  };
};
```

### `createAPIHooks`

Well-typed hooks should first be created using the `createAPIHooks` helper.

```typescript
import { createAPIHooks } from '@lifeomic/one-query';

const hooks = createAPIHooks<APIEndpoints>({ // <-- Specify your custom endpointstype here
  // Provide a unique name for this API. This value is only used internally,
  // to ensure that cached queries are scoped only to this set of created
  // hooks.
  name: 'my-api',
  // Pass an Axios client to use for performing requests.
  client: axios.create({ ... })
});

// `hooks` provides all the hooks you need. We recommend exporting these values from a
// centralized file in your app.
export const {
  useAPIQuery,
  useAPIMutation,
  ...
} = hooks;
```

### `useAPIQuery`

Type-safe wrapper around `useQuery` from `react-query`.

```typescript
const query = useAPIQuery(
  // First, specify the route.
  'GET /messages',
  // Then, specify the payload.
  { filter: 'some-filter' },
);
```

The return value of this hook is identical to the behavior of the `react-query` `useQuery` hook's return value.

```typescript
query.data; // Message[] | undefined

if (query.isLoading) {
  return null;
}
if (query.isError) {
  return null;
}

query.data; // Message[]
```

Queries are cached using a combination of `route name + payload`. So, in the example above, the query key looks roughly like `['GET /messages', { filter: 'some-filter' }]`.

### `useAPIMutation`

Type-safe wrapper around `useQuery` from `react-query`.

```typescript
const mutation = useAPIQuery('PUT /messages/:id');
```

The return value of this hook is identical to the behavior of the `react-query` `useMutation` hook's return value. The `mutate` and `mutateAsync` values are typed correctly using the endpoint definition

```tsx
return (
  <button
    onClick={() => {
      mutation.mutate({
        id: 'new-message-id',
        content: 'new message content',
      });
    }}
  >
    Click Me
  </button>
);
```

### `useCombinedAPIQueries`

A helper for combining multiple parallel queries into a single `react-query`-like hook.

```typescript
const query = useCombinedAPIQueries(
  ['GET /messages', { filter: 'some-filter' }],
  ['GET /messages/:id', { id: 'some-message-id' }],
);

// This means _at least one_ query is in the "error" state.
if (query.isError) {
  return;
}

// This means _at least one_ query is in the "loading" state.
if (query.isLoading) {
  return;
}

query.data; // [Message[], Message]

const [list, message] = query.data;

list; // Message[]
message; // Message
```

Queries performed using this hook are cached independently, just as if they had been performed individually using `useAPIQuery`.

#### `isFetching`

Indicates whether _at least one_ query is in the "fetching" state.

#### `isRefetching`

Indicates whether _at least one_ query is in the "refetching" state.

#### `isLoading`

Indicates whether _at least one_ query is in the "loading state.

#### `isError`

Indicates whether _at least one_ query is in the "error" state.

#### `refetchAll()`

A helper function for triggering a refetch of every independent query in the combination.

```typescript
const query = useCombinedAPIQueries(
  ['GET /messages', { filter: 'some-filter' }],
  ['GET /messages/:id', { id: 'some-message-id' }],
);

// This:
query.refetchAll();

// Is equivalent to:
for (const individualQuery of queries) {
  void individualQuery.refetch();
}
```

#### `queries`

Provides access to the individual underlying queries.

```typescript
const query = useCombinedAPIQueries(
  ['GET /messages', { filter: 'some-filter' }],
  ['GET /messages/:id', { id: 'some-message-id' }],
);

query.queries[0].data; // Messages[] | undefined
query.queries[1].data; // Message | undefined
```

### `useAPICache`

This hook provides several utilities for doing well-typed cache invalidation + cache updates for queries.

#### `invalidateQueries`

Performs invalidaton of queries using `react-query`'s [`invalidateQueries`](https://tanstack.com/query/v4/docs/reference/QueryClient#queryclientinvalidatequeries).

```typescript
const cache = useAPICache();

// Invalidates _all_ queries targeting the "GET /messages" route,
// regardless of payload.
cache.invalidateQueries({
  'GET /messages': 'all',
});

// Invalidates any queries targeting the "GET /messages" route that
// have the payload `{ filter: 'some-filter' }`
cache.invalidateQueries({
  'GET /messages': [{ filter: 'some-filter' }],
});

// Invalidates any queries targeting the "GET /messages" route that
// have _either_ of the specified payloads.
cache.invalidateQueries({
  'GET /messages': [{ filter: 'some-filter' }, { filter: 'other-filter' }],
});

// Provide a predicate if you need to match queries programmatically.
cache.invalidateQueries({
  'GET /messages': (payload) => {
    return payload.filter.includes('some-');
  },
});

// Pass multiple keys to invalidate multiple queries at once.
cache.invalidateQueries({
  'GET /messages': 'all',
  'GET /messages/:id': [{ id: 'some-id' }],
});
```

#### `resetQueries`

Resets queries using `react-query`'s [`resetQueries`](https://tanstack.com/query/v4/docs/reference/QueryClient#queryclientresetqueries).

The API is identical to `invalidateQueries`.

```typescript
const cache = useAPICache();

cache.resetQueries({
  'GET /messages': 'all',
});
```

#### `updateCache`

Performs surgical, well-typed updates to cached queries.

```typescript
const cache = useAPICache();

cache.updateCache(
  // Specify the route + payload that you'd like to update the cached value for.
  'GET /messages',
  { filter: 'some-filter' },
  // Then, specify the updated value.
  [
    { id: '1', content: 'message content one' },
    { id: '2', content: 'message content two' },
  ],
);

// Or, perform a programmatic update by transforming the current cached value:
cache.updateCache(
  'GET /messages',
  { filter: 'some-filter' },
  // `current` will be the current value in the cache.
  (current) => {
    // It's safe to simply mutate `current` directly and return nothing
    //  to perform an update.
    current.push({ id: 'message-id-new', content: 'new message content' });

    // OR, you can just return an updated value if you prefer
    return [
      ...current,
      { id: 'message-id-new', content: 'new message content' },
    ];
  },
);
```

**Note**: if performing a programmatic update, _no update will occur_ if there is not a cached value.

## Test Utility API Reference

`one-query` also provides a testing utility for doing type-safe mocking of API endpoints in tests. This utility is powered by [`msw`](https://github.com/mswjs/msw).

### `createAPIMockingUtility`

If you're using [`jest`](https://jestjs.io/) for testing, use `createAPIMockingUtility` to create a shareable utility for mocking network calls.

```typescript
// Specify your custom "APIEndpoints" type as the generic parameter here.
export const useAPIMocking = createAPIMockingUtility<APIEndpoints>({
  baseUrl: 'https://my.api.com',
});
```

### `mock(route, mocker)`

Mocks the specified route with the specified mocker _persistently_.

```typescript
const api = useAPIMocking();

api.mock(
  // First, specify the route name.
  'GET /messages',
  // Then specify a static response.
  {
    status: 200,
    data: [
      { id: '1', content: 'one' },
      { id: '2', content: 'two' },
    ],
  },
);

// The mock is persistent -- multiple call will receive the same result:
await axios.get('/messages');
// [{ id: '1', ...}, { id: '2', ... }]
await axios.get('/messages');
// [{ id: '1', ...}, { id: '2', ... }]

// A function can also be used to respond programmatically:
api.mock('GET /messages', (req) => ({
  status: 200,
  data:
    req.query.filter === 'some-filter'
      ? [{ id: '1', content: 'one' }]
      : [
          { id: '1', content: 'one' },
          { id: '2', content: 'two' },
        ],
}));

await axios.get('/messages');
// [{ id: '1', ...}, { id: '2', ... }]
await axios.get('/messages?filter=some-filter');
// [{ id: '1', ...}]
```

The function-style mocking can also be useful for making specific assertions about network calls.

```typescript
const getMessages = jest.fn();
api.mock(
  'GET /messages',
  getMessages.mockReturnValue({
    status: 200,
    data: [],
  }),
);

await axios.get('/messages?filter=some-filter');

expect(getMessages).toHaveBeenCalledTimes(1);
expect(getMessages).toHaveBeenCalledWith(
  expect.objectContaining({
    query: 'some-filter',
  }),
);
```

### `mockOrdered(route, responses)`

Mocks a series of ordered responses from the specified route.

```typescript
const api = useAPIMocking();

api.mockOrdered('GET /messages', [
  { status: 200, data: [] },
  { status: 200, data: [{ id: '1', content: 'one' }] },
  {
    status: 200,
    data: [
      { id: '1', content: 'one' },
      { id: '2', content: 'two' },
    ],
  },
]);

await client.get('/messages');
// []

await client.get('/messages');
// [{ id: '1', content: 'one' }]

await client.get('/messages');
// [{ id: '1', content: 'one' }, { id: '2', content: 'two' }]

await client.get('/messages');
// This request will *not* be mocked.
```
