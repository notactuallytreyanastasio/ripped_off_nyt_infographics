import { select } from 'd3';
import { createTooltip } from './tooltip';

afterEach(() => { document.body.innerHTML = ''; });

describe('createTooltip', () => {
  it('shows text safely, hides, and cleans up after itself', () => {
    const box = document.createElement('div');
    document.body.append(box);
    const tt = createTooltip(box);
    expect(box.style.position).toBe('relative');
    tt.show('<b>not html</b>', 20, 40);
    expect(tt.element.hidden).toBe(false);
    expect(tt.element.querySelector('b')).toBeNull();
    expect(tt.element.textContent).toBe('<b>not html</b>');
    tt.hide();
    expect(tt.element.hidden).toBe(true);
    tt.destroy();
    expect(box.querySelector('.tooltip')).toBeNull();
    expect(box.style.position).toBe('');
    expect(() => tt.show('x', 0, 0)).toThrow(/after destroy/);
  });

  it('binds to a selection and unbinds on destroy', () => {
    const box = document.createElement('div');
    document.body.append(box);
    const svg = select(box).append('svg');
    const dots = svg.selectAll('circle').data([{ name: 'Akron' }]).join('circle');
    const tt = createTooltip(box);
    tt.bind(dots, (d) => d.name);
    (dots.node() as Element).dispatchEvent(new Event('pointerenter'));
    expect(tt.element.textContent).toBe('Akron');
    (dots.node() as Element).dispatchEvent(new Event('pointerleave'));
    expect(tt.element.hidden).toBe(true);
    tt.destroy();
    expect(dots.on('pointerenter.kit-tooltip')).toBeUndefined();
  });
});
