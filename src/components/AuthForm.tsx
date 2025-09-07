import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText, sanitizeEmail } from '@/lib/sanitize';

interface AuthFormProps {
  embedded?: boolean;
}

export function AuthForm({ embedded = false }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Sanitize all inputs before submission
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedFirstName = sanitizeText(firstName);
    const sanitizedLastName = sanitizeText(lastName);
    const sanitizedPassword = password; // Don't sanitize password as it may contain special chars

    // Validate sanitized inputs
    if (!sanitizedEmail) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (isSignUp && (!sanitizedFirstName || !sanitizedLastName)) {
      toast({
        title: "Error", 
        description: "First name and last name are required",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

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

  if (embedded) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {isSignUp && (
          <>
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-connection-text">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-connection-text">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Enter your last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-connection-text">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="border-connection-primary/20 focus:border-connection-primary bg-white/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-connection-text">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
        </div>

        <Button 
          type="submit" 
          className="w-full bg-connection-primary hover:bg-connection-primary/90 text-white shadow-elegant hover:shadow-glow transition-all" 
          disabled={loading}
        >
          {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </Button>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            onClick={() => setIsSignUp(!isSignUp)}
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
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Enter your first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Enter your last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 sm:h-10 text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
            </div>

            <Button 
              type="submit" 
              variant="medical" 
              className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium mt-6" 
              disabled={loading}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsSignUp(!isSignUp)}
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