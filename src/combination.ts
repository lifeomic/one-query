import {
  DefinedQueryObserverResult,
  QueryObserverResult,
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

export type CombinedQueriesLoadingResult<
  Queries extends QueryObserverResult[],
> = {
  status: 'loading';
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
      | CombinedQueriesLoadingResult<Queries>
      | CombinedQueriesErrorResult<Queries>
    );

export const combineQueries = <Queries extends QueryObserverResult[]>(
  queries: [...Queries],
): CombinedQueriesResult<Queries> => {
  const base = {
    isFetching: queries.some((query) => query.isFetching),
    isRefetching: queries.some((query) => query.isRefetching),
    refetchAll: () => {
      queries.forEach((query) => {
        void query.refetch();
      });
    },
  };

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

  if (queries.some((query) => query.status === 'pending')) {
    return {
      ...base,
      status: 'loading',
      isPending: true,
      data: undefined,
      isError: false,
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
