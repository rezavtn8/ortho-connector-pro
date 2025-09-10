import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, signUpSchema, checkPasswordStrength, SignInFormData, SignUpFormData } from '@/lib/validationSchemas';
import { Progress } from '@/components/ui/progress';

interface AuthFormProps {
  embedded?: boolean;
}

export function AuthForm({ embedded = false }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, signInWithGoogle, isLocked, lockoutTimeRemaining, formatLockoutTime } = useAuth();
  const { toast } = useToast();

  // Form setup with validation
  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      jobTitle: '',
      degrees: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const currentForm = isSignUp ? signUpForm : signInForm;
  const watchedPassword = signUpForm.watch('password');
  const passwordStrength = isSignUp ? checkPasswordStrength(watchedPassword || '') : null;

  const handleSubmit = async (data: SignInFormData | SignUpFormData) => {
    if (isLocked && !isSignUp) {
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Try again in ${formatLockoutTime(lockoutTimeRemaining)}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = isSignUp 
        ? await signUp(
            (data as SignUpFormData).email, 
            (data as SignUpFormData).password, 
            (data as SignUpFormData).firstName, 
            (data as SignUpFormData).lastName,
            (data as SignUpFormData).phone,
            (data as SignUpFormData).jobTitle,
            (data as SignUpFormData).degrees
          )
        : await signIn((data as SignInFormData).email, (data as SignInFormData).password);

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
        // Reset form after successful signup
        signUpForm.reset();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleModeChange = () => {
    setIsSignUp(!isSignUp);
    // Reset both forms when switching modes
    signInForm.reset();
    signUpForm.reset();
  };

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred with Google sign-in",
        variant: "destructive",
      });
    }
  };

  // Password strength indicator component
  const PasswordStrengthIndicator = ({ strength }: { strength: ReturnType<typeof checkPasswordStrength> }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Password strength</span>
        <span className={`text-xs font-medium text-${strength.color}-600`}>
          {strength.score <= 2 ? 'Weak' : strength.score <= 4 ? 'Good' : 'Strong'}
        </span>
      </div>
      <Progress value={(strength.score / 6) * 100} className="h-2" />
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {strength.feedback.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              <X className="w-3 h-3 text-red-500" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    return (
      <form onSubmit={currentForm.handleSubmit(handleSubmit)} className="space-y-6">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-connection-text">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Enter your first name"
                      {...signUpForm.register('firstName')}
                      className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                    />
                    {signUpForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600">{signUpForm.formState.errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-connection-text">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Enter your last name"
                      {...signUpForm.register('lastName')}
                      className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                    />
                    {signUpForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600">{signUpForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-connection-text">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    {...signUpForm.register('phone')}
                    className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                  />
                  {signUpForm.formState.errors.phone && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-connection-text">Job Title</Label>
                  <Input
                    id="jobTitle"
                    type="text"
                    placeholder="e.g., Dentist, Office Manager, etc."
                    {...signUpForm.register('jobTitle')}
                    className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                  />
                  {signUpForm.formState.errors.jobTitle && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.jobTitle.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="degrees" className="text-connection-text">Degrees (Optional)</Label>
                  <Input
                    id="degrees"
                    type="text"
                    placeholder="e.g., DDS, MS, MDS" 
                    {...signUpForm.register('degrees')}
                    className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
                  />
                  {signUpForm.formState.errors.degrees && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.degrees.message}</p>
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
            {...(isSignUp ? signUpForm.register('email') : signInForm.register('email'))}
            className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
          />
          {(isSignUp ? signUpForm.formState.errors.email : signInForm.formState.errors.email) && (
            <p className="text-sm text-red-600">
              {(isSignUp ? signUpForm.formState.errors.email : signInForm.formState.errors.email)?.message}
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
              {...(isSignUp ? signUpForm.register('password') : signInForm.register('password'))}
              className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 text-connection-muted hover:text-connection-text"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          {(isSignUp ? signUpForm.formState.errors.password : signInForm.formState.errors.password) && (
            <p className="text-sm text-red-600">
              {(isSignUp ? signUpForm.formState.errors.password : signInForm.formState.errors.password)?.message}
            </p>
          )}
          {isSignUp && passwordStrength && watchedPassword && (
            <PasswordStrengthIndicator strength={passwordStrength} />
          )}
        </div>

        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-connection-text">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              {...signUpForm.register('confirmPassword')}
              className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
            />
            {signUpForm.formState.errors.confirmPassword && (
              <p className="text-sm text-red-600">{signUpForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>
        )}

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
          disabled={currentForm.formState.isSubmitting || (isLocked && !isSignUp)}
        >
          {currentForm.formState.isSubmitting ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </Button>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 border-t border-connection-primary/20"></div>
          <span className="text-sm text-connection-muted">or</span>
          <div className="flex-1 border-t border-connection-primary/20"></div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignUp}
          className="w-full border-connection-primary/20 hover:bg-connection-primary/5 text-connection-text"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
        </Button>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            onClick={handleModeChange}
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
          <form onSubmit={currentForm.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
            {isSignUp && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Enter your first name"
                      {...signUpForm.register('firstName')}
                      className="h-12 sm:h-10 text-base sm:text-sm"
                    />
                    {signUpForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600">{signUpForm.formState.errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Enter your last name"
                      {...signUpForm.register('lastName')}
                      className="h-12 sm:h-10 text-base sm:text-sm"
                    />
                    {signUpForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600">{signUpForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    {...signUpForm.register('phone')}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                  {signUpForm.formState.errors.phone && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-sm font-medium">Job Title</Label>
                  <Input
                    id="jobTitle"
                    type="text"
                    placeholder="e.g., Dentist, Office Manager, etc."
                    {...signUpForm.register('jobTitle')}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                  {signUpForm.formState.errors.jobTitle && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.jobTitle.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="degrees" className="text-sm font-medium">Degrees (Optional)</Label>
                  <Input
                    id="degrees"
                    type="text"
                    placeholder="e.g., DDS, MS, MDS"
                    {...signUpForm.register('degrees')}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                  {signUpForm.formState.errors.degrees && (
                    <p className="text-sm text-red-600">{signUpForm.formState.errors.degrees.message}</p>
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
                {...(isSignUp ? signUpForm.register('email') : signInForm.register('email'))}
                className="h-12 sm:h-10 text-base sm:text-sm"
              />
              {(isSignUp ? signUpForm.formState.errors.email : signInForm.formState.errors.email) && (
                <p className="text-sm text-red-600">
                  {(isSignUp ? signUpForm.formState.errors.email : signInForm.formState.errors.email)?.message}
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
                  {...(isSignUp ? signUpForm.register('password') : signInForm.register('password'))}
                  className="h-12 sm:h-10 text-base sm:text-sm pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted/50"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {(isSignUp ? signUpForm.formState.errors.password : signInForm.formState.errors.password) && (
                <p className="text-sm text-red-600">
                  {(isSignUp ? signUpForm.formState.errors.password : signInForm.formState.errors.password)?.message}
                </p>
              )}
              {isSignUp && passwordStrength && watchedPassword && (
                <PasswordStrengthIndicator strength={passwordStrength} />
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...signUpForm.register('confirmPassword')}
                  className="h-12 sm:h-10 text-base sm:text-sm"
                />
                {signUpForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-600">{signUpForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            )}

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
              disabled={currentForm.formState.isSubmitting || (isLocked && !isSignUp)}
            >
              {currentForm.formState.isSubmitting ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 border-t border-border"></div>
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignUp}
              className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </Button>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="link"
                onClick={handleModeChange}
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