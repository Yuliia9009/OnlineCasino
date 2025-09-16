// Simple API adapter — currently mocks. Replace API_BASE with real backend URL.
const API_BASE = 'http://localhost:5000'

export async function getFeed() {
  // mock data
  return [
    { id: 1, time: new Date().toISOString(), title: '0x3a4... виграш 0.05 ETH', meta: '🎉' },
    { id: 2, time: new Date().toISOString(), title: '0x7b2... програш', meta: '😢' }
  ]
}

export async function fetchHistory(address) {
  return []
}