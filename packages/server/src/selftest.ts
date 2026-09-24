process.env.AUTO_BOT_ENABLED = 'false';
process.env.CHATGPT_BOSS_ENABLED = 'false';

import { GameLoop } from './game/GameLoop';
import { parseTikTokChatPayload } from './tiktok/TikTokLiveConnectorAdapter';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('[SELFTEST] ' + message);
}

const oldShape = parseTikTokChatPayload(
  {
    user: {
      userId: 'viewer-1',
      uniqueId: 'viewer_one',
      nickname: 'Viewer One',
      profilePictureUrl: 'https://example.com/viewer-one.jpg',
    },
    comment: 'bora',
  },
  'host_account'
);

assert(oldShape.user.userId === 'viewer-1', 'old chat shape lost userId');
assert(oldShape.user.username === 'viewer_one', 'old chat shape lost username');
assert(oldShape.comment === 'bora', 'old chat shape lost comment');

const mixedShape = parseTikTokChatPayload(
  {
    userId: 'viewer-2',
    uniqueId: 'viewer_two',
    nickname: 'Viewer Two',
    profilePictureUrl: 'https://example.com/viewer-two.jpg',
    commentText: 'entrei',
    user: {
      userId: 'host-id',
      uniqueId: 'host_account',
      nickname: 'BALL ARENA',
    },
  },
  'host_account'
);

assert(mixedShape.user.userId === 'viewer-2', 'mixed chat shape selected host instead of commenter');
assert(mixedShape.user.username === 'viewer_two', 'mixed chat shape lost commenter username');
assert(mixedShape.comment === 'entrei', 'mixed chat shape lost comment text');

const game = new GameLoop('demo', 300);
try {
  game.resetToWaiting();

  game.handleLiveEvent({
    type: 'comment',
    user: {
      userId: oldShape.user.userId,
      username: oldShape.user.username,
      nickname: oldShape.user.nickname,
      avatarUrl: oldShape.user.avatarUrl,
    },
    comment: oldShape.comment,
    timestamp: Date.now(),
  });

  game.handleLiveEvent({
    type: 'comment',
    user: {
      userId: mixedShape.user.userId,
      username: mixedShape.user.username,
      nickname: mixedShape.user.nickname,
      avatarUrl: mixedShape.user.avatarUrl,
    },
    comment: mixedShape.comment,
    timestamp: Date.now(),
  });

  const snap = game.getSnapshot();
  const one = snap.balls.find((b) => b.userId === 'viewer-1');
  const two = snap.balls.find((b) => b.userId === 'viewer-2');

  assert(snap.phase === 'running', 'first comment did not start/enter round');
  assert(one, 'first comment did not create a character');
  assert(two, 'second comment did not create a distinct character');
  assert(one.avatarUrl === 'https://example.com/viewer-one.jpg', 'first avatar was not preserved');
  assert(two.avatarUrl === 'https://example.com/viewer-two.jpg', 'second avatar was not preserved');

  game.handleLikes(
    { userId: 'viewer-1', username: 'viewer_one', nickname: 'Viewer One' },
    100
  );
  const afterLikes = game.getSnapshot().balls.find((b) => b.userId === 'viewer-1');
  assert(afterLikes, 'player disappeared during like test');
  assert((afterLikes.hitPower ?? 0) >= 1, '100 personal likes did not add strength');

  console.log(
    '[SELFTEST] PASS comment parser -> GameLoop -> snapshot: 2 distinct players, avatars preserved, likes applied'
  );
} finally {
  game.destroy();
}
