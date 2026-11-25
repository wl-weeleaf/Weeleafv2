import assert from 'node:assert/strict';
import {memoryRejection} from '../lib/leafy/core-filters.ts';
for (const text of ['010101-0000','4242 4242 4242 4242','DK50 0040 0440 1162 43','kodeord er hemmeligt','Bearer abcdefgh','reg.nr. 1234']) {
  assert.ok(memoryRejection(text,'user'));
}
assert.equal(memoryRejection('Jeg foretrækker korte svar på dansk.','user'),null);
assert.ok(memoryRejection('Jeg foretrækker korte svar på dansk.','leafy'));
