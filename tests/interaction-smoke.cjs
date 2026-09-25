// Runs only against an explicitly local disposable server.
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const base = 'http://127.0.0.1:3100';
const { once } = require('node:events');
async function post(path, body = {}) {
  const res = await fetch(base + path, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert(res.ok, `${path}: ${res.status}`); return res.json();
}
async function status() { return (await fetch(base + '/admin/status')).json(); }
(async () => {
  const socket = io(base, { transports:['websocket'] });
  try {
    await Promise.race([once(socket, 'connect'), new Promise((_, reject) => setTimeout(() => reject(new Error('Socket connection timeout')), 5000).unref())]);
    await post('/admin/sim/auto', {enabled:false});
    await post('/admin/events/random', {enabled:false});
    await post('/admin/round/reset');
    const user = {userId:'qa-human',username:'qa_human'};
    let received = false;
    socket.on('game:snapshot', snap => { if(snap.balls.some(b=>b.userId===user.userId)) received=true; });
    await post('/admin/sim/comment', {user,comment:'jogar'});
    assert((await status()).balls.some(b=>b.userId===user.userId));
    await post('/admin/combat/kill', {victimId:user.userId});
    assert(!(await status()).balls.some(b=>b.userId===user.userId));
    await post('/admin/sim/comment', {user,comment:'jogar'});
    let state = await status();
    assert.equal(state.balls.filter(b=>b.userId===user.userId).length,1);
    assert.equal(state.stats.find(b=>b.userId===user.userId).deaths,1);
    await new Promise(resolve => setTimeout(resolve, 2100));
    await post('/admin/combat/damage', {victimId:user.userId,damage:80});
    await post('/admin/sim/like', {userId:user.userId,likeCount:50});
    assert.equal((await status()).balls.find(b=>b.userId===user.userId).hp,30);
    await post('/admin/sim/like', {userId:user.userId,likeCount:50});
    assert.equal((await status()).balls.find(b=>b.userId===user.userId).hitPower,1);
    await post('/admin/sim/like', {userId:user.userId,likeCount:50});
    assert.equal((await status()).balls.find(b=>b.userId===user.userId).hp,60);
    await post('/admin/sim/like', {userId:user.userId,likeCount:850});
    state=await status();
    const ball=state.balls.find(b=>b.userId===user.userId);
    assert.equal(ball.hitPower,28);
    assert.equal(ball.hp,ball.maxHp);
    assert(received,'Socket did not deliver the new character');
    console.log('PASS: HTTP → game → WebSocket; entry, death, same-comment respawn, 50/100/150/1000 likes.');
  } finally { socket.disconnect(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
