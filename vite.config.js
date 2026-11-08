import { defineConfig } from 'vite';

// One file a Laravel app loads as is: nothing external, no Node on the app's side.
export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'es2022',
        cssCodeSplit: false,
        lib: {
            entry: 'resources/js/aparte.js',
            formats: ['es'],
            fileName: () => 'aparte.js',
            cssFileName: 'aparte',
        },
        rollupOptions: {
            output: { inlineDynamicImports: true },
        },
    },
});
