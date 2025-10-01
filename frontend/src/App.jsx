import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, NavLink } from 'react-router-dom';
import Login from './pages/Login';
import Cabinet from './pages/Cabinet';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import Feed from './pages/Feed';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import AdminRoute from './components/AdminRoute';
import { connectWallet, onAccountChange, isAdmin } from './utils/web3';
import Presentation from './pages/Presentation';

export default function App() {
  const [address, setAddress] = useState(null);
  const navigate = useNavigate();

  // единая точка после успешного подключения/смены аккаунта
  const handleConnected = useCallback((addr) => {
    setAddress(addr);
    const path = window.location.pathname;

    if (!addr) {
      navigate('/');
      return;
    }

    if (path === '/presentation') return;

    if (isAdmin(addr)) {
      // если админ зашёл с корня — ведём в админку
      if (path === '/' || path === '') {
        navigate('/admin');
      }
      return;
    }

    // не админ — если он на корне, ведём в кабинет
    if (path === '/' || path === '') {
      navigate('/cabinet');
      return;
    }

    // запрет для чужаков в админке
    if (path.startsWith('/admin') && !isAdmin(addr)) {
      alert('У вас немає прав доступу до адмін-панелі.');
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    onAccountChange(handleConnected);
  }, [handleConnected]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        address={address}
        onConnect={async () => {
          const a = await connectWallet();
          handleConnected(a);
        }}
        extraLinks={[{ to: '/presentation', label: 'Презентація' }]}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Routes>
          <Route
            path="/"
            element={
              <Login
                onConnect={async () => {
                  const a = await connectWallet();
                  handleConnected(a);
                }}
              />
            }
          />
          <Route path="/cabinet" element={<Cabinet address={address} />} />
          <Route path="/deposit" element={<Deposit address={address} />} />
          <Route path="/withdraw" element={<Withdraw address={address} />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/presentation" element={<Presentation />} />
          <Route
            path="/admin/*"
            element={
              <AdminRoute address={address}>
                <Admin address={address} />
              </AdminRoute>
            }
          />
        </Routes>
      </main>

      <footer className="bg-gray-800 text-gray-400 text-center py-3">
        Спробуй удачу!
      </footer>
    </div>
  );
}