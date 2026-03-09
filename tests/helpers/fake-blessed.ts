/**
 * Minimal fake Blessed primitives for TUI tests
 */

type EventHandler = (...args: unknown[]) => unknown;

export class FakeBlessedElement {
  children: FakeBlessedElement[] = [];
  content = "";
  items: string[] = [];
  destroyed = false;
  focused = false;
  handlers = new Map<string, EventHandler[]>();
  askHandler?: (err: Error | null, value: string) => void;
  displayedMessage?: string;
  renderCount = 0;
  style: Record<string, unknown>;

  constructor(public readonly options: Record<string, unknown> = {}) {
    this.content = String(options.content || "");
    this.items = Array.isArray(options.items) ? (options.items as string[]) : [];
    this.style = (options.style as Record<string, unknown>) || {};

    const parent = options.parent as FakeBlessedElement | undefined;
    parent?.children.push(this);
  }

  on(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  key(keys: string[] | string, handler: EventHandler): void {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      this.on(`key:${key}`, handler);
    }
  }

  async emitAsync(event: string, ...args: unknown[]): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      await handler(...args);
    }
  }

  setContent(content: string): void {
    this.content = content;
  }

  getContent(): string {
    return this.content;
  }

  setScrollPerc(_perc: number): void {
    // no-op for fake
  }

  setItems(items: string[]): void {
    this.items = items;
  }

  focus(): void {
    this.focused = true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  render(): void {
    this.renderCount += 1;
  }

  focusNext(): void {
    this.focused = true;
  }

  focusPrevious(): void {
    this.focused = true;
  }

  display(message: string, _seconds: number, callback?: () => void): void {
    this.displayedMessage = message;
    callback?.();
  }

  ask(_prompt: string, handler: (err: Error | null, value: string) => void): void {
    this.askHandler = handler;
  }
}

export class FakeBlessedScreen extends FakeBlessedElement {}

export function createBlessedFactory(screen: FakeBlessedScreen) {
  return {
    screen: () => screen,
    box: (options: Record<string, unknown>) => new FakeBlessedElement(options),
    list: (options: Record<string, unknown>) => new FakeBlessedElement(options),
    button: (options: Record<string, unknown>) => new FakeBlessedElement(options),
    message: (options: Record<string, unknown>) => new FakeBlessedElement(options),
    question: (options: Record<string, unknown>) => new FakeBlessedElement(options),
  };
}

export function findChildByLabel(root: FakeBlessedElement, label: string): FakeBlessedElement | undefined {
  for (const child of root.children) {
    if (child.options.label === label) {
      return child;
    }

    const nested = findChildByLabel(child, label);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

export function findChildByContent(root: FakeBlessedElement, text: string): FakeBlessedElement | undefined {
  for (const child of root.children) {
    if (String(child.options.content || "").includes(text)) {
      return child;
    }

    const nested = findChildByContent(child, text);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}
