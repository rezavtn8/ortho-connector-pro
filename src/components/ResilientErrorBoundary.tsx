import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Wifi, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showNetworkStatus?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isOnline: boolean;
}

export class ResilientErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isOnline: navigator.onLine
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOnline: true });
    // If error was network-related, try to recover
    if (this.state.hasError && this.isNetworkError(this.state.error)) {
      this.handleRetry();
    }
  };

  handleOffline = () => {
    this.setState({ isOnline: false });
  };

  isNetworkError = (error: Error | null): boolean => {
    if (!error) return false;
    const networkKeywords = ['network', 'connection', 'fetch', 'load failed', 'offline'];
    return networkKeywords.some(keyword => 
      error.message?.toLowerCase().includes(keyword)
    );
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null
    });
    // Force a re-render
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNetworkError = this.isNetworkError(this.state.error);

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                {isNetworkError ? (
                  this.state.isOnline ? <Wifi className="w-6 h-6 text-destructive" /> : <WifiOff className="w-6 h-6 text-destructive" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                )}
              </div>
              <CardTitle className="text-xl">
                {isNetworkError 
                  ? (this.state.isOnline ? 'Connection Error' : 'You\'re Offline')
                  : 'Something went wrong'
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                {isNetworkError
                  ? this.state.isOnline 
                    ? 'Unable to connect to our servers. Please check your internet connection and try again.'
                    : 'You\'re currently offline. Some features may not be available until you reconnect.'
                  : 'An unexpected error occurred. Please try refreshing the page.'
                }
              </p>

              {this.props.showNetworkStatus && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  {this.state.isOnline ? (
                    <>
                      <Wifi className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">Offline</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button 
                  onClick={this.handleRetry}
                  className="gap-2"
                  disabled={!this.state.isOnline && isNetworkError}
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Technical Details
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}