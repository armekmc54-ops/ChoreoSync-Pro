import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { createRoomHandler } from '../live-rooms.js';

class Client extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  incoming = [];
  send(message) { this.incoming.push(JSON.parse(message)); }
  publish(message) { this.emit('message', Buffer.from(JSON.stringify(message))); }
}

test('a private invitation gives read access while exactly one director can publish', () => {
  const connect = createRoomHandler({ directorKey: 'test-only-kept-in-the-test' });
  const roomId = 'PILOT-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const director = new Client();
  const dancer = new Client();
  const other = new Client();
  for (const client of [director, dancer, other]) connect(client);
  for (const client of [director, dancer]) client.publish({ type: 'JOIN_ROOM', roomId });
  other.publish({ type: 'JOIN_ROOM', roomId: 'PILOT-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' });
  const update = { type: 'FULL_STATE', roomId, project: { dancers: [], formations: [], beats: [] }, currentTimeMs: 1200, playbackRate: 1, isPlaying: false };
  dancer.publish(update);
  assert.equal(director.incoming.some(({ type }) => type === 'FULL_STATE'), false);
  director.publish({ type: 'DIRECTOR_AUTH', roomId, key: 'test-only-kept-in-the-test' });
  assert.equal(director.incoming.at(-1).status, 'authorized');
  dancer.publish({ type: 'DIRECTOR_AUTH', roomId, key: 'test-only-kept-in-the-test' });
  assert.equal(dancer.incoming.at(-1).status, 'occupied');
  director.publish(update);
  assert.equal(dancer.incoming.at(-1).currentTimeMs, 1200);
  assert.equal(other.incoming.some(({ type }) => type === 'FULL_STATE'), false);
  director.publish({ ...update, type: 'SYNC_TIME', currentTimeMs: 2700, project: undefined });
  const late = new Client();
  connect(late);
  late.publish({ type: 'JOIN_ROOM', roomId });
  assert.equal(late.incoming.at(-1).currentTimeMs, 2700);
  director.emit('close');
  assert.equal(late.incoming.at(-1).isPlaying, false);
  dancer.publish({ type: 'DIRECTOR_AUTH', roomId, key: 'test-only-kept-in-the-test' });
  assert.equal(dancer.incoming.at(-1).status, 'authorized');
});
