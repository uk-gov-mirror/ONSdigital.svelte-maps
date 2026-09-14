import { mount, hydrate } from 'svelte';
import App from './App.svelte';
import config from '../config.json';

const app = config.hydrate
	? hydrate(App, { target: document.body })
	: mount(App, { target: document.body });

export default app;
