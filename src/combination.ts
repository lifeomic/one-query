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
  isLoading: false;
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
  isLoading: true;
  isError: false;
  data: undefined;
  queries: Queries;
};

export type CombinedQueriesErrorResult<Queries extends QueryObserverResult[]> =
  {
    isLoading: false;
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
      isLoading: false,
      data: undefined,
      isError: true,
      queries,
    };
  }

  if (queries.some((query) => query.status === 'loading')) {
    return {
      ...base,
      isLoading: true,
      data: undefined,
      isError: false,
      queries,
    };
  }

  return {
    ...base,
    isLoading: false,
    data: queries.map((query) => query.data) as any,
    isError: false,
    queries: queries as any,
  };
};
