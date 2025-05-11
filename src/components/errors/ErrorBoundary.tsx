import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../services/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showConfirmation: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showConfirmation: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      showConfirmation: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Error capturado en ErrorBoundary', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack,
      location: window.location.href,
      timestamp: new Date().toISOString()
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleContinue = (): void => {
    if (window.confirm('¿Desea continuar con la iteración?')) {
      this.setState({ hasError: false, error: null });
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary-container">
          <h1>Lo sentimos, ha ocurrido un error inesperado</h1>
          <p>Nuestro equipo ha sido notificado y estamos trabajando en solucionarlo.</p>
          <div className="error-boundary-actions">
            <button onClick={this.handleReload}>
              Recargar página
            </button>
            <button onClick={this.handleContinue}>
              Continuar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}