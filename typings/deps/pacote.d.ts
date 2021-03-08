declare module "pacote" {
  export function manifest(
    dependency: string,
    opts?: Record<string, any>,
  ): Promise<{ [key: string]: string }>;
}
