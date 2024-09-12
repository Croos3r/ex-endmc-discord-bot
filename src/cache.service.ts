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

export async function setDelayKey(key: string, expireInSeconds: number) {
	await REDIS_INSTANCE.setex(key, expireInSeconds, "");
}

export async function isDelayKeyActive(key: string): Promise<boolean> {
	return !!(await REDIS_INSTANCE.exists(key));
}
