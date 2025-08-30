import { useAuth } from './useAuth';

export function usePermissions() {
  const { userProfile } = useAuth();

  const isOwner = userProfile?.role === 'Owner';
  const isManager = userProfile?.role === 'Manager';
  const isAdmin = isOwner; // Only owners have admin access

  const canManageUsers = isOwner;
  const canEditClinicSettings = isOwner;
  const canDeleteClinic = isOwner;
  const canViewSettings = isOwner; // Only owners can access settings
  
  // All authenticated users can access these features
  const canViewSources = !!userProfile;
  const canEditSources = !!userProfile;
  const canViewAnalytics = !!userProfile;
  const canViewMarketingVisits = !!userProfile;
  const canEditMarketingVisits = !!userProfile;

  return {
    userProfile,
    isOwner,
    isManager,
    isAdmin,
    canManageUsers,
    canEditClinicSettings,
    canDeleteClinic,
    canViewSettings,
    canViewSources,
    canEditSources,
    canViewAnalytics,
    canViewMarketingVisits,
    canEditMarketingVisits,
  };
}