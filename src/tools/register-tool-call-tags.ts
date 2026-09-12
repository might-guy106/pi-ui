import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ToolRegistrar = (pi: ExtensionAPI) => void | Promise<void>;
type ToolRegistrarModule = Record<string, ToolRegistrar>;

async function loadRegistrar(specifier: string, exportName: string): Promise<ToolRegistrar> {
	const module = await import(specifier) as ToolRegistrarModule;
	const register = module[exportName];
	if (typeof register !== "function") throw new Error(`Missing tool registrar ${exportName}`);
	return register;
}

export async function registerToolCallTags(pi: ExtensionAPI): Promise<void> {
	const registers = await Promise.all([
		loadRegistrar("./read.ts", "registerReadTool"),
		loadRegistrar("./write.ts", "registerWriteTool"),
		loadRegistrar("./edit.ts", "registerEditTool"),
		loadRegistrar("./ls.ts", "registerLsTool"),
		loadRegistrar("./find.ts", "registerFindTool"),
		loadRegistrar("./grep.ts", "registerGrepTool"),
		loadRegistrar("./bash.ts", "registerBashTool"),
	]);
	await Promise.all(registers.map((register) => register(pi)));
}
