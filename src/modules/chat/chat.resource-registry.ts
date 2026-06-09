import { ResourceDefinition } from './chat.types.js';

class ResourceRegistry {
    private resources = new Map<string, ResourceDefinition>();

    register(resource: ResourceDefinition): void {
        if (this.resources.has(resource.name)) {
            throw new Error(`Resource "${resource.name}" already registered`);
        }
        this.resources.set(resource.name, resource);
    }

    get(name: string): ResourceDefinition | undefined {
        return this.resources.get(name);
    }

    all(): ResourceDefinition[] {
        return [...this.resources.values()];
    }

    describe(): string {
        return this.all()
            .map((r) => `- ${r.name}: ${r.description}`)
            .join('\n');
    }
}

export const resourceRegistry = new ResourceRegistry();
