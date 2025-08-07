import React, { createContext, useContext, ReactNode } from 'react';
import { SnackBar } from '../components/SnackBar';
import { useSnackBar } from '../hooks/useSnackBar';

interface SnackBarContextType {
  showSnackBar: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackBarContext = createContext<SnackBarContextType | undefined>(undefined);

export const useSnackBarContext = (): SnackBarContextType => {
  const context = useContext(SnackBarContext);
  if (!context) {
    throw new Error('useSnackBarContext must be used within a SnackBarProvider');
  }
  return context;
};

interface SnackBarProviderProps {
  children: ReactNode;
}

export const SnackBarProvider: React.FC<SnackBarProviderProps> = ({ children }) => {
  const {
    snackBarState,
    hideSnackBar,
    showSnackBar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  } = useSnackBar();

  const contextValue: SnackBarContextType = {
    showSnackBar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <SnackBarContext.Provider value={contextValue}>
      {children}
      <SnackBar
        message={snackBarState.message}
        type={snackBarState.type}
        visible={snackBarState.visible}
        onDismiss={hideSnackBar}
      />
    </SnackBarContext.Provider>
  );
};
