export function toWeiString(x) {
  if (x == null) return "0";
  return BigInt(String(x)).toString();
}
export function addWei(a, b) {
  return (BigInt(String(a ?? "0")) + BigInt(String(b ?? "0"))).toString();
}
export function subWei(a, b) {
  return (BigInt(String(a ?? "0")) - BigInt(String(b ?? "0"))).toString();
}
export function norm(addr) {
  return (addr || "").toLowerCase();
}