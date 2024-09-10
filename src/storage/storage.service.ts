import type { User } from 'discord.js'
import { getCachedByIdOrCacheResult } from '../cache.service.js'
import { CONFIGURATION } from '../configuration.service.js'
import DATA_SOURCE from '../database.service.js'
import Pokemon from '../entities/Pokemon.js'
import { getPokemonDetails } from '../poke-api.service.js'

export async function getDatabasePokemonDetails(storedPokemon: Pokemon) {
	const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${storedPokemon.pokeAPIId.toString()}`, () =>
		getPokemonDetails(storedPokemon.pokeAPIId.toString()),
	).catch((error) => {
		if (error.response?.status !== 404) {
			console.error(
				`An error occured during fetch of pokemon's details ${storedPokemon.id} (#${storedPokemon.pokeAPIId})`,
				error,
			);
			return "error" as const;
		}
		return "unknown" as const;
	});

	if (pokemonDetails === "unknown" || pokemonDetails === "error") return { ...storedPokemon, error: pokemonDetails };
	return { ...storedPokemon, name: pokemonDetails.name };
}

export async function getPCMaxPage(targetUser: User) {
	return getCachedByIdOrCacheResult(`pc:max-page:${targetUser.id}`, async () => {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const count = await pokemons.count({ where: { storedBy: targetUser.id } });
		return Math.ceil(count / CONFIGURATION.storage.pokemonsPerPage);
	});
}

export async function getPCPagePokemons(
	targetUser: User,
	pageNumber: number,
): Promise<Array<Pokemon & ({ error: "unknown" | "error" } | { name: string })>> {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const targetUsersPokemons = await pokemons.find({
		where: { storedBy: targetUser.id },
		skip: pageNumber ? (pageNumber - 1) * CONFIGURATION.storage.pokemonsPerPage : 0,
		take: CONFIGURATION.storage.pokemonsPerPage,
		order: { id: "asc" },
	});

	if (targetUsersPokemons.length === 0) return [];

	return await Promise.all(targetUsersPokemons.map(getDatabasePokemonDetails));
}
