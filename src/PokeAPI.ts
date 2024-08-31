import axios from 'axios'

const AXIOS_INSTANCE = axios.create({
	baseURL: "https://pokeapi.co/api/v2/",
	responseType: "json",
});

export type NamedAPIResource = {
	name: string;
	url: string;
};

export type PokemonHabitat = NamedAPIResource;
export type PokemonAbility = { ability: NamedAPIResource };
export type PokemonType = NamedAPIResource;
export type PokemonColor = NamedAPIResource;
export type PokemonEggGroup = NamedAPIResource;
export type PokemonStat = { stat: NamedAPIResource; base_stat: number };

export type PokemonSpecies = NamedAPIResource & {
	capture_rate: number;
	habitat: PokemonHabitat | null;
	egg_groups: Array<PokemonEggGroup>;
	color: PokemonColor;
};

export type PokemonFormType = {
	order: number;
	type: PokemonType;
};

export type PokemonSprites = {
	front_default: string;
};

export type Pokemon = NamedAPIResource & {
	id: number;
	species: PokemonSpecies;
	abilities: Array<PokemonAbility>;
	types: Array<PokemonFormType>;
	sprites: PokemonSprites;
	stats: Array<PokemonStat>;
};

export async function getPokemon(pokemonNameOrId: string): Promise<Pokemon> {
	const response = await AXIOS_INSTANCE.get(`pokemon/${pokemonNameOrId}`);
	return response.data;
}

export async function getPokemonSpecies(
	speciesName: string,
): Promise<PokemonSpecies> {
	const response = await AXIOS_INSTANCE.get(`pokemon-species/${speciesName}`);
	return response.data;
}

export type PokemonDetails = {
	name: string;
	id: number;
	spriteURL: string;
	species: string;
	abilities: Array<string>;
	color: string;
	captureRate: number;
	habitat: string | null;
	types: Array<string>;
	eggGroups: Array<string>;
	stats: Array<{ name: string; stat: number }>;
};

export async function getPokemonDetails(
	pokemonNameOrId: string,
): Promise<PokemonDetails> {
	const pokemon = await getPokemon(pokemonNameOrId);
	const pokemonSpecies = await getPokemonSpecies(pokemon.species.name);
	return {
		name: capitalizeFirstLetter(pokemon.name),
		id: pokemon.id,
		spriteURL: pokemon.sprites.front_default,
		species: capitalizeFirstLetter(pokemonSpecies.name),
		abilities: pokemon.abilities.map(({ ability: { name } }) =>
			capitalizeFirstLetter(name),
		),
		color: capitalizeFirstLetter(pokemonSpecies.color.name),
		captureRate: pokemonSpecies.capture_rate,
		habitat: pokemonSpecies.habitat
			? capitalizeFirstLetter(pokemonSpecies.habitat.name)
			: null,
		types: pokemon.types.map((type) => capitalizeFirstLetter(type.type.name)),
		eggGroups: pokemonSpecies.egg_groups.map((eggGroup) =>
			capitalizeFirstLetter(eggGroup.name),
		),
		stats: pokemon.stats.map(({ stat: { name }, base_stat }) => ({
			name: capitalizeFirstLetter(name),
			stat: base_stat,
		})),
	};
}

function capitalizeFirstLetter(string: string): string {
	return string.charAt(0).toUpperCase() + string.slice(1);
}
