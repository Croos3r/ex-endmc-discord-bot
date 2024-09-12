import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const AbilityPointsPerLevelSchema = z
	.object({
		min: z.number().int().min(1).max(255).default(1),
		max: z.number().int().min(1).max(255).default(5),
	})
	.refine(({ min, max }) => min <= max, {
		message: "min must be less than or equal to max",
	})
	.default({});

const ConfigurationSchema = z
	.object({
		inventory: z
			.object({
				size: z.number().int().min(1).max(25).default(3),
			})
			.default({}),
		storage: z
			.object({
				pokemonsPerPage: z.number().int().min(1).max(25).default(24),
			})
			.default({}),
		leveling: z
			.object({
				experienceGainCooldown: z.number().int().min(1).default(10),
				experiencePerMessage: z.string().default("1 / level * 10"),
				experiencePerLevel: z.string().default("level * 100"),
				abilityPointsPerLevel: AbilityPointsPerLevelSchema.default({}),
			})
			.default({}),
	})
	.default({});

export type ConfigurationService = z.infer<typeof ConfigurationSchema>;

export async function loadConfiguration(): Promise<ConfigurationService> {
	const file = await readFile("configuration.yaml", "utf-8");
	const parsed = parse(file) ?? {};
	return ConfigurationSchema.parse(parsed);
}

export const CONFIGURATION = await loadConfiguration();
