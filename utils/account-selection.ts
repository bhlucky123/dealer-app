export function changeDealerSelection<T>(value: T, setDealer: (value: T) => void, setAgent: (value: string) => void) {
  setDealer(value);
  setAgent("");
}
