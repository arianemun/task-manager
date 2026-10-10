/** فاصله‌ای که کیبورد از پایین layout viewport می‌پوشاند، بدون offset اسکرول visual viewport. */
export function keyboardOverlap(input: {
  innerHeight: number;
  offsetTop: number;
  height: number;
}): number {
  return Math.max(0, input.innerHeight - input.offsetTop - input.height);
}
