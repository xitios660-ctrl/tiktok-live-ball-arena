process.env.AUTO_BOT_ENABLED = 'false';
process.env.CHATGPT_BOSS_ENABLED = 'false';

import { LIKE_COMBO_RESET_MS, type ArenaLiveEvent, type ArenaUser } from '@arena/shared';
import { EventDedupe } from './tiktok/eventDedupe';
import { GameLoop } from './game/GameLoop';
import {
  parseTikTokChatPayload,
  TikTokLiveConnectorAdapter,
} from './tiktok/TikTokLiveConnectorAdapter';
import { mapTikTokGiftToArenaId } from './tiktok/mapTikTokGift';
import { HybridTikTokConnector } from './tiktok/HybridTikTokConnector';
import { applyPickupAbility } from './game/GiftAbilities';
import { AutoBotSpawner } from './game/AutoBotSpawner';
import {
  mapPirateChatEvent,
  mapPirateLikeEvent,
  mapPirateGiftEvent,
} from './tiktok/PirateTokConnectorAdapter';
import type { PhysicsWorld } from './game/PhysicsWorld';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('[SELFTEST] ' + message);
}

function getBall(game: GameLoop, userId: string) {
  const ball = game.getSnapshot().balls.find((b) => b.userId === userId);
  assert(ball, 'missing ball for ' + userId);
  return ball;
}

function commentEvent(user: ArenaUser, comment = 'bora'): ArenaLiveEvent {
  return { type: 'comment', user, comment, timestamp: Date.now() };
}

function giftEvent(
  user: ArenaUser,
  giftId: string,
  giftName: string,
  repeatCount = 1,
  coinValue = 1
): ArenaLiveEvent {
  return {
    type: 'gift',
    user,
    giftId,
    giftName,
    repeatCount,
    repeatEnd: true,
    coinValue,
    timestamp: Date.now(),
  };
}

// Repeated text with distinct TikTok message IDs must respawn immediately.
{
  const game = new GameLoop('production');
  const hybrid = new HybridTikTokConnector();
  const route = hybrid as unknown as {handlePrimaryEvent: (e: ArenaLiveEvent) => void};
  hybrid.on('event', event => game.handleLiveEvent(event));
  try {
    const raw = {common:{msgId:'comment-a'}, user:{id:'repeat-user',uniqueId:'repeat_user'},content:'jogar'};
    route.handlePrimaryEvent(mapPirateChatEvent(raw)!);
    game.adminKill('repeat-user','admin');
    route.handlePrimaryEvent(mapPirateChatEvent({...raw,common:{msgId:'comment-b'}})!);
    assert(game.getSnapshot().balls.filter(b=>b.userId==='repeat-user').length===1,
      'new message with repeated text did not respawn through the connector');
    assert(game.getStats()[0].deaths===1, 'connector respawn lost deaths');
    route.handlePrimaryEvent(mapPirateChatEvent({...raw,common:{msgId:'comment-b'}})!);
    assert(game.getSnapshot().balls.length===1, 'duplicate message created extra character');
  } finally { game.destroy(); }
}

// Dedupe must expire even when the map has fewer than 200 entries.
{
  const realNow = Date.now;
  let now = 10000;
  Date.now = () => now;
  try {
    const dedupe = new EventDedupe(2000);
    assert(dedupe.check('same comment'), 'first comment rejected');
    assert(!dedupe.check('same comment'), 'duplicate accepted');
    now += 2001;
    assert(dedupe.check('same comment'), 'repeated comment never expired');
  } finally { Date.now = realNow; }
}

/* -------------------------------------------------------------------------- */
/* PirateTok direct realtime payload mapping                                   */
/* -------------------------------------------------------------------------- */

const pirateUser = {
  id: '987654321',
  uniqueId: 'pirate_viewer',
  nickname: 'Pirate Viewer',
  avatarThumb: { urlList: ['https://example.com/pirate.jpg'] },
};

