import type { TikTokMode } from '@arena/shared';
import type { ITikTokConnector } from './ITikTokConnector';
import { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { HybridTikTokConnector } from './HybridTikTokConnector';

export function createConnector(mode: TikTokMode): ITikTokConnector {
  if (mode === 'production') {
    console.log('[TIKTOK] PRODUCTION mode — using hybrid realtime + chat/gift backup');
    return new HybridTikTokConnector();
  }
  console.log('[DEMO] Using DemoEventSimulator — events are SIMULATED, not TikTok');
  return new DemoEventSimulator();
}
