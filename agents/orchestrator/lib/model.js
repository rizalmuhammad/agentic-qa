'use strict';

/**
 * Minimal OpenAI-compatible chat client. The project uses a custom provider
 * (Sumopod, glm-5.3-flash) instead of Claude via MCP; that deviation is
 * recorded in agents/orchestrator/README.md.
 *
 * The key is never read from the repo. Point QA_LLM_KEY_FILE at a file outside
 * the workspace, or set QA_LLM_API_KEY in the environment.
 *
 * Reasoning models spend tokens before writing their answer, so a short budget
 * truncates the JSON. One automatic retry doubles it before giving up.
 */

const fs = require('fs');

const BASE_URL = process.env.QA_LLM_BASE_URL || 'https://ai.sumopod.com/v1';
const MODEL = process.env.QA_LLM_MODEL || 'glm-5.3-flash';

function apiKey() {
  if (process.env.QA_LLM_API_KEY) return process.env.QA_LLM_API_KEY;
  const file = process.env.QA_LLM_KEY_FILE;
  if (!file) throw new Error('Set QA_LLM_KEY_FILE to a file outside the repo, or QA_LLM_API_KEY');
  return fs.readFileSync(file, 'utf8').trim();
}

async function once(messages, options, maxTokens) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: options.model || MODEL,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: maxTokens,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && body.error ? body.error.message : response.statusText;
    throw new Error(`model call failed (${response.status}): ${detail}`);
  }

  const choice = body.choices && body.choices[0];
  return {
    content: (choice && choice.message && choice.message.content) || '',
    finishReason: choice ? choice.finish_reason : null,
    usage: body.usage || {},
    latencyMs: Date.now() - started,
  };
}

async function chat(messages, options = {}) {
  let budget = options.maxTokens ?? 8000;
  let totalTokens = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await once(messages, options, budget);
    totalTokens += reply.usage.total_tokens || 0;

    if (reply.finishReason !== 'length') {
      return { ...reply, usage: { ...reply.usage, total_tokens: totalTokens } };
    }

    budget = Math.min(budget * 2, 20000);
    messages = [
      ...messages,
      { role: 'user', content: 'Your previous reply hit the token cap. Answer now with the JSON object only, no reasoning and no prose.' },
    ];
  }

  return {
    content: '',
    finishReason: 'length',
    usage: { total_tokens: totalTokens },
    latencyMs: 0,
  };
}

module.exports = { chat, MODEL, BASE_URL };
