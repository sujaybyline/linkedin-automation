const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDER_CATALOG, isValidProviderType, defaultModelForType } = require('../lib/aiProviderTypes');

test('ollama is registered as a supported provider', () => {
  assert.equal(isValidProviderType('ollama'), true);
  assert.ok(PROVIDER_CATALOG.ollama);
  assert.equal(defaultModelForType('ollama'), 'llama3.1:8b');
});
