import { Redis } from "ioredis";

const REDIS_INSTANCE = new Redis({
	keyPrefix: "eedb:",
	host: process.env.REDIS_HOST,
	port: Number.parseInt(process.env.REDIS_PORT),
});

export async function invalidateCache(key: string): Promise<void> {
	await REDIS_INSTANCE.del(key);
}

export async function getCachedByIdOrCacheResult<T>(
	key: string,
	fetcherFunction: () => Promise<T>,
	expireInSeconds = 60 * 60 * 24 * 7, // One week
): Promise<T> {
	const cachedResult = await REDIS_INSTANCE.get(key);

	if (cachedResult) {
		await REDIS_INSTANCE.expire(key, expireInSeconds);
		return JSON.parse(cachedResult);
	}

	const result = await fetcherFunction();
	await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(result));
	return result;
}

export async function setCachedValueIfNotExists(
	key: string,
	value: unknown,
	expireInSeconds = 60 * 60 * 24 * 7, // One week
): Promise<void> {
	if (await REDIS_INSTANCE.exists(key)) return;
	await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(value));
}

export async function setCachedValue(key: string, value: unknown, expireInSeconds = 60 * 60 * 24 * 7): Promise<void> {
	await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(value));
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
	const cachedResult = await REDIS_INSTANCE.get(key);
	return cachedResult ? JSON.parse(cachedResult) : null;
}

export async function setDelayKey(key: string, expireInSeconds: number) {
	await REDIS_INSTANCE.setex(key, expireInSeconds, "");
}

export async function isDelayKeyActive(key: string): Promise<boolean> {
	return !!(await REDIS_INSTANCE.exists(key));
}
