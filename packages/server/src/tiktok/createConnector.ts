import type { TikTokMode } from '@arena/shared';
import type { ITikTokConnector } from './ITikTokConnector';
import { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { TikTokLiveConnectorAdapter } from './TikTokLiveConnectorAdapter';

export function createConnector(mode: TikTokMode): ITikTokConnector {
  if (mode === 'production') {
    console.log('[TIKTOK] PRODUCTION mode — using tiktok-live-connector (unofficial Webcast WS)');
    return new TikTokLiveConnectorAdapter();
  }
  console.log('[DEMO] Using DemoEventSimulator — events are SIMULATED, not TikTok');
  return new DemoEventSimulator();
}
