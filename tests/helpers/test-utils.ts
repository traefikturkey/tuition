/**
 * Shared test utilities
 */

export interface ConsoleCapture {
  output: string[];
  restore: () => void;
}

export function captureConsoleLog(): ConsoleCapture {
  const output: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };

  return {
    output,
    restore: () => {
      console.log = originalLog;
    },
  };
}

export interface ExitStub {
  lastCode: () => number | undefined;
  restore: () => void;
}

export function stubProcessExit(): ExitStub {
  let exitCode: number | undefined;
  const originalExit = process.exit;

  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as typeof process.exit;

  return {
    lastCode: () => exitCode,
    restore: () => {
      process.exit = originalExit;
    },
  };
}

export interface PatchSet {
  patch: <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => void;
  restore: () => void;
}

export function createPatchSet(): PatchSet {
  const restorers: Array<() => void> = [];

  return {
    patch: <T extends object, K extends keyof T>(target: T, key: K, value: T[K]) => {
      const original = target[key];
      target[key] = value;
      restorers.push(() => {
        target[key] = original;
      });
    },
    restore: () => {
      while (restorers.length > 0) {
        const restore = restorers.pop();
        restore?.();
      }
    },
  };
}
