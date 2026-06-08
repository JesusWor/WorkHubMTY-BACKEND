import { ToolDefinition, ServerToolDefinition, ClientToolDefinition } from './chat.types.js';

class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();

    register<TSchema extends ServerToolDefinition['schema']>(tool: ServerToolDefinition<TSchema>): void;
    register<TSchema extends ClientToolDefinition['schema']>(tool: ClientToolDefinition<TSchema>): void;
    register(tool: ToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" already registered`);
        }
        this.tools.set(tool.name, tool);
    }

    get(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    asServerTool(name: string): ServerToolDefinition | undefined {
        const t = this.tools.get(name);
        return t?.target === 'SERVER' ? (t as ServerToolDefinition) : undefined;
    }

    asClientTool(name: string): ClientToolDefinition | undefined {
        const t = this.tools.get(name);
        return t?.target === 'CLIENT' ? (t as ClientToolDefinition) : undefined;
    }

    /** All tools (SERVER + CLIENT) — used to build Gemini FunctionDeclarations */
    all(): ToolDefinition[] {
        return [...this.tools.values()];
    }
}

export const toolRegistry = new ToolRegistry();
