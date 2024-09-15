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
	expireInSeconds?: number,
): Promise<T> {
	const cachedResult = await REDIS_INSTANCE.get(key);

	if (cachedResult) {
		if (expireInSeconds !== undefined) await REDIS_INSTANCE.expire(key, expireInSeconds);
		return JSON.parse(cachedResult);
	}

	const result = await fetcherFunction();
	if (expireInSeconds === undefined) await REDIS_INSTANCE.set(key, JSON.stringify(result));
	else await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(result));
	return result;
}

export async function setCachedValueIfNotExists(key: string, value: unknown, expireInSeconds?: number): Promise<void> {
	if (await REDIS_INSTANCE.exists(key)) return;

	if (expireInSeconds === undefined) await REDIS_INSTANCE.set(key, JSON.stringify(value));
	else await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(value));
}

export async function setCachedValue(key: string, value: unknown, expireInSeconds?: number): Promise<void> {
	if (expireInSeconds === undefined) await REDIS_INSTANCE.set(key, JSON.stringify(value));
	else await REDIS_INSTANCE.setex(key, expireInSeconds, JSON.stringify(value));
}

export async function getCachedValuesByPattern<T>(pattern: string): Promise<Array<{ key: string; value: T | null }>> {
	const keys = await REDIS_INSTANCE.keys(pattern);
	return await Promise.all(keys.map(async (key) => ({ key, value: await getCachedValue<T>(key) })));
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
