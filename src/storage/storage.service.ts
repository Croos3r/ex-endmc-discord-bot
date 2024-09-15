import type { User } from "discord.js";
import { getCachedByIdOrCacheResult, invalidateCache } from "../cache.service.js";
import { CONFIGURATION } from "../configuration.service.js";
import { DATA_SOURCE } from "../database.service.js";
import Pokemon from "../entities/Pokemon.js";
import { type PokemonDetails, getPokemonDetails } from "../poke-api.service.js";

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

export async function getPCMaxPage(trainer: User) {
	return getCachedByIdOrCacheResult(`pc:max-page:${trainer.id}`, async () => {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const count = await pokemons.count({ where: { storedBy: trainer.id } });
		return Math.ceil(count / CONFIGURATION.storage.pokemonsPerPage);
	});
}

export async function getPCPagePokemons(
	trainer: User,
	pageNumber: number,
): Promise<Array<Pokemon & ({ error: "unknown" | "error" } | { name: string })>> {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const targetUsersPokemons = await pokemons.find({
		where: { storedBy: trainer.id },
		skip: pageNumber ? (pageNumber - 1) * CONFIGURATION.storage.pokemonsPerPage : 0,
		take: CONFIGURATION.storage.pokemonsPerPage,
		order: { id: "asc" },
	});

	if (targetUsersPokemons.length === 0) return [];

	return await Promise.all(targetUsersPokemons.map(getDatabasePokemonDetails));
}

export async function setPokemonStored(trainer: User, pokemonId: number) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	await invalidateCache(`pc:max-page:${trainer.id}`);
	await invalidateCache(`inventory:full:${trainer.id}`);
	return await pokemons.update({ heldBy: trainer.id, id: pokemonId }, { heldBy: null, storedBy: trainer.id });
}

export async function getStoredPokemon(trainer: User, pokemonId: number) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	return await pokemons.findOne({ where: { storedBy: trainer.id, id: pokemonId } });
}

export async function getPokemon(trainer: User, pokemonId: number) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	return await pokemons.findOne({
		where: [
			{ id: pokemonId, storedBy: trainer.id },
			{ id: pokemonId, heldBy: trainer.id },
		],
	});
}

export async function createPokemon(trainer: User, pokemonDetails: PokemonDetails) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	const pokemon = pokemons.create({
		pokeAPIId: pokemonDetails.id,
		storedBy: trainer.id,
		health: pokemonDetails.stats.find((stat) => stat.name === "HP")?.stat ?? 0,
		attack: pokemonDetails.stats.find((stat) => stat.name === "Attack")?.stat ?? 0,
		defense: pokemonDetails.stats.find((stat) => stat.name === "Defense")?.stat ?? 0,
		specialAttack: pokemonDetails.stats.find((stat) => stat.name === "Special-attack")?.stat ?? 0,
		specialDefense: pokemonDetails.stats.find((stat) => stat.name === "Special-defense")?.stat ?? 0,
		speed: pokemonDetails.stats.find((stat) => stat.name === "Speed")?.stat ?? 0,
	});
	await invalidateCache(`pc:max-page:${trainer.id}`);
	return await pokemons.save(pokemon);
}

export async function removePokemon(pokemon: Pokemon) {
	const pokemons = DATA_SOURCE.getRepository(Pokemon);
	await invalidateCache(`pc:max-page:${pokemon.storedBy}`);
	return await pokemons.remove(pokemon);
}
