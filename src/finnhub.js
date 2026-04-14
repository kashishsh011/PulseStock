// src/finnhub.js
const FINNHUB_KEY = 'YOUR_FINNHUB_KEY'
let socket = null
const subscribers = {}

export function connectFinnhub() {
  // Don't attempt connection if using the placeholder key
  if (!FINNHUB_KEY || FINNHUB_KEY === 'YOUR_FINNHUB_KEY') {
    console.warn('Finnhub: no API key configured — live prices disabled.')
    return
  }

  socket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`)

  socket.onopen = () => {
    console.log('✅ Finnhub connected')
    Object.keys(subscribers).forEach(subscribeSymbol)
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type !== 'trade' || !data.data) return
      data.data.forEach(trade => {
        const { s: symbol, p: price } = trade
        subscribers[symbol]?.forEach(cb => cb({ symbol, price }))
      })
    } catch { /* ignore malformed frames */ }
  }

  socket.onclose = () => setTimeout(connectFinnhub, 3000)
  socket.onerror = (err) => console.warn('Finnhub WS error:', err)
}

function subscribeSymbol(symbol) {
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ type: 'subscribe', symbol }))
}

export function watchStock(symbol, callback) {
  if (!subscribers[symbol]) {
    subscribers[symbol] = []
    subscribeSymbol(symbol)
  }
  subscribers[symbol].push(callback)
}

export function unwatchStock(symbol) {
  delete subscribers[symbol]
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ type: 'unsubscribe', symbol }))
}