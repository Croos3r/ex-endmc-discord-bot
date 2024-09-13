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

const MultiplierSchema = z
	.object({
		type: z.literal("status"),
		statusText: z.string(),
		requiredMinStatusDuration: z.number().int().min(1).default(86400),
	})
	.or(
		z.object({
			type: z.literal("message"),
			messageText: z.string(),
		}),
	)
	.or(
		z.object({
			type: z.enum(["wonBattle", "lostBattle", "joinedGuild"]),
		}),
	)
	.and(
		z.object({
			multiplier: z.number(),
			multiplierDuration: z.number().int().min(1).optional(),
			cooldownDuration: z.number().int().min(1).optional(),
		}),
	);

export const ConfigurationSchema = z
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
				experiencePerSecondsInVoiceChannel: z.string().default("1 / level"),
				experiencePerLevel: z.string().default("level * 100"),
				experiencePerWonBattle: z.string().default("level * 100"),
				experiencePerLostBattle: z.string().default("-1"),
				abilityPointsPerLevel: AbilityPointsPerLevelSchema.default({}),
				multipliers: z.record(z.string(), MultiplierSchema).default({}),
			})
			.default({}),
	})
	.default({});

export type Configuration = z.infer<typeof ConfigurationSchema>;

export async function loadConfiguration(): Promise<Configuration> {
	const file = await readFile("configuration.yaml", "utf-8");
	const parsed = parse(file) ?? {};
	return ConfigurationSchema.parse(parsed);
}

export const CONFIGURATION = await loadConfiguration();
