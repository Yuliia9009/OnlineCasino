import { ethers } from 'ethers'
import { fetchHistory } from './api'

let provider = null
let signer = null
let currentAddress = null

export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'
export const CONTRACT_ABI = [ /* ... replace with actual ABI ... */ ]
export const ADMINS = []

export function isAdmin(address) {
  if (!address) return false
  return ADMINS.includes(address.toLowerCase())
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No MetaMask')
  provider = new ethers.BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  signer = await provider.getSigner()
  currentAddress = await signer.getAddress()
  return currentAddress
}

export function onAccountChange(cb) {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) cb(null)
      else cb(accounts[0])
    })
  }
}

export async function getBalance(address) {
  // if contract exists, query it. For now return mock
  return (Math.random() * 2).toFixed(5)
}

export async function getHistory(address) {
  return fetchHistory(address)
}

export async function spinSlot() {
  // If contract is deployed, call contract.spin({ value: ... }) using signer
  // For now we return a deterministic random mock
  const symbols = ['🍒','🍋','🍊','⭐','7️⃣']
  const res = Array.from({length:3}, () => symbols[Math.floor(Math.random()*symbols.length)])
  const win = (res[0] === res[1] && res[1] === res[2]) ? (Math.random() * 0.1).toFixed(5) : '0'
  return { result: res, win }
}

export async function deposit(amount) {
  // call contract or backend
  // mock a delay
  await new Promise(r => setTimeout(r, 800))
  return { status: 'ok' }
}

export async function withdraw(amount) {
  await new Promise(r => setTimeout(r, 800))
  return { status: 'ok' }
}