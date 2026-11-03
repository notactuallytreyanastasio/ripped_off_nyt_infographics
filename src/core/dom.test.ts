import { h } from './dom';

describe('h', () => {
  it('creates an element with classes, attributes and text children', () => {
    const el = h('p', { class: 'dek', 'data-step': '2' }, 'Hello ', 'world');
    expect(el.tagName).toBe('P');
    expect(el.className).toBe('dek');
    expect(el.dataset['step']).toBe('2');
    expect(el.textContent).toBe('Hello world');
  });

  it('appends element children and skips null/false', () => {
    const el = h('div', {}, h('span', {}, 'a'), null, false, h('span', {}, 'b'));
    expect(el.children).toHaveLength(2);
    expect(el.textContent).toBe('ab');
  });

  it('is typed by tag name', () => {
    const input = h('input', { type: 'range' });
    // Compiles only because h('input') returns HTMLInputElement.
    input.valueAsNumber = 3;
    expect(input.type).toBe('range');
  });
});
