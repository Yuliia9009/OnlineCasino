import React from 'react'
export default function Reel({ symbol }) {
  return (
    <div className="reel w-24 h-24 bg-gray-700 rounded flex items-center justify-center text-4xl">{symbol}</div>
  )
}