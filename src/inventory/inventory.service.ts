import type { User } from "discord.js";
import { getCachedByIdOrCacheResult, invalidateCache, isDelayKeyActive, setDelayKey } from "../cache.service.js";
import { CONFIGURATION } from "../configuration.service.js";
import { DATA_SOURCE } from "../database.service.js";
import Pokemon from "../entities/Pokemon.js";
import { getDatabasePokemonDetails } from "../storage/storage.service.js";

export async function isInventoryFull(trainer: User) {
	return await getCachedByIdOrCacheResult(`inventory:full:${trainer.id}`, async () => {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		return (await pokemons.count({ where: { heldBy: trainer.id } })) >= CONFIGURATION.inventory.size;
	});
}

export async function getInventoryPokemons(trainer: User) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const targetUsersInventoryPokemons = await pokemons.find({
		where: { heldBy: trainer.id },
		take: CONFIGURATION.inventory.size,
	});
	if (targetUsersInventoryPokemons.length === 0) return [];

	return await Promise.all(targetUsersInventoryPokemons.map(getDatabasePokemonDetails));
}

export async function getHeldPokemon(trainer: User, pokemonId: number) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	return await pokemons.findOne({ where: { heldBy: trainer.id, id: pokemonId } });
}

export async function setPokemonHeld(trainer: User, pokemonId: number) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	await invalidateCache(`pc:max-page:${trainer.id}`);
	await invalidateCache(`inventory:full:${trainer.id}`);
	return await pokemons.update({ storedBy: trainer.id, id: pokemonId }, { heldBy: trainer.id, storedBy: null });
}

export async function getAllHeldPokemons(trainer: User) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	return await pokemons.find({ where: { heldBy: trainer.id }, take: CONFIGURATION.inventory.size });
}

export async function updateAllHeldPokemonsExperienceAndStats(trainer: User) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const heldPokemons = await getAllHeldPokemons(trainer);

	return await pokemons.save(
		await Promise.all(heldPokemons.map((pokemon) => updateHeldPokemonExperienceAndStats(trainer, pokemon))),
	);
}

// noinspection JSUnusedLocalSymbols: can be used in eval in configuration
export async function updateHeldPokemonExperienceAndStats(
	trainer: User,
	{ level, experience, health, attack, defense, specialAttack, specialDefense, speed, ...rest }: Pokemon,
) {
	// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
	experience += Math.ceil(eval(CONFIGURATION.leveling.experiencePerMessage));

	let stats = [health, attack, defense, specialAttack, specialDefense, speed];
	// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
	if (experience >= Math.ceil(eval(CONFIGURATION.leveling.experiencePerLevel))) {
		experience = 0;
		level++;
		stats = stats.map(
			(stat) =>
				stat +
				CONFIGURATION.leveling.abilityPointsPerLevel.min +
				Math.ceil(
					Math.random() * CONFIGURATION.leveling.abilityPointsPerLevel.max -
						CONFIGURATION.leveling.abilityPointsPerLevel.min,
				),
		);
		await trainer.send(
			`Your pokemon No. ${rest.id} (#${rest.pokeAPIId}) has leveled up to level ${level} you can check its new stat with /pc pokemon view ${rest.id}`,
		);
	}
	const [newHealth, newAttack, newDefense, newSpecialAttack, newSpecialDefense, newSpeed] = stats;

	return {
		...rest,
		level,
		experience,
		health: newHealth,
		attack: newAttack,
		defense: newDefense,
		specialAttack: newSpecialAttack,
		specialDefense: newSpecialDefense,
		speed: newSpeed,
	};
}

export async function isExperienceOnCooldown(user: User) {
	return await isDelayKeyActive(`experience-delay:${user.id}`);
}

export async function setExperienceCooldown(user: User) {
	await setDelayKey(`experience-delay:${user.id}`, CONFIGURATION.leveling.experienceGainCooldown);
}
