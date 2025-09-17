import React from 'react'
import { Navigate } from 'react-router-dom'
import { isAdmin } from '../utils/web3'

export default function AdminRoute({ address, children }) {
  if (!address || !isAdmin(address)) {
    return <Navigate to="/" replace />
  }
  return children
}
