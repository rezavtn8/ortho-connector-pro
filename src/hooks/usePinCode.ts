import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PinCodeResult {
  success: boolean;
  error?: string;
  verified?: boolean;
}

interface PinCodeResponse {
  success: boolean;
  error?: string;
  verified?: boolean;
  message?: string;
}

export function usePinCode() {
  const [isLoading, setIsLoading] = useState(false);

  const updatePinCode = async (newPin: string): Promise<PinCodeResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('update_user_pin_code', {
        new_pin: newPin
      });

      if (error) {
        console.error('Error updating PIN:', error);
        toast({
          title: "Error",
          description: "Failed to update PIN code. Please try again.",
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      const result = data as unknown as PinCodeResponse;
      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to update PIN code",
          variant: "destructive",
        });
        return { success: false, error: result.error };
      }

      toast({
        title: "Success",
        description: "PIN code updated successfully",
      });
      return { success: true };
    } catch (error) {
      console.error('PIN update error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPinCode = async (inputPin: string): Promise<PinCodeResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_user_pin_code', {
        input_pin: inputPin
      });

      if (error) {
        console.error('Error verifying PIN:', error);
        return { success: false, error: error.message };
      }

      const result = data as unknown as PinCodeResponse;
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, verified: result.verified };
    } catch (error) {
      console.error('PIN verification error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updatePinCode,
    verifyPinCode,
    isLoading
  };
}