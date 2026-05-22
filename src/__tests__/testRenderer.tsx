import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

export const flushPendingWork = () =>
  new Promise<void>((resolve) => {
    const defer = (globalThis as typeof globalThis & {
      setImmediate?: (callback: () => void) => void;
    }).setImmediate;

    if (defer) {
      defer(resolve);
      return;
    }

    setTimeout(resolve, 0);
  });

export async function createWithAct(element: React.ReactElement): Promise<ReactTestRenderer> {
  let instance: ReactTestRenderer | undefined;

  await act(async () => {
    instance = create(element);
    await flushPendingWork();
    await Promise.resolve();
  });

  if (!instance) {
    throw new Error('Renderer was not created');
  }

  return instance;
}

export async function renderToJSON(element: React.ReactElement): Promise<ReturnType<ReactTestRenderer['toJSON']>> {
  const instance = await createWithAct(element);
  return instance.toJSON();
}
