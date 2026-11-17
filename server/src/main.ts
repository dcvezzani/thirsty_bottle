import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify();
await app.register(fastifyStatic, { root: path.resolve(here, '../../client/dist') });
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
console.log('listening');
