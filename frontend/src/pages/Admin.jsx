import React from 'react'

export default function Admin() {
  // макет адмінського інтерфейсу: дашборд + список гравців + список ігор
  return (
    <div>
      <h2 className="text-2xl mb-4">Адмін Панель (клієнтський макет)</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          Всього гравців<br />
          <span className="text-2xl font-bold">123</span>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          Всього ігор<br />
          <span className="text-2xl font-bold">4,321</span>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          Баланс казино<br />
          <span className="text-2xl font-bold">12.34 ETH</span>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xl mb-2">Гравці (макет)</h3>
        <div className="bg-gray-800 p-3 rounded space-y-2">
          <div className="flex justify-between">
            <div>0x123...abcd</div>
            <div>1.2 ETH</div>
          </div>
          <div className="flex justify-between">
            <div>0x555...face</div>
            <div>0.01 ETH</div>
          </div>
        </div>
      </div>
    </div>
  )
}
