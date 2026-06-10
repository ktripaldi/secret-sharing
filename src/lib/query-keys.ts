// Centralized query-key factory (STANDARDS §3.3). Never hand-write keys inline.

export const queryKeys = {
  secrets: {
    all: ['secrets'] as const,
    peek: (id: string) => ['secrets', 'peek', id] as const,
  },
}
