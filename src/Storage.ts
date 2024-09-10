import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	EmbedBuilder,
	type MessageActionRowComponentBuilder,
	type User,
} from "discord.js";
import {
	ButtonComponent,
	Discord,
	Slash,
	SlashGroup,
	SlashOption,
} from "discordx";
import { getCachedByIdOrCacheResult, invalidateCache } from "./Cache.js";
import { CONFIGURATION } from "./Configuration.js";
import DATA_SOURCE from "./Database.js";
import { getPokemonDetails } from "./PokeAPI.js";
import Pokemon from "./entities/Pokemon.js";
import {
	POKEMON_MAX_STAT_VALUE,
	POKEMON_STAT_PROGRESS_BAR_SIZE,
} from "./helpers/constants.js";
import {
	createEmptyPCMessage,
	createPCPageMessage,
	createPCPageNotFoundMessage,
} from "./helpers/ui.js";

@Discord()
@SlashGroup({ name: "pc", description: "PC commands" })
@SlashGroup({ name: "storage", description: "Storage commands", root: "pc" })
@SlashGroup("storage", "pc")
export class Storage {
	public static async getDatabasePokemonDetails(storedPokemon: Pokemon) {
		const pokemonDetails = await getCachedByIdOrCacheResult(
			`pokemon:${storedPokemon.pokeAPIId.toString()}`,
			() => getPokemonDetails(storedPokemon.pokeAPIId.toString()),
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

		if (pokemonDetails === "unknown" || pokemonDetails === "error")
			return {
				...storedPokemon,
				error: pokemonDetails,
			};
		return {
			...storedPokemon,
			name: pokemonDetails.name,
		};
	}

	static async getPCMaxPage(targetUser: User) {
		return getCachedByIdOrCacheResult(
			`pc:max-page:${targetUser.id}`,
			async () => {
				const pokemons = DATA_SOURCE.getRepository(Pokemon);
				const count = await pokemons.count({
					where: { storedBy: targetUser.id },
				});
				return Math.ceil(count / CONFIGURATION.storage.pokemonsPerPage);
			},
		);
	}

	static async getPCPageComponents(targetUser: User, pageNumber: number) {
		const pcPagePokemons = await Storage.getPCPagePokemons(
			targetUser,
			pageNumber,
		);
		const maxPage = await Storage.getPCMaxPage(targetUser);
		if (maxPage === 0) return createEmptyPCMessage(targetUser);
		if (pageNumber > maxPage) return createPCPageNotFoundMessage(pageNumber);
		return createPCPageMessage(targetUser, pageNumber, maxPage, pcPagePokemons);
	}

	static async getPCPagePokemons(
		targetUser: User,
		pageNumber: number,
	): Promise<
		Array<Pokemon & ({ error: "unknown" | "error" } | { name: string })>
	> {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const targetUsersPokemons = await pokemons.find({
			where: { storedBy: targetUser.id },
			skip: pageNumber
				? (pageNumber - 1) * CONFIGURATION.storage.pokemonsPerPage
				: 0,
			take: CONFIGURATION.storage.pokemonsPerPage,
			order: { id: "asc" },
		});

		if (targetUsersPokemons.length === 0) return [];

		return await Promise.all(
			targetUsersPokemons.map(Storage.getDatabasePokemonDetails),
		);
	}

	static async getPokemonViewComponents(targetUser: User, pokemonId: number) {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const pokemon = await pokemons.findOne({
			where: [
				{ id: pokemonId, storedBy: targetUser.id },
				{ id: pokemonId, heldBy: targetUser.id },
			],
		});
		if (!pokemon)
			return {
				content: `Pokemon #${pokemonId} not found in **${targetUser.displayName}**'s PC`,
				ephemeral: true,
			};

		const pokemonDetails = await getCachedByIdOrCacheResult(
			`pokemon:${pokemon.pokeAPIId}`,
			() => getPokemonDetails(pokemon.pokeAPIId.toString()),
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
			return { content: `Pokemon #${pokemon.pokeAPIId} not found` };
		// noinspection JSUnusedLocalSymbols: level is destructured to allow the configuration to use it and to be evaluated
		const {
			level,
			health,
			attack,
			defense,
			specialAttack,
			specialDefense,
			speed,
		} = pokemon;
		const stats = [
			health,
			attack,
			defense,
			specialAttack,
			specialDefense,
			speed,
		];
		return {
			content: "",
			embeds: [
				new EmbedBuilder()
					.setTitle(
						`${pokemonDetails.name} (No. ${pokemon.id}/#${pokemon.pokeAPIId})`,
					)
					// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
					.setDescription(`Level: ${pokemon.level} (${pokemon.experience}/${eval(CONFIGURATION.leveling.experiencePerLevel)})
					${pokemonDetails.stats
						.map(
							({ name }, index) =>
								`**${name}** (${stats[index]})\n\`${"#".repeat((stats[index] / POKEMON_MAX_STAT_VALUE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}${"-".repeat(POKEMON_STAT_PROGRESS_BAR_SIZE - (stats[index] / POKEMON_MAX_STAT_VALUE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}\``,
						)
						.join("\n")}`),
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>({
					components: [
						new ButtonBuilder()
							.setLabel("Refresh")
							.setEmoji("🔃")
							.setStyle(ButtonStyle.Secondary)
							.setCustomId(`pokemon-view-${pokemon.id}-${targetUser.id}`),
					],
				}),
			],
		};
	}

	@ButtonComponent({ id: /pokemon-view-\d+-\d+/ })
	async viewPokemon(interaction: ButtonInteraction) {
		const [pokemonId, userId] = interaction.customId.split("-").slice(2);
		const targetUser = await interaction.client.users.fetch(userId);
		if (!targetUser)
			return await interaction.reply({
				content: "User not found",
				ephemeral: true,
			});
		const pokemonViewComponents = await Storage.getPokemonViewComponents(
			targetUser,
			Number.parseInt(pokemonId),
		);

		await interaction.update(pokemonViewComponents);
	}

	@ButtonComponent({ id: /pc-page-\d+-\d+/ })
	async viewPCPage(interaction: ButtonInteraction) {
		const [pageNumber, userId] = interaction.customId.split("-").slice(2);
		const targetUser = await interaction.client.users.fetch(userId);
		if (!targetUser)
			return await interaction.reply({
				content: "User not found",
				ephemeral: true,
			});
		const pcPageComponents = await Storage.getPCPageComponents(
			targetUser,
			Number.parseInt(pageNumber),
		);

		await interaction.update(pcPageComponents);
	}

	@Slash({
		description:
			"View an user's PC stored specific pokemon or list of pokemons",
	})
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
			const pcPageComponents = await Storage.getPCPageComponents(
				targetUser,
				pageNumber ?? 1,
			);

			return await interaction.reply({ ephemeral: true, ...pcPageComponents });
		}
		console.log(JSON.stringify(pokemonId));
		const pokemonViewCmponents = await Storage.getPokemonViewComponents(
			targetUser,
			pokemonId,
		);

		return await interaction.reply({
			ephemeral: true,
			...pokemonViewCmponents,
		});
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
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(
			pokemonNameOrId.toLowerCase(),
		);
		const pokemonDetails = await getCachedByIdOrCacheResult(
			`pokemon:${lowerCaseURLEncodedPokemonName}`,
			() => getPokemonDetails(lowerCaseURLEncodedPokemonName),
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

		if (pokemonDetails === "unknown")
			return await interaction.reply("Unknown pokemon");
		if (pokemonDetails === "error")
			return await interaction.reply("An error occurred");
		const pokemons = DATA_SOURCE.getRepository(Pokemon);

		const pokemon = pokemons.create({
			pokeAPIId: pokemonDetails.id,
			storedBy: targetUser.id,
			health:
				pokemonDetails.stats.find((stat) => stat.name === "HP")?.stat ?? 0,
			attack:
				pokemonDetails.stats.find((stat) => stat.name === "Attack")?.stat ?? 0,
			defense:
				pokemonDetails.stats.find((stat) => stat.name === "Defense")?.stat ?? 0,
			specialAttack:
				pokemonDetails.stats.find((stat) => stat.name === "Special-attack")
					?.stat ?? 0,
			specialDefense:
				pokemonDetails.stats.find((stat) => stat.name === "Special-defense")
					?.stat ?? 0,
			speed:
				pokemonDetails.stats.find((stat) => stat.name === "Speed")?.stat ?? 0,
		});
		await pokemons.save(pokemon);
		await invalidateCache(`pc:max-page:${targetUser.id}`);

		await interaction.reply({
			content: `Pokemon ${pokemonDetails.name} (#${pokemonDetails.id}) successfully added to **${targetUser.displayName}**'s PC`,
			ephemeral: true,
		});
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

		const pokemon = await pokemons.findOneBy({
			id: pokemonPCId,
			storedBy: targetUser.id,
		});
		if (!pokemon) {
			await interaction.reply({
				content: `Pokemon #${pokemonPCId} not found in **${targetUser.displayName}**'s PC`,
				ephemeral: true,
			});
			return;
		}

		await pokemons.remove(pokemon);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await interaction.reply({
			content: `Pokemon #${pokemonPCId} successfully removed from **${targetUser.displayName}**'s PC`,
			ephemeral: true,
		});
	}
}
