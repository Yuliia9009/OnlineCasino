import React, { useState } from 'react'
import { withdraw } from '../utils/web3'

export default function Withdraw({ address }) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState(null)

  async function handleWithdraw() {
    setStatus('pending')
    try {
      const tx = await withdraw(amount)
      setStatus('success')
    } catch (e) {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-gray-800 p-6 rounded">
      <h2 className="text-xl mb-4">Зняття коштів</h2>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Значення у ETH" className="w-full p-2 mb-3 bg-gray-900" />
      <button onClick={handleWithdraw} className="bg-yellow-600 px-4 py-2 rounded">Зняти</button>
      {status && <div className="mt-3 text-sm">{status}</div>}
    </div>
  )
}