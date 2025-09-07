import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, signUpSchema } from '@/lib/validation';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';
import { sanitizeText, sanitizeEmail } from '@/lib/sanitize';

interface AuthFormProps {
  embedded?: boolean;
}

export function AuthForm({ embedded = false }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, isLocked, lockoutTimeRemaining, formatLockoutTime } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue
  } = useForm<any>({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema),
    mode: 'onChange',
  });

  const watchedPassword = watch('password', '');

  const onSubmit = async (data: any) => {
    if (isLocked && !isSignUp) {
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Try again in ${formatLockoutTime(lockoutTimeRemaining)}.`,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    // Sanitize all inputs before submission
    const sanitizedEmail = sanitizeEmail(data.email);
    const sanitizedFirstName = data.firstName ? sanitizeText(data.firstName) : '';
    const sanitizedLastName = data.lastName ? sanitizeText(data.lastName) : '';
    const sanitizedPassword = data.password; // Don't sanitize password as it may contain special chars

    try {
      const { error } = isSignUp 
        ? await signUp(sanitizedEmail, sanitizedPassword, sanitizedFirstName, sanitizedLastName)
        : await signIn(sanitizedEmail, sanitizedPassword);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else if (isSignUp) {
        toast({
          title: "Account created",
          description: "Please check your email to verify your account.",
          variant: "default",
        });
        reset();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    reset();
    setValue('password', '');
  };

  if (embedded) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {isSignUp && (
          <>
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-connection-text">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Enter your first name"
                {...register('firstName')}
                autoComplete="given-name"
                className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.firstName?.message as string}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-connection-text">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Enter your last name"
                {...register('lastName')}
                autoComplete="family-name"
                className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.lastName?.message as string}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-connection-text">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            {...register('email')}
            autoComplete="email"
            className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-destructive" role="alert">
              {errors.email?.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-connection-text">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
              aria-invalid={!!errors.password}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 text-connection-muted hover:text-connection-text"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive" role="alert">
              {errors.password?.message as string}
            </p>
          )}
          {isSignUp && (
            <PasswordStrengthIndicator password={watchedPassword} className="mt-2" />
          )}
        </div>

        {isLocked && !isSignUp && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center">
            <p className="text-sm text-destructive font-medium">Account Locked</p>
            <p className="text-xs text-connection-muted mt-1">
              Too many failed attempts. Try again in {formatLockoutTime(lockoutTimeRemaining)}.
            </p>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full bg-connection-primary hover:bg-connection-primary/90 text-white shadow-elegant hover:shadow-glow transition-all" 
          disabled={loading || (isLocked && !isSignUp)}
        >
          {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </Button>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            onClick={toggleMode}
            className="text-sm text-connection-muted hover:text-connection-primary"
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"
            }
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <Card variant="medical" className="w-full max-w-sm sm:max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center px-4 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-3 sm:mb-6">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <CardTitle className="text-lg sm:text-2xl font-semibold mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base px-1 sm:px-2">
            {isSignUp 
              ? 'Create your account for Referring Office Intelligence' 
              : 'Sign in to your Referring Office Intelligence account'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Enter your first name"
                    {...register('firstName')}
                    autoComplete="given-name"
                    className="h-12 sm:h-10 text-base sm:text-sm"
                    aria-invalid={!!errors.firstName}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.firstName?.message as string}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Enter your last name"
                    {...register('lastName')}
                    autoComplete="family-name"
                    className="h-12 sm:h-10 text-base sm:text-sm"
                    aria-invalid={!!errors.lastName}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.lastName?.message as string}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                autoComplete="email"
                className="h-12 sm:h-10 text-base sm:text-sm"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.email?.message as string}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="h-12 sm:h-10 text-base sm:text-sm pr-12"
                  aria-invalid={!!errors.password}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted/50"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.password?.message as string}
                </p>
              )}
              {isSignUp && (
                <PasswordStrengthIndicator password={watchedPassword} className="mt-2" />
              )}
            </div>

            {isLocked && !isSignUp && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center mb-4">
                <p className="text-sm text-destructive font-medium">Account Locked</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Too many failed attempts. Try again in {formatLockoutTime(lockoutTimeRemaining)}.
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              variant="medical" 
              className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium mt-6" 
              disabled={loading || (isLocked && !isSignUp)}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="link"
                onClick={toggleMode}
                className="text-sm text-muted-foreground hover:text-foreground h-auto p-0 min-h-[44px] flex items-center"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}