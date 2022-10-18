import * as React from 'react';
import * as TestingLibrary from '@testing-library/react';
import axios from 'axios';
import { createAPIHooks } from './hooks';
import { createAPIMockingUtility } from './test-utils';
import { APIClient } from './util';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type TestEndpoints = {
  'GET /items': {
    Request: { filter: string };
    Response: { message: string };
  };
  'GET /items/:id': {
    Request: { filter: string };
    Response: { message: string };
  };
  'POST /items': {
    Request: { message: string };
    Response: { message: string };
  };
  'PUT /list': {
    Request: { message: string }[];
    Response: { message: string };
  };
};

const { useQuery, useMutation } = createAPIHooks({
  name: 'test-name',
  client: new APIClient<TestEndpoints>(
    axios.create({ baseURL: 'https://www.lifeomic.com' }),
  ),
});

const network = createAPIMockingUtility<TestEndpoints>({
  baseUrl: 'https://www.lifeomic.com',
})();

const client = new QueryClient();

const render = (Component: React.FC) =>
  TestingLibrary.render(<Component />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

describe('useQuery', () => {
  test('works correctly', async () => {
    network.mock('GET /items', {
      status: 200,
      data: { message: 'test-message' },
    });

    const screen = render(() => {
      const query = useQuery('GET /items', { filter: 'test-filter' });
      return <div data-testid="content">{query.data?.message || ''}</div>;
    });

    await TestingLibrary.waitFor(() => {
      expect(screen.getByTestId('content').textContent).toStrictEqual(
        'test-message',
      );
    });
  });
});

describe('useMutation', () => {
  test('works correctly', async () => {
    const networkPost = jest.fn().mockReturnValue({
      status: 200,
      data: { message: 'another-test-message' },
    });
    network.mock('POST /items', networkPost);

    const screen = render(() => {
      const mutation = useMutation('POST /items');
      return (
        <button
          onClick={() => {
            mutation.mutate({ message: 'something' });
          }}
        >
          Press Me
        </button>
      );
    });

    TestingLibrary.fireEvent.click(screen.getByText('Press Me'));

    await TestingLibrary.waitFor(() => {
      expect(networkPost).toHaveBeenCalledTimes(1);
      expect(networkPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { message: 'something' },
        }),
      );
    });
  });
});
