/**
 * Background synchronization service for keeping cache fresh
 */

import { supabase } from '@/integrations/supabase/client';
import { platformCache, userCache, analyticsCache, CACHE_KEYS, CACHE_TAGS } from './cacheManager';

interface SyncJob {
  id: string;
  userId: string;
  type: 'incremental' | 'full';
  priority: 'high' | 'medium' | 'low';
  lastRun?: number;
  interval: number;
  data?: any;
}

class BackgroundSyncService {
  private jobs = new Map<string, SyncJob>();
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryAttempts = new Map<string, number>();

  constructor() {
    this.setupVisibilityListener();
    this.setupOnlineListener();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, 30000); // Process every 30 seconds

    console.log('Background sync service started');
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Background sync service stopped');
  }

  scheduleSync(job: SyncJob): void {
    this.jobs.set(job.id, {
      ...job,
      lastRun: Date.now()
    });
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // App became visible - do a quick sync
        this.doQuickSync();
      } else {
        // App went to background - reduce sync frequency
        this.reduceActivity();
      }
    });
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      // Network came back - sync immediately
      this.doEmergencySync();
    });

    window.addEventListener('offline', () => {
      // Network lost - cache what we can
      this.prepareForOffline();
    });
  }

  private async processSyncQueue(): Promise<void> {
    if (!navigator.onLine) return;

    const now = Date.now();
    const jobsToRun: SyncJob[] = [];

    // Find jobs that need to run
    for (const job of this.jobs.values()) {
      const timeSinceLastRun = now - (job.lastRun || 0);
      if (timeSinceLastRun >= job.interval) {
        jobsToRun.push(job);
      }
    }

    // Sort by priority
    jobsToRun.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Process jobs
    for (const job of jobsToRun) {
      try {
        await this.executeSync(job);
        job.lastRun = now;
        this.retryAttempts.delete(job.id);
      } catch (error) {
        console.error(`Sync job ${job.id} failed:`, error);
        this.handleSyncError(job, error);
      }
    }
  }

  private async executeSync(job: SyncJob): Promise<void> {
    switch (job.id) {
      case 'user_profile':
        await this.syncUserProfile(job.userId);
        break;
      case 'sources_incremental':
        await this.syncSourcesIncremental(job.userId);
        break;
      case 'analytics_data':
        await this.syncAnalyticsData(job.userId);
        break;
      case 'ai_usage':
        await this.syncAIUsage(job.userId);
        break;
      case 'campaigns':
        await this.syncCampaigns(job.userId);
        break;
      default:
        console.warn(`Unknown sync job: ${job.id}`);
    }
  }

  private async syncUserProfile(userId: string): Promise<void> {
    const [userProfileResult, clinicResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('clinics').select('*').eq('owner_id', userId).maybeSingle()
    ]);

    if (userProfileResult.data) {
      await userCache.set(CACHE_KEYS.USER_PROFILE(userId), {
        userProfile: userProfileResult.data,
        clinic: clinicResult.data
      }, {
        ttl: 15 * 60 * 1000, // 15 minutes
        tags: [CACHE_TAGS.USER_DATA]
      });
    }
  }

  private async syncSourcesIncremental(userId: string): Promise<void> {
    // Get last sync timestamp from cache or use 1 hour ago
    const lastSync = await this.getLastSyncTime('sources', userId) || (Date.now() - 60 * 60 * 1000);

    const sourcesResult = await supabase
      .from('patient_sources')
      .select('*')
      .eq('created_by', userId)
      .gte('updated_at', new Date(lastSync).toISOString());

    if (sourcesResult.data && sourcesResult.data.length > 0) {
      // Merge with existing cached data
      const existingData = (await platformCache.get(CACHE_KEYS.USER_SOURCES(userId))) || [];
      const mergedData = this.mergeSourcesData(existingData as any[], sourcesResult.data);

      await platformCache.set(CACHE_KEYS.USER_SOURCES(userId), mergedData, {
        ttl: 5 * 60 * 1000, // 5 minutes
        tags: [CACHE_TAGS.SOURCES, CACHE_TAGS.USER_DATA]
      });

      await this.setLastSyncTime('sources', userId, Date.now());
    }
  }

  private async syncAnalyticsData(userId: string): Promise<void> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [monthlyResult, visitsResult] = await Promise.all([
      supabase.from('monthly_patients')
        .select('*')
        .eq('user_id', userId)
        .gte('year_month', sixMonthsAgo.toISOString().substring(0, 7))
        .limit(50),
      supabase.from('marketing_visits')
        .select('*')
        .eq('user_id', userId)
        .gte('visit_date', sixMonthsAgo.toISOString().split('T')[0])
        .limit(50)
    ]);

    const analyticsData = {
      monthly_data: monthlyResult.data || [],
      visits: visitsResult.data || [],
      lastUpdated: Date.now()
    };

    await analyticsCache.set(CACHE_KEYS.MONTHLY_DATA(userId), analyticsData, {
      ttl: 2 * 60 * 1000, // 2 minutes for analytics
      tags: [CACHE_TAGS.ANALYTICS, CACHE_TAGS.USER_DATA]
    });
  }

  private async syncAIUsage(userId: string): Promise<void> {
    const usageResult = await supabase
      .from('ai_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (usageResult.data) {
      await analyticsCache.set(CACHE_KEYS.AI_USAGE(userId), usageResult.data, {
        ttl: 5 * 60 * 1000, // 5 minutes
        tags: [CACHE_TAGS.AI_CONTENT, CACHE_TAGS.USER_DATA]
      });
    }
  }

  private async syncCampaigns(userId: string): Promise<void> {
    const campaignsResult = await supabase
      .from('campaigns')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (campaignsResult.data) {
      await platformCache.set(CACHE_KEYS.CAMPAIGNS(userId), campaignsResult.data, {
        ttl: 5 * 60 * 1000, // 5 minutes
        tags: [CACHE_TAGS.CAMPAIGNS, CACHE_TAGS.USER_DATA]
      });
    }
  }

  private mergeSourcesData(existing: any[], newData: any[]): any[] {
    const merged = [...(Array.isArray(existing) ? existing : [])];
    
    for (const newItem of newData) {
      const existingIndex = merged.findIndex(item => item.id === newItem.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = newItem; // Update existing
      } else {
        merged.push(newItem); // Add new
      }
    }
    
    return merged;
  }

  private async getLastSyncTime(type: string, userId: string): Promise<number | null> {
    const key = `last_sync_${type}_${userId}`;
    return await platformCache.get(key);
  }

  private async setLastSyncTime(type: string, userId: string, timestamp: number): Promise<void> {
    const key = `last_sync_${type}_${userId}`;
    await platformCache.set(key, timestamp, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
  }

  private handleSyncError(job: SyncJob, error: any): void {
    const attempts = this.retryAttempts.get(job.id) || 0;
    this.retryAttempts.set(job.id, attempts + 1);

    if (attempts < 3) {
      // Exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      setTimeout(() => {
        this.executeSync(job).catch(console.error);
      }, delay);
    } else {
      console.error(`Max retry attempts reached for job ${job.id}:`, error);
      this.retryAttempts.delete(job.id);
    }
  }

  private async doQuickSync(): Promise<void> {
    // High priority sync when app becomes visible
    const highPriorityJobs = Array.from(this.jobs.values())
      .filter(job => job.priority === 'high');

    for (const job of highPriorityJobs) {
      try {
        await this.executeSync(job);
        job.lastRun = Date.now();
      } catch (error) {
        console.error(`Quick sync failed for ${job.id}:`, error);
      }
    }
  }

  private async doEmergencySync(): Promise<void> {
    // Sync critical data when network comes back
    console.log('Network restored - performing emergency sync');
    await this.doQuickSync();
  }

  private async prepareForOffline(): Promise<void> {
    // Cache additional data before going offline
    console.log('Preparing for offline mode');
  }

  private reduceActivity(): void {
    // Reduce background activity when app is not visible
    console.log('Reducing background sync activity');
  }

  setupUserSync(userId: string): void {
    // Set up sync jobs for a user
    const jobs: SyncJob[] = [
      {
        id: 'user_profile',
        userId,
        type: 'incremental',
        priority: 'medium',
        interval: 15 * 60 * 1000 // 15 minutes
      },
      {
        id: 'sources_incremental',
        userId,
        type: 'incremental',
        priority: 'high',
        interval: 5 * 60 * 1000 // 5 minutes
      },
      {
        id: 'analytics_data',
        userId,
        type: 'incremental',
        priority: 'medium',
        interval: 2 * 60 * 1000 // 2 minutes
      },
      {
        id: 'ai_usage',
        userId,
        type: 'incremental',
        priority: 'low',
        interval: 10 * 60 * 1000 // 10 minutes
      },
      {
        id: 'campaigns',
        userId,
        type: 'incremental',
        priority: 'medium',
        interval: 5 * 60 * 1000 // 5 minutes
      }
    ];

    jobs.forEach(job => this.scheduleSync(job));
  }

  clearUserSync(userId: string): void {
    // Remove sync jobs for a user
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.userId === userId) {
        this.jobs.delete(jobId);
      }
    }
  }
}

export const backgroundSync = new BackgroundSyncService();