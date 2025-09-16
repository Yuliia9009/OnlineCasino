import React from 'react'
import { Link } from 'react-router-dom'


export default function Navbar({ address, onConnect }) {
    return (
        <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-2xl font-bold">🎰 Йти до казино!</Link>
                    <Link to="/feed" className="text-sm text-gray-300">Активність</Link>
                    <Link to="/cabinet" className="text-sm text-gray-300">Мій кабінет</Link>
                </div>
                <div>
                    {address ? (
                        <span className="text-green-400">
                            ✅ {address.slice(0, 6)}...{address.slice(-4)}
                        </span>
                    ) : (
                        <span className="text-red-400">❌ Гаманець не підключений</span>
                    )}
                </div>
            </div>
        </nav>
    )
}