const pirateChat = mapPirateChatEvent({
  common: { msgId: 'chat-1' },
  user: pirateUser,
  content: 'entrei',
});
assert(pirateChat?.type === 'comment', 'PirateTok CHAT did not map');
if (pirateChat?.type === 'comment') {
  assert(pirateChat.user.userId === '987654321', 'PirateTok CHAT userId mismatch');
  assert(pirateChat.user.username === 'pirate_viewer', 'PirateTok CHAT username mismatch');
  assert(pirateChat.comment === 'entrei', 'PirateTok CHAT content mismatch');
  assert(pirateChat.user.avatarUrl?.includes('pirate.jpg'), 'PirateTok CHAT avatar missing');
}

const pirateLike = mapPirateLikeEvent({
  common: { msgId: 'like-1' },
  user: pirateUser,
  count: 17,
  total: 321,
});
assert(pirateLike?.type === 'like', 'PirateTok LIKE did not map');
if (pirateLike?.type === 'like') {
  assert(pirateLike.likeCount === 17, 'PirateTok LIKE count mismatch');
  assert(pirateLike.totalLikeCount === 321, 'PirateTok LIKE total mismatch');
  assert(pirateLike.user.userId === '987654321', 'PirateTok LIKE user mismatch');
}

const pirateGiftProgress = mapPirateGiftEvent({
  common: { msgId: 'gift-progress' },
  user: pirateUser,
  giftId: 5655,
  repeatCount: 2,
  repeatEnd: 0,
  gift: { type: 1, name: 'Rose', diamondCount: 1 },
});
assert(pirateGiftProgress === null, 'PirateTok combo gift progress must not pay early');

const pirateGiftFinal = mapPirateGiftEvent({
  common: { msgId: 'gift-final' },
  user: pirateUser,
  giftId: 5655,
  repeatCount: 3,
  repeatEnd: 1,
  gift: { type: 1, name: 'Rose', diamondCount: 1 },
});
assert(pirateGiftFinal?.type === 'gift', 'PirateTok GIFT final did not map');
if (pirateGiftFinal?.type === 'gift') {
  assert(pirateGiftFinal.giftId === 'rosa', 'PirateTok Rose did not map to rosa');
  assert(pirateGiftFinal.repeatCount === 3, 'PirateTok gift repeat count mismatch');
}

/* -------------------------------------------------------------------------- */
/* Auto bots: exact batch of 3 without touching comment/like paths            */
/* -------------------------------------------------------------------------- */

{
  const oldEnabled = process.env.AUTO_BOT_ENABLED;
  const oldInterval = process.env.AUTO_BOT_INTERVAL_MS;
  const oldBatch = process.env.AUTO_BOT_BATCH_SIZE;
  const oldMax = process.env.AUTO_BOT_MAX_PLAYERS;

  process.env.AUTO_BOT_ENABLED = 'true';
  process.env.AUTO_BOT_INTERVAL_MS = '30000';
  process.env.AUTO_BOT_BATCH_SIZE = '3';
  process.env.AUTO_BOT_MAX_PLAYERS = '40';

  const joined: string[] = [];
  const spawner = new AutoBotSpawner({
    getPlayerCount: () => joined.length,
    canAcceptJoin: () => true,
    injectJoin: (user) => joined.push(user.userId),
  });

  const spawned = spawner.runNowForTest();
  assert(spawned === 3, 'auto bot batch must spawn exactly 3 bots');
  assert(joined.length === 3, 'auto bot batch injected the wrong player count');
  spawner.stop();

  if (oldEnabled == null) delete process.env.AUTO_BOT_ENABLED;
  else process.env.AUTO_BOT_ENABLED = oldEnabled;
  if (oldInterval == null) delete process.env.AUTO_BOT_INTERVAL_MS;
  else process.env.AUTO_BOT_INTERVAL_MS = oldInterval;
  if (oldBatch == null) delete process.env.AUTO_BOT_BATCH_SIZE;
  else process.env.AUTO_BOT_BATCH_SIZE = oldBatch;
  if (oldMax == null) delete process.env.AUTO_BOT_MAX_PLAYERS;
  else process.env.AUTO_BOT_MAX_PLAYERS = oldMax;
}

