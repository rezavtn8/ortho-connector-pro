import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary, useErrorReporting } from './ErrorBoundary';
import { AlertTriangle, Zap, Bug } from 'lucide-react';

// Component that can throw different types of errors for testing
function ErrorThrower() {
  const { reportError } = useErrorReporting();
  const [count, setCount] = useState(0);

  const throwRenderError = () => {
    throw new Error('This is a test render error');
  };

  const throwAsyncError = async () => {
    try {
      throw new Error('This is a test async error');
    } catch (error) {
      reportError(error as Error, {
        level: 'error',
        metadata: {
          component: 'ErrorThrower',
          action: 'throwAsyncError',
          timestamp: Date.now().toString(),
        }
      });
    }
  };

  const throwNetworkError = async () => {
    try {
      const response = await fetch('/api/nonexistent-endpoint');
      if (!response.ok) throw new Error('Network request failed');
    } catch (error) {
      reportError(error as Error, {
        level: 'error',
        metadata: {
          component: 'ErrorThrower',
          action: 'networkRequest',
          endpoint: '/api/nonexistent-endpoint',
        }
      });
    }
  };

  if (count > 2) {
    throwRenderError();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Error Testing Component
        </CardTitle>
        <CardDescription>
          Test different types of errors to see how the ErrorBoundary handles them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Button 
            onClick={() => setCount(count + 1)}
            variant="outline"
            className="justify-start"
          >
            <Zap className="mr-2 h-4 w-4" />
            Trigger Render Error (click 3 times)
          </Button>
          
          <Button 
            onClick={throwAsyncError}
            variant="outline"
            className="justify-start"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Test Async Error Reporting
          </Button>
          
          <Button 
            onClick={throwNetworkError}
            variant="outline"
            className="justify-start"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Test Network Error Reporting
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Click count: {count}/3 (Render error will trigger at 3)
        </div>
      </CardContent>
    </Card>
  );
}

// Test component wrapped with error boundary
export function ErrorTest() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Error Boundary Testing</h2>
        <p className="text-muted-foreground">
          This component demonstrates how the ErrorBoundary catches and handles different types of errors.
        </p>
      </div>

      <div className="grid gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Component with Error Boundary</h3>
          <ErrorBoundary level="component">
            <ErrorThrower />
          </ErrorBoundary>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Component without Error Boundary</h3>
          <p className="text-sm text-muted-foreground mb-3">
            ⚠️ Warning: This component is not wrapped with an error boundary. 
            A render error here will crash the entire app.
          </p>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm">
                This component is not protected by an error boundary. 
                Use the component above to test error handling safely.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}