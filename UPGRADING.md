This document provides instructions for upgrading between major
versions of `@lifeomic/one-query`

### 3.x -> 4.x

- Replace your installation of `@tanstack/react-query@4.x` with `@tanstack/react-query@5.x`

- See `react-query`'s [migration guide](https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5) for an idea. The largest changes will be outlined below - however since `one-query` is mostly a typed wrapper around `react-query` most, if not all, things mentioned apply

- To Better align with with the api changes in react-query, the api will change to providing the request "input" or payload as part of the third argument options. Making options required for at least that property.

```diff
- useAPIQuery(route, payload, options)
+ useQuery(route, { payload, ...options })
```

- The `loading` status has been renamed to `pending`, and similarly the derived `isLoading` flag has been renamed to `isPending`

```diff
- query.status === 'loading'
+ query.status === 'pending'

- if (query.isLoading)
+ if (query.isPending)
```

- `useInfiniteAPIQuery` now requires `initialPageParam` and `getNextPageParam` options. Passing page param through `fetchNextPage` and `fetchPreviousPage` is no longer supported.

```diff
-  const query = useInfiniteAPIQuery('GET /list', {
-   filter: 'some-filter',
-   after: undefined,
- });
- await void query.fetchNextPage({ pageParam: {...} });
+ const query = useInfiniteAPIQuery(
+   'GET /list',
+   {
+     filter: 'some-filter',
+     after: undefined,
+   },
+   {
+     initialPageParam: {},
+     getNextPageParam: (lastPage) => ({
+       after: lastPage.next,
+     }),
+   },
+ );
+ await void query.fetchNextPage();
```

- The minimum required TypeScript version is now 4.7

- TypeScript: `Error` is now the default type for errors instead of `unknown`

- Callbacks on `useQuery` have been removed (e.g., `onSuccess`, `onError` and `onSettled`)

- Removed `keepPreviousData` in favor of `placeholderData` identity function

- Rename `cacheTime` to `gcTime`

- Removed `refetchPage` in favor of `maxPages`

- The experimental `suspense: boolean` flag on the query hooks has been removed - new hooks for suspense have been added
