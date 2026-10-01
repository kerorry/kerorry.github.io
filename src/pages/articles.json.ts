import type { APIRoute } from 'astro';
import articles from '../data/articles.json';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(articles), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });