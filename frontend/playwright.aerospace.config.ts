import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
 ...base,
 testIgnore: [],
 testMatch: '**/aerospace.spec.ts',
 use: {...base.use,baseURL:'http://127.0.0.1:5182'},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5182 --strictPort',url:'http://127.0.0.1:5182',reuseExistingServer:false,env:{VITE_WS_URL:'ws://127.0.0.1:5199/ws'}},
});
