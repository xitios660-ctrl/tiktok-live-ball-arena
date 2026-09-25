import type { TikTokMode } from '@arena/shared';
import type { ITikTokConnector } from './ITikTokConnector';
import { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { PirateTokConnectorAdapter } from './PirateTokConnectorAdapter';

export function createConnector(mode: TikTokMode): ITikTokConnector {
  if (mode === 'production') {
    console.log('[TIKTOK] PRODUCTION mode — using PirateTok direct realtime WebSocket');
    return new PirateTokConnectorAdapter();
  }
  console.log('[DEMO] Using DemoEventSimulator — events are SIMULATED, not TikTok');
  return new DemoEventSimulator();
}