/* -------------------------------------------------------------------------- */
/* Hybrid TikTok redundancy: backup likes/comments without double counting     */
/* -------------------------------------------------------------------------- */

{
  const hybrid = new HybridTikTokConnector();
  const seen: ArenaLiveEvent[] = [];
  hybrid.on('event', (event) => seen.push(event));

  const internal = hybrid as unknown as {
    handlePrimaryEvent: (event: ArenaLiveEvent) => void;
    handleBackupEvent: (event: ArenaLiveEvent) => void;
  };

  const user: ArenaUser = {
    userId: 'hybrid-viewer',
    username: 'hybrid_viewer',
    nickname: 'Hybrid Viewer',
  };

  const likeA: ArenaLiveEvent = {
    type: 'like',
    user,
    likeCount: 10,
    totalLikeCount: 500,
    timestamp: Date.now(),
  };

  internal.handleBackupEvent(likeA);
  internal.handlePrimaryEvent({ ...likeA, timestamp: Date.now() + 10 });
  assert(
    seen.filter((event) => event.type === 'like').length === 1,
    'hybrid duplicate LIKE was counted twice'
  );

  internal.handleBackupEvent({
    ...likeA,
    likeCount: 5,
    totalLikeCount: 505,
    timestamp: Date.now() + 20,
  });
  assert(
    seen.filter((event) => event.type === 'like').length === 2,
    'hybrid backup did not forward a new LIKE batch'
  );

  const comment: ArenaLiveEvent = {
    type: 'comment',
    user,
    comment: 'teste híbrido',
    timestamp: Date.now(),
  };
  internal.handleBackupEvent(comment);
  internal.handlePrimaryEvent({ ...comment, timestamp: Date.now() + 10 });
  assert(
    seen.filter((event) => event.type === 'comment').length === 1,
    'hybrid duplicate COMMENT was counted twice'
  );

  void hybrid.disconnect();
}

/* -------------------------------------------------------------------------- */
/* TikTok production payload normalization                                     */
/* -------------------------------------------------------------------------- */

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

assert(
  mixedShape.user.userId === 'viewer-2',
  'mixed chat shape selected host instead of commenter'
);
assert(
  mixedShape.user.username === 'viewer_two',
  'mixed chat shape lost commenter username'
);
assert(mixedShape.comment === 'entrei', 'mixed chat shape lost comment text');

// Exercise the exact PRODUCTION adapter handlers without requiring a real room.
const adapter = new TikTokLiveConnectorAdapter();
const normalized: ArenaLiveEvent[] = [];
adapter.on('event', (event) => normalized.push(event));

const privateAdapter = adapter as unknown as {
  handleChat: (raw: unknown) => void;
  handleLike: (raw: unknown) => void;
  handleGift: (raw: unknown) => void;
};

privateAdapter.handleChat({
  data: {
    user: {
      userId: 'prod-commenter',
      uniqueId: 'prod_commenter',
      nickname: 'Prod Commenter',
      profilePictureUrl: 'https://example.com/prod.jpg',
    },
    commentText: 'quero jogar',
  },
});

const normalizedComment = normalized.at(-1);
assert(normalizedComment?.type === 'comment', 'production CHAT did not normalize');
if (normalizedComment?.type === 'comment') {
  assert(
    normalizedComment.user.userId === 'prod-commenter',
    'production CHAT userId mismatch'
  );
}

privateAdapter.handleLike({
  data: {
    user: {
      userId: 'prod-commenter',
      uniqueId: 'prod_commenter',
      nickname: 'Prod Commenter',
    },
    likeCount: 1,
    totalLikeCount: 200,
  },
});
let normalizedLike = normalized.at(-1);
assert(normalizedLike?.type === 'like', 'production LIKE did not normalize');
if (normalizedLike?.type === 'like') {
  assert(normalizedLike.likeCount === 1, 'first LIKE burst should credit raw count');
  assert(
    normalizedLike.user.userId === 'prod-commenter',
    'LIKE and COMMENT resolved to different user ids'
  );
}

