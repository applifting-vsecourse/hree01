import "@testing-library/jest-dom/vitest"

// jsdom has no ResizeObserver; Radix primitives (Select, RadioGroup) need one
// to measure themselves. Nothing in the tests depends on real sizes.
class ResizeObserverStub {
  observe(): void {
    // sizes never change in jsdom
  }
  unobserve(): void {
    // nothing was observed
  }
  disconnect(): void {
    // nothing to disconnect
  }
}
globalThis.ResizeObserver ??= ResizeObserverStub
