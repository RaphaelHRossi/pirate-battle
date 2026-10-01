import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'

export const worker = setupWorker(
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),
)
