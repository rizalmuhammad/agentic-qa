'use strict';

/**
 * Minimal OpenAI-compatible chat client. The project uses a custom provider
 * (Sumopod, glm-5.3-flash) instead of Claude via MCP; that deviation is
 * recorded in agents/orchestrator/README.md.
 *
 * The key is never read from the repo. Point QA_LLM_KEY_FILE at a file outside
 * the workspace, or set QA_LLM_API_KEY in the environment.
 */

const fs = require('fs');

const BASE_URL = process.env.QA_LLM_BASE_URL || 'https://ai.sumopod.com/v1';
const MODEL = process.env.QA_LLM_MODEL || 'glm-5.3-flash';

function apiKey() {
  if (process.env.QA_LLM_API_KEY) return process.env.QA_LLM_API_KEY;
  const file = process.env.QA_LLM_KEY_FILE;
  if (!file) {
    throw new Error('Set QA_LLM_KEY_FILE to a file outside the repo, or QA_LLM_API_KEY');
  }
  return fs.readFileSync(file, 'utf8').trim();
}

async function chat(messages, options = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: options.model || MODEL,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 8000,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && body.error ? body.error.message : response.statusText;
    throw new Error(`model call failed (${response.status}): ${detail}`);
  }

  const choice = body.choices && body.choices[0];
  const content = (choice && choice.message && choice.message.content) || '';
  return {
    content,
    finishReason: choice ? choice.finish_reason : null,
    usage: body.usage || {},
    latencyMs: Date.now() - started,
  };
}

module.exports = { chat, MODEL, BASE_URL };
