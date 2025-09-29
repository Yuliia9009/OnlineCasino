import React, { useState } from 'react'
import { withdraw, EXPECTED_CHAIN_ID } from '../utils/web3'
import { apiConfirmWithdraw as apiWithdraw } from '../utils/api'

export default function Withdraw({ address }) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState('')
  const [txHash, setTxHash] = useState('')

  const disabled = !amount || Number(amount) <= 0 || status === 'pending'

  async function handleWithdraw() {
    setStatus('pending')
    setErr('')
    setTxHash('')

    try {
      const tx = await withdraw(amount)
      const hash = tx?.txHash || tx?.hash || tx?.transactionHash
      if (!hash) {
        throw new Error("Не вдалося отримати hash транзакції")
      }
      setTxHash(hash || '')

      await apiWithdraw({
        txHash: hash,
        address,
        chainId: EXPECTED_CHAIN_ID
      })

      setStatus('success')
      setAmount('')
    } catch (e) {
      console.error('[Withdraw] error:', e)
      setErr(e?.message || 'Помилка')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-gray-800 p-6 rounded">
      <h2 className="text-xl mb-4">Зняття коштів</h2>

      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Значення у ETH"
        type="number"
        min="0"
        step="0.001"
        className="w-full p-2 mb-3 bg-gray-900 rounded"
      />

      <button
        onClick={handleWithdraw}
        disabled={disabled}
        className={`px-4 py-2 rounded ${disabled ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'}`}
      >
        {status === 'pending' ? 'Очікуємо підтвердження…' : 'Зняти'}
      </button>

      {status === 'success' && (
        <div className="mt-3 text-sm text-green-400">
          ✅ Успіх! {txHash && (
            <span>tx: <span className="font-mono break-all">{txHash}</span></span>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 text-sm text-red-400">
          ❌ {err}
        </div>
      )}
    </div>
  )
}