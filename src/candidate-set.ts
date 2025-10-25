import invariant from 'tiny-invariant'

export class CandidateSet {
  public readonly size: number
  protected readonly entries: CandidateSetEntry[] = []

  constructor(size = 5) {
    invariant(size > 0, 'Size must be a positive integer.')

    this.size = size
  }

  add(key: string, value: number): void {
    invariant(key, 'Key must be provided.')
    invariant(value, 'Value must be provided.')

    if (this.entries.length < this.size) {
      this.entries.push(new CandidateSetEntry(key, value))

      return
    }

    let minIndex = 0
    let minValue = this.entries[0].value

    for (let i = 1; i < this.entries.length; i++) {
      if (this.entries[i].value < minValue) {
        minValue = this.entries[i].value
        minIndex = i
      }
    }

    if (value > minValue) {
      this.entries[minIndex] = new CandidateSetEntry(key, value)
    }
  }

  count(): number {
    return this.entries.length
  }

  getEntries(): CandidateSetEntry[] {
    return this.entries.slice().sort((a, b) => b.value - a.value)
  }

  getKeys(): string[] {
    return this.getEntries().map((entry) => entry.key)
  }
}

class CandidateSetEntry {
  public readonly key: string
  public readonly value: number

  constructor(key: string, value: number) {
    this.key = key
    this.value = value
  }
}
