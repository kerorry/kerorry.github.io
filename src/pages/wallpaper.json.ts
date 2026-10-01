import type { APIRoute } from 'astro';
import wallpapers from '../data/wallpapers.json';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(wallpapers), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });