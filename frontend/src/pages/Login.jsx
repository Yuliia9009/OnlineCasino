import React from 'react'


export default function Login({ onConnect }) {
return (
<div className="max-w-xl mx-auto text-center py-20">
<h1 className="text-4xl font-bold mb-4">Ласкаво просимо до ігрового автомата</h1>
<p className="mb-6 text-gray-300">Увійдіть, використовуючи свій гаманець MetaMask.</p>
<button className="bg-indigo-600 px-6 py-3 rounded text-white" onClick={onConnect}>Підключити гаманець</button>
<div className="mt-8 text-sm text-gray-400">Після підключення ви потрапите до гральної кімнати.</div>
</div>
)
}