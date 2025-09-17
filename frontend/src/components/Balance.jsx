import React from 'react'
export default function Balance({ balance }) {
  return (
    <div className="flex items-center gap-4 bg-gray-800 p-4 rounded">
      <div className="text-sm text-gray-400">Баланс</div>
      <div className="text-2xl font-bold">{balance} ETH</div>
    </div>
  )
}