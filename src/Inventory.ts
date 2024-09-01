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
} from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { getCachedByIdOrCacheResult, invalidateCache } from './Cache.js'
import DATA_SOURCE from './Database.js'
import { Storage } from './Storage.js'
import Pokemon from './entities/Pokemon.js'

@Discord()
@SlashGroup({
	name: "inventory",
	description: "Inventory commands",
	root: "pc",
})
@SlashGroup("inventory", "pc")
export class Inventory {
	static async isInventoryFull(targetUser: User) {
		return await getCachedByIdOrCacheResult(`inventory:full:${targetUser.id}`, async () => {
			const pokemons = DATA_SOURCE.getRepository(Pokemon)
			return await pokemons.count({where: {heldBy: targetUser.id}}) >= 3
		})
	}

	static async getInventoryComponents(targetUser: User) {
		const [a, b, c] = await Inventory.getInventoryPokemons(targetUser)
		const refreshButton = new ActionRowBuilder<MessageActionRowComponentBuilder>({
			components: [
				new ButtonBuilder().setLabel('Refresh').setEmoji("🔃").setStyle(ButtonStyle.Secondary).setCustomId(`inventory-refresh-${targetUser.id}`),
			]
		})
		if (!a && !b && !c)
			return {
				content: `${targetUser.displayName}'s inventory is empty.\n Use \`/pc inventory add\` to add pokemons`,
				components: [
					refreshButton
				]
			}
		return {
			content: "",
			embeds: [
				new EmbedBuilder()
					.setTitle(`${targetUser.displayName}'s Inventory`)
					.addFields(await Promise.all([a, b, c].map(async (pokemon, index) => {
						if (pokemon && "error" in pokemon) {
							if (pokemon.error === 'unknown')
								return {
									name: `Slot ${index + 1}`,
									value: `Unknown Pokemon #${pokemon.pokeAPIId}`,
								}
							return {
								name: `Slot ${index + 1}`,
								value: `Error fetching Pokemon #${pokemon.pokeAPIId}`,
							}
						}
						return {
							name: `Slot ${index + 1}`,
							value: pokemon ? `${pokemon.id}. ${pokemon.name} (#${pokemon.pokeAPIId})` : 'Empty',
						}
					})))
			],
			components: [
				refreshButton
			]
		}
	}

	static async getInventoryPokemons(targetUser: User) {
		const pokemons = DATA_SOURCE.getRepository(Pokemon)
		const targetUsersInventoryPokemons = await pokemons.find({ where: { heldBy: targetUser.id }, take: 3 })
		if (targetUsersInventoryPokemons.length === 0) return []

		return await Promise.all(targetUsersInventoryPokemons.map(Storage.getDatabasePokemonDetails))
	}

	@ButtonComponent({id: /inventory-refresh-\d+/})
	async refreshInventoryButton(interaction: ButtonInteraction) {
		await interaction.update({ ...await Inventory.getInventoryComponents(interaction.user) })
	}

	@Slash({ description: "View your inventory" })
	async view(
		@SlashOption({name: "user", description: "User to view the inventory of", required: false, type: ApplicationCommandOptionType.User})
			user: User | null,
		interaction: CommandInteraction
	) {
		const targetUser = user ?? interaction.user
		await interaction.reply({ephemeral: true, ...await Inventory.getInventoryComponents(targetUser)})
	}

	@Slash({ description: "Add a pokemon to your inventory" })
	async add(
		@SlashOption({name: "stored-pokemon-id", description: "Stored ID of the Pokemon to add to the inventory", required: true, type: ApplicationCommandOptionType.Number})
			pokemon: number,
		@SlashOption({name: "user", description: "User to add the pokemon to", required: false, type: ApplicationCommandOptionType.User})
			user: User | null,
		interaction: CommandInteraction
	) {
		const targetUser = user ?? interaction.user
		const pokemons = DATA_SOURCE.getRepository(Pokemon)
		const pokemonToTransfer = await pokemons.findOne({ where: { id: pokemon, storedBy: targetUser.id } })

		if (!pokemonToTransfer)
			return await interaction.reply({ephemeral: true, content: `Pokemon not found in ${targetUser.displayName}'s PC`})
		if (await Inventory.isInventoryFull(targetUser))
			return await interaction.reply({ephemeral: true, content: "Your inventory is full"})
		pokemonToTransfer.heldBy = targetUser.id
		pokemonToTransfer.storedBy = null
		await pokemons.save(pokemonToTransfer)
		await invalidateCache(`pc:max-page:${targetUser.id}`)
		await invalidateCache(`inventory:full:${targetUser.id}`)
		const pokemonDetails = await Storage.getDatabasePokemonDetails(pokemonToTransfer)
		await interaction.reply({ephemeral: true, content: `Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) added to your inventory`})
	}

	@Slash({ description: "Remove a pokemon from your inventory" })
	async remove(
		@SlashOption({name: "held-pokemon-id", description: "Held ID of the Pokemon to remove from the inventory", required: true, type: ApplicationCommandOptionType.Number})
			pokemon: number,
		@SlashOption({name: "user", description: "User to remove the pokemon from", required: false, type: ApplicationCommandOptionType.User})
			user: User | null,
		interaction: CommandInteraction
	) {
		const targetUser = user ?? interaction.user
		const pokemons = DATA_SOURCE.getRepository(Pokemon)
		const pokemonToTransfer = await pokemons.findOne({ where: { id: pokemon, heldBy: targetUser.id } })

		if (!pokemonToTransfer)
			return await interaction.reply({ephemeral: true, content: `Pokemon not found in ${targetUser.displayName}'s inventory`})
		pokemonToTransfer.heldBy = null
		pokemonToTransfer.storedBy = targetUser.id
		await pokemons.save(pokemonToTransfer)
		await invalidateCache(`pc:max-page:${targetUser.id}`)
		await invalidateCache(`inventory:full:${targetUser.id}`)
		const pokemonDetails = await Storage.getDatabasePokemonDetails(pokemonToTransfer)
		await interaction.reply({ephemeral: true, content: `Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) removed from your inventory`})
	}
}
