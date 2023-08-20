import React from 'react';

import { AxiosInstance } from 'axios';

const ClientContext = React.createContext<AxiosInstance | undefined>(undefined);

export type ClientProviderProps = {
  client: AxiosInstance;
  children?: React.ReactNode;
};

export const ClientProvider: React.FC<ClientProviderProps> = ({
  client,
  children,
}) => {
  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
};

export const useClient = (): AxiosInstance | undefined => {
  return React.useContext(ClientContext);
};
