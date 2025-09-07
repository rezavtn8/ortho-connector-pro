import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { errorHandler } from '@/utils/errorUtils';

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

      if (error) throw error;

      const result = data as unknown as PinCodeResponse;
      if (!result.success) {
        return { success: false, error: result.error };
      }

      toast({
        title: "Success",
        description: "PIN code updated successfully",
      });
      return { success: true };
    } catch (error) {
      await errorHandler.handleError(error, 'updatePinCode');
      return { success: false, error: 'Failed to update PIN code' };
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

      if (error) throw error;

      const result = data as unknown as PinCodeResponse;
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, verified: result.verified };
    } catch (error) {
      await errorHandler.handleError(error, 'verifyPinCode', false); // No toast for verification
      return { success: false, error: 'Failed to verify PIN code' };
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