import { Context } from 'hono';
import { WORKER_CACHE_HOSTNAME } from '../constants';

export async function matchCache(cacheKey: string) {
	return await caches.default.match(
		new Request(`${WORKER_CACHE_HOSTNAME}/${cacheKey}`, {
			method: 'GET',
			headers: new Headers(),
			cf: {
				cacheEverything: true,
			},
		}),
	);
}

export function putCache(ctx: Context, cacheKey: string, cacheTtl: number, data: any): Promise<void> {
	let response = new Response(JSON.stringify(data));

	if (!response.ok) return;

	response = response.clone();
	response = new Response(response.body, response);

	const expires = new Date(new Date().getTime() + cacheTtl * 1000);

	response.headers.set('Content-Type', 'application/json');
	response.headers.set('Cache-Control', `public, maxage=${cacheTtl}`);
	response.headers.set('Expires', expires.toUTCString());

	return caches.default.put(
		new Request(`${WORKER_CACHE_HOSTNAME}/${cacheKey}`, {
			method: 'GET',
			headers: new Headers(),
			cf: {
				cacheEverything: true,
			},
		}),
		response,
	);
}
