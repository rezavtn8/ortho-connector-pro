import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  children: React.ReactNode;
  permission: 'canManageUsers' | 'canEditClinicSettings' | 'canDeleteClinic' | 'canViewSettings' | 'isOwner' | 'isManager';
  fallback?: React.ReactNode;
}

export function PermissionGate({ children, permission, fallback = null }: PermissionGateProps) {
  const permissions = usePermissions();
  
  const hasPermission = permissions[permission];
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}