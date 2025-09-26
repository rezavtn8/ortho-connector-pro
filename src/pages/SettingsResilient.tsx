import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useProfileDataResilient } from '@/hooks/useResilientQuery';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { 
  MapPin,
  User,
  Bell,
  Shield,
  Loader2,
  Edit,
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  WifiOff
} from 'lucide-react';

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  google_place_id: string;
}

interface NotificationSettings {
  email_notifications: boolean;
  weekly_reports: boolean;
  monthly_reports: boolean;
  referral_alerts: boolean;
}

const initialClinicSettings: ClinicSettings = {
  clinic_name: '',
  clinic_address: '',
  google_place_id: ''
};

const initialNotificationSettings: NotificationSettings = {
  email_notifications: true,
  weekly_reports: true,
  monthly_reports: true,
  referral_alerts: true
};

function SettingsContent() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, retry: retryProfile, isOffline } = useProfileDataResilient();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(initialClinicSettings);
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotificationSettings);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingClinic, setEditingClinic] = useState(false);
  const [localProfile, setLocalProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [clinicLoading, setClinicLoading] = useState(false);

  // Load clinic settings when profile loads
  useEffect(() => {
    if (profile?.clinic_id) {
      loadClinicSettings(profile.clinic_id);
    }
    setLocalProfile(profile);
  }, [profile]);

  // Load notification settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notification_settings');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }
  }, []);

  const loadClinicSettings = async (clinicId: string) => {
    setClinicLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('name, address, google_place_id')
        .eq('id', clinicId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setClinicSettings({
          clinic_name: data.name || '',
          clinic_address: data.address || '',
          google_place_id: data.google_place_id || ''
        });
      }
    } catch (error: any) {
      console.error('Error loading clinic settings:', error);
      toast({
        title: 'Warning',
        description: 'Could not load clinic settings. You can still update your profile.',
        variant: 'destructive',
      });
    } finally {
      setClinicLoading(false);
    }
  };

  const saveProfileSettings = async () => {
    if (!user?.id || !localProfile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: localProfile.first_name,
          last_name: localProfile.last_name,
          phone: localProfile.phone,
          job_title: localProfile.job_title,
          degrees: localProfile.degrees,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingProfile(false);
      toast({
        title: 'Success',
        description: 'Profile settings saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save profile settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    setEditingProfile(false);
    setLocalProfile(profile);
  };

  const saveClinicSettings = async () => {
    if (!user?.id) return;
    
    if (!clinicSettings.clinic_name.trim()) {
      toast({
        title: "Error",
        description: "Clinic name is required",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    try {
      let clinicId = profile?.clinic_id;

      if (clinicId) {
        // Update existing clinic
        const { error: clinicError } = await supabase
          .from('clinics')
          .update({
            name: clinicSettings.clinic_name,
            address: clinicSettings.clinic_address,
            google_place_id: clinicSettings.google_place_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', clinicId);

        if (clinicError) throw clinicError;
      } else {
        // Create new clinic
        const { data: newClinic, error: createError } = await supabase
          .from('clinics')
          .insert({
            name: clinicSettings.clinic_name,
            address: clinicSettings.clinic_address,
            google_place_id: clinicSettings.google_place_id || null,
            owner_id: user.id
          })
          .select()
          .single();

        if (createError) throw createError;
        clinicId = newClinic.id;
      }

      // Update user profile with clinic info
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          clinic_id: clinicId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setEditingClinic(false);
      toast({
        title: 'Success',
        description: 'Clinic settings saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving clinic settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save clinic settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelClinicEdit = () => {
    setEditingClinic(false);
    if (profile?.clinic_id) {
      loadClinicSettings(profile.clinic_id);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      localStorage.setItem('notification_settings', JSON.stringify(notifications));
      toast({
        title: 'Success',
        description: 'Notification preferences saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save notification settings',
        variant: 'destructive',
      });
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Settings</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading your settings...
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Settings</h1>
          </div>
        </div>
        
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? <WifiOff className="w-6 h-6 text-destructive" /> : <AlertCircle className="w-6 h-6 text-destructive" />}
            </div>
            <CardTitle>
              {isOffline ? 'You\'re Offline' : 'Failed to Load Settings'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isOffline 
                ? 'Settings are not available while offline. Please reconnect to access your settings.'
                : 'Unable to load your settings. Please check your connection and try again.'
              }
            </p>
            <Button onClick={retryProfile} disabled={isOffline} className="gap-2">
              <Loader2 className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Settings</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your account and clinic preferences
        </p>
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">You're currently offline</p>
              <p className="text-sm text-orange-700">Some settings may not be available until you reconnect.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <TabsList className="flex flex-col h-auto w-full p-2 bg-card border">
              <div className="w-full mb-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">
                  Personal
                </div>
                <TabsTrigger value="profile" className="w-full justify-start px-3 py-3 text-left">
                  <User className="w-4 h-4 mr-3" />
                  Profile Settings
                </TabsTrigger>
                <TabsTrigger value="notifications" className="w-full justify-start px-3 py-3 text-left">
                  <Bell className="w-4 h-4 mr-3" />
                  Notifications
                </TabsTrigger>
              </div>

              <div className="w-full mb-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider border-t pt-4">
                  Organization
                </div>
                <TabsTrigger value="clinic" className="w-full justify-start px-3 py-3 text-left">
                  <MapPin className="w-4 h-4 mr-3" />
                  Clinic Information
                </TabsTrigger>
              </div>

              <div className="w-full">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider border-t pt-4">
                  System
                </div>
                <TabsTrigger value="security" className="w-full justify-start px-3 py-3 text-left">
                  <Shield className="w-4 h-4 mr-3" />
                  Security & Privacy
                </TabsTrigger>
              </div>
            </TabsList>
          </div>

          <div className="flex-1">
            <div className="bg-card border rounded-lg p-6">
              {/* Profile Settings */}
              <TabsContent value="profile" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        User Profile
                      </div>
                      {!editingProfile ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEditingProfile(true)}
                          disabled={isOffline}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelProfileEdit}>
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={saveProfileSettings}
                            disabled={saving || isOffline}
                          >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!editingProfile ? (
                      /* Display Mode */
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                            <p className="text-base font-medium">{localProfile?.first_name || 'Not set'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                            <p className="text-base font-medium">{localProfile?.last_name || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                            <p className="text-base font-medium">{localProfile?.phone || 'Not set'}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Job Title</Label>
                            <p className="text-base font-medium">{localProfile?.job_title || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Degrees</Label>
                            <p className="text-base font-medium">{localProfile?.degrees || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                            <p className="text-base font-medium">{user?.email}</p>
                            <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Edit Mode */
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name *</Label>
                            <Input
                              id="first_name"
                              value={localProfile?.first_name || ''}
                              onChange={(e) => setLocalProfile(prev => ({ ...prev, first_name: e.target.value }))}
                              placeholder="Enter your first name..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name *</Label>
                            <Input
                              id="last_name"
                              value={localProfile?.last_name || ''}
                              onChange={(e) => setLocalProfile(prev => ({ ...prev, last_name: e.target.value }))}
                              placeholder="Enter your last name..."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                              id="phone"
                              value={localProfile?.phone || ''}
                              onChange={(e) => setLocalProfile(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="Enter your phone number..."
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="job_title">Job Title</Label>
                            <Input
                              id="job_title"
                              value={localProfile?.job_title || ''}
                              onChange={(e) => setLocalProfile(prev => ({ ...prev, job_title: e.target.value }))}
                              placeholder="Enter your job title..."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="degrees">Degrees</Label>
                            <Input
                              id="degrees"
                              value={localProfile?.degrees || ''}
                              onChange={(e) => setLocalProfile(prev => ({ ...prev, degrees: e.target.value }))}
                              placeholder="Enter your degrees..."
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                            <p className="text-base font-medium text-muted-foreground">{user?.email}</p>
                            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clinic Information */}
              <TabsContent value="clinic" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Clinic Information
                      </div>
                      {!editingClinic ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEditingClinic(true)}
                          disabled={isOffline}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelClinicEdit}>
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={saveClinicSettings}
                            disabled={saving || isOffline}
                          >
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {clinicLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : !editingClinic ? (
                      /* Display Mode */
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-muted-foreground">Clinic Name</Label>
                          <p className="text-base font-medium">{clinicSettings.clinic_name || 'Not set'}</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                          <p className="text-base font-medium">{clinicSettings.clinic_address || 'Not set'}</p>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm font-medium text-muted-foreground">Google Place ID</Label>
                          <p className="text-base font-medium">{clinicSettings.google_place_id || 'Not set'}</p>
                        </div>
                      </div>
                    ) : (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="clinic_name">Clinic Name *</Label>
                          <Input
                            id="clinic_name"
                            value={clinicSettings.clinic_name}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_name: e.target.value }))}
                            placeholder="Enter clinic name..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="clinic_address">Address</Label>
                          <Input
                            id="clinic_address"
                            value={clinicSettings.clinic_address}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_address: e.target.value }))}
                            placeholder="Enter clinic address..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="google_place_id">Google Place ID</Label>
                          <Input
                            id="google_place_id"
                            value={clinicSettings.google_place_id}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, google_place_id: e.target.value }))}
                            placeholder="Enter Google Place ID..."
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="email_notifications">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive email notifications for important updates</p>
                        </div>
                        <input
                          id="email_notifications"
                          type="checkbox"
                          checked={notifications.email_notifications}
                          onChange={(e) => setNotifications(prev => ({ ...prev, email_notifications: e.target.checked }))}
                          className="rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="weekly_reports">Weekly Reports</Label>
                          <p className="text-sm text-muted-foreground">Receive weekly summary reports</p>
                        </div>
                        <input
                          id="weekly_reports"
                          type="checkbox"
                          checked={notifications.weekly_reports}
                          onChange={(e) => setNotifications(prev => ({ ...prev, weekly_reports: e.target.checked }))}
                          className="rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="monthly_reports">Monthly Reports</Label>
                          <p className="text-sm text-muted-foreground">Receive monthly analytics reports</p>
                        </div>
                        <input
                          id="monthly_reports"
                          type="checkbox"
                          checked={notifications.monthly_reports}
                          onChange={(e) => setNotifications(prev => ({ ...prev, monthly_reports: e.target.checked }))}
                          className="rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="referral_alerts">Referral Alerts</Label>
                          <p className="text-sm text-muted-foreground">Get notified of new referrals</p>
                        </div>
                        <input
                          id="referral_alerts"
                          type="checkbox"
                          checked={notifications.referral_alerts}
                          onChange={(e) => setNotifications(prev => ({ ...prev, referral_alerts: e.target.checked }))}
                          className="rounded"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button onClick={saveNotificationSettings} className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Save Preferences
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Security & Privacy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Security settings will be available in a future update.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

export function Settings() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <SettingsContent />
    </ResilientErrorBoundary>
  );
}
