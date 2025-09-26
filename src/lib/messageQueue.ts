// Message queue to prevent simultaneous requests and handle retries
export interface QueuedMessage {
  id: string;
  content: string;
  userId: string;
  retryCount: number;
  maxRetries: number;
  onSuccess: (response: string) => void;
  onError: (error: string) => void;
  onProgress?: (progress: string) => void;
}

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private currentRequest: AbortController | null = null;

  async addMessage(message: Omit<QueuedMessage, 'retryCount'>): Promise<void> {
    const queuedMessage: QueuedMessage = {
      ...message,
      retryCount: 0
    };

    this.queue.push(queuedMessage);
    
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const message = this.queue[0];
      
      try {
        await this.processMessage(message);
        this.queue.shift(); // Remove processed message
      } catch (error) {
        console.error('Error processing message:', error);
        
        // Handle retry logic
        if (message.retryCount < message.maxRetries) {
          message.retryCount++;
          console.log(`Retrying message ${message.id}, attempt ${message.retryCount}`);
          
          // Add delay before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, message.retryCount - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          continue; // Retry the same message
        } else {
          // Max retries reached, remove from queue and call error handler
          this.queue.shift();
          message.onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    this.processing = false;
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    // Cancel any existing request
    if (this.currentRequest) {
      this.currentRequest.abort();
    }

    this.currentRequest = new AbortController();

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Get essential data for context
      const cachedData = await this.getEssentialData(message.userId);

      const { data: aiResponse, error } = await supabase.functions.invoke('unified-ai-service', {
        body: {
          task_type: 'chat',
          prompt: message.content,
          context: {
            practice_data: cachedData,
            conversation_history: [] // Will be handled by the service
          },
          parameters: {
            stream: false // We'll implement SSE later
          }
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'AI service error');
      }

      if (!aiResponse?.success) {
        throw new Error(aiResponse?.error || 'AI service failed');
      }

      message.onSuccess(aiResponse.data || 'I apologize, but I couldn\'t generate a response. Please try again.');
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    } finally {
      this.currentRequest = null;
    }
  }

  private async getEssentialData(userId: string): Promise<any> {
    try {
      const { chatStorage } = await import('./chatStorage');
      
      // Try to get from cache first
      const cacheKey = `essential_data_${userId}`;
      let cachedData = await chatStorage.getCache(cacheKey);
      
      if (cachedData) {
        console.log('Using cached essential data');
        return cachedData;
      }

      console.log('Fetching fresh essential data');
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Get essential data from last 3 months only
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().substring(0, 7); // YYYY-MM format

      // Use Promise.allSettled to handle partial failures
      const [
        sourcesResult,
        monthlyDataResult,
        visitsResult,
        campaignsResult
      ] = await Promise.allSettled([
        supabase
          .from('patient_sources')
          .select('id, name, source_type, is_active, google_rating, notes')
          .eq('is_active', true)
          .limit(20),
        
        supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .gte('year_month', threeMonthsAgoStr)
          .order('year_month', { ascending: false })
          .limit(50),
        
        supabase
          .from('marketing_visits')
          .select('id, office_id, visit_date, visited, star_rating, rep_name')
          .gte('visit_date', threeMonthsAgo.toISOString().split('T')[0])
          .order('visit_date', { ascending: false })
          .limit(10),
        
        supabase
          .from('campaigns')
          .select('id, name, status, campaign_type, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      // Extract successful results, use empty arrays for failed ones
      const essentialData = {
        sources: sourcesResult.status === 'fulfilled' ? (sourcesResult.value.data || []) : [],
        monthly_data: monthlyDataResult.status === 'fulfilled' ? (monthlyDataResult.value.data || []) : [],
        visits: visitsResult.status === 'fulfilled' ? (visitsResult.value.data || []) : [],
        campaigns: campaignsResult.status === 'fulfilled' ? (campaignsResult.value.data || []) : [],
        generated_at: new Date().toISOString()
      };

      // Cache for 5 minutes
      await chatStorage.setCache(cacheKey, essentialData, 5);
      
      return essentialData;
      
    } catch (error) {
      console.error('Error fetching essential data:', error);
      // Return minimal data structure to prevent complete failure
      return {
        sources: [],
        monthly_data: [],
        visits: [],
        campaigns: [],
        generated_at: new Date().toISOString(),
        error: 'Limited data available'
      };
    }
  }

  cancelCurrentRequest(): void {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
  }

  clearQueue(): void {
    this.queue = [];
    this.cancelCurrentRequest();
    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

export const messageQueue = new MessageQueue();