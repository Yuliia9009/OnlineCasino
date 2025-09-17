import React, { useState } from 'react'
import { deposit } from '../utils/web3'

export default function Deposit({ address }) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState(null)

  async function handleDeposit() {
    setStatus('pending')
    try {
      const tx = await deposit(amount)
      setStatus('success')
    } catch (e) {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-gray-800 p-6 rounded">
      <h2 className="text-xl mb-4">Поповнення балансу</h2>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Кількість у ETH" className="w-full p-2 mb-3 bg-gray-900" />
      <button onClick={handleDeposit} className="bg-blue-600 px-4 py-2 rounded">Поповнити</button>
      {status && <div className="mt-3 text-sm">{status}</div>}
    </div>
  )
}