privateAdapter.handleLike({
  data: {
    user: {
      userId: 'prod-commenter',
      uniqueId: 'prod_commenter',
      nickname: 'Prod Commenter',
    },
    likeCount: 1,
    totalLikeCount: 212,
  },
});
normalizedLike = normalized.at(-1);
assert(normalizedLike?.type === 'like', 'second production LIKE missing');
if (normalizedLike?.type === 'like') {
  assert(
    normalizedLike.likeCount === 1,
    'same-user rapid LIKE burst did not recover room-total delta'
  );
}

// Cross-user room-total movement must never be stolen by the previous viewer.
privateAdapter.handleLike({
  user: {
    userId: 'other-viewer',
    uniqueId: 'other_viewer',
    nickname: 'Other Viewer',
  },
  likeCount: 1,
  totalLikeCount: 220,
});
normalizedLike = normalized.at(-1);
assert(normalizedLike?.type === 'like', 'cross-user production LIKE missing');
if (normalizedLike?.type === 'like') {
  assert(
    normalizedLike.likeCount === 1,
    'room total delta was incorrectly credited across different users'
  );
}

// Streak gifts: non-final repeat packets are ignored, final packet applies once.
const giftBefore = normalized.length;
privateAdapter.handleGift({
  user: { userId: 'prod-commenter', uniqueId: 'prod_commenter' },
  giftType: 1,
  repeatEnd: false,
  repeatCount: 3,
  giftName: 'Rose',
  diamondCount: 1,
  msgId: 'rose-streak-progress',
});
assert(
  normalized.length === giftBefore,
  'non-final streak gift should not emit an arena gift'
);

privateAdapter.handleGift({
  user: { userId: 'prod-commenter', uniqueId: 'prod_commenter' },
  giftType: 1,
  repeatEnd: true,
  repeatCount: 3,
  giftName: 'Rose',
  diamondCount: 1,
  msgId: 'rose-streak-final',
});
const normalizedGift = normalized.at(-1);
assert(normalizedGift?.type === 'gift', 'final TikTok gift did not normalize');
if (normalizedGift?.type === 'gift') {
  assert(normalizedGift.giftId === 'rosa', 'Rose did not map to arena rosa gift');
  assert(normalizedGift.repeatCount === 3, 'gift repeatCount was lost');
}

/* -------------------------------------------------------------------------- */
/* Real TikTok gift-name mapping                                               */
/* -------------------------------------------------------------------------- */

const giftNameCases: Array<[string, number, string]> = [
  ['Rose', 1, 'rosa'],
  ['Mini Dino', 10, 'mini_dino'],
  ['Doughnut', 30, 'rosquinha'],
  ['Capybara', 100, 'capivara'],
  ['Galaxy', 1000, 'galaxia'],
  ['GG', 15, 'raio'],
  ['Finger Heart', 20, 'ima'],
  ['Ice Cream Cone', 25, 'gelo'],
  ['Rocket', 15, 'foguete'],
  ['Hand Hearts', 35, 'espelho'],
];

for (const [giftName, coinValue, expectedId] of giftNameCases) {
  const mapped = mapTikTokGiftToArenaId(undefined, giftName, coinValue);
  assert(
    mapped.arenaGiftId === expectedId,
    `TikTok gift "${giftName}" mapped to ${mapped.arenaGiftId}, expected ${expectedId}`
  );
}

/* -------------------------------------------------------------------------- */
/* Comment -> character -> death -> comment respawn                           */
/* -------------------------------------------------------------------------- */

