import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Cabinet from './pages/Cabinet'
import Deposit from './pages/Deposit'
import Withdraw from './pages/Withdraw'
import Feed from './pages/Feed'
import Admin from './pages/Admin'
import Navbar from './components/Navbar'
import AdminRoute from './components/AdminRoute'
import { connectWallet, onAccountChange } from './utils/web3'


export default function App() {
const [address, setAddress] = useState(null)
const navigate = useNavigate()


useEffect(() => {
// handle account change (MetaMask)
onAccountChange((addr) => {
setAddress(addr)
if (!addr) navigate('/')
})
}, [])


return (
<div className="min-h-screen flex flex-col">
<Navbar address={address} onConnect={async () => {
const a = await connectWallet()
setAddress(a)
navigate('/cabinet')
}} />


<main className="flex-1 container mx-auto px-4 py-6">
<Routes>
  <Route path="/" element={<Login onConnect={async () => { const a = await connectWallet(); setAddress(a); navigate('/cabinet') }} />} />
  <Route path="/cabinet" element={<Cabinet address={address} />} />
  <Route path="/deposit" element={<Deposit address={address} />} />
  <Route path="/withdraw" element={<Withdraw address={address} />} />
  <Route path="/feed" element={<Feed />} />
  <Route path="/admin/*" element={
    <AdminRoute address={address}>
      <Admin />
    </AdminRoute>
  } />
</Routes>
</main>


<footer className="bg-gray-800 text-gray-400 text-center py-3">Спробуй удачу!</footer>
</div>
)
}