import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { MINECRAFT_CACHE_TTL, MINECRAFT_HOSTNAME_REGEX, MINECRAFT_IP_ADDRESS_REGEX } from './constants';
import { status } from './protocols/minecraft';
import { distributedCache } from './helpers/distributed-cache';

export async function handleGetMinecraftServerStatus(ctx: Context, address?: string) {
	if (!address) {
		throw new HTTPException(400, { message: 'Minecraft server address not provided.' });
	}

	if (!MINECRAFT_IP_ADDRESS_REGEX.test(address) && !MINECRAFT_HOSTNAME_REGEX.test(address)) {
		throw new HTTPException(400, { message: 'Invalid Minecraft server address.' });
	}

	const cacheKey = `minecraft:${address}`;
	const serverStatus = await distributedCache(ctx, cacheKey, MINECRAFT_CACHE_TTL, () => status(address, true));
	if (serverStatus.error) {
		throw new HTTPException(400, { message: serverStatus.error });
	}

	ctx.header('Cache-Control', 'public, max-age=60');
	return ctx.json(serverStatus);
}
