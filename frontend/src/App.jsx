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
import { connectWallet, onAccountChange, isAdmin } from './utils/web3'


export default function App() {
  const [address, setAddress] = useState(null)
  const navigate = useNavigate()


  useEffect(() => {
    onAccountChange((addr) => {
      setAddress(addr);
      const path = window.location.pathname;

      if (!addr) {
        navigate('/');
        return;
      }

      if (isAdmin(addr) && (path === '/' || path === '')) {
        navigate('/admin');
        return;
      }

      if (path.startsWith('/admin') && !isAdmin(addr)) {
        alert('У вас немає прав доступу до адмін-панелі.');
        navigate('/');
      }
    });
  }, [navigate]);


  return (
    <div className="min-h-screen flex flex-col">
      <Navbar address={address} onConnect={async () => {
        const a = await connectWallet();
        setAddress(a);

        if (isAdmin(a)) {
          navigate('/admin');
        } else {
          navigate('/cabinet');
        }
      }} />


      <main className="flex-1 container mx-auto px-4 py-6">
        <Routes>
          <Route
            path="/"
            element={
              <Login
                onConnect={async () => {
                  const a = await connectWallet();
                  setAddress(a);

                  if (isAdmin(a)) {
                    navigate('/admin');
                  } else {
                    navigate('/cabinet');
                  }
                }}
              />
            }
          />
          <Route path="/cabinet" element={<Cabinet address={address} />} />
          <Route path="/deposit" element={<Deposit address={address} />} />
          <Route path="/withdraw" element={<Withdraw address={address} />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/admin/*" element={
            <AdminRoute address={address}>
              <Admin address={address} />
            </AdminRoute>
          } />
        </Routes>
      </main>


      <footer className="bg-gray-800 text-gray-400 text-center py-3">Спробуй удачу!</footer>
    </div>
  )
}