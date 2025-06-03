import { Context } from 'hono';
import { matchCache, putCache } from './local-cache';

export async function distributedCache<T>(ctx: Context, cacheKey: string, cacheTtl: number, fetchFunc: () => Promise<T>): Promise<T> {
	// First, let's hit the Cloudflare Cache API (this saves us money on KV lookups, it's a local datacenter cache)
	const statusCached = await matchCache(cacheKey);
	if (statusCached) {
		return await statusCached.json();
	}

	const statusKV = await ctx.env.gameserver_status_servers.get(cacheKey, {
		cacheTtl: cacheTtl,
	});

	// Not in cache, but retrieved from KV - cache it
	if (statusKV) {
		ctx.executionCtx.waitUntil(putCache(ctx, cacheKey, cacheTtl, statusKV));
		return statusKV;
	}

	// And even if KV does not have this, fetch the actual func
	let response;
	try {
		response = await fetchFunc();
	} catch (err) {
		response = { error: err.message } as T;
	}

	const promisesToWaitFor = Promise.all([
		ctx.env.gameserver_status_servers.put(cacheKey, JSON.stringify(response), {
			expirationTtl: cacheTtl,
		}),
		putCache(ctx, cacheKey, cacheTtl, response),
	]);

	ctx.executionCtx.waitUntil(promisesToWaitFor);
	return response;
}
