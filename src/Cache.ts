import { Redis } from 'ioredis'

const REDIS_INSTANCE = new Redis({
	keyPrefix: "eedb:",
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT as unknown as number,
});

export async function getCachedByIdOrCacheResult<T>(
	key: string,
	fetcherFunction: () => Promise<T>,
): Promise<T> {
	const cachedResult = await REDIS_INSTANCE.get(key);

	if (cachedResult) return JSON.parse(cachedResult);

	const result = await fetcherFunction();
	await REDIS_INSTANCE.setex(
		key,
		60 * 60 * 24 * 7 /* One week */,
		JSON.stringify(result),
	);
	return result;
}
