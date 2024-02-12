import {
  DefinedQueryObserverResult,
  QueryObserverResult,
  UseSuspenseQueryResult,
} from '@tanstack/react-query';

type CombinedQueriesBaseResult = {
  isFetching: boolean;
  isRefetching: boolean;
  refetchAll: () => void;
};

type DataOfQuery<Query> = Query extends QueryObserverResult<infer Data>
  ? Data
  : never;

// Data is defined -- not loading and not error.
export type CombinedQueriesDefinedResult<
  Queries extends QueryObserverResult[],
> = {
  status: 'success';
  isPending: false;
  isError: false;
  data: {
    [Index in keyof Queries]: DataOfQuery<Queries[Index]>;
  };
  queries: {
    [Index in keyof Queries]: DefinedQueryObserverResult<
      DataOfQuery<Queries[Index]>
    >;
  };
};

export type CombinedQueriesPendingResult<
  Queries extends QueryObserverResult[],
> = {
  status: 'pending';
  isPending: true;
  isError: false;
  data: undefined;
  queries: Queries;
};

export type CombinedQueriesErrorResult<Queries extends QueryObserverResult[]> =
  {
    status: 'error';
    isPending: false;
    isError: true;
    data: undefined;
    queries: Queries;
  };

export type CombinedQueriesResult<Queries extends QueryObserverResult[]> =
  CombinedQueriesBaseResult &
    (
      | CombinedQueriesDefinedResult<Queries>
      | CombinedQueriesPendingResult<Queries>
      | CombinedQueriesErrorResult<Queries>
    );

export type SuspenseCombinedQueriesResult<
  Queries extends QueryObserverResult[],
> = CombinedQueriesBaseResult &
  Pick<
    UseSuspenseQueryResult<Queries>,
    'data' | 'status' | 'isPending' | 'isError'
  > & {
    queries: {
      [Index in keyof Queries]: DefinedQueryObserverResult<
        DataOfQuery<Queries[Index]>
      >;
    };
  };

const getBase = <Queries extends QueryObserverResult[]>(
  queries: [...Queries],
): CombinedQueriesBaseResult => {
  const base = {
    isFetching: queries.some((query) => query.isFetching),
    isRefetching: queries.some((query) => query.isRefetching),
    refetchAll: () => {
      queries.forEach((query) => {
        void query.refetch();
      });
    },
  };

  return base;
};

export const combineQueries = <Queries extends QueryObserverResult[]>(
  queries: [...Queries],
): CombinedQueriesResult<Queries> => {
  const base = getBase(queries);

  if (queries.some((query) => query.status === 'pending')) {
    return {
      ...base,
      status: 'pending',
      isPending: true,
      data: undefined,
      isError: false,
      queries,
    };
  }

  if (queries.some((query) => query.status === 'error')) {
    return {
      ...base,
      status: 'error',
      isPending: false,
      data: undefined,
      isError: true,
      queries,
    };
  }

  return {
    ...base,
    status: 'success',
    isPending: false,
    data: queries.map((query) => query.data) as any,
    isError: false,
    queries: queries as any,
  };
};

export const suspenseCombineQueries = <Queries extends QueryObserverResult[]>(
  queries: [...Queries],
): SuspenseCombinedQueriesResult<Queries> => {
  const base = getBase(queries);

  // Loading and Error states will be handled by suspense and error
  // boundaries so unlike the non-suspense version we only need to
  // account for the DefinedQueryObserverResult state
  return {
    ...base,
    status: 'success',
    isPending: false,
    data: queries.map((query) => query.data) as any,
    isError: false,
    queries: queries as any,
  };
};
