declare module "bcrypt" {
  const bcrypt: {
    hash(data: string, saltOrRounds: string | number): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
  };

  export default bcrypt;
}

declare module "bun:test" {
  type MaybePromise<T = void> = T | Promise<T>;

  export function describe(name: string, fn: () => MaybePromise): void;
  export function it(name: string, fn: () => MaybePromise): void;
  export function beforeEach(fn: () => MaybePromise): void;
  export function afterEach(fn: () => MaybePromise): void;

  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toMatch(expected: RegExp | string): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toHaveLength(expected: number): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    resolves: {
      toBeUndefined(): Promise<void>;
    };
    not: {
      toBe(expected: unknown): void;
      toContain(expected: unknown): void;
      toBeNull(): void;
    };
  };
}
