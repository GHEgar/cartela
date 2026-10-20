let probe: HTMLElement | null = null;

export function cssColor(color: string, scope?: Element): string {
    if (!color.includes('var(') || typeof document === 'undefined') return color;
    const host = scope ?? document.body ?? document.documentElement;
    probe ??= document.createElement('span');
    probe.hidden = true;
    host.appendChild(probe);
    probe.style.color = '';
    probe.style.color = color;
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved && !resolved.includes('var(') ? resolved : color;
}
