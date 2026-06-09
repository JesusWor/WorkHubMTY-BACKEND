import { ZodTypeAny } from 'zod';
import { Content, FunctionDeclaration, SchemaType, Tool } from '@google/generative-ai';
import { ToolDefinition, HistoryMessage } from './chat.types.js';

type ZodDef = {
    type?: string;
    shape?: Record<string, ZodTypeAny>;
    element?: ZodTypeAny;
    innerType?: ZodTypeAny;
    out?: ZodTypeAny;
    entries?: Record<string, string>;
    checks?: Array<{ isInt?: boolean }>;
    value?: string | number | boolean;
};

function getDef(schema: ZodTypeAny): ZodDef {
    return (schema as unknown as { def: ZodDef }).def;
}

function getDescription(schema: ZodTypeAny): string | undefined {
    return (schema as unknown as { meta?: () => { description?: string } }).meta?.()?.description;
}

function isOptionalLike(schema: ZodTypeAny): boolean {
    const type = getDef(schema).type;
    return type === 'optional' || type === 'default' || type === 'prefault' || type === 'catch';
}

function unwrap(schema: ZodTypeAny): ZodTypeAny {
    const def = getDef(schema);

    if (
        def.type === 'optional' ||
        def.type === 'default' ||
        def.type === 'prefault' ||
        def.type === 'catch' ||
        def.type === 'nullable' ||
        def.type === 'readonly' ||
        def.type === 'nonoptional'
    ) {
        return def.innerType ? unwrap(def.innerType) : schema;
    }

    if (def.type === 'pipe') {
        return def.out ? unwrap(def.out) : schema;
    }

    return schema;
}

function withDescription(schema: ZodTypeAny, payload: Record<string, unknown>): Record<string, unknown> {
    const description = getDescription(schema);
    return description ? { ...payload, description } : payload;
}

export function zodToGeminiSchema(schema: ZodTypeAny): Record<string, unknown> {
    const inner = unwrap(schema);
    const def = getDef(inner);

    if (def.type === 'object') {
        const shape = def.shape ?? (inner as unknown as { shape: Record<string, ZodTypeAny> }).shape;
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
            properties[key] = zodToGeminiSchema(value);
            if (!isOptionalLike(value)) required.push(key);
        }

        return withDescription(inner, {
            type: SchemaType.OBJECT,
            properties,
            ...(required.length > 0 ? { required } : {}),
        });
    }

    if (def.type === 'array') {
        return withDescription(inner, {
            type: SchemaType.ARRAY,
            items: zodToGeminiSchema(def.element ?? (inner as unknown as { element: ZodTypeAny }).element),
        });
    }

    if (def.type === 'string' || def.type === 'date') {
        return withDescription(inner, { type: SchemaType.STRING });
    }

    if (def.type === 'number') {
        const isInt = Boolean((inner as unknown as { isInt?: boolean }).isInt)
            || def.checks?.some((check) => check.isInt);
        return withDescription(inner, {
            type: isInt ? SchemaType.INTEGER : SchemaType.NUMBER,
        });
    }

    if (def.type === 'boolean') {
        return withDescription(inner, { type: SchemaType.BOOLEAN });
    }

    if (def.type === 'enum') {
        return withDescription(inner, {
            type: SchemaType.STRING,
            enum: Object.values(def.entries ?? {}),
        });
    }

    if (def.type === 'literal') {
        const value = def.value;
        if (typeof value === 'string') return withDescription(inner, { type: SchemaType.STRING, enum: [value] });
        if (typeof value === 'number') return withDescription(inner, { type: SchemaType.NUMBER, enum: [value] });
        if (typeof value === 'boolean') return withDescription(inner, { type: SchemaType.BOOLEAN, enum: [value] });
    }

    return withDescription(inner, { type: SchemaType.STRING });
}

export function buildFunctionDeclarations(tools: ToolDefinition[]): Tool {
    const declarations: FunctionDeclaration[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToGeminiSchema(tool.schema) as unknown as FunctionDeclaration['parameters'],
    }));
    return { functionDeclarations: declarations };
}

export function buildGeminiHistory(messages: HistoryMessage[]): Content[] {
    return messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
}
