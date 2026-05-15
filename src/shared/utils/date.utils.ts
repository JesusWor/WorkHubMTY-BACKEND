export function toMysqlUtc(datetime: string): string {
    return new Date(datetime)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
}