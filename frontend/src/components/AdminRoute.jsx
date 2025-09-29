import React from 'react'
import { Navigate } from 'react-router-dom'
import { isAdmin } from '../utils/web3'

export default function AdminRoute({ address, children }) {
  if (!address) {
    return <Navigate to="/" replace />
  }

  if (!isAdmin(address)) {
    return (
      <div className="text-center p-10 text-red-400">
        <h2 className="text-2xl font-bold mb-4">403</h2>
        <p>У вас немає прав доступу до адмін-панелі.</p>
      </div>
    )
  }

  return children
}
