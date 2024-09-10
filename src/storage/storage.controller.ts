import {
	ApplicationCommandOptionType,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	type User,
} from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { getCachedByIdOrCacheResult, invalidateCache } from '../cache.service.js'
import DATA_SOURCE from '../database.service.js'
import Pokemon from '../entities/Pokemon.js'
import {
	createContentMessage,
	createEmptyPCMessage,
	createEphemeralContentMessage,
	createEphemeralMessage,
	createPCPageMessage,
	createPCPokemonViewMessage,
} from '../helpers/ui.js'
import { getPokemonDetails } from '../poke-api.service.js'
import { getPCMaxPage, getPCPagePokemons } from './storage.service.js'

@Discord()
@SlashGroup({ name: "pc", description: "PC commands" })
@SlashGroup({ name: "storage", description: "Storage commands", root: "pc" })
@SlashGroup("storage", "pc")
export class StorageController {
	static async getPCPageComponents(targetUser: User, pageNumber: number) {
		const pcPagePokemons = await getPCPagePokemons(targetUser, pageNumber);
		const maxPage = await getPCMaxPage(targetUser);
		if (maxPage === 0) return createEmptyPCMessage(targetUser);
		if (pageNumber > maxPage) return createContentMessage(`Page ${pageNumber} not found`);
		return createPCPageMessage(targetUser, pageNumber, maxPage, pcPagePokemons);
	}

	static async getPokemonViewMessage(targetUser: User, pokemonId: number) {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const pokemon = await pokemons.findOne({
			where: [
				{ id: pokemonId, storedBy: targetUser.id },
				{ id: pokemonId, heldBy: targetUser.id },
			],
		});
		if (!pokemon) return createContentMessage(`Pokemon #${pokemonId} not found in **${targetUser.displayName}**'s PC`);

		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemon.pokeAPIId}`, () =>
			getPokemonDetails(pokemon.pokeAPIId.toString()),
		).catch((error) => {
			if (error.response?.status !== 404) {
				console.error(
					`An error occured during fetch of pokemon's details ${pokemon.id} (#${pokemon.pokeAPIId})`,
					error,
				);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown" || pokemonDetails === "error")
			return createContentMessage(`Pokemon #${pokemon.pokeAPIId} not found`);
		return createPCPokemonViewMessage(targetUser, pokemonDetails, pokemon);
	}

	@ButtonComponent({ id: /pokemon-view-\d+-\d+/ })
	async viewPokemon(interaction: ButtonInteraction) {
		const [pokemonId, userId] = interaction.customId.split("-").slice(2);
		const targetUser = await interaction.client.users.fetch(userId);
		if (!targetUser) return await interaction.reply({ content: "User not found", ephemeral: true });
		const pokemonViewComponents = await StorageController.getPokemonViewMessage(targetUser, Number.parseInt(pokemonId));

		await interaction.update(pokemonViewComponents);
	}

	@ButtonComponent({ id: /pc-page-\d+-\d+/ })
	async viewPCPage(interaction: ButtonInteraction) {
		const [pageNumber, userId] = interaction.customId.split("-").slice(2);
		const targetUser = await interaction.client.users.fetch(userId);
		if (!targetUser) return await interaction.reply({ content: "User not found", ephemeral: true });
		const pcPageComponents = await StorageController.getPCPageComponents(targetUser, Number.parseInt(pageNumber));

		await interaction.update(pcPageComponents);
	}

	@Slash({ description: "View an user's PC stored specific pokemon or list of pokemons" })
	async view(
		@SlashOption({
			name: "user",
			description: "User to view",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		user: User | undefined,
		@SlashOption({
			name: "page",
			description: "Page number",
			required: false,
			type: ApplicationCommandOptionType.Integer,
		})
		pageNumber: number | undefined,
		@SlashOption({
			name: "pokemon-id",
			description: "ID of the Pokemon to view",
			required: false,
			type: ApplicationCommandOptionType.Integer,
		})
		pokemonId: number | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;

		if (pokemonId === undefined) {
			const pcPageComponents = await StorageController.getPCPageComponents(targetUser, pageNumber ?? 1);
			return await interaction.reply(createEphemeralMessage(pcPageComponents));
		}
		const pokemonViewCmponents = await StorageController.getPokemonViewMessage(targetUser, pokemonId);

		return await interaction.reply(createEphemeralMessage(pokemonViewCmponents));
	}

	@Slash({ description: "Add a pokemon to an user's PC" })
	async add(
		@SlashOption({
			name: "pokemon-name-or-id",
			description: "Pokemon's name or id",
			required: true,
			type: ApplicationCommandOptionType.String,
		})
		pokemonNameOrId: string,
		@SlashOption({
			name: "user",
			description: "User to add the pokemon",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		user: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(pokemonNameOrId.toLowerCase());
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${lowerCaseURLEncodedPokemonName}`, () =>
			getPokemonDetails(lowerCaseURLEncodedPokemonName),
		).catch((error) => {
			if (error.response?.status !== 404) {
				console.error(
					`An error occured during fetch of to-be-stored pokemon ${pokemon.id}(#${pokemon.pokeAPIId})`,
					error,
				);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		const pokemons = DATA_SOURCE.getRepository(Pokemon);

		const pokemon = pokemons.create({
			pokeAPIId: pokemonDetails.id,
			storedBy: targetUser.id,
			health: pokemonDetails.stats.find((stat) => stat.name === "HP")?.stat ?? 0,
			attack: pokemonDetails.stats.find((stat) => stat.name === "Attack")?.stat ?? 0,
			defense: pokemonDetails.stats.find((stat) => stat.name === "Defense")?.stat ?? 0,
			specialAttack: pokemonDetails.stats.find((stat) => stat.name === "Special-attack")?.stat ?? 0,
			specialDefense: pokemonDetails.stats.find((stat) => stat.name === "Special-defense")?.stat ?? 0,
			speed: pokemonDetails.stats.find((stat) => stat.name === "Speed")?.stat ?? 0,
		});
		await pokemons.save(pokemon);
		await invalidateCache(`pc:max-page:${targetUser.id}`);

		await interaction.reply(
			createEphemeralContentMessage(
				`Pokemon ${pokemonDetails.name} (#${pokemonDetails.id}) successfully added to **${targetUser.displayName}**'s PC`,
			),
		);
	}

	@Slash({ description: "Remove a pokemon from an user's PC" })
	async remove(
		@SlashOption({
			name: "pokemon-id",
			description: "Pokemon's PC id",
			required: true,
			type: ApplicationCommandOptionType.Integer,
		})
		pokemonPCId: number,
		@SlashOption({
			name: "user",
			description: "User to remove the pokemon",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		user: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;
		const pokemons = DATA_SOURCE.getRepository(Pokemon);

		const pokemon = await pokemons.findOneBy({ id: pokemonPCId, storedBy: targetUser.id });
		if (!pokemon)
			return await interaction.reply(
				createContentMessage(`Pokemon #${pokemonPCId} not found in **${targetUser.displayName}**'s PC`),
			);

		await pokemons.remove(pokemon);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await interaction.reply(
			createContentMessage(`Pokemon #${pokemonPCId} successfully removed from **${targetUser.displayName}**'s PC`),
		);
	}
}
