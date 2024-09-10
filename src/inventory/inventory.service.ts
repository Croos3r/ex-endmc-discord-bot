import type { User } from 'discord.js'
import { getCachedByIdOrCacheResult } from '../cache.service.js'
import { CONFIGURATION } from '../configuration.service.js'
import DATA_SOURCE from '../database.service.js'
import Pokemon from '../entities/Pokemon.js'
import { getDatabasePokemonDetails } from '../storage/storage.service.js'

export async function isInventoryFull(targetUser: User) {
	return await getCachedByIdOrCacheResult(`inventory:full:${targetUser.id}`, async () => {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		return (await pokemons.count({ where: { heldBy: targetUser.id } })) >= CONFIGURATION.inventory.size;
	});
}

export async function getInventoryPokemons(targetUser: User) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const targetUsersInventoryPokemons = await pokemons.find({
		where: { heldBy: targetUser.id },
		take: CONFIGURATION.inventory.size,
	});
	if (targetUsersInventoryPokemons.length === 0) return [];

	return await Promise.all(targetUsersInventoryPokemons.map(getDatabasePokemonDetails));
}
