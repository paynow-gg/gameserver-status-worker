import { Context, Hono } from 'hono';
import { handleGetMinecraftServerStatus } from './routes';

const app = new Hono();

app.get('/', (c: Context) => {
	const version = c.env.CF_VERSION_METADATA;
	return c.text(`PayNow Gameserver Status Worker - build ${version.tag || version.id} (${version.timestamp || 'build time unknown'})`);
});
app.get('/minecraft/:address', (c: Context) => handleGetMinecraftServerStatus(c, c.req.param('address')));
app.get('/a2s', (c: Context) => {
	return c.text('todo');
});

export default app;
