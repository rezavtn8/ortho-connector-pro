import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, MapPin, Users, Rocket, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClinicAddressSearch } from '@/components/ClinicAddressSearch';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Welcome', icon: Rocket },
  { id: 2, title: 'Clinic Setup', icon: Building2 },
  { id: 3, title: 'Location', icon: MapPin },
  { id: 4, title: 'Get Started', icon: Users },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    clinicName: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (form.clinicName) {
        await supabase.rpc('create_clinic_for_user', {
          p_name: form.clinicName,
          p_address: form.address || null,
          p_latitude: form.latitude,
          p_longitude: form.longitude,
        });
      }

      await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true, onboarding_step: STEPS.length })
        .eq('user_id', user.id);

      toast.success('Setup complete!');
      onComplete();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to complete setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('user_id', user.id);
      }
      onComplete();
    } catch (error) {
      onComplete();
    }
  };

  const handleAddressSelect = (place: { address: string; latitude: number; longitude: number }) => {
    setForm({ ...form, address: place.address, latitude: place.latitude, longitude: place.longitude });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {currentStep > step.id ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              {index < STEPS.length - 1 && <div className={`w-12 h-1 mx-2 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="min-h-[300px]">
            {currentStep === 1 && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">Welcome to Nexora!</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">Let's get your practice set up in just a few quick steps.</p>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Tell us about your clinic</h2>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="space-y-2">
                    <Label>Clinic Name *</Label>
                    <Input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} placeholder="e.g., Downtown Dental Care" autoFocus />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Where are you located?</h2>
                </div>
                <div className="space-y-4 max-w-md mx-auto">
                  <Label>Clinic Address</Label>
                  <ClinicAddressSearch value={form.address} onSelect={handleAddressSelect} placeholder="Start typing your address..." />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">You're all set!</h2>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  <button onClick={() => { onComplete(); navigate('/discover'); }} className="p-4 border rounded-lg hover:border-primary transition-all">
                    <MapPin className="h-6 w-6 text-primary mb-2 mx-auto" />
                    <p className="font-medium text-sm">Discover</p>
                  </button>
                  <button onClick={() => { onComplete(); navigate('/offices'); }} className="p-4 border rounded-lg hover:border-primary transition-all">
                    <Building2 className="h-6 w-6 text-primary mb-2 mx-auto" />
                    <p className="font-medium text-sm">Add Partners</p>
                  </button>
                  <button onClick={() => { onComplete(); navigate('/sources'); }} className="p-4 border rounded-lg hover:border-primary transition-all">
                    <Users className="h-6 w-6 text-primary mb-2 mx-auto" />
                    <p className="font-medium text-sm">Import</p>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting}>Skip</Button>
          <div className="flex gap-2">
            {currentStep > 1 && <Button variant="outline" onClick={handleBack}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={currentStep === 2 && !form.clinicName}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleComplete} disabled={isSubmitting}>{isSubmitting ? 'Completing...' : 'Complete Setup'}</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
