import { getCachedByIdOrCacheResult } from "../cache.service.js";
import * as PokeAPI from "../poke-api.service.js";

export async function getPokemonDetails(pokemonName: string) {
	return await getCachedByIdOrCacheResult(`pokemon:${pokemonName}`, () => PokeAPI.getPokemonDetails(pokemonName)).catch(
		(error) => {
			if (error.response?.status !== 404) {
				console.error(`An error occured during fetch of pokemon's details ${pokemonName})`);
				return "error" as const;
			}
			return "unknown" as const;
		},
	);
}