const commentGame = new GameLoop('production', 300);
try {
  commentGame.resetToWaiting();
  commentGame.setRandomEventsEnabled(false);

  commentGame.handleLiveEvent(commentEvent({
    userId: oldShape.user.userId,
    username: oldShape.user.username,
    nickname: oldShape.user.nickname,
    avatarUrl: oldShape.user.avatarUrl,
  }));

  commentGame.handleLiveEvent(commentEvent({
    userId: mixedShape.user.userId,
    username: mixedShape.user.username,
    nickname: mixedShape.user.nickname,
    avatarUrl: mixedShape.user.avatarUrl,
  }));

  let snap = commentGame.getSnapshot();
  const one = snap.balls.find((b) => b.userId === 'viewer-1');
  const two = snap.balls.find((b) => b.userId === 'viewer-2');

  assert(snap.phase === 'running', 'first comment did not start/enter round');
  assert(one, 'first comment did not create a character');
  assert(two, 'second comment did not create a distinct character');
  assert(
    one.avatarUrl === 'https://example.com/viewer-one.jpg',
    'first avatar was not preserved'
  );
  assert(
    two.avatarUrl === 'https://example.com/viewer-two.jpg',
    'second avatar was not preserved'
  );

  const killEvents = commentGame.adminKill('viewer-1', 'viewer-2');
  assert(killEvents.length > 0, 'admin kill did not eliminate test player');
  assert(
    !commentGame.getSnapshot().balls.some((b) => b.userId === 'viewer-1'),
    'dead player still had a live body'
  );

  commentGame.handleLiveEvent(commentEvent({
    userId: 'viewer-1',
    username: 'viewer_one',
    nickname: 'Viewer One',
    avatarUrl: 'https://example.com/viewer-one.jpg',
  }, 'voltei'));

  snap = commentGame.getSnapshot();
  assert(
    snap.balls.filter((b) => b.userId === 'viewer-1').length === 1,
    'new comment did not respawn exactly one character'
  );
  assert(
    commentGame.getStats().find((st) => st.userId === 'viewer-1')?.deaths === 1,
    'respawn lost death history from the current round'
  );
} finally {
  commentGame.destroy();
}

/* -------------------------------------------------------------------------- */
/* Personal LIKE combo: 50/100/200/500/1000 + reset/repeat                    */
/* -------------------------------------------------------------------------- */

const likeGame = new GameLoop('production', 300);
try {
  likeGame.resetToWaiting();
  likeGame.setRandomEventsEnabled(false);

  const user: ArenaUser = {
    userId: 'likes-user',
    username: 'likes_user',
    nickname: 'Likes User',
  };
  likeGame.handleLiveEvent(commentEvent(user));

  const damage = likeGame.adminDamage(user.userId, 80, 'admin');
  assert(damage.length > 0, 'could not prepare low HP for like test');
  assert(getBall(likeGame, user.userId).hp === 20, 'like test damage setup mismatch');

  likeGame.handleLikes(user, 49);
  let b = getBall(likeGame, user.userId);
  assert(b.hp === 20, '49 likes should not trigger the 50-like reward');
  assert((b.hitPower ?? 0) === 0, '49 likes changed strength');

  likeGame.handleLikes(user, 1);
  b = getBall(likeGame, user.userId);
  assert(b.hp === 30, '50 likes must recover exactly 10 HP');
  assert((b.hitPower ?? 0) === 0, '50 likes must not add strength');

  likeGame.handleLikes(user, 50);
  b = getBall(likeGame, user.userId);
  assert(b.hp === 50, '100 likes must add 20 HP');
  assert((b.hitPower ?? 0) === 1, '100 likes must add +1 power');

  likeGame.handleLikes(user, 100);
  b = getBall(likeGame, user.userId);
  assert(b.hp === 100, '150 likes heal 10 and 200 likes heal 40, capped at max HP');
  assert((b.hitPower ?? 0) === 3, '200 likes must add +2 additional power');

  likeGame.handleLikes(user, 300);
  b = getBall(likeGame, user.userId);
  assert(b.hp === b.maxHp, '500 likes must restore 100% HP');
  assert((b.hitPower ?? 0) === 13, '500 likes must add +10 power');
  assert((b.titanStacks ?? 0) === 1, '500 likes must grant one Capybara stack');
  assert(
    b.buffs?.includes('capybara_titan'),
    '500 likes did not activate Capybara/Titan'
  );

  likeGame.handleLikes(user, 500);
  b = getBall(likeGame, user.userId);
  assert(b.hp === b.maxHp, '1000 likes must restore 100% HP');
  assert((b.hitPower ?? 0) === 28, '1000 likes must add +15 additional power');
  assert((b.titanStacks ?? 0) === 3, '1000 likes must grant Capybara x3');
  assert(
    b.buffs?.includes('capybara_titan'),
    '1000 likes lost the Capybara/Titan buff'
  );

  const physics = (likeGame as unknown as {
    physics: { getBall: (userId: string) => { titanUntil: number } | undefined };
  }).physics;
  const internal = physics.getBall(user.userId);
  assert(internal, 'could not inspect Titan timer');
  assert(
    internal.titanUntil > Date.now() + 60_000,
    '1000-like Capybara x3 is not lasting toward the end of the round'
  );

  const internals = likeGame as unknown as {
    personalLikeCombos: Map<string, { count: number; lastLikeAt: number }>;
  };
  const combo = internals.personalLikeCombos.get(user.userId)!;
  combo.lastLikeAt = Date.now() - LIKE_COMBO_RESET_MS - 1;
  likeGame.handleLikes(user, 50);
  assert(combo.count === 1000, 'previous combo object unexpectedly mutated');
  assert(internals.personalLikeCombos.get(user.userId)?.count === 50,
    'idle pause did not start a fresh like combo');
  assert((getBall(likeGame, user.userId).hitPower ?? 0) === 28,
    'fresh 50-like combo should heal only, not add strength');
  const other = { userId: 'other-viewer', username: 'other_viewer' };
  likeGame.handleLiveEvent(commentEvent(other));
  likeGame.adminDamage(other.userId, 50, 'admin');
  likeGame.handleLikes(user, 1);
  assert(getBall(likeGame, other.userId).hp === 50, 'likes healed another viewer');
  likeGame.forceNextRound();
  assert(internals.personalLikeCombos.size === 0, 'new round did not reset likes');

} finally {
  likeGame.destroy();
}

