import React from 'react'
export default function Result({ win }) {
  if (win === null) return <div className="text-gray-400">Щоб грати - зробіть оберт!</div>
  if (parseFloat(win) > 0) return <div className="text-green-400 font-semibold">🎉 Ви виграли {win} ETH</div>
  return <div className="text-red-400">😢 Ви програли(</div>
}