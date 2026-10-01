import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createQueryClient } from './api/queryClient'
import { App } from './app/App'

/**
 * The mock API runs in every build (including production), so the worker
 * must be active before React mounts and issues its first request.
 */
async function enableMocking(): Promise<void> {
  const { initScenarioFromUrl } = await import('./mocks/scenarios')
  // ?scenario= / ?netSeed= pick the simulated network before any request.
  initScenarioFromUrl(window.location.search)
  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: import.meta.env.PROD,
  })
}

function render(): void {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element is missing from index.html')

  // One cache for the whole app; it outlives every screen.
  const queryClient = createQueryClient()
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

enableMocking()
  .catch((error: unknown) => {
    // e.g. service workers unavailable (insecure origin, private mode):
    // the game still works, only API calls will fail.
    console.warn('Mock API could not start', error)
  })
  .finally(render)
