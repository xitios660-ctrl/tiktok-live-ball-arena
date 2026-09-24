import type { TikTokMode } from '@arena/shared';
import type { ITikTokConnector } from './ITikTokConnector';
import { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { TikTokLiveConnectorAdapter } from './TikTokLiveConnectorAdapter';

export function createConnector(mode: TikTokMode): ITikTokConnector {
  if (mode === 'production') {
    console.warn(
      '[TikTok] PRODUCTION mode selected — adapter is a stub until wired. Prefer DEMO for local work.'
    );
    return new TikTokLiveConnectorAdapter();
  }
  return new DemoEventSimulator();
}
