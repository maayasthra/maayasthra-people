import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPoll } from '../src/refreshPoll.js';

for (const [area, fallback] of [['board', 45000], ['attendance', 60000]]) {
  test(area + ' reconciles on reconnect, keeps polling without realtime, and stops on logout', t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const response = JSON.stringify([{ id: 1, description: 'Dummy staging record' }]);
    let bytes = 0;
    const poll = refreshPoll(() => { bytes += Buffer.byteLength(response); }, fallback);
    const calls = () => bytes / Buffer.byteLength(response);
    t.mock.timers.tick(fallback);
    assert.equal(calls(), 1);
    poll.status('SUBSCRIBED');
    assert.equal(calls(), 2);
    poll.status('SUBSCRIBED');
    for (let i = 0; i < 60; i++) t.mock.timers.tick(60000);
    assert.equal(calls(), 14);
    poll.status('CHANNEL_ERROR');
    t.mock.timers.tick(fallback);
    assert.equal(calls(), 15);
    poll.status('SUBSCRIBED');
    assert.equal(calls(), 16);
    poll.stop();
    poll.status('SUBSCRIBED');
    poll.status('CLOSED');
    t.mock.timers.tick(300000);
    assert.equal(calls(), 16);
  });
}
