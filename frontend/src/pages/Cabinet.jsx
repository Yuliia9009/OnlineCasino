// File: src/pages/Cabinet.jsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Reel from '../components/Reel'
import Balance from '../components/Balance'
import Result from '../components/Result'
import { getBalance, spinSlot, getHistory } from '../utils/web3'

export default function Cabinet({ address }) {
  const [balance, setBalance] = useState('0')
  const [bet, setBet] = useState('0.01')
  const [symbols, setSymbols] = useState(['🍒','🍒','🍒'])
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState('')
  const [frozen, setFrozen] = useState([false, false, false]) // які барабани заморожені

  const symbolsList = ['🍒','🍋','🍊','⭐','7️⃣']

  useEffect(() => {
    if (!address) return
    ;(async () => {
      setBalance(await getBalance(address))
      setHistory(await getHistory(address))
    })()
  }, [address])

  // Перемикання заморозки барабана
  function toggleFreeze(index) {
    if (spinning) return
    const countFrozen = frozen.filter(f => f).length

    // максимум 2 заморозки
    if (!frozen[index] && countFrozen >= 2) return

    const cost = parseFloat(bet) * Math.pow(2, countFrozen) // 1 заморозка = bet*2, 2 заморозки = bet*4
    if (!frozen[index] && parseFloat(balance) < cost) {
      setError('Недостатньо коштів для заморозки')
      return
    }

    setBalance(prev => {
      if (!frozen[index]) return (parseFloat(prev) - cost).toFixed(5)
      return prev
    })

    const newFrozen = [...frozen]
    newFrozen[index] = !newFrozen[index]
    setFrozen(newFrozen)
    setError('')
  }

  // Обертання
  async function handleSpin() {
    setError('')
    if (spinning) return
    if (parseFloat(balance) < parseFloat(bet)) {
      setError('Недостатньо коштів для ставки')
      return
    }

    setSpinning(true)
    setResult(null)

    const res = await spinSlot() // нові символи

    let iter = 0
    const interval = setInterval(() => {
      setSymbols(prev => prev.map((s, idx) => frozen[idx] ? s : symbolsList[(iter + idx + 1) % symbolsList.length]))
      iter++
      if (iter > 12) {
        clearInterval(interval)

        // Фінальний результат з урахуванням заморожених барабанів
        const finalResult = res.result.map((s, idx) => frozen[idx] ? symbols[idx] : s)

        // Розрахунок виграшу: якщо всі три символи однакові
        const winAmount = (finalResult[0] === finalResult[1] && finalResult[1] === finalResult[2])
                          ? (Math.random() * 0.1).toFixed(5)
                          : '0'

        setSymbols(finalResult)
        setResult(winAmount)
        setSpinning(false)
        setFrozen([false, false, false])

        // Оновлюємо баланс
        setBalance(prev => {
          const prevNum = parseFloat(prev)
          const winNum = parseFloat(winAmount)
          const newBalance = winNum > 0 ? prevNum + winNum : prevNum - parseFloat(bet)
          return newBalance.toFixed(5)
        })

        // Додаємо в історію
        setHistory(prev => [
          {
            id: Date.now(),
            time: new Date().toISOString(),
            bet,
            win: winAmount,
            result: finalResult
          },
          ...prev
        ])
      }
    }, 80)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Гральна кімната</h2>
        <div className="flex gap-3">
          <Link to="/deposit" className="px-3 py-1 bg-blue-600 rounded">Депозит</Link>
          <Link to="/withdraw" className="px-3 py-1 bg-yellow-600 rounded">Зняти гроші</Link>
        </div>
      </div>

      <Balance balance={balance} />

      {/* Ставка */}
      <div className="my-4 flex items-center gap-3">
        <label className="text-gray-300">Ставка (ETH):</label>
        <input 
          type="number" 
          min="0.01" 
          step="0.01" 
          value={bet} 
          onChange={e => setBet(e.target.value)} 
          className="w-24 p-2 bg-gray-900 rounded"
        />
      </div>

      <div className="bg-gray-800 rounded p-6 my-6">
        {/* Барабани + кнопки заморозки */}
        <div className="flex justify-center gap-4 mb-4">
          {symbols.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <Reel symbol={s} />
              <button
                onClick={() => toggleFreeze(i)}
                disabled={spinning || (!frozen[i] && frozen.filter(f => f).length >= 2)}
                className={`mt-2 px-3 py-1 rounded text-sm ${frozen[i] ? 'bg-yellow-500' : 'bg-gray-600'}`}
              >
                {frozen[i] ? 'Заморожено' : 'Заморозити'}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button 
            onClick={handleSpin} 
            disabled={spinning || parseFloat(balance) <= 0} 
            className="bg-red-600 px-6 py-2 rounded text-white"
          >
            {spinning ? 'Очікуйте результат...' : 'Зробити оберт'}
          </button>
          {error && <div className="text-red-400 mt-2">{error}</div>}
        </div>
        <div className="mt-4"><Result win={result} /></div>
      </div>

      <h3 className="text-xl mb-2">Історія</h3>
      <div className="space-y-2">
        {history.length === 0 && <div className="text-gray-400">Ігри відсутні</div>}
        {history.map(h => (
          <div key={h.id} className="bg-gray-800 p-3 rounded flex justify-between">
            <div>
              <div className="text-sm text-gray-300">{new Date(h.time).toLocaleString()}</div>
              <div className="font-medium">Результат: {h.result.join(' ')}</div>
            </div>
            <div className="text-right">
              <div>{parseFloat(h.win) > 0 ? `Виграш ${h.win} ETH` : `Програш ${h.bet} ETH`}</div>
              <div className="text-sm text-gray-400">Ставка: {h.bet} ETH</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}