/* -------------------------------------------------------------------------- */
/* Gift/power path                                                            */
/* -------------------------------------------------------------------------- */

const giftGame = new GameLoop('production', 300);
try {
  giftGame.resetToWaiting();
  giftGame.setRandomEventsEnabled(false);

  const user: ArenaUser = {
    userId: 'gift-user',
    username: 'gift_user',
    nickname: 'Gift User',
  };
  giftGame.handleLiveEvent(commentEvent(user));
  giftGame.adminDamage(user.userId, 30, 'admin');

  giftGame.handleLiveEvent(giftEvent(user, 'rosa', 'Rosa', 3, 1));
  let b = getBall(giftGame, user.userId);
  assert(b.hp === 76, 'Rosa x3 should heal +6 HP');

  giftGame.handleLiveEvent(giftEvent(user, 'mini_dino', 'Mini Dino', 1, 10));
  b = getBall(giftGame, user.userId);
  assert((b.dinoStacks ?? 0) === 1, 'Mini Dino did not add DINO stack');
  assert(b.buffs?.includes('dino_rage'), 'Mini Dino did not activate dino_rage');

  giftGame.handleLiveEvent(giftEvent(user, 'rosquinha', 'Rosquinha', 1, 30));
  b = getBall(giftGame, user.userId);
  assert(b.hp === 96, 'Rosquinha did not heal +20 HP');
  assert((b.shieldHp ?? 0) === 100, 'Rosquinha did not grant 100 shield');
  assert((b.donutStacks ?? 0) === 1, 'Rosquinha did not add donut stack');
  assert(
    b.buffs?.includes('donut_overdrive'),
    'Rosquinha did not activate donut_overdrive'
  );

  giftGame.handleLiveEvent(giftEvent(user, 'capivara', 'Capivara', 1, 100));
  b = getBall(giftGame, user.userId);
  assert((b.titanStacks ?? 0) === 1, 'Capivara did not add Titan stack');
  assert(
    b.buffs?.includes('capybara_titan'),
    'Capivara did not activate capybara_titan'
  );
  assert((b.sizeScale ?? 1) > 1, 'Capivara did not increase character size');

  giftGame.handleLiveEvent(giftEvent(user, 'galaxia', 'Galaxia', 1, 1000));
  b = getBall(giftGame, user.userId);
  assert(b.isGalaxy === true, 'Galaxy did not enable God Mode');
  assert(
    b.buffs?.includes('galaxy_god'),
    'Galaxy did not expose galaxy_god buff to the client'
  );

  const pickupCountBefore = giftGame.getSnapshot().pickups.length;
  giftGame.handleLiveEvent(giftEvent(user, 'raio', 'Raio', 1, 15));
  const pickups = giftGame.getSnapshot().pickups;
  assert(
    pickups.length === pickupCountBefore + 1,
    'Raio power did not spawn a floor pickup'
  );
  assert(
    pickups.some((p) => p.ability === 'lightning_zap'),
    'Raio pickup mapped to the wrong ability'
  );

  // Exercise every floor power directly against real PhysicsWorld state.
  const foe: ArenaUser = {
    userId: 'power-foe',
    username: 'power_foe',
    nickname: 'Power Foe',
  };
  giftGame.handleLiveEvent(commentEvent(foe));

  const physics = (giftGame as unknown as { physics: PhysicsWorld }).physics;
  const caster = physics.getBall(user.userId);
  const target = physics.getBall(foe.userId);
  assert(caster && target, 'power test balls missing');

  // Put both balls close and remove spawn protection for deterministic tests.
  caster.x = 500;
  caster.y = 960;
  target.x = 620;
  target.y = 960;
  caster.spawnProtectedUntil = 0;
  target.spawnProtectedUntil = 0;

  const hpBeforeZap = target.hp;
  const zap = applyPickupAbility(physics, user.userId, 'lightning_zap', user.username);
  assert(zap, 'lightning_zap returned null');
  assert(target.hp < hpBeforeZap, 'lightning_zap did not damage target');
  assert(
    physics.toPublicStates().find((x) => x.userId === target.userId)?.buffs?.includes('slowed'),
    'lightning_zap did not slow target'
  );

  target.vx = 0;
  target.vy = 0;
  const magnet = applyPickupAbility(physics, user.userId, 'magnet_pulse', user.username);
  assert(magnet, 'magnet_pulse returned null');
  assert(
    Math.abs(target.vx) + Math.abs(target.vy) > 0,
    'magnet_pulse did not pull nearby target'
  );

  const freeze = applyPickupAbility(physics, user.userId, 'freeze_aura', user.username);
  assert(freeze, 'freeze_aura returned null');
  assert(
    physics.toPublicStates().find((x) => x.userId === user.userId)?.buffs?.includes('freeze_aura'),
    'freeze_aura buff missing'
  );

  const speedBeforeDash = Math.hypot(caster.vx, caster.vy);
  const dash = applyPickupAbility(physics, user.userId, 'dash_burst', user.username);
  assert(dash, 'dash_burst returned null');
  assert(
    Math.hypot(caster.vx, caster.vy) >= speedBeforeDash,
    'dash_burst did not increase/retain boosted speed'
  );
  assert(
    physics.toPublicStates().find((x) => x.userId === user.userId)?.buffs?.includes('dash_burst'),
    'dash_burst buff missing'
  );

  const reflect = applyPickupAbility(physics, user.userId, 'reflect_shield', user.username);
  assert(reflect, 'reflect_shield returned null');
  assert(
    physics.toPublicStates().find((x) => x.userId === user.userId)?.buffs?.includes('reflect_shield'),
    'reflect_shield buff missing'
  );

  physics.applyDirectDamage(user.userId, 30);
  const hpBeforeOrb = caster.hp;
  const healOrb = applyPickupAbility(physics, user.userId, 'heal_orb', user.username);
  assert(healOrb, 'heal_orb returned null');
  assert(caster.hp > hpBeforeOrb, 'heal_orb did not restore HP');
} finally {
  giftGame.destroy();
}

console.log(
  '[SELFTEST] PASS PirateTok direct CHAT/LIKE/GIFT + legacy normalization + real gift-name mapping; ' +
    'comment spawn+respawn; repeatable LIKE combos every 50 through 1000 with idle reset; ' +
    'Rosa/Dino/Donut/Capybara/Galaxy + Lightning/Magnet/Freeze/Dash/Reflect/Heal powers'
);
