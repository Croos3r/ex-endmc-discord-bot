import { ActivityType, type GuildMember, type Message, type User } from "discord.js";
import { getCachedValue, isDelayKeyActive, setCachedValue, setDelayKey } from "../cache.service.js";
import { CONFIGURATION, type Multiplier } from "../configuration.service.js";

export async function getCurrentMultiplierForTrainer(trainer: User) {
	return getCachedValue<number>(`experience:multiplier:${trainer.id}`);
}

export async function applyMultiplier(trainer: User, multiplier: Multiplier) {
	if (await isDelayKeyActive(`experience:multiplier:delay:${trainer.id}`)) return false;

	await addMultiplier(trainer, multiplier);
	setTimeout(() => removeMultiplier(trainer, multiplier), multiplier.multiplierDuration * 1000);
	if (multiplier.cooldownDuration !== 0)
		await setDelayKey(`experience:multiplier:delay:${trainer.id}`, multiplier.cooldownDuration);
	return true;
}

export async function addMultiplier(trainer: User, multiplier: Multiplier) {
	const currentMultiplier = await getCurrentMultiplierForTrainer(trainer);

	await setCachedValue(`experience:multiplier:${trainer.id}`, (currentMultiplier ?? 1) * multiplier.multiplier);
}

export async function removeMultiplier(trainer: User, multiplier: Multiplier) {
	const currentMultiplier = await getCurrentMultiplierForTrainer(trainer);
	if (!currentMultiplier) return await setCachedValue(`experience:multiplier:${trainer.id}`, 1);

	await setCachedValue(`experience:multiplier:${trainer.id}`, currentMultiplier / multiplier.multiplier);
}

export async function applyMessageMultipliers(message: Message) {
	const multipliers = getMultipliersForType("message");
	const applyableMultipliers = multipliers.filter(({ messageText }) =>
		message.content.toLowerCase().includes(messageText.toLowerCase()),
	);

	await applyMultipliers(message.author, applyableMultipliers);
}

export async function applyStatusMultiplierAfterRequiredDelay(trainer: GuildMember, status: string) {
	const multipliers = getMultipliersForType("status");

	multipliers
		.filter(({ statusText }) => status.toLowerCase().includes(statusText.toLowerCase()))
		.map((multiplier) => {
			return setTimeout(async () => {
				const newTrainer = await trainer.fetch();

				const status = newTrainer.presence?.activities.find(({ type }) => type === ActivityType.Custom)?.state;
				if (status?.toLowerCase().includes(multiplier.statusText.toLowerCase()))
					await applyMultiplier(newTrainer.user, multiplier);
			}, multiplier.requiredMinStatusDuration * 1000);
		});
}

export async function applyMultipliers(trainer: User, multipliers: Array<Multiplier>) {
	await Promise.all(multipliers.map((multiplier) => applyMultiplier(trainer, multiplier)));
}

export function getMultipliersForType<T extends Multiplier["type"]>(
	multiplierType: T,
): Array<Multiplier & { type: T }> {
	return Object.keys(CONFIGURATION.leveling.multipliers)
		.map((key) => CONFIGURATION.leveling.multipliers[key])
		.filter(({ type }) => multiplierType === type) as unknown as Array<Multiplier & { type: T }>;
}
