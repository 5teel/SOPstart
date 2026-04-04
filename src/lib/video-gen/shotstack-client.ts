/**
 * Shotstack API client — typed fetch wrapper for cloud video rendering.
 * Uses direct fetch (no @shotstack/shotstack-sdk) per research recommendation.
 * Lazy API key resolution to prevent build failures without env vars set.
 *
 * Supports sandbox/production URL switching via SHOTSTACK_API_URL env var.
 */

import type { ShotstackEdit, ShotstackRenderResponse } from './types'

function getApiKey(): string {
  const key = process.env.SHOTSTACK_API_KEY
  if (!key) throw new Error('SHOTSTACK_API_KEY is not set')
  return key
}

function getBaseUrl(): string {
  return process.env.SHOTSTACK_API_URL || 'https://api.shotstack.io/edit/v1'
}

/**
 * Submit a Shotstack render job.
 *
 * @param edit  The full Shotstack edit timeline + output config
 * @returns     The Shotstack render ID (use with getShotstackRender to poll status)
 * @throws      Descriptive error if the API returns a non-OK response
 */
export async function submitShotstackRender(edit: ShotstackEdit): Promise<string> {
  const response = await fetch(`${getBaseUrl()}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
    body: JSON.stringify(edit),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shotstack render submission failed (${response.status}): ${body}`)
  }

  const data = await response.json() as { response?: { id?: string } }
  const renderId = data?.response?.id
  if (!renderId) {
    throw new Error('Shotstack did not return a render ID')
  }

  return renderId
}

/**
 * Get the current status of a Shotstack render job.
 *
 * @param renderId  The Shotstack render ID returned from submitShotstackRender
 * @returns         Status and URL (when done) for the render job
 * @throws          Descriptive error if the API returns a non-OK response
 */
export async function getShotstackRender(renderId: string): Promise<ShotstackRenderResponse> {
  const response = await fetch(`${getBaseUrl()}/render/${renderId}`, {
    method: 'GET',
    headers: {
      'x-api-key': getApiKey(),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shotstack status check failed (${response.status}): ${body}`)
  }

  const data = await response.json() as {
    response?: {
      status?: string
      url?: string
      error?: string
    }
  }

  const render = data?.response
  return {
    status: (render?.status ?? 'failed') as ShotstackRenderResponse['status'],
    url: render?.url,
    error: render?.error,
  }
}
