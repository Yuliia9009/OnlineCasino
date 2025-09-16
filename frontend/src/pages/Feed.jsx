import React, { useEffect, useState } from 'react'
import { getFeed } from '../utils/api'

export default function Feed() {
  const [items, setItems] = useState([])

  useEffect(() => {
    (async () => {
      setItems(await getFeed())
    })()
  }, [])

  return (
    <div>
      <h2 className="text-2xl mb-4">Історія активності:</h2>
      <div className="space-y-3">
        {items.length === 0 && <div className="text-gray-400">Активність відсутня</div>}
        {items.map(i => (
          <div key={i.id} className="bg-gray-800 p-3 rounded flex justify-between">
            <div>
              <div className="text-sm text-gray-400">{new Date(i.time).toLocaleString()}</div>
              <div className="font-medium">{i.title}</div>
            </div>
            <div className="text-right">{i.meta}</div>
          </div>
        ))}
      </div>
    </div>
  )
}