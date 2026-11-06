import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/gateway',workers:1,retries:0,reporter:'list',use:{baseURL:'http://127.0.0.1:3106',trace:'retain-on-failure'},webServer:{command:'node scripts/test-gateway-server.mjs',url:'http://127.0.0.1:3106/privacy',reuseExistingServer:false,timeout:120000}});
