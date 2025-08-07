import { useState, useCallback } from 'react';

export const useSnackBar = () => {
  const [snackBarState, setSnackBarState] = useState({
    visible: false,
    message: '',
    type: 'info', // 'success', 'error', 'warning', 'info'
  });

  const showSnackBar = useCallback((message, type = 'info') => {
    setSnackBarState({
      visible: true,
      message,
      type,
    });
  }, []);

  const hideSnackBar = useCallback(() => {
    setSnackBarState(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // Convenience methods for different types
  const showSuccess = useCallback((message) => {
    showSnackBar(message, 'success');
  }, [showSnackBar]);

  const showError = useCallback((message) => {
    showSnackBar(message, 'error');
  }, [showSnackBar]);

  const showWarning = useCallback((message) => {
    showSnackBar(message, 'warning');
  }, [showSnackBar]);

  const showInfo = useCallback((message) => {
    showSnackBar(message, 'info');
  }, [showSnackBar]);

  return {
    snackBarState,
    showSnackBar,
    hideSnackBar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
