import React from 'react';
import { Layout } from '@/components/Layout';
import { SecuritySettings } from '@/components/SecuritySettings';
import { SecurityAuditLog } from '@/components/SecurityAuditLog';

export function Security() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl fonts-bold tracking-tight text-foreground">Security</h1>
          <p className="text-muted-foreground">
            Monitor and manage your application's security settings and audit logs.
          </p>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <SecuritySettings />
          <SecurityAuditLog />
        </div>
      </div>
    </Layout>
  );
}