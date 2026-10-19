const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©' };

export function plainText(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&(#\d+|[a-z]+);/gi, (entity, name: string) => {
            if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
            return ENTITIES[name.toLowerCase()] ?? entity;
        })
        .replace(/\s+/g, ' ')
        .trim();
}
