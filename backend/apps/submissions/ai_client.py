"""
Provider-agnostic LLM client for the AI-assisted discrepancy review (spec 2.9).

One small HTTP adapter per API family, so any of these can be used by setting
environment variables alone - no SDK dependency:

    AI_PROVIDER   openai | openrouter | openai-compatible | anthropic | gemini
                  (unset or "none": the AI layer is off)
    AI_API_KEY    the provider's key
    AI_MODEL      model id; a default per provider is used if unset
    AI_BASE_URL   override the endpoint (required for openai-compatible, e.g.
                  a self-hosted vLLM/Ollama server or Groq/Together/Azure)
    AI_TIMEOUT_SECONDS  default 30

The AI layer is an enhancement, never a dependency (spec 2.9 "Reliability
Principle"): `complete()` raises AIError on any failure, and callers carry on
with the deterministic flags.
"""
import json
import re
import time
from dataclasses import dataclass

import requests
from django.conf import settings

OPENAI_STYLE = {'openai', 'openrouter', 'openai-compatible'}
SUPPORTED = OPENAI_STYLE | {'anthropic', 'gemini'}

DEFAULT_BASE_URLS = {
    'openai': 'https://api.openai.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'anthropic': 'https://api.anthropic.com/v1',
    'gemini': 'https://generativelanguage.googleapis.com/v1beta',
}

# Sensible, inexpensive defaults; set AI_MODEL to pin a specific model.
DEFAULT_MODELS = {
    'openai': 'gpt-4o-mini',
    'openrouter': 'openrouter/auto',
    'anthropic': 'claude-haiku-5-5',
    'gemini': 'gemini-2.0-flash',
}


class AIError(Exception):
    """The provider could not be reached or returned something unusable."""


@dataclass(frozen=True)
class AIConfig:
    provider: str
    api_key: str
    model: str
    base_url: str
    timeout: float

    def public(self):
        """What the UI may show: never the key."""
        return {'provider': self.provider, 'model': self.model, 'baseUrl': self.base_url}


def get_config():
    """The configured provider, or None when the AI layer is off or incomplete."""
    provider = (getattr(settings, 'AI_PROVIDER', '') or '').strip().lower()
    key = (getattr(settings, 'AI_API_KEY', '') or '').strip()
    if provider in ('', 'none', 'off') or provider not in SUPPORTED or not key:
        return None
    base = (getattr(settings, 'AI_BASE_URL', '') or '').strip().rstrip('/') or DEFAULT_BASE_URLS.get(provider, '')
    if not base:
        return None  # openai-compatible needs an explicit endpoint
    model = (getattr(settings, 'AI_MODEL', '') or '').strip() or DEFAULT_MODELS.get(provider, '')
    if not model:
        return None
    return AIConfig(provider, key, model, base, float(getattr(settings, 'AI_TIMEOUT_SECONDS', 30)))


def status():
    """For the UI: whether AI review is available and with what."""
    cfg = get_config()
    provider = (getattr(settings, 'AI_PROVIDER', '') or '').strip().lower()
    if cfg:
        return {'configured': True, **cfg.public()}
    reason = 'AI_PROVIDER is not set.'
    if provider and provider not in ('none', 'off'):
        if provider not in SUPPORTED:
            reason = f"Unsupported AI_PROVIDER '{provider}'. Use one of: {', '.join(sorted(SUPPORTED))}."
        elif not (getattr(settings, 'AI_API_KEY', '') or '').strip():
            reason = 'AI_API_KEY is not set.'
        else:
            reason = 'AI_BASE_URL is required for openai-compatible providers.'
    return {'configured': False, 'reason': reason}


def _post(cfg, url, headers, body):
    try:
        res = requests.post(url, headers=headers, json=body, timeout=cfg.timeout)
    except requests.RequestException as exc:
        raise AIError(f'Could not reach {cfg.provider}: {exc.__class__.__name__}') from exc
    if res.status_code >= 400:
        # Error bodies can echo request details; keep only a short prefix.
        raise AIError(f'{cfg.provider} returned HTTP {res.status_code}: {res.text[:300]}')
    try:
        return res.json()
    except ValueError as exc:
        raise AIError(f'{cfg.provider} returned a non-JSON body.') from exc


def _openai_style(cfg, system, user):
    headers = {'Authorization': f'Bearer {cfg.api_key}', 'Content-Type': 'application/json'}
    if cfg.provider == 'openrouter':
        headers['X-Title'] = 'DORA Ranking Portal'
    body = {
        'model': cfg.model,
        'temperature': 0,
        'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
    }
    if cfg.provider == 'openai':
        body['response_format'] = {'type': 'json_object'}
    data = _post(cfg, f'{cfg.base_url}/chat/completions', headers, body)
    try:
        return data['choices'][0]['message']['content'] or ''
    except (KeyError, IndexError, TypeError) as exc:
        raise AIError('Unexpected chat-completions response shape.') from exc


def _anthropic(cfg, system, user):
    headers = {
        'x-api-key': cfg.api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    }
    body = {
        'model': cfg.model,
        'max_tokens': 4096,
        'temperature': 0,
        'system': system,
        'messages': [{'role': 'user', 'content': user}],
    }
    data = _post(cfg, f'{cfg.base_url}/messages', headers, body)
    try:
        return ''.join(part.get('text', '') for part in data['content'] if part.get('type') == 'text')
    except (KeyError, TypeError) as exc:
        raise AIError('Unexpected Anthropic response shape.') from exc


def _gemini(cfg, system, user):
    headers = {'x-goog-api-key': cfg.api_key, 'Content-Type': 'application/json'}
    body = {
        'systemInstruction': {'parts': [{'text': system}]},
        'contents': [{'role': 'user', 'parts': [{'text': user}]}],
        'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json'},
    }
    data = _post(cfg, f'{cfg.base_url}/models/{cfg.model}:generateContent', headers, body)
    try:
        parts = data['candidates'][0]['content']['parts']
        return ''.join(p.get('text', '') for p in parts)
    except (KeyError, IndexError, TypeError) as exc:
        raise AIError('Unexpected Gemini response shape.') from exc


def complete(cfg, system, user):
    """Send one system+user exchange; returns (text, latency_ms)."""
    started = time.monotonic()
    if cfg.provider in OPENAI_STYLE:
        text = _openai_style(cfg, system, user)
    elif cfg.provider == 'anthropic':
        text = _anthropic(cfg, system, user)
    elif cfg.provider == 'gemini':
        text = _gemini(cfg, system, user)
    else:  # pragma: no cover - get_config filters these
        raise AIError(f'Unsupported provider {cfg.provider}')
    return text, int((time.monotonic() - started) * 1000)


_FENCE = re.compile(r'```(?:json)?\s*(.*?)```', re.DOTALL)


def parse_json(text):
    """The JSON object in a model reply, tolerating code fences and prose around it."""
    if not text:
        raise AIError('Empty response.')
    candidates = [text.strip()]
    candidates += [m.strip() for m in _FENCE.findall(text)]
    start, end = text.find('{'), text.rfind('}')
    if start != -1 and end > start:
        candidates.append(text[start:end + 1])
    for chunk in candidates:
        try:
            value = json.loads(chunk)
        except ValueError:
            continue
        if isinstance(value, dict):
            return value
    raise AIError('The response did not contain a JSON object.')
