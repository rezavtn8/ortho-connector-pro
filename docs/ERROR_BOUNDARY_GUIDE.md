# Error Boundary Implementation Guide

This project includes a comprehensive error boundary system for catching and handling React errors gracefully.

## Overview

The error boundary system consists of:

1. **ErrorBoundary Component** - Main error boundary with Supabase logging
2. **CriticalErrorBoundary** - Specialized boundary for critical sections
3. **Error Utilities** - Helper functions and custom error classes
4. **Database Integration** - Error logging to Supabase with RLS policies

## Components

### ErrorBoundary

The main error boundary component that catches React errors and provides:

- **Error Logging**: Automatically logs errors to Supabase database
- **User-Friendly UI**: Shows fallback UI with retry options
- **Development Tools**: Displays error details in development mode
- **Retry Logic**: Allows users to retry failed operations
- **Context Tracking**: Logs component stack and user context

#### Usage

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

// App level (critical errors)
<ErrorBoundary level="app">
  <App />
</ErrorBoundary>

// Section level (page/route errors)
<ErrorBoundary level="section">
  <Dashboard />
</ErrorBoundary>

// Component level (individual component errors)
<ErrorBoundary level="component">
  <DataTable data={data} />
</ErrorBoundary>
```

#### Props

- `level`: Error severity level (`'app' | 'section' | 'component'`)
- `fallback`: Custom fallback UI (optional)
- `onError`: Custom error handler (optional)

### withErrorBoundary HOC

Higher-order component for wrapping components:

```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

const SafeComponent = withErrorBoundary(MyComponent, {
  level: 'component'
});
```

### useErrorReporting Hook

Hook for programmatic error reporting:

```tsx
import { useErrorReporting } from '@/components/ErrorBoundary';

function MyComponent() {
  const { reportError } = useErrorReporting();

  const handleAsyncError = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      reportError(error as Error, {
        level: 'error',
        metadata: {
          component: 'MyComponent',
          action: 'riskyOperation'
        }
      });
    }
  };
}
```

## Database Schema

### error_logs Table

```sql
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  url TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  severity TEXT DEFAULT 'error',
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### RLS Policies

- Users can insert their own error logs
- Users can view their own error logs
- System can update error logs (for resolution status)

## Error Levels

### App Level (`level="app"`)
- **Purpose**: Catch critical errors that could crash the entire application
- **UI**: Full-screen error message with reload option
- **Logging**: Severity set to 'critical'
- **Retry**: Limited retries, then suggests page reload

### Section Level (`level="section"`)
- **Purpose**: Catch errors in major sections like pages or routes
- **UI**: Section-specific error message with navigation options
- **Logging**: Severity set to 'error'
- **Retry**: Multiple retry attempts with backoff

### Component Level (`level="component"`)
- **Purpose**: Catch errors in individual components
- **UI**: Minimal error message within component bounds
- **Logging**: Severity set to 'error'
- **Retry**: Quick retry with graceful degradation

## Best Practices

### 1. Strategic Placement

```tsx
// ✅ Good: Strategic placement at key boundaries
<ErrorBoundary level="app">
  <QueryClientProvider>
    <BrowserRouter>
      <ErrorBoundary level="section">
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </QueryClientProvider>
</ErrorBoundary>

// ❌ Avoid: Over-wrapping every component
<ErrorBoundary level="component">
  <ErrorBoundary level="component">
    <SimpleComponent />
  </ErrorBoundary>
</ErrorBoundary>
```

### 2. Custom Fallbacks

```tsx
// ✅ Provide context-appropriate fallbacks
<ErrorBoundary 
  level="component"
  fallback={
    <div className="p-4 text-center text-muted-foreground">
      Chart temporarily unavailable
    </div>
  }
>
  <ExpensiveChart data={data} />
</ErrorBoundary>
```

### 3. Error Context

```tsx
// ✅ Include relevant context in error reports
const { reportError } = useErrorReporting();

try {
  await processPayment(amount);
} catch (error) {
  reportError(error as Error, {
    level: 'error',
    metadata: {
      component: 'PaymentForm',
      amount: amount.toString(),
      userId: user.id,
      timestamp: Date.now().toString()
    }
  });
}
```

## Error Monitoring

### Viewing Errors

Errors are stored in the `error_logs` table and can be viewed through Supabase dashboard or by creating an admin interface.

### Error Resolution

Errors can be marked as resolved by updating the `resolved` field:

```sql
UPDATE error_logs 
SET resolved = true 
WHERE id = 'error-id';
```

### Analytics Queries

```sql
-- Most common errors
SELECT error_message, COUNT(*) as count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC;

-- Errors by severity
SELECT severity, COUNT(*) as count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY severity;

-- User impact
SELECT user_id, COUNT(*) as error_count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND user_id IS NOT NULL
GROUP BY user_id
ORDER BY error_count DESC;
```

## Testing

Use the `ErrorTest` component to test error boundary functionality:

```tsx
import { ErrorTest } from '@/components/ErrorTest';

// Add to your development routes
<Route path="/error-test" element={<ErrorTest />} />
```

## Environment Considerations

### Development
- Shows detailed error information
- Displays component stack traces
- Includes debug information in UI

### Production
- Hides sensitive error details
- Shows user-friendly messages
- Focuses on recovery options
- Logs detailed information to database

## Security Considerations

1. **Sensitive Data**: Never log sensitive information in error messages
2. **User Privacy**: Error logs are isolated by user via RLS policies
3. **Rate Limiting**: Consider implementing rate limiting for error reporting
4. **Data Retention**: Implement cleanup policies for old error logs

## Migration and Cleanup

The system includes automatic cleanup functionality:

```sql
-- Cleanup old error logs (called automatically)
SELECT cleanup_old_audit_logs();
```

## Troubleshooting

### Common Issues

1. **Error Boundary Not Catching Errors**
   - Ensure error occurs during render, not in event handlers
   - Use `useErrorReporting` hook for async errors

2. **Database Connection Issues**
   - Check Supabase configuration
   - Verify RLS policies
   - Ensure user authentication

3. **Performance Impact**
   - Monitor error log table size
   - Implement proper indexing
   - Regular cleanup of old logs

### Debug Mode

Enable debug logging by setting:

```tsx
// In development only
if (process.env.NODE_ENV === 'development') {
  // Error boundary will show additional debug information
}
```