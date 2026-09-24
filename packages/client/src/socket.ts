import { io, Socket } from 'socket.io-client';
import type Phaser from 'phaser';
import {
  SOCKET_EVENTS,
  type RoundState,
  type ArenaLiveEvent,
  type GameSnapshot,
  type CombatEvent,
} from '@arena/shared';

let socket: Socket | null = null;

export function connectSocket(game: Phaser.Game): Socket {
  const params = new URLSearchParams(location.search);
  const url = params.get('ws') || undefined;
  socket = io(url, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('[WS] connected', socket?.id);
    socket?.emit(SOCKET_EVENTS.CLIENT_READY);
  });

  socket.on(SOCKET_EVENTS.ROUND_STATE, (state: RoundState) => {
    game.events.emit(SOCKET_EVENTS.ROUND_STATE, state);
    if (state.phase === 'running') {
      if (game.scene.isActive('WaitingScene')) {
        game.scene.stop('WaitingScene');
        game.scene.start('ArenaScene', { round: state });
      } else if (!game.scene.isActive('ArenaScene')) {
        game.scene.start('ArenaScene', { round: state });
      }
    } else if (state.phase === 'waiting' || state.phase === 'ended') {
      if (!game.scene.isActive('WaitingScene')) {
        game.scene.stop('ArenaScene');
        game.scene.start('WaitingScene', { round: state });
      }
    }
  });

  socket.on(SOCKET_EVENTS.LIVE_EVENT, (event: ArenaLiveEvent) => {
    game.events.emit(SOCKET_EVENTS.LIVE_EVENT, event);
  });

  socket.on(SOCKET_EVENTS.GAME_SNAPSHOT, (snap: GameSnapshot) => {
    game.events.emit(SOCKET_EVENTS.GAME_SNAPSHOT, snap);
  });

  socket.on(SOCKET_EVENTS.COMBAT_EVENT, (event: CombatEvent) => {
    game.events.emit(SOCKET_EVENTS.COMBAT_EVENT, event);